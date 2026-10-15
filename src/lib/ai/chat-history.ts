import { isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { summarizeToolActivity } from "@/lib/ai/tool-labels";

export function textOf(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

/**
 * The messages of one finished turn that still have to be stored: the user message that started
 * it and the assistant text, with a line per data-changing tool call. Returns null while a tool
 * call still waits for approval; the turn is stored once the approval round has finished.
 */
export function collectTurnToSave(
  message: UIMessage,
  messages: UIMessage[],
  savedIds: ReadonlySet<string>
): { user: UIMessage | null; assistantIds: string[]; assistantContent: string } | null {
  const waitsForApproval = message.parts.some(
    (part) => isToolUIPart(part) && part.state === "approval-requested"
  );
  if (waitsForApproval) return null;

  const end = messages.findIndex((m) => m.id === message.id);
  const turn = end === -1 ? [message] : messages.slice(0, end + 1);
  const userIndex = turn.findLastIndex((m) => m.role === "user");
  const user = userIndex === -1 ? null : turn[userIndex];
  // Every assistant message since the user message that is not stored yet
  const assistants = turn
    .slice(userIndex + 1)
    .filter((m) => m.role === "assistant" && !savedIds.has(m.id));
  const assistantContent = assistants
    .map((m) => [textOf(m), summarizeToolActivity(m.parts)].filter(Boolean).join("\n\n"))
    .filter(Boolean)
    .join("\n\n");

  return {
    user: user && !savedIds.has(user.id) ? user : null,
    assistantIds: assistants.map((m) => m.id),
    assistantContent,
  };
}
