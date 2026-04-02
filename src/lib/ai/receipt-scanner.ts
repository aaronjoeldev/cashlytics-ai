import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { ReceiptScanResult } from "@/types/receipt";

const receiptSchema = z.object({
  merchant: z.string().nullable().describe("Name des Händlers/Geschäfts"),
  amount: z.number().nullable().describe("Gesamtbetrag inkl. MwSt"),
  date: z.string().nullable().describe("Kaufdatum als YYYY-MM-DD"),
  currency: z.enum(["EUR", "USD", "GBP", "CHF", "DKK"]).nullable().describe("Währungscode als ISO-4217: EUR, USD, GBP, CHF oder DKK. Falls nicht erkennbar: null."),
  description: z.string().nullable().describe("Kurze Beschreibung was gekauft wurde"),
  suggestedCategoryName: z
    .string()
    .nullable()
    .describe("Passende Kategorie aus der Liste des Nutzers, oder null"),
  confidence: z.enum(["high", "medium", "low"]).describe("Konfidenz der Extraktion"),
});

export async function scanReceipt(
  fileBase64: string,
  mediaType: "image/jpeg" | "image/jpg" | "image/png",
  userCategories: string[]
): Promise<ReceiptScanResult> {
  const categoryList =
    userCategories.length > 0 ? userCategories.join(", ") : "keine Kategorien vorhanden";

  const systemPrompt = `Du bist ein Spezialist für das Auslesen von Kassenbons und Rechnungen.
Extrahiere alle relevanten Daten präzise und strukturiert.
Für das Datum: Nutze immer das Kaufdatum (nicht Druckdatum), Format YYYY-MM-DD.
Für amount: Immer der finale Gesamtbetrag (inkl. MwSt/Steuer).
Für currency: Gib den ISO-4217-Code zurück (EUR, USD, GBP, CHF oder DKK). Falls keine Währung erkennbar ist oder die Währung nicht in dieser Liste ist: null.
Für suggestedCategoryName: Wähle die am besten passende aus dieser Liste: ${categoryList}. Wenn keine passt oder die Liste leer ist, null.
Für confidence: "high" wenn alle Kernfelder (merchant, amount, date) klar lesbar sind, "medium" wenn 1-2 Felder unsicher, "low" wenn Beleg sehr schlecht lesbar.`;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: receiptSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: Buffer.from(fileBase64, "base64"),
            mediaType,
          },
          {
            type: "text",
            text: "Analysiere diesen Kassenbon/diese Rechnung und extrahiere alle Daten.",
          },
        ],
      },
    ],
  });

  return object;
}
