# Security & Data Protection

Passalong connects to a family's Yoto library, so it holds credentials and
personal-adjacent data. This document records how that data is handled. It
tracks Yoto's API Terms and Developer Security Policy.

## What Passalong stores

Only what the app functionally needs:

- Per card: the stable `cardId`, `title`, and cover image URL. Nothing else
  from the Yoto API.
- Ownership and loan records created inside this app.
- A username, cross streets, and the Yoto refresh token per member.

The app never requests the `user:content:view` scope, so it structurally
cannot read Make Your Own recordings. Personal audio never enters the system.
Nothing about children is ever stored.

## Secrets

- All secrets live in server-side environment variables. See `.env.example`
  for the key names.
- `.env` is git-ignored. The Yoto client secret and encryption keys are never
  committed and never sent to the browser.
- The `YOTO_CLIENT_ID` is the only Yoto value that reaches the client, which is
  expected for a public OAuth client identifier.

## Encryption at rest

- The Yoto refresh token is encrypted with AES-256-GCM at the application layer
  before it is written to the database, using `TOKEN_ENCRYPTION_KEY`. It is
  decrypted only in server memory when a token refresh runs. It is never logged
  and never leaves the server.
- The database as a whole is expected to run on encrypted storage in
  production, which covers card and ownership records at rest.

## Encryption in transit

- All traffic runs over HTTPS/TLS. OAuth redirects and token exchange use
  Yoto's HTTPS endpoints. The app must be served over HTTPS in any deployment
  that real members use.

## Refresh-token rotation

Yoto refresh tokens are single-use. Every refresh returns a new token, and the
stored value is overwritten immediately so a member is never locked out and no
stale token lingers.

## Data purge

A member's Yoto-derived data can be fully deleted on request, and is purged
automatically if Yoto API access for that member is revoked. Purge removes the
stored refresh token and every card and ownership record derived from that
member's library. This function is built alongside the token and database layer,
before any real member data is stored.

## Reporting a security or safety incident

- Security issues in Passalong itself: open a private report to the maintainer.
- Any incident involving Yoto data or account access is reported to
  **security@yotoplay.com within 48 hours** of discovery, per Yoto's policy.

## Dependency security

Dependabot is enabled (`.github/dependabot.yml`) to alert on vulnerable
dependencies. Alerts are reviewed and patched promptly.

## Member safety reporting

Passalong includes a flag-to-organizer mechanism so members can report anything
that needs a human. Yoto's terms require a report system to be present before
real members use the app.
