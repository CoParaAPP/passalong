# Passalong

A small web app for a private, invite-only neighborhood parents' group to lend, borrow, and swap Yoto cards. A parent connects their Yoto account, their commercial cards sync in, they choose what to offer, and the app connects them with nearby families. No addresses, no phone numbers, no profiles of children.

Passalong is an unofficial project. It is not made by, affiliated with, or endorsed by Yoto.

## How it treats your data

- Only official commercial cards are ever visible to the app. It never requests the Yoto permission that covers Make Your Own recordings, so personal audio is structurally unreadable, not just filtered out.
- Everything synced arrives unlisted. Nothing is shared with the group until you choose to share it.
- The app stores the minimum: a username, your card list, your cross streets. Nothing about children. No ads, no tracking, ever.

The full design lives in [docs/spec.md](docs/spec.md). What's being built first, and why, is in [docs/first-slice-build-checklist.md](docs/first-slice-build-checklist.md). The promises members make to each other are in [docs/community-agreements.md](docs/community-agreements.md).

## Running it yourself

Passalong is self-hostable and always will be. It's a Next.js app with a Postgres database and no other required services.

**Local development:**

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in. You need a Postgres connection string (any Postgres works; a Supabase project used purely as managed Postgres is fine), a Yoto `client_id`/`client_secret` from [dashboard.yoto.dev](https://dashboard.yoto.dev), and generated secrets (the file explains each). Register `http://localhost:3000/auth/callback` as an allowed callback URL in your Yoto app.
3. `npm run db:migrate` to create the tables.
4. `npm run dev`, then open http://localhost:3000.
5. Make an invite to sign up with: `npm run invite:new`. After you've picked a username, make yourself an organizer: `npm run organizer:add -- your_username`.

**Deploying to production:** see [DEPLOY.md](DEPLOY.md) for the full runbook (Vercel + a managed Postgres, HTTPS, the reminders cron, and the env checklist).

## License

[AGPL-3.0](LICENSE). Free to use, free to change, and changes stay free.
