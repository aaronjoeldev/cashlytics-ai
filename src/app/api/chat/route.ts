import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { tools } from '@/lib/ai/tools';
import { getAccounts } from '@/actions/account-actions';
import { getCategories } from '@/actions/category-actions';
import { getExpenses } from '@/actions/expense-actions';

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

## ⚠️ KRITISCH: AUSGABEN ERSTELLEN

Nutze die Konto-IDs und Kategorie-IDs aus dem KONTEXT-ABSCHNITT unten direkt.
Rufe getAccounts() oder getCategories() NICHT auf, außer der Kontext ist leer.

Wenn eine passende Kategorie im Kontext vorhanden ist → direkt verwenden.
Wenn keine passende Kategorie vorhanden ist → createCategory aufrufen, dann weiter.

BEISPIEL für "Ich habe 30€ getankt":
→ Passendes Konto aus Kontext nehmen (z.B. Girokonto, id: "abc-123")
→ Passende Kategorie aus Kontext nehmen (z.B. Auto/Transport)
→ createDailyExpense({ accountId: "abc-123", categoryId: "cat-456", description: "Tanken", amount: 30, date: "HEUTE" })

## DATUM-REGELN

- "heute", "gerade", "jetzt" → Datum aus KONTEXT unten verwenden
- "gestern" → Datum minus 1 Tag
- Kein Datum genannt → heutiges Datum verwenden

## TOOL-WAHL FÜR ABFRAGEN

- "Wie hoch sind meine Einnahmen?" → getIncomes (ohne Filter)
- "Wie viel Geld habe ich diesen Monat?" → getMonthlyOverview mit aktuellem Monat/Jahr aus Kontext
- "Wie viel ausgegeben?" → getMonthlyOverview
- "Alle Konten zeigen" → Kontext-Abschnitt direkt nutzen, kein Tool nötig

## VERHALTEN

1. Sprache: Deutsch, kurz und prägnant
2. Fehler: Freundlich erklären, Alternativen anbieten
3. Proaktiv: Bei Ausgaben-Erwähnung sofort erstellen
4. Nach Anlegen: Kurz bestätigen was erstellt wurde`;

async function buildSystemPrompt(): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const isoDate = today.toISOString().split('T')[0];
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
          .map((a) => `  - "${a.name}" | Typ: ${a.type} | Stand: ${a.balance} ${a.currency} | ID: ${a.id}`)
          .join('\n')
      : '  (Keine Konten vorhanden – zuerst createAccount aufrufen)';

  const categoriesContext =
    categoriesResult.success && categoriesResult.data.length > 0
      ? categoriesResult.data
          .map((c) => `  - "${c.name}" ${c.icon ?? ''} | ID: ${c.id}`)
          .join('\n')
      : '  (Keine Kategorien vorhanden)';

  const expensesContext =
    expensesResult.success && expensesResult.data.length > 0
      ? expensesResult.data
          .map((e) => {
            const cat = e.category?.name ? ` [${e.category.name}]` : '';
            const start = new Date(e.startDate).toLocaleDateString('de-DE');
            const end = e.endDate ? ` bis ${new Date(e.endDate).toLocaleDateString('de-DE')}` : '';
            return `  - "${e.name}"${cat} | ${e.amount}€ | ${e.recurrenceType} | ab ${start}${end} | ID: ${e.id}`;
          })
          .join('\n')
      : '  (Keine periodischen Ausgaben vorhanden)';

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
  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };

    const systemPrompt = await buildSystemPrompt();

    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(10),
      toolChoice: 'auto',
      onStepFinish: ({ toolCalls, toolResults, finishReason }) => {
        if (process.env.NODE_ENV === 'development') {
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
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
