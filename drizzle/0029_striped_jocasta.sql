CREATE TYPE "public"."gamify_quest_cadence" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "eod_ai_month_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year_month" text NOT NULL,
	"summary_text" text NOT NULL,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"period_label" text DEFAULT '' NOT NULL,
	"source_journal_stamp" text,
	"ai_summarize_run_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eod_trading_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"initial_capital_cents" integer,
	"initial_capital_payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gamify_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"character_name" text DEFAULT 'Adventurer' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gamify_quest_completion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" uuid,
	"stat_id" uuid,
	"quest_title" text NOT NULL,
	"stat_name" text NOT NULL,
	"stat_icon" text DEFAULT '' NOT NULL,
	"stat_color" text DEFAULT '#22d3ee' NOT NULL,
	"cadence" "gamify_quest_cadence" NOT NULL,
	"xp_awarded" integer NOT NULL,
	"period_key" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gamify_quest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stat_id" uuid NOT NULL,
	"title" text NOT NULL,
	"cadence" "gamify_quest_cadence" NOT NULL,
	"xp" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gamify_stat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#22d3ee' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "trading_account_id" uuid;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "net_pnl_cents" integer;--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD COLUMN "net_pnl_payload" text;--> statement-breakpoint
ALTER TABLE "eod_ai_month_summary" ADD CONSTRAINT "eod_ai_month_summary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_trading_account" ADD CONSTRAINT "eod_trading_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_profile" ADD CONSTRAINT "gamify_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_quest_completion" ADD CONSTRAINT "gamify_quest_completion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_quest_completion" ADD CONSTRAINT "gamify_quest_completion_quest_id_gamify_quest_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."gamify_quest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_quest_completion" ADD CONSTRAINT "gamify_quest_completion_stat_id_gamify_stat_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."gamify_stat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_quest" ADD CONSTRAINT "gamify_quest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_quest" ADD CONSTRAINT "gamify_quest_stat_id_gamify_stat_id_fk" FOREIGN KEY ("stat_id") REFERENCES "public"."gamify_stat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamify_stat" ADD CONSTRAINT "gamify_stat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eod_ai_month_summary_user_ym" ON "eod_ai_month_summary" USING btree ("user_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "eod_trading_account_user_name" ON "eod_trading_account" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "gamify_quest_completion_quest_period" ON "gamify_quest_completion" USING btree ("quest_id","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "gamify_stat_user_name" ON "gamify_stat" USING btree ("user_id","name");--> statement-breakpoint
ALTER TABLE "eod_tracker_row" ADD CONSTRAINT "eod_tracker_row_trading_account_id_eod_trading_account_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."eod_trading_account"("id") ON DELETE set null ON UPDATE no action;