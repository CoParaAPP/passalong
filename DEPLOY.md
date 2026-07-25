# Deploying Passalong to Vercel

This is the runbook for putting Passalong live. It uses Vercel to host the
Next.js app and a Supabase project as the managed Postgres database. The app
stays plain Next.js, so you can move it to any host later.

The steps marked **(you)** need your accounts and credentials, so I can't do
them for you. The config they refer to (`vercel.json`, env var names, the
migration and CLI commands) is already in the repo.

## What you'll end up with

- The app served over HTTPS at a Vercel URL (or your own domain).
- A daily cron that generates return reminders.
- A production database separate from development.

## 1. Put the code on GitHub (you)

Vercel deploys from a Git repo, and this also switches on the Dependabot config
already in the repo.

```bash
# create a new PRIVATE repo on github.com first, then:
git remote add origin git@github.com:<you>/passalong.git
git push -u origin main
```

Keep it private. The `.env` file is git-ignored, so no secrets go up.

## 2. Make a production Supabase project (you)

- Create a **new** Supabase project (don't reuse the dev one).
- Copy its **pooled** connection string (the one on **port 6543**, labelled
  "Transaction" / pooler). That port matters: it's built for serverless.
- That string is your production `DATABASE_URL`.

## 3. Generate fresh production secrets (you)

Don't reuse the dev secrets. Generate new ones:

```bash
# TOKEN_ENCRYPTION_KEY and SESSION_SECRET (run twice, once for each):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# CRON_SECRET:
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

# VAPID keys (you can reuse the dev pair, or make a fresh one):
npx web-push generate-vapid-keys
```

## 4. Import the project into Vercel (you)

- On vercel.com, "Add New Project" and import the GitHub repo.
- Framework preset: **Next.js** (auto-detected). No build command changes.
- Before the first deploy, add the environment variables in the next step.

## 5. Set environment variables in Vercel (you)

In the Vercel project's **Settings → Environment Variables**, add every row
below for the **Production** environment. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be
present at build time, so set it before deploying.

| Variable | Value |
|---|---|
| `YOTO_CLIENT_ID` | from dashboard.yoto.dev |
| `YOTO_CLIENT_SECRET` | from dashboard.yoto.dev |
| `YOTO_REDIRECT_URI` | `https://<your-domain>/auth/callback` |
| `APP_BASE_URL` | `https://<your-domain>` |
| `DATABASE_URL` | the port-6543 pooled string from step 2 |
| `TOKEN_ENCRYPTION_KEY` | fresh key from step 3 |
| `SESSION_SECRET` | fresh key from step 3 |
| `CRON_SECRET` | fresh secret from step 3 |
| `VAPID_PUBLIC_KEY` | from step 3 |
| `VAPID_PRIVATE_KEY` | from step 3 |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` |

Use the same value for `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
The `NEXT_PUBLIC_` one is the copy the browser is allowed to see.

## 6. Pick the domain, then fix the two URL values (you)

- Decide the production URL. The free `something.vercel.app` is fine to start.
- Set `APP_BASE_URL` and `YOTO_REDIRECT_URI` (above) to that exact URL.
- **In dashboard.yoto.dev, add the production callback to Allowed Callback
  URLs**, exactly: `https://<your-domain>/auth/callback`, no trailing slash.
  This is the same byte-for-byte match rule we hit in development.

## 7. Run the database migrations against production (you)

Vercel does not run migrations. Run them once from your machine, pointed at the
production database, before the first real login:

```bash
DATABASE_URL="<production pooled string>" npm run db:migrate
```

Re-run this whenever new migrations land in `db/migrations`.

## 8. Deploy

Vercel deploys automatically on every push to `main`. The first deploy happens
when you finish the import, or trigger it with "Deploy". Watch the build log for
a green build.

## 9. Seed yourself (you)

Create the first invite and make yourself the organizer, pointed at production:

```bash
DATABASE_URL="<production pooled string>" npm run invite:new -- "me"
DATABASE_URL="<production pooled string>" npm run organizer:add -- "<your-username>"
```

Order matters: use the invite to sign up (which creates your member and
username), then run `organizer:add` with that username.

## 10. Verify live

- Open the URL, connect your Yoto account, confirm your shelf loads.
- The consent screen should ask only for library access, not personal
  recordings.
- Tap **Enable notifications**, allow it. On iPhone, first **install the app to
  the home screen** (Share → Add to Home Screen); iOS only allows push for an
  installed PWA.
- Check the reminders cron shows under **Settings → Cron Jobs** in Vercel. To
  test it now without waiting for 14:00 UTC:

  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-domain>/api/cron/reminders
  ```

## Notes

- **HTTPS** is automatic on Vercel, which is what Web Push and secure cookies
  need.
- **Reminder schedule**: daily at 14:00 UTC (`vercel.json`). Vercel Cron sends
  the request with `Authorization: Bearer $CRON_SECRET` automatically, which the
  route checks. Adjust the time by editing the `schedule` cron expression.
- **Region**: `vercel.json` pins the functions to `iad1` (US East) to sit next
  to a US-East Supabase project. If your database is elsewhere, change it.
- **Keep dev and production separate**: different Supabase projects, different
  secrets. Data encrypted with the dev `TOKEN_ENCRYPTION_KEY` can't be read with
  a different production key, which is the point.
- **AGPL**: if you run this as a network service, offer your source. A link to
  the GitHub repo from the app covers it.
