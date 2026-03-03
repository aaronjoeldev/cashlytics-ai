type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  error?: unknown;
  timestamp: string;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeStr =
      cause instanceof Error
        ? ` | cause=${cause.name}: ${cause.message}`
        : cause !== undefined
          ? ` | cause=${String(cause)}`
          : "";
    return `${error.name}: ${error.message}${causeStr}`;
  }
  return String(error);
}

function log(level: LogLevel, message: string, context?: string, error?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    ...(context ? { context } : {}),
    ...(error !== undefined ? { error: formatError(error) } : {}),
    timestamp: new Date().toISOString(),
  };

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]${context ? ` [${context}]` : ""}`;
  const errorSuffix = error !== undefined ? ` | error=${formatError(error)}` : "";
  const line = `${prefix} ${message}${errorSuffix}`;

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") {
        console.debug(line);
      }
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: string) => log("debug", message, context),
  info: (message: string, context?: string) => log("info", message, context),
  warn: (message: string, context?: string) => log("warn", message, context),
  error: (message: string, context?: string, error?: unknown) =>
    log("error", message, context, error),
};
