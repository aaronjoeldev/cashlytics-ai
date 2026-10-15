import { and, eq } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { db } from "@/lib/db";
import {
  buildCsvReconciliationPrompt,
  parseAndValidateCsvReconciliationOutput,
} from "@/lib/ai/csv-reconciliation";
import { logger } from "@/lib/logger";
import {
  dailyExpenses,
  importConflicts,
  importRows,
  importSessions,
  incomes,
} from "@/lib/db/schema";

export type ImportConflictSuggestion =
  "keep_both" | "replace_existing" | "skip_import_row" | "needs_user_review";

export type ImportConflictDecisionOption = "replace_existing" | "keep_both" | "skip_import_row";

export type ReconciliationSession = {
  id: string;
  userId: string;
  accountId: string;
};

export type ReconciliationStagedRow = {
  id: string;
  userId: string;
  rowIndex: number;
  bookingDate: Date | null;
  amount: string;
  description: string;
  excludedByUser: boolean;
};

export type ReconciliationManualTransaction = {
  id: string;
  userId: string;
  accountId: string | null;
  type: "income" | "expense";
  date: Date;
  amount: string;
  description: string;
};

export type NearMatchInput = {
  rows: ReconciliationStagedRow[];
  existingTransactions: ReconciliationManualTransaction[];
};

export type NearMatchResult = {
  decisions: NearMatchDecision[];
  /** Rows that could not be checked, for example because the AI call failed */
  uncheckedRowCount: number;
};

export type NearMatchDecision = {
  importRowId: string;
  matchedTransactionId: string;
  confidence: number;
  similarityScore?: number;
  explanation: string;
  suggestion?: ImportConflictSuggestion;
};

export type ImportConflictCandidate = {
  importRowId: string;
  existingTransactionId: string;
  existingTransactionType: "income" | "expense";
  matchStrategy: "exact" | "ai_near";
  similarityScore: number;
  confidence: number;
  explanation: string;
  suggestion: ImportConflictSuggestion;
  resolutionOptions: ImportConflictDecisionOption[];
};

export type StagedConflictCandidateRecord = {
  userId: string;
  sessionId: string;
  importRowId: string;
  existingExpenseId: string | null;
  existingIncomeId: string | null;
  similarityScore: string | null;
  confidence: string | null;
  explanation: string;
  suggestion: ImportConflictSuggestion;
};

type ReconciliationStore = {
  getSession(userId: string, sessionId: string): Promise<ReconciliationSession | null>;
  getStagedRows(userId: string, sessionId: string): Promise<ReconciliationStagedRow[]>;
  getManualTransactions(
    userId: string,
    accountId: string
  ): Promise<ReconciliationManualTransaction[]>;
  replaceConflicts(
    userId: string,
    sessionId: string,
    conflicts: StagedConflictCandidateRecord[]
  ): Promise<void>;
};

export type ImportReconciliationEngineDeps = {
  store: ReconciliationStore;
  resolveNearMatches?: (input: NearMatchInput) => Promise<NearMatchResult>;
};

export type ImportReconciliationInput = {
  userId: string;
  sessionId: string;
};

export type ImportReconciliationResult = {
  sessionId: string;
  exactMatchCount: number;
  nearMatchCount: number;
  conflictRows: number;
  /** Rows only checked for exact duplicates because the near-match check failed for them */
  uncheckedRowCount: number;
  candidates: ImportConflictCandidate[];
};

type AiNearMatchResolverDeps = {
  runReconciliationPrompt?: (prompt: string) => Promise<string>;
};

/** Rows per AI call; keeps the prompt and the JSON answer well inside the model limits */
export const NEAR_MATCH_BATCH_SIZE = 40;
/** Existing entries further away from every row in a batch are not sent to the AI */
const NEAR_MATCH_WINDOW_DAYS = 7;
const MAX_EXISTING_PER_BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_RESOLUTION_OPTIONS: ImportConflictDecisionOption[] = [
  "replace_existing",
  "keep_both",
  "skip_import_row",
];

