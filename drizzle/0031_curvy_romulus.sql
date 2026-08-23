CREATE TYPE "public"."gamify_xp_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
ALTER TABLE "gamify_profile" ADD COLUMN "xp_mode" "gamify_xp_mode" DEFAULT 'auto' NOT NULL;