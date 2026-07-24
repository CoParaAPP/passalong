CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"cover_image_url" text
);
--> statement-breakpoint
CREATE TABLE "ownership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"visibility" text DEFAULT 'unlisted' NOT NULL,
	"first_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"yoto_sub" text NOT NULL,
	"username" text,
	"refresh_token_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_yoto_sub_unique" UNIQUE("yoto_sub")
);
--> statement-breakpoint
ALTER TABLE "ownership" ADD CONSTRAINT "ownership_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership" ADD CONSTRAINT "ownership_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;