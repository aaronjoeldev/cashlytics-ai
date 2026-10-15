/** German titles of the assistant tools that change data; shared by the approval card and history. */
export const MUTATING_TOOL_TITLES: Record<string, string> = {
  createAccount: "Neues Konto erstellen",
  updateAccount: "Konto aktualisieren",
  deleteAccount: "Konto löschen",
  createExpense: "Wiederkehrende Ausgabe erstellen",
  updateExpense: "Wiederkehrende Ausgabe aktualisieren",
  deleteExpense: "Wiederkehrende Ausgabe löschen",
  createDailyExpense: "Ausgabe erfassen",
  updateDailyExpense: "Ausgabe aktualisieren",
  deleteDailyExpense: "Ausgabe löschen",
  createIncome: "Einnahme erfassen",
  updateIncome: "Einnahme aktualisieren",
  deleteIncome: "Einnahme löschen",
  createCategory: "Kategorie erstellen",
  createTransfer: "Transfer erstellen",
  markInsightRead: "Hinweis als gelesen markieren",
};

/** The fields of a tool UI part that the history summary needs. */
export type ToolActivityPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

function describeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const values = input as Record<string, unknown>;
  const name = values.description ?? values.name ?? values.source;
  const amount = values.amount;
  const parts = [
    typeof name === "string" ? name : null,
    typeof amount === "number" || typeof amount === "string" ? String(amount) : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

/**
 * One line per finished data-changing tool call, for storing the conversation as text:
 * "✓ Ausgabe erfassen (REWE, 45)", "✗ Abgelehnt: Konto löschen", "⚠ Fehlgeschlagen: …".
 * Read-only tools and calls still waiting for approval are left out.
 */
export function summarizeToolActivity(parts: ToolActivityPart[]): string {
  const lines: string[] = [];
  for (const part of parts) {
    if (!part.type.startsWith("tool-")) continue;
    const toolName = part.type.slice("tool-".length);
    const title = MUTATING_TOOL_TITLES[toolName];
    if (!title) continue;

    const details = describeInput(part.input);
    if (part.state === "output-denied") {
      lines.push(`✗ Abgelehnt: ${title}${details}`);
    } else if (part.state === "output-error") {
      lines.push(`⚠ Fehlgeschlagen: ${title}${details}`);
    } else if (part.state === "output-available") {
      // The actions report failures as { success: false } instead of throwing
      const failed =
        typeof part.output === "object" &&
        part.output !== null &&
        (part.output as { success?: unknown }).success === false;
      lines.push(failed ? `⚠ Fehlgeschlagen: ${title}${details}` : `✓ ${title}${details}`);
    }
  }
  return lines.join("\n");
}
