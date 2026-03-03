import { beforeEach, describe, expect, it, vi } from "vitest";

const signInMock = vi.fn();
const signOutMock = vi.fn();
const redirectMock = vi.fn();

const dbSelectMock = vi.fn();
const dbUpdateMock = vi.fn();

const hashPasswordMock = vi.fn();
const isEmailConfiguredMock = vi.fn();
const sendEmailMock = vi.fn();
const createResetTokenMock = vi.fn();
const validateResetTokenMock = vi.fn();
const consumeResetTokenMock = vi.fn();
const invalidateUserTokensMock = vi.fn();
const renderResetPasswordEmailMock = vi.fn();
const renderWelcomeEmailMock = vi.fn();
const loggerErrorMock = vi.fn();

const usersMock = {
  id: "users.id",
  email: "users.email",
  password: "users.password",
};

vi.mock("@/auth", () => ({
  signIn: signInMock,
  signOut: signOutMock,
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbSelectMock,
    update: dbUpdateMock,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: usersMock,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/auth/registration-mode", () => ({
  isRegistrationOpen: vi.fn(),
}));

vi.mock("@/lib/email/transporter", () => ({
  isEmailConfigured: isEmailConfiguredMock,
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/auth/reset-token", () => ({
  createResetToken: createResetTokenMock,
  validateResetToken: validateResetTokenMock,
  consumeResetToken: consumeResetTokenMock,
  invalidateUserTokens: invalidateUserTokensMock,
}));

vi.mock("@/emails", () => ({
  renderResetPasswordEmail: renderResetPasswordEmailMock,
  renderWelcomeEmail: renderWelcomeEmailMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
}));

function setSelectResult(value: unknown) {
  const limitMock = vi.fn().mockResolvedValue(value);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  dbSelectMock.mockReturnValueOnce({ from: fromMock });
}

function setPasswordUpdateSuccess() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  dbUpdateMock.mockReturnValueOnce({ set: setMock });
}

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("auth actions password reset flows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isEmailConfiguredMock.mockReturnValue(true);
    createResetTokenMock.mockResolvedValue("token-raw");
    renderResetPasswordEmailMock.mockResolvedValue({
      subject: "Reset",
      html: "<p>reset</p>",
      text: "reset",
    });
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("forgotPasswordAction returns identical success message for existing and non-existing emails", async () => {
    const { forgotPasswordAction } = await import("./auth-actions");

    setSelectResult([{ id: "user-1", email: "known@example.com" }]);
    const existingResult = await forgotPasswordAction(
      {},
      buildFormData({ email: "known@example.com" })
    );

    setSelectResult([]);
    const missingResult = await forgotPasswordAction(
      {},
      buildFormData({ email: "missing@example.com" })
    );

    expect(existingResult).toEqual({
      success: true,
      message: "If an account exists with this email, you will receive a reset link.",
    });
    expect(missingResult).toEqual(existingResult);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("resetPasswordAction rejects mismatched passwords", async () => {
    const { resetPasswordAction } = await import("./auth-actions");

    const result = await resetPasswordAction(
      {},
      buildFormData({ token: "token-1", password: "Password1", confirmPassword: "Password2" })
    );

    expect(result).toEqual({ fieldErrors: { confirmPassword: "Passwords do not match" } });
    expect(validateResetTokenMock).not.toHaveBeenCalled();
  });

  it("resetPasswordAction rejects weak passwords by length and number requirements", async () => {
    const { resetPasswordAction } = await import("./auth-actions");

    const tooShort = await resetPasswordAction(
      {},
      buildFormData({ token: "token-1", password: "Abc123", confirmPassword: "Abc123" })
    );
    const missingNumber = await resetPasswordAction(
      {},
      buildFormData({ token: "token-2", password: "NoNumbers", confirmPassword: "NoNumbers" })
    );

    expect(tooShort).toEqual({
      fieldErrors: { password: "Password must be at least 8 characters" },
    });
    expect(missingNumber).toEqual({
      fieldErrors: { password: "Password must contain at least one number" },
    });
    expect(validateResetTokenMock).not.toHaveBeenCalled();
  });

  it("resetPasswordAction returns an error for invalid token", async () => {
    const { resetPasswordAction } = await import("./auth-actions");
    validateResetTokenMock.mockResolvedValue({ valid: false });

    const result = await resetPasswordAction(
      {},
      buildFormData({ token: "bad-token", password: "Password1", confirmPassword: "Password1" })
    );

    expect(result).toEqual({
      error: "This reset link is invalid or has expired. Please request a new one.",
    });
    expect(hashPasswordMock).not.toHaveBeenCalled();
  });

  it("resetPasswordAction success path hashes, updates, consumes token, and invalidates tokens", async () => {
    const { resetPasswordAction } = await import("./auth-actions");
    validateResetTokenMock.mockResolvedValue({
      valid: true,
      userId: "user-1",
      tokenId: "token-id-1",
    });
    hashPasswordMock.mockResolvedValue("hashed-password");
    setPasswordUpdateSuccess();
    consumeResetTokenMock.mockResolvedValue(undefined);
    invalidateUserTokensMock.mockResolvedValue(undefined);

    const result = await resetPasswordAction(
      {},
      buildFormData({ token: "good-token", password: "Password1", confirmPassword: "Password1" })
    );

    expect(result).toEqual({ success: true });
    expect(hashPasswordMock).toHaveBeenCalledWith("Password1");
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(consumeResetTokenMock).toHaveBeenCalledWith("token-id-1");
    expect(invalidateUserTokensMock).toHaveBeenCalledWith("user-1");

    const hashOrder = hashPasswordMock.mock.invocationCallOrder[0];
    const updateOrder = dbUpdateMock.mock.invocationCallOrder[0];
    const consumeOrder = consumeResetTokenMock.mock.invocationCallOrder[0];
    const invalidateOrder = invalidateUserTokensMock.mock.invocationCallOrder[0];
    expect(hashOrder).toBeLessThan(updateOrder);
    expect(updateOrder).toBeLessThan(consumeOrder);
    expect(consumeOrder).toBeLessThan(invalidateOrder);
  });
});
