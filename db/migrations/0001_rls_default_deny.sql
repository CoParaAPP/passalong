-- Custom SQL migration file, put your code below! --

-- Default-deny backstop.
-- Passalong reaches Postgres only server-side, through the owner connection
-- string, which is not subject to RLS. Enabling row-level security with NO
-- policies denies every other role (e.g. the anon / authenticated PostgREST
-- roles that exist on a managed host) by default. This is defense in depth:
-- if anything ever tried to read these tables over a public API surface, it
-- would get nothing. The app's own server access is unaffected.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ownership" ENABLE ROW LEVEL SECURITY;