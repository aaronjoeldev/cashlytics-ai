-- Transfers created before the currency columns were filled from the accounts carry the column
-- default 'EUR', even between accounts in another currency. Take the account's currency for those
-- rows. Rows with an exchange rate or target amount were entered with explicit currencies and stay
-- as they are.
UPDATE "transfers" AS t
SET "source_currency" = a."currency"
FROM "accounts" AS a
WHERE a."id" = t."source_account_id"
  AND t."source_currency" = 'EUR'
  AND a."currency" <> 'EUR'
  AND t."exchange_rate" IS NULL
  AND t."target_amount" IS NULL;--> statement-breakpoint
UPDATE "transfers" AS t
SET "target_currency" = a."currency"
FROM "accounts" AS a
WHERE a."id" = t."target_account_id"
  AND t."target_currency" = 'EUR'
  AND a."currency" <> 'EUR'
  AND t."exchange_rate" IS NULL
  AND t."target_amount" IS NULL;
