"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { MAX_PASSWORD_LENGTH, emailSchema, registerSchema } from "@/lib/validations/auth";
import { markPasswordChanged } from "@/lib/auth/session-validity";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limiter";
import { isRegistrationOpen } from "@/lib/auth/registration-mode";
import { isEmailConfigured, sendEmail } from "@/lib/email/transporter";
import {
  createResetToken,
  validateResetToken,
  consumeResetToken,
  invalidateUserTokens,
} from "@/lib/auth/reset-token";
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

  // Best effort: behind a reverse proxy the last X-Forwarded-For entry is the address the proxy
  // saw. Without a proxy the header is client-controlled and this limit can be bypassed.
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const clientAddress = forwardedFor?.split(",").at(-1)?.trim() || "unknown";
  if (!rateLimit(`register:${clientAddress}`, 5, 60 * 60_000).allowed) {
    return { error: "Too many registration attempts. Please try again later." };
  }

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

  const emailTakenError = { fieldErrors: { email: "An account with this email already exists" } };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing) {
    return emailTakenError;
  }

  const hashedPassword = await hashPassword(password);
  // A concurrent registration with the same address loses on a unique index (email or lower(email))
  const [created] = await db
    .insert(users)
    .values({ email, password: hashedPassword })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!created) {
    return emailTakenError;
  }

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
  email: emailSchema,
});

const passwordResetRequestMessage =
  "If an account exists with this email, you will receive a reset link.";

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

  // Limit reset mails per address; the response stays identical so nothing is revealed
  if (!rateLimit(`forgot-password:${email}`, 3, 60 * 60_000).allowed) {
    return { success: true, message: passwordResetRequestMessage };
  }

  // Look up user by email
  let user: { id: string; email: string } | undefined;
  try {
    [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      // Same account as the login picks when two differ only in case
      .orderBy(users.createdAt)
      .limit(1);
  } catch (error) {
    logger.error("Failed to look up user for password reset", "auth", error);
    return {
      success: true,
      message: passwordResetRequestMessage,
    };
  }

  // Only send email if user exists AND SMTP is configured
  if (user && isEmailConfigured()) {
    try {
      // Generate reset token
      const rawToken = await createResetToken(user.id);

      // Build reset URL
      const resetUrl = `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;

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
    message: passwordResetRequestMessage,
  };
}

const invalidResetLinkMessage =
  "This reset link is invalid or has expired. Please request a new one.";

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof token !== "string" || !token) {
    return { error: invalidResetLinkMessage };
  }
  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    return { fieldErrors: { password: "Password must be at least 8 characters" } };
  }

  // Validate password match
  if (password !== confirmPassword) {
    return { fieldErrors: { confirmPassword: "Passwords do not match" } };
  }

  // Validate password strength (min 8 chars, contains number)
  if (password.length < 8) {
    return { fieldErrors: { password: "Password must be at least 8 characters" } };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { fieldErrors: { password: "Password is too long" } };
  }

  if (!/\d/.test(password)) {
    return { fieldErrors: { password: "Password must contain at least one number" } };
  }

  // Validate token
  const validation = await validateResetToken(token);
  if (!validation.valid) {
    return { error: invalidResetLinkMessage };
  }

  // Hash new password
  const hashedPassword = await hashPassword(password);

  // Mark the token as used first; only the request that wins this update may set the password
  if (!(await consumeResetToken(validation.tokenId))) {
    return { error: invalidResetLinkMessage };
  }

  // Update user password. Whole seconds, so a sign-in right after the reset is not rejected.
  const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  await db
    .update(users)
    .set({ password: hashedPassword, passwordChangedAt })
    .where(eq(users.id, validation.userId));
  // Ends every session that was signed in before this moment
  markPasswordChanged(validation.userId, passwordChangedAt);

  // Invalidate all other tokens for this user
  await invalidateUserTokens(validation.userId);

  return { success: true };
}
