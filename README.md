# Passalong

A small web app for a private, invite-only neighborhood parents' group to lend, borrow, and swap Yoto cards. A parent connects their Yoto account, their commercial cards sync in, they choose what to offer, and the app connects them with nearby families. No addresses, no phone numbers, no profiles of children.

Passalong is an unofficial project. It is not made by, affiliated with, or endorsed by Yoto.

## How it treats your data

- Only official commercial cards are ever visible to the app. It never requests the Yoto permission that covers Make Your Own recordings, so personal audio is structurally unreadable, not just filtered out.
- Everything synced arrives unlisted. Nothing is shared with the group until you choose to share it.
- The app stores the minimum: a username, your card list, your cross streets. Nothing about children. No ads, no tracking, ever.

The full design lives in [docs/spec.md](docs/spec.md). What's being built first, and why, is in [docs/first-slice-build-checklist.md](docs/first-slice-build-checklist.md). The promises members make to each other are in [docs/community-agreements.md](docs/community-agreements.md).

## Running it yourself

Passalong is self-hostable and always will be. It's a Next.js app with a Postgres database and no other required services. Setup instructions will land here as the first slice comes together.

## License

[AGPL-3.0](LICENSE). Free to use, free to change, and changes stay free.
