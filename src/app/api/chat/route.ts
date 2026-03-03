import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { tools } from "@/lib/ai/tools";
import { getAccounts } from "@/actions/account-actions";
import { getCategories } from "@/actions/category-actions";
import { getExpenses } from "@/actions/expense-actions";
import { rateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { auth } from "@/auth";
import { recordAssistantUsageEvent } from "@/lib/ai/metering";
import { getAiBlockedErrorPayload } from "@/lib/billing/ai-entitlement";

const MAX_MESSAGES = 100;
const CHAT_MODEL = "gpt-4o";

function extractTokenUsage(usage: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  const value = usage as {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  };

  const promptTokens = value.inputTokens ?? value.promptTokens ?? 0;
  const completionTokens = value.outputTokens ?? value.completionTokens ?? 0;
  const totalTokens = value.totalTokens ?? promptTokens + completionTokens;

  if (
    !Number.isInteger(promptTokens) ||
    !Number.isInteger(completionTokens) ||
    !Number.isInteger(totalTokens)
  ) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  if (promptTokens < 0 || completionTokens < 0 || totalTokens < 0) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

/**
 * Strips characters that could break LLM prompt structure or enable injection attacks.
 */
function sanitizeForPrompt(str: string): string {
  return str
    .replace(/`{1,3}/g, "")
    .replace(/"{3}/g, "")
    .replace(/'{3}/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\[INST\]/gi, "")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/s>/gi, "")
    .replace(/\[\/INST\]/gi, "")
    .trim();
}

const BASE_SYSTEM_PROMPT = `Du bist der Finanz-Assistent von Cashlytics - einer persönlichen Budget-App.

## STRENGE EINSCHRÄNKUNG

Du darfst NUR bei diesen Themen helfen:
- Ausgaben erfassen, anzeigen, bearbeiten
- Einnahmen verwalten
- Konten und Kontostände
- Budget-Analysen und -Prognosen
- Kategorien verwalten
- Sparen und Finanzplanung

Bei ALLEN anderen Anfragen (Wetter, Kochen, Programmieren, Sport, Musik, etc.) antworte EXAKT so:

"Ich kann dir nur bei Finanzfragen helfen. Möchtest du eine Ausgabe erfassen oder dein Budget prüfen?"

Rufe NIEMALS Tools für nicht-finanzielle Anfragen auf.

## AUSGABE-TYPEN

- Täglich/Einmalig (Einkaufen, Tanken, Restaurant, einmalige Zahlungen) → createDailyExpense
- Wirklich wiederkehrend (Miete, Abo, Versicherung, Gehalt) → createExpense mit recurrenceType

## KATEGORIEN-PFLICHT

Für ALLE Ausgaben (createDailyExpense und createExpense) MUSS eine Kategorie vergeben werden.

Vorgehensweise wenn der Benutzer keine Kategorie nennt:
1. Wähle die passendste Kategorie aus dem Kontext basierend auf der Beschreibung (z.B. "Tanken" → "Auto", "REWE" → "Lebensmittel")
2. Frage den Benutzer ZUERST per Text: "Soll ich das unter der Kategorie **[Kategoriename]** einordnen?" – BEVOR du das Tool aufrufst
3. Erst wenn der Benutzer zustimmt oder eine andere Kategorie wählt, rufe das Tool mit der bestätigten categoryId auf
4. Falls keine passende Kategorie im Kontext vorhanden ist: Frage ob du eine neue Kategorie anlegen soll, und rufe zuerst createCategory auf

Für Einnahmen (createIncome) ist keine Kategorie nötig – die Quelle (source) reicht aus.

## ⚠️ KRITISCH: AUSGABEN ERSTELLEN

Nutze die Konto-IDs und Kategorie-IDs aus dem KONTEXT-ABSCHNITT unten direkt.
Rufe getAccounts() oder getCategories() NICHT auf, außer der Kontext ist leer.

Wenn eine passende Kategorie im Kontext vorhanden ist → direkt verwenden.
Wenn keine passende Kategorie vorhanden ist → createCategory aufrufen, dann weiter.

BEISPIEL für "Ich habe 30€ getankt":
→ Passende Kategorie aus Kontext ermitteln (z.B. "Auto/Transport")
→ Benutzer fragen: "Soll ich das unter der Kategorie **Auto/Transport** einordnen?"
→ Nach Bestätigung: createDailyExpense({ accountId: "abc-123", categoryId: "cat-456", description: "Tanken", amount: 30, date: "HEUTE" })

## DATUM-REGELN

- "heute", "gerade", "jetzt" → Datum aus KONTEXT unten verwenden
- "gestern" → Datum minus 1 Tag
- Kein Datum genannt → heutiges Datum verwenden

## TOOL-WAHL FÜR ABFRAGEN

- "Wie hoch sind meine Einnahmen?" → getIncomes (ohne Filter)
- "Wie viel Geld habe ich diesen Monat?" → getMonthlyOverview mit aktuellem Monat/Jahr aus Kontext
- "Wie viel ausgegeben?" → getMonthlyOverview
- "Alle Konten zeigen" → Kontext-Abschnitt direkt nutzen, kein Tool nötig

## DOKUMENTE

Du hast keinen Zugriff auf hochgeladene Dokumente der Nutzer (Belege, Rechnungen, Kontoauszüge etc.).
Diese Dateien werden dir bewusst NICHT bereitgestellt, da sie sensible persönliche Daten enthalten können.
Weise den Nutzer freundlich darauf hin, falls er dich bittet, ein Dokument zu lesen oder zu verarbeiten.

## VERHALTEN

1. Sprache: Deutsch, kurz und prägnant
2. Fehler: Freundlich erklären, Alternativen anbieten
3. Proaktiv: Bei Ausgaben-Erwähnung sofort das passende Tool aufrufen und dem Benutzer zur Bestätigung vorlegen
4. Bestätigung: Alle Schreib-Operationen (erstellen, ändern, löschen) erfordern eine Bestätigung durch den Benutzer – rufe das Tool auf und warte auf die Genehmigung
5. Nach Genehmigung: Kurz bestätigen was durchgeführt wurde
6. Bei Ablehnung: Akzeptiere die Entscheidung und biete ggf. Alternativen an`;

async function buildSystemPrompt(): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isoDate = today.toISOString().split("T")[0];
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const [accountsResult, categoriesResult, expensesResult] = await Promise.all([
    getAccounts(),
    getCategories(),
    getExpenses(),
  ]);

  const accountsContext =
    accountsResult.success && accountsResult.data.length > 0
      ? accountsResult.data
          .map(
            (a) =>
              `  - "${sanitizeForPrompt(a.name)}" | Typ: ${sanitizeForPrompt(a.type)} | Stand: ${a.balance} ${sanitizeForPrompt(a.currency)} | ID: ${a.id}`
          )
          .join("\n")
      : "  (Keine Konten vorhanden – zuerst createAccount aufrufen)";

  const categoriesContext =
    categoriesResult.success && categoriesResult.data.length > 0
      ? categoriesResult.data
          .map((c) => `  - "${sanitizeForPrompt(c.name)}" ${c.icon ?? ""} | ID: ${c.id}`)
          .join("\n")
      : "  (Keine Kategorien vorhanden)";

  const expensesContext =
    expensesResult.success && expensesResult.data.length > 0
      ? expensesResult.data
          .map((e) => {
            const cat = e.category?.name ? ` [${sanitizeForPrompt(e.category.name)}]` : "";
            const start = new Date(e.startDate).toLocaleDateString("de-DE");
            const end = e.endDate ? ` bis ${new Date(e.endDate).toLocaleDateString("de-DE")}` : "";
            return `  - "${sanitizeForPrompt(e.name)}"${cat} | ${e.amount}€ | ${e.recurrenceType} | ab ${start}${end} | ID: ${e.id}`;
          })
          .join("\n")
      : "  (Keine periodischen Ausgaben vorhanden)";

  return `${BASE_SYSTEM_PROMPT}

## AKTUELLER KONTEXT

Heutiges Datum: ${dateStr} (ISO: ${isoDate})
Aktueller Monat: ${currentMonth}, Jahr: ${currentYear}

### Verfügbare Konten:
${accountsContext}

### Verfügbare Kategorien:
${categoriesContext}

### Bestehende periodische Ausgaben (für Updates/Löschungen direkt ID verwenden, kein getExpenses nötig):
${expensesContext}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;

  // Rate limiting: 20 requests per minute per IP
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "local";
  const rl = rateLimit(`chat:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warte einen Moment." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSecs) },
    });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Ungültiger JSON-Body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body || typeof body !== "object" || !("messages" in body)) {
      return new Response(
        JSON.stringify({ error: 'Fehlende "messages"-Eigenschaft im Request-Body.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, conversationId, requestId } = body as {
      messages: unknown;
      conversationId?: unknown;
      requestId?: unknown;
    };

    const safeConversationId = typeof conversationId === "string" ? conversationId : null;
    const safeRequestId =
      typeof requestId === "string"
        ? requestId
        : (req.headers.get("x-request-id") ?? crypto.randomUUID());

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: '"messages" muss ein nicht-leeres Array sein.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: `Zu viele Nachrichten. Maximum: ${MAX_MESSAGES}.` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== "object" || !("role" in msg)) {
        return new Response(JSON.stringify({ error: `Nachricht ${i} fehlt "role".` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const validatedMessages = messages as UIMessage[];

    const blockedPayload = await getAiBlockedErrorPayload(userId);
    if (blockedPayload) {
      return new Response(JSON.stringify(blockedPayload), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = await buildSystemPrompt();

    const result = streamText({
      model: openai(CHAT_MODEL),
      system: systemPrompt,
      messages: await convertToModelMessages(validatedMessages, {
        ignoreIncompleteToolCalls: true,
      }),
      tools,
      stopWhen: stepCountIs(10),
      toolChoice: "auto",
      onFinish: async ({ usage }) => {
        const tokenUsage = extractTokenUsage(usage);
        try {
          await recordAssistantUsageEvent({
            userId,
            model: CHAT_MODEL,
            promptTokens: tokenUsage.promptTokens,
            completionTokens: tokenUsage.completionTokens,
            totalTokens: tokenUsage.totalTokens,
            conversationId: safeConversationId,
            requestId: safeRequestId,
          });
        } catch (meteringError) {
          logger.error(
            "Failed to persist AI usage event",
            "POST /api/chat metering",
            meteringError
          );
        }
      },
      onStepFinish: ({ toolCalls, toolResults, finishReason }) => {
        if (process.env.NODE_ENV === "development") {
          console.log(`[AI Step] finish=${finishReason}`);
          if (toolCalls?.length) {
            for (const call of toolCalls) {
              console.log(`  → Tool: ${call.toolName}`, JSON.stringify(call.input).slice(0, 200));
            }
          }
          if (toolResults?.length) {
            for (const result of toolResults) {
              const preview = JSON.stringify(result.output).slice(0, 300);
              console.log(`  ← Result: ${preview}`);
            }
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    logger.error("Chat API error", "POST /api/chat", error);
    return new Response(
      JSON.stringify({ error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
