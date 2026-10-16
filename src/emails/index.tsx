import { render } from "@react-email/render";
import * as React from "react";
import { ResetPasswordEmail } from "./reset-password";
import { WelcomeEmail } from "./welcome";

/**
 * Renders the reset password email in both HTML and plaintext formats.
 *
 * @param resetUrl - Full URL for password reset including token
 * @returns Object containing html, text, and subject for sending
 */
export async function renderResetPasswordEmail(resetUrl: string) {
  const component = <ResetPasswordEmail resetUrl={resetUrl} expiresInHours={1} />;
  const [html, text] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ]);
  return { html, text, subject: "Reset Your Password" };
}

/**
 * Renders the welcome email in both HTML and plaintext formats.
 *
 * @param userName - Name of the newly registered user
 * @returns Object containing html, text, and subject for sending
 */
export async function renderWelcomeEmail(userName: string) {
  const component = <WelcomeEmail userName={userName} />;
  const [html, text] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ]);
  return { html, text, subject: "Welcome to Cashlytics" };
}
