import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/lib/logger";
import type { SendEmailOptions, SendEmailResult } from "./types";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

let transporter: Transporter | null = null;
let configChecked = false;
let isConfigured = false;
let fromAddress: string = "";

function getSmtpConfig(): SmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  const port = parseInt(SMTP_PORT, 10);
  if (isNaN(port)) {
    logger.warn("SMTP_PORT is not a valid number", "email");
    return null;
  }

  return {
    host: SMTP_HOST,
    port,
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: SMTP_FROM || SMTP_USER,
  };
}

function isSendmailConfigured(): boolean {
  const { EMAIL_TRANSPORT } = process.env;
  if (EMAIL_TRANSPORT === "sendmail") {
    return true;
  }
  return false;
}

export function isEmailConfigured(): boolean {
  if (!configChecked) {
    configChecked = true;

    if (isSendmailConfigured()) {
      isConfigured = true;
      fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@localhost";
      logger.info("Using sendmail for email delivery", "email");
    } else {
      const config = getSmtpConfig();
      isConfigured = config !== null;
      if (config) {
        fromAddress = config.from;
      }
    }
  }
  return isConfigured;
}

function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  if (isSendmailConfigured()) {
    transporter = nodemailer.createTransport({
      sendmail: true,
      newline: "unix",
      path: "/usr/sbin/sendmail",
    });
    return transporter;
  }

  const config = getSmtpConfig();
  if (!config) {
    logger.warn("SMTP not configured - email features disabled", "email");
    return null;
  }

  const isImplicitTls = config.port === 465;
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: isImplicitTls,
    requireTLS: !isImplicitTls,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return transporter;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    logger.info("Email not sent (not configured)", "email");
    return { success: false, error: "EMAIL_NOT_CONFIGURED" };
  }

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return { success: false, error: "TRANSPORTER_UNAVAILABLE" };
  }

  try {
    await mailTransporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    logger.info("Email sent", "email");
    return { success: true };
  } catch (error) {
    logger.error("Email send failed", "email", error);
    return { success: false, error: "SEND_FAILED" };
  }
}