function normalizeDescription(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function asDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseAmountToNumber(amount: string): number {
  const parsed = Number.parseFloat(amount);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return parsed;
}

function normalizeSignedAmount(amount: string): {
  direction: "income" | "expense";
  absolute: number;
} {
  const parsed = parseAmountToNumber(amount);
  return {
    direction: parsed >= 0 ? "income" : "expense",
    absolute: Math.abs(parsed),
  };
}

function toFixedDecimal(value: number): string {
  return value.toFixed(4);
}

function buildConflictCandidateRecord(
  userId: string,
  sessionId: string,
  candidate: ImportConflictCandidate
): StagedConflictCandidateRecord {
  return {
    userId,
    sessionId,
    importRowId: candidate.importRowId,
    existingExpenseId:
      candidate.existingTransactionType === "expense" ? candidate.existingTransactionId : null,
    existingIncomeId:
      candidate.existingTransactionType === "income" ? candidate.existingTransactionId : null,
    similarityScore: toFixedDecimal(candidate.similarityScore),
    confidence: toFixedDecimal(candidate.confidence),
    explanation: candidate.explanation,
    suggestion: candidate.suggestion,
  };
}

export function toStagedConflictCandidateRecord(input: {
  userId: string;
  sessionId: string;
  candidate: ImportConflictCandidate;
}): StagedConflictCandidateRecord {
  return buildConflictCandidateRecord(input.userId, input.sessionId, input.candidate);
}

function rowDirection(row: ReconciliationStagedRow): "income" | "expense" {
  return normalizeSignedAmount(row.amount).direction;
}

function pickDeterministicExactMatch(
  row: ReconciliationStagedRow,
  manualTransactions: ReconciliationManualTransaction[],
  claimedTransactionIds: Set<string>
): ReconciliationManualTransaction | null {
  if (!row.bookingDate) {
    return null;
  }

  const rowAmount = normalizeSignedAmount(row.amount);
  const rowDateKey = asDateKey(row.bookingDate);
  const rowDescription = normalizeDescription(row.description);

  const candidates = manualTransactions
    // Two identical CSV rows must not both be matched to the same existing entry
    .filter((transaction) => !claimedTransactionIds.has(transaction.id))
    .filter((transaction) => transaction.type === rowAmount.direction)
    .filter((transaction) => Number.parseFloat(transaction.amount) === rowAmount.absolute)
    .filter((transaction) => asDateKey(transaction.date) === rowDateKey)
    .filter((transaction) => normalizeDescription(transaction.description) === rowDescription)
    .sort((a, b) => a.id.localeCompare(b.id));

  return candidates[0] ?? null;
}

function createExactCandidate(
  row: ReconciliationStagedRow,
  transaction: ReconciliationManualTransaction
): ImportConflictCandidate {
  return {
    importRowId: row.id,
    existingTransactionId: transaction.id,
    existingTransactionType: transaction.type,
    matchStrategy: "exact",
    similarityScore: 1,
    confidence: 1,
    explanation: "Exact duplicate by transaction type, booking date, amount, and description.",
    suggestion: "replace_existing",
    resolutionOptions: [...DEFAULT_RESOLUTION_OPTIONS],
  };
}

function toNearMatchCandidate(
  row: ReconciliationStagedRow,
  transaction: ReconciliationManualTransaction,
  nearMatch: NearMatchDecision
): ImportConflictCandidate {
  return {
    importRowId: row.id,
    existingTransactionId: transaction.id,
    existingTransactionType: transaction.type,
    matchStrategy: "ai_near",
    similarityScore: nearMatch.similarityScore ?? nearMatch.confidence,
    confidence: nearMatch.confidence,
    explanation: nearMatch.explanation,
    suggestion: nearMatch.suggestion ?? "needs_user_review",
    resolutionOptions: [...DEFAULT_RESOLUTION_OPTIONS],
  };
}

function mapConfidenceToSuggestion(confidence: number): ImportConflictSuggestion {
  return confidence >= 0.95 ? "replace_existing" : "needs_user_review";
}

export function createAiNearMatchResolver(deps: AiNearMatchResolverDeps = {}) {
  const runReconciliationPrompt =
    deps.runReconciliationPrompt ??
    (async (prompt: string) => {
      const result = await generateText({
        model: openai("gpt-4o"),
        prompt,
      });
      return result.text;
    });

  const resolveBatch = async (
    rows: ReconciliationStagedRow[],
    existingTransactions: ReconciliationManualTransaction[]
  ): Promise<NearMatchDecision[] | null> => {
    try {
      const prompt = buildCsvReconciliationPrompt({
        accountName: "CSV Import Account",
        rows: rows.map((row) => ({
          csvRowId: row.id,
          date: row.bookingDate ? asDateKey(row.bookingDate) : "unknown",
          amount: parseAmountToNumber(row.amount),
          description: row.description,
          currency: "UNKNOWN",
        })),
        existingTransactions: existingTransactions.map((transaction) => ({
          transactionId: transaction.id,
          date: asDateKey(transaction.date),
          amount: parseAmountToNumber(transaction.amount),
          description: transaction.description,
          type: transaction.type,
        })),
      });

      const parsed = parseAndValidateCsvReconciliationOutput(await runReconciliationPrompt(prompt));
      if (!parsed.success) {
        logger.warn(
          `AI near-match output rejected (${parsed.errorCode}): ${parsed.message}`,
          "createAiNearMatchResolver"
        );
        return null;
      }

      return parsed.data.decisions
        .filter((decision) => decision.action === "match_existing")
        .map((decision) => ({
          importRowId: decision.csvRowId,
          matchedTransactionId: decision.matchedTransactionId,
          confidence: decision.confidence,
          similarityScore: decision.confidence,
          explanation: decision.reason,
          suggestion: mapConfidenceToSuggestion(decision.confidence),
        }));
    } catch (error) {
      logger.error(
        "AI near-match resolution failed. Falling back to deterministic-only matching.",
        "createAiNearMatchResolver",
        error
      );
      return null;
    }
  };

  return async (input: NearMatchInput): Promise<NearMatchResult> => {
    if (input.rows.length === 0 || input.existingTransactions.length === 0) {
      return { decisions: [], uncheckedRowCount: 0 };
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return { decisions: [], uncheckedRowCount: input.rows.length };
    }

    const decisions: NearMatchDecision[] = [];
    let uncheckedRowCount = 0;

    for (let start = 0; start < input.rows.length; start += NEAR_MATCH_BATCH_SIZE) {
      const rows = input.rows.slice(start, start + NEAR_MATCH_BATCH_SIZE);
      const candidates = selectNearMatchCandidates(rows, input.existingTransactions);
      if (candidates.length === 0) {
        continue;
      }

      const batchDecisions = await resolveBatch(rows, candidates);
      if (batchDecisions === null) {
        uncheckedRowCount += rows.length;
      } else {
        decisions.push(...batchDecisions);
      }
    }

    return { decisions, uncheckedRowCount };
  };
}

/**
 * Existing entries worth comparing with a batch of rows: same direction as one of the rows and
 * within a week of its date, closest first.
 */
export function selectNearMatchCandidates(
  rows: ReconciliationStagedRow[],
  existingTransactions: ReconciliationManualTransaction[]
): ReconciliationManualTransaction[] {
  const rowKeys = rows
    .filter((row) => row.bookingDate)
    .map((row) => ({ direction: rowDirection(row), time: row.bookingDate!.getTime() }));

  return existingTransactions
    .map((transaction) => {
      const distances = rowKeys
        .filter((row) => row.direction === transaction.type)
        .map((row) => Math.abs(row.time - transaction.date.getTime()));
      return { transaction, distance: distances.length > 0 ? Math.min(...distances) : Infinity };
    })
    .filter(({ distance }) => distance <= NEAR_MATCH_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_EXISTING_PER_BATCH)
    .map(({ transaction }) => transaction);
}

export function createImportReconciliationEngine(deps: ImportReconciliationEngineDeps) {
  return {
    async detectAndStageConflicts(
      input: ImportReconciliationInput
    ): Promise<ImportReconciliationResult> {
      const session = await deps.store.getSession(input.userId, input.sessionId);
      if (!session) {
        throw new Error("Import session not found");
      }

      const stagedRows = (await deps.store.getStagedRows(input.userId, input.sessionId)).filter(
        (row) => !row.excludedByUser
      );
      const manualTransactions = (
        await deps.store.getManualTransactions(input.userId, session.accountId)
      ).filter((transaction) => transaction.userId === input.userId);

      const exactCandidates: ImportConflictCandidate[] = [];
      const unresolvedRows: ReconciliationStagedRow[] = [];
      // Each existing entry can be the counterpart of one CSV row only
      const claimedTransactionIds = new Set<string>();

      for (const row of stagedRows) {
        const exactMatch = pickDeterministicExactMatch(
          row,
          manualTransactions,
          claimedTransactionIds
        );
        if (exactMatch) {
          claimedTransactionIds.add(exactMatch.id);
          exactCandidates.push(createExactCandidate(row, exactMatch));
        } else {
          unresolvedRows.push(row);
        }
      }

      const nearCandidates: ImportConflictCandidate[] = [];
      let uncheckedRowCount = 0;
      if (deps.resolveNearMatches && unresolvedRows.length > 0) {
        const unclaimedTransactions = manualTransactions.filter(
          (transaction) => !claimedTransactionIds.has(transaction.id)
        );
        let nearResult: NearMatchResult = { decisions: [], uncheckedRowCount: 0 };
        try {
          nearResult = await deps.resolveNearMatches({
            rows: unresolvedRows,
            existingTransactions: unclaimedTransactions,
          });
        } catch (error) {
          logger.error(
            "Near-match resolver failed. Continuing with deterministic exact matches only.",
            "detectAndStageConflicts",
            error
          );
          nearResult = { decisions: [], uncheckedRowCount: unresolvedRows.length };
        }
        uncheckedRowCount = nearResult.uncheckedRowCount;

        const rowById = new Map(unresolvedRows.map((row) => [row.id, row]));
        const transactionById = new Map(
          unclaimedTransactions.map((transaction) => [transaction.id, transaction])
        );
        const matchedRowIds = new Set<string>();

        // Highest confidence first, so a contested entry goes to its best match
        const decisions = [...nearResult.decisions].sort((a, b) => b.confidence - a.confidence);
        for (const decision of decisions) {
          const row = rowById.get(decision.importRowId);
          const transaction = transactionById.get(decision.matchedTransactionId);
          if (
            !row ||
            !transaction ||
            matchedRowIds.has(row.id) ||
            claimedTransactionIds.has(transaction.id) ||
            // An expense row is never a duplicate of an income and vice versa
            rowDirection(row) !== transaction.type
          ) {
            continue;
          }
          matchedRowIds.add(row.id);
          claimedTransactionIds.add(transaction.id);
          nearCandidates.push(toNearMatchCandidate(row, transaction, decision));
        }
      }

      const allCandidates = [...exactCandidates, ...nearCandidates].sort((a, b) =>
        a.importRowId.localeCompare(b.importRowId)
      );

      await deps.store.replaceConflicts(
        input.userId,
        input.sessionId,
        allCandidates.map((candidate) =>
          buildConflictCandidateRecord(input.userId, input.sessionId, candidate)
        )
      );

      return {
        sessionId: input.sessionId,
        exactMatchCount: exactCandidates.length,
        nearMatchCount: nearCandidates.length,
        conflictRows: allCandidates.length,
        uncheckedRowCount,
        candidates: allCandidates,
      };
    },
  };
}

function createDbReconciliationStore(): ReconciliationStore {
  return {
    async getSession(userId, sessionId) {
      const [session] = await db
        .select({
          id: importSessions.id,
          userId: importSessions.userId,
          accountId: importSessions.accountId,
        })
        .from(importSessions)
        .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, userId)))
        .limit(1);

      return session ?? null;
    },

    async getStagedRows(userId, sessionId) {
      return db
        .select({
          id: importRows.id,
          userId: importRows.userId,
          rowIndex: importRows.rowIndex,
          bookingDate: importRows.bookingDate,
          amount: importRows.amount,
          description: importRows.description,
          excludedByUser: importRows.excludedByUser,
        })
        .from(importRows)
        .where(and(eq(importRows.userId, userId), eq(importRows.sessionId, sessionId)))
        .orderBy(importRows.rowIndex);
    },

    async getManualTransactions(userId, accountId) {
      const [incomeRows, expenseRows] = await Promise.all([
        db
          .select({
            id: incomes.id,
            userId: incomes.userId,
            accountId: incomes.accountId,
            date: incomes.startDate,
            amount: incomes.amount,
            description: incomes.source,
          })
          .from(incomes)
          // Only one-off incomes are bookings; a recurring income must not be matched and replaced
          .where(
            and(
              eq(incomes.userId, userId),
              eq(incomes.accountId, accountId),
              eq(incomes.recurrenceType, "once")
            )
          ),
        db
          .select({
            id: dailyExpenses.id,
            userId: dailyExpenses.userId,
            accountId: dailyExpenses.accountId,
            date: dailyExpenses.date,
            amount: dailyExpenses.amount,
            description: dailyExpenses.description,
          })
          .from(dailyExpenses)
          .where(and(eq(dailyExpenses.userId, userId), eq(dailyExpenses.accountId, accountId))),
      ]);

      return [
        ...incomeRows.map((row) => ({
          ...row,
          type: "income" as const,
        })),
        ...expenseRows.map((row) => ({
          ...row,
          type: "expense" as const,
        })),
      ];
    },

    async replaceConflicts(userId, sessionId, conflicts) {
      await db.transaction(async (tx) => {
        await tx
          .delete(importConflicts)
          .where(and(eq(importConflicts.userId, userId), eq(importConflicts.sessionId, sessionId)));

        if (conflicts.length > 0) {
          await tx.insert(importConflicts).values(conflicts);
        }

        await tx
          .update(importSessions)
          .set({
            conflictRows: conflicts.length,
            reconciledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, userId)));
      });
    },
  };
}

export const importReconciliationEngine = createImportReconciliationEngine({
  store: createDbReconciliationStore(),
  resolveNearMatches: createAiNearMatchResolver(),
});
