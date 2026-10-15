/**
 * Safely parses a value to float, returning a fallback (default 0) if the result is NaN.
 */
export function safeParseFloat(value: unknown, fallback = 0): number {
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}
