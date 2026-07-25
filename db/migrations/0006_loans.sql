CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownership_id" uuid,
	"lender_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"due_by" date,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ownership" ADD COLUMN "status" text DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "ownership" ADD COLUMN "current_loan_id" uuid;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_ownership_id_ownership_id_fk" FOREIGN KEY ("ownership_id") REFERENCES "public"."ownership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_lender_id_users_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;