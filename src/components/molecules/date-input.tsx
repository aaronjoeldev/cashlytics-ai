"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/**
 * Dates are stored as the UTC midnight of a calendar day (see src/lib/recurrence.ts), so the
 * input shows and returns the UTC calendar day. Older rows that carry a time of day show the day
 * of their UTC timestamp.
 */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
}

type DateInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: Date | string | null | undefined;
  onChange: (value: Date | null) => void;
};

/**
 * Controlled date field. `<input type="date">` cannot display a `Date` object, which is why
 * `register(..., { valueAsDate: true })` with a `Date` default rendered an empty field.
 */
export function DateInput({ value, onChange, ...props }: DateInputProps) {
  return (
    <Input
      {...props}
      type="date"
      value={toDateInputValue(value)}
      onChange={(event) => onChange(fromDateInputValue(event.target.value))}
    />
  );
}
