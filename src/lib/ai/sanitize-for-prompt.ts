/**
 * Sanitizer for untrusted text (bank descriptions from CSV imports, receipt OCR, user-chosen
 * names, insight texts) before it is placed into an LLM prompt. The result is always a single
 * line, so the text cannot fake new prompt sections or roles.
 */

export const MAX_PROMPT_FIELD_LENGTH = 200;

// C0/C1 control characters (incl. \t \r \n), line/paragraph separators, zero-width characters,
// bidi controls, BOM, soft hyphen and Unicode tag characters.
const INVISIBLE_OR_CONTROL =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]|\uDB40[\uDC00-\uDC7F]/g;

export function sanitizeForPrompt(input: unknown, maxLength = MAX_PROMPT_FIELD_LENGTH): string {
  if (input === null || input === undefined) return "";

  let s = String(input)
    .normalize("NFKC")
    .replace(INVISIBLE_OR_CONTROL, " ")
    // Quotes would end the quoted data field in the prompt
    .replace(/["“”„‟«»]/g, "'")
    .replace(/`+/g, "")
    .replace(/'{3,}/g, "'")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\[\/?INST\]/gi, "")
    .replace(/\[\/?SYS\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Markdown structure that could fake headings, rules or lists at the start of the field
  s = s.replace(/^(?:[#>*=_~-]\s*)+/, "").replace(/(?:^|\s)#{2,}(?=\s|$)/g, " ");
  s = s
    .replace(/-{3,}|={3,}|_{3,}|\*{3,}|~{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (s.length > maxLength) {
    s = `${s.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }
  return s;
}
