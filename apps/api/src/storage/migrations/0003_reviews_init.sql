CREATE TYPE "public"."finding_priority" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."finding_source" AS ENUM('static', 'ai');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"source_type" text NOT NULL,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"skipped_file_count" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"error_message" text,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"ai_model" text,
	"ai_error" text,
	"started_at" timestamp(3) with time zone,
	"completed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"path" text NOT NULL,
	"language" text NOT NULL,
	"byte_size" integer NOT NULL,
	"line_count" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"file_path" text NOT NULL,
	"line" integer,
	"end_line" integer,
	"priority" "finding_priority" NOT NULL,
	"category" text NOT NULL,
	"source" "finding_source" NOT NULL,
	"rule" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"suggestion" text,
	"snippet" text,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_file" ADD CONSTRAINT "review_file_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_finding" ADD CONSTRAINT "review_finding_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;