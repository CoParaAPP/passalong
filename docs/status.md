# Passalong — Current State

_Snapshot as of August 3, 2026. A quick brief to bring a conversation up to speed._

## What it is

An invite-only Progressive Web App for a private neighborhood parents' group to lend, borrow, and swap physical Yoto cards. Unofficial and unaffiliated with Yoto. Open source (AGPL-3.0) and self-hostable.

## Status: live and in testing

- **Live at:** https://passalong-eta.vercel.app
- **Hosting:** Vercel, auto-deploys from GitHub on every push to `main`.
- **Database:** Postgres (a Supabase project used only as managed Postgres, no Supabase Auth).
- Currently being tested by a small group (a couple of real accounts) before opening it up.

## How it works (the core loop)

1. Connect your Yoto account. Your store-bought cards sync in on their own. Personal "Make Your Own" recordings are never visible to the app (enforced by the login scope, not a filter).
2. Everything starts private. On your **Shelf**, you choose per card: offer it to lend, mark it off-limits (shown but never lent), or leave it private.
3. **Browse** what neighbors are offering, grouped by neighbor. Only offered cards ever appear; private ones never do.
4. Tap **Request** on a card. That opens a shared **chat thread** with the owner, who accepts or declines right there.
5. You coordinate the handoff in the thread (no phone numbers exchanged), meet up, and hand over the physical card.
6. Borrows can carry a return-by date and reminder. Either person marks it returned.

## What's built and working

- Yoto OAuth login (Authorization Code + PKCE), encrypted refresh tokens, automatic library sync, commercial-cards-only filter.
- Shelf with four sharing states: private, offered-to-lend, trade, off-limits.
- Browse (offers grouped by neighbor) → one-tap Request → a single request-thread with Accept/Decline and messaging in one place.
- Loans with return tracking and reminders. Swaps are recorded; the two people trade the physical cards themselves.
- Onboarding: invite-code gate, username, and a one-time agreement (community covenant + borrow/swap terms).
- Web Push notifications with an on/off toggle, for new requests, messages, and return reminders.
- Organizer role: flag-to-organizer reporting and triage, a group-stats line (member count, cards offered, active borrows), and a standing reusable invite code (visible in the Organizer tab).
- A scheduled daily job that generates return reminders.
- Installable PWA with an offline shell and the app's own logo/icon.

## Recent simplification pass

The flow was cut down hard for fewer steps:

- **Removed the Wishlist** entirely. It exposed private card titles from the shared catalog and mostly duplicated browsing.
- **Merged** the old separate "propose form" and "message thread" into one request-thread, with Accept/Decline built into the top of the conversation.
- **Terms** moved to a one-time agreement at signup, so there's no checkbox on every borrow.
- **Requesting is low-stakes:** it doesn't notify the owner until you send a first message, and you can **withdraw** a pending request with no trace.

## Known issues (from a security review) — to fix before wider launch

- Reflected XSS on the OAuth callback error page.
- No security headers / Content-Security-Policy yet.
- Invite codes are guessable and there's no rate limiting, so the invite gate is weak.
- No app-level rate limiting anywhere.
- Dev and production share one database and the same secrets; both should be split and rotated before real families are on it.
- Session cookies have no server-side expiry and there's no logout yet.

The fundamentals are solid: parameterized queries (no SQL injection), React output-escaping (no stored XSS), encrypted refresh tokens, signed sessions, and authorization checks that hold up.

## What's next / open ideas

- Fix the security findings above.
- In-app **announcements**: an organizer broadcast that banners on every member's shelf and pushes to phones.
- Community "later chapters" the whole thing is really building toward: a monthly card exchange, story time, and family recording sessions at the local library.
- The co-parent shared-account case (two homes, one Yoto account) — documented, handled socially for now.

## Tech notes

- **Repo:** github.com/CoParaAPP/passalong (private)
- **Stack:** Next.js (App Router) + Postgres + Drizzle ORM. Web Push via VAPID. No Firebase, no Supabase Auth. Portable to any Postgres by connection string.
