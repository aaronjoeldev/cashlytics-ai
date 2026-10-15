-- New addresses are stored in lower case, older ones may not be. Lower-case every address that has
-- no case variant, then enforce one account per address with a unique index on lower(email).
-- Accounts that differ only in case ("Max@x.de" and "max@x.de") are left untouched; while such
-- duplicates exist the old, non-unique index stays and a warning is logged. After resolving them by
-- hand, add the index with:
--   DROP INDEX "users_email_lower_idx";
--   CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" (lower("email"));
UPDATE "users" u
SET "email" = lower(trim(u."email"))
WHERE u."email" <> lower(trim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "users" o
    WHERE o."id" <> u."id" AND lower(trim(o."email")) = lower(trim(u."email"))
  );--> statement-breakpoint
DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(address, ', ') INTO duplicates
  FROM (
    SELECT lower("email") AS address FROM "users" GROUP BY lower("email") HAVING count(*) > 1
  ) d;

  IF duplicates IS NULL THEN
    DROP INDEX IF EXISTS "users_email_lower_idx";
    CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));
  ELSE
    RAISE WARNING 'users_email_lower_unique not created: accounts differ only in e-mail case: %',
      duplicates;
  END IF;
END $$;
