import { z } from "zod";

export const MAX_PASSWORD_LENGTH = 100;

/** Validation messages are keys of the `auth.errors` translations. */
export type AuthErrorKey =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordNeedsNumber"
  | "confirmRequired"
  | "passwordsDontMatch";

/** E-mail addresses are compared and stored in lower case. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "emailRequired")
  .email("emailInvalid");

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "passwordRequired")
    .min(8, "passwordTooShort")
    .max(MAX_PASSWORD_LENGTH, "passwordTooLong"),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, "passwordTooShort")
      .max(MAX_PASSWORD_LENGTH, "passwordTooLong")
      .regex(/\d/, "passwordNeedsNumber"),
    confirmPassword: z.string().min(1, "confirmRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordsDontMatch",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
