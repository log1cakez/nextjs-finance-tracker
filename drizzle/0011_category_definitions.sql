CREATE TABLE IF NOT EXISTS "category_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "name_key" text NOT NULL,
  "kind" "transaction_kind" NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "category_definitions_name_key_kind" UNIQUE ("name_key", "kind")
);

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "definition_id" uuid;

INSERT INTO "category_definitions" ("name", "name_key", "kind")
SELECT DISTINCT ON (lower(trim("name")), "kind")
  trim("name"),
  lower(trim("name")),
  "kind"
FROM "categories"
WHERE "definition_id" IS NULL
ORDER BY lower(trim("name")), "kind", trim("name")
ON CONFLICT ("name_key", "kind") DO NOTHING;

UPDATE "categories" AS c
SET "definition_id" = d."id"
FROM "category_definitions" AS d
WHERE c."definition_id" IS NULL
  AND d."name_key" = lower(trim(c."name"))
  AND d."kind" = c."kind";

UPDATE "transactions" AS t
SET "category_id" = k."keep_id"
FROM (
  SELECT c."id" AS old_id,
    (
      SELECT MIN(c2."id")
      FROM "categories" c2
      WHERE c2."user_id" = c."user_id" AND c2."definition_id" = c."definition_id"
    ) AS keep_id
  FROM "categories" c
  WHERE c."definition_id" IS NOT NULL
) AS k
WHERE t."category_id" = k.old_id
  AND k.keep_id IS NOT NULL
  AND k.old_id <> k.keep_id;

UPDATE "recurring_expenses" AS r
SET "category_id" = k."keep_id"
FROM (
  SELECT c."id" AS old_id,
    (
      SELECT MIN(c2."id")
      FROM "categories" c2
      WHERE c2."user_id" = c."user_id" AND c2."definition_id" = c."definition_id"
    ) AS keep_id
  FROM "categories" c
  WHERE c."definition_id" IS NOT NULL
) AS k
WHERE r."category_id" = k.old_id
  AND k.keep_id IS NOT NULL
  AND k.old_id <> k.keep_id;

DELETE FROM "categories" c
WHERE c."definition_id" IS NOT NULL
  AND c."id" NOT IN (
    SELECT MIN(c2."id")
    FROM "categories" c2
    WHERE c2."definition_id" IS NOT NULL
    GROUP BY c2."user_id", c2."definition_id"
  );

ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_definition_id_category_definitions_id_fk";

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_definition_id_category_definitions_id_fk"
  FOREIGN KEY ("definition_id") REFERENCES "category_definitions"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "categories" ALTER COLUMN "definition_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_user_definition_idx" ON "categories" ("user_id", "definition_id");
