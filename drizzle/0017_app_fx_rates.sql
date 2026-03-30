CREATE TABLE IF NOT EXISTS "app_fx_rates" (
  "id" text PRIMARY KEY NOT NULL,
  "usd_to_php_rate_ppm" integer NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "app_fx_rates" ("id", "usd_to_php_rate_ppm", "source")
VALUES ('usd_php', 56000000, 'seed')
ON CONFLICT ("id") DO NOTHING;

