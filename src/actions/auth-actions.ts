"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validations/auth";
import { isRegistrationOpen } from "@/lib/auth/registration-mode";
import { isEmailConfigured, sendEmail } from "@/lib/email/transporter";
import {
  createResetToken,
  validateResetToken,
  consumeResetToken,
  invalidateUserTokens,
} from "@/lib/auth/reset-token";
import { initializeTrialForUser } from "@/lib/billing/trial";
import { renderResetPasswordEmail, renderWelcomeEmail } from "@/emails";
import { logger } from "@/lib/logger";
import { z } from "zod";

export type AuthActionState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
};

export type ForgotPasswordState = {
  success?: boolean;
  message?: string;
  error?: string;
};

export type ResetPasswordState = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    password?: string;
    confirmPassword?: string;
  };
};

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  let shouldRedirect = false;
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    shouldRedirect = true;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }
  if (shouldRedirect) redirect("/");
  return {};
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // --- SINGLE_USER_MODE GATE ---
  const registrationOpen = await isRegistrationOpen();
  if (!registrationOpen) {
    return {
      error: "Registration is disabled. This instance is configured for a single user.",
    };
  }
  // --- END MODE GATE ---

  const result = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    const fieldErrors: AuthActionState["fieldErrors"] = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof NonNullable<typeof fieldErrors>;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const { email, password } = result.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const hashedPassword = await hashPassword(password);
  const registrationTimestamp = new Date();
  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      password: hashedPassword,
      createdAt: registrationTimestamp,
    })
    .returning({ id: users.id });

  await initializeTrialForUser(createdUser.id, registrationTimestamp);

  // Send welcome email (non-blocking, failures ignored)
  if (isEmailConfigured()) {
    const userName = email.split("@")[0];
    renderWelcomeEmail(userName)
      .then(({ html, text, subject }) => sendEmail({ to: email, subject, html, text }))
      .catch((error) => {
        logger.error("Failed to send welcome email", "auth", error);
      });
  }

  // Auto-login after registration, then redirect manually
  let shouldRedirect = false;
  try {
    await signIn("credentials", { email, password, redirect: false });
    shouldRedirect = true;
  } catch (error) {
    if (error instanceof AuthError) {
      // Account created but auto-login failed — redirect to login page
      redirect("/login");
    }
    throw error;
  }
  if (shouldRedirect) redirect("/");
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  // Validate email format
  const result = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!result.success) {
    const fieldError = result.error.issues[0]?.message;
    return { error: fieldError };
  }

  const { email } = result.data;

  // Look up user by email
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Only send email if user exists AND SMTP is configured
  if (user && isEmailConfigured()) {
    try {
      // Generate reset token
      const rawToken = await createResetToken(user.id);

      // Build reset URL
      const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;

      // Render email
      const { html, text, subject } = await renderResetPasswordEmail(resetUrl);

      // Send email
      await sendEmail({ to: user.email, subject, html, text });
    } catch (error) {
      // Log errors but don't reveal to user
      logger.error("Failed to send password reset email", "auth", error);
    }
  }

  // ALWAYS return identical message regardless of user existence
  return {
    success: true,
    message: "If an account exists with this email, you will receive a reset link.",
  };
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validate password match
  if (password !== confirmPassword) {
    return { fieldErrors: { confirmPassword: "Passwords do not match" } };
  }

  // Validate password strength (min 8 chars, contains number)
  if (password.length < 8) {
    return { fieldErrors: { password: "Password must be at least 8 characters" } };
  }

  if (!/\d/.test(password)) {
    return { fieldErrors: { password: "Password must contain at least one number" } };
  }

  // Validate token
  const validation = await validateResetToken(token);
  if (!validation.valid) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  // Hash new password
  const hashedPassword = await hashPassword(password);

  // Update user password
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, validation.userId));

  // Mark token as used
  await consumeResetToken(validation.tokenId);

  // Invalidate all other tokens for this user
  await invalidateUserTokens(validation.userId);

  return { success: true };
}
