CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"image_url" text,
	"quota" integer NOT NULL,
	"remaining_quota" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_categories_quota_positive" CHECK ("categories"."quota" >= 0),
	CONSTRAINT "chk_categories_remaining_quota_positive" CHECK ("categories"."remaining_quota" >= 0),
	CONSTRAINT "chk_categories_remaining_quota_lte_quota" CHECK ("categories"."remaining_quota" <= "categories"."quota")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"selection_starts_at" timestamp with time zone NOT NULL,
	"selection_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_events_status" CHECK ("events"."status" IN ('DRAFT', 'WAITING', 'OPEN', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" ADD CONSTRAINT "selections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" ADD CONSTRAINT "selections_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" ADD CONSTRAINT "selections_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_event_active" ON "categories" USING btree ("event_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_participants_event_id" ON "participants" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_selections_event_participant" ON "selections" USING btree ("event_id","participant_id");--> statement-breakpoint
CREATE INDEX "idx_selections_category_id" ON "selections" USING btree ("category_id");