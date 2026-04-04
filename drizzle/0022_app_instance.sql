CREATE TABLE IF NOT EXISTS "app_instance" (
	"singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"runtime_mode" text DEFAULT 'prod' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "app_instance" ("singleton_key", "runtime_mode")
VALUES ('default', 'prod')
ON CONFLICT ("singleton_key") DO NOTHING;
