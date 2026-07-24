# Neighborhood Yoto Swap — v1 Working Spec

*Working title. Closed, invite-only. Built for one neighborhood parents' group to start.*

---

## What it is

A private tool for a neighborhood parents' group to lend, borrow, and swap Yoto cards. A parent connects their Yoto account, their card collection syncs in automatically, they mark what they're looking for, and the app connects them with nearby families who can help. No exact addresses, no shared phone numbers, no profiles of children.

Yoto is the wedge because the group and the demand already exist. Physical books, a book club, and gatherings are later chapters, not v1.

## The core loop

1. Join by invite and pick a username.
2. Connect your Yoto account. Your commercial cards sync in automatically.
3. Choose which cards you're willing to lend or trade away.
4. Mark the cards you want (your wishlist).
5. Set your cross streets so neighbors can see roughly how close you are.
6. When you want something, the app shows who nearby has it. You send a proposal.
7. The owner gets a push notification, accepts or declines, and you arrange the handoff in person.

Everything happens inside the app. Nobody exchanges contact details.

## v1 feature cut

**In:**

- Invite-only signup with a username, no real name required.
- Yoto account connection with automatic library sync (official cards only).
- Wishlist: mark any card from the Yoto catalog as wanted.
- Per-card sharing controls: unlisted, offered to lend, offered to trade, off-limits.
- Wishlist-driven matching: "who nearby has what I want."
- In-app proposals for borrow or swap, with accept and decline.
- Push notification when someone proposes to you or responds to you.
- Cross-streets location, shown coarsely, used for a rough distance sort.
- Return-by date attached to each borrow, with a friendly reminder before it's due, and a tap-back-into-your-player reminder to the lender on return.
- Community covenant agreed at signup, and per-borrow terms agreed at each borrow.
- Flag-to-organizer for anything that needs a human.

**Out (deliberately, for now):**

- Physical books and parenting books.
- Book club, reviews, monthly gatherings, storytime.
- Ratings, reputation scores, dispute resolution systems.
- Shipping, escrow, payments.
- Public who-owns-what directory.
- Passwords, if a magic link or Yoto login covers signup.

## Data model

Keep it small on purpose. Store the minimum that makes matching work.

**User**
- id
- username (display name, no real name required)
- cross_streets (text the user enters, e.g. "Oak & 4th")
- approx_location (rough coordinate, derived from cross streets, used only for distance math, never displayed as a pin)
- yoto_connection (OAuth tokens / refresh token for library sync)
- covenant_version_agreed, covenant_agreed_at
- notification_prefs (direct proposals on by default; broader alerts opt-in)
- created_at

**Card (catalog)**
- id
- title
- artwork_url
- source: official catalog (seeded from the Yoto API)

Make Your Own (personal) cards are never stored as listable catalog items. They are filtered out on sync.

**Ownership** (pinned in this app, never overwritten by a sync)
- user_id (the owner, as recorded here, not as Yoto currently reports)
- card_id
- claimed: true/false (user actively confirmed "I own this")
- status: available | on_loan | off_limits
- current_loan_id (set when status is on_loan)
- visibility: unlisted (default) | lend | trade
- first_synced_at, claimed_at

**Loan**
- id
- ownership_id (whose card)
- lender_id, borrower_id
- type: borrow | swap
- due_by (borrows only)
- status: active | returned | completed_trade
- created_at, returned_at

**Wishlist**
- user_id
- card_id
- added_at

**Proposal**
- id
- from_user_id
- to_user_id
- card_id
- type: borrow | swap
- offered_card_id (for swaps)
- status: pending | accepted | declined | completed
- return_by (for borrows)
- condition_note (agreed at acceptance)
- terms_version_agreed
- created_at, updated_at

**Message** (thin layer so people can coordinate without contact info)
- id, proposal_id, from_user_id, body, created_at

## Ownership, syncing, and loans

This is the trickiest part of the whole app, and getting it wrong would quietly corrupt everything. Yoto ties card ownership to whoever physically taps the card. Insert a borrowed card into your player and Yoto moves it into your library and removes it from the lender's. Give it back and the lender has to tap it into their own player to restore it. So Yoto's library reflects who is holding a card right now, not who owns it.

The rule that follows: this app's ownership records are the source of truth, and Yoto sync is only a suggestion.

**Ownership is pinned in this app.** The first time a card appears in someone's sync, they claim it, which creates an ownership record here. From then on that record is authoritative. A later sync can propose new cards to claim; it can never reassign or delete an existing ownership record on its own. Sync populates, records decide. This is how we resolve the apparent conflict between auto-sync and stable ownership.

**Loans are explicit app state, never inferred from Yoto.** When a lender accepts a loan, the app sets that ownership record to on_loan with a borrower and due date. It fully expects Yoto to then show the card in the borrower's library and gone from the lender's, and it ignores that mismatch, because the loan record explains it.

**Reconciliation rules on each sync:**

- Card is on loan to you and appears in your sync: expected. Do nothing, and disable claim/list on it. When viewed, it reads "borrowed from [lender], due [date]."
- A card you own disappears from your sync because you lent it out: expected. Ownership stays.
- A card you own disappears from your sync with no loan on record: do not guess and do not delete. Ask the user ("looks like [title] left your Yoto library, did you give it away?").
- A genuinely new card appears, tied to no loan: offer it to claim, arriving unlisted.

**Return has a physical step the app prompts.** Because Yoto moved the card into the borrower's library, marking a loan returned triggers a friendly reminder to the lender to tap the card back into their own player to restore it. The app's ownership record never changed; only Yoto's view did.

**Permanent trades are the one case ownership actually moves.** On a completed swap the app transfers the ownership record to the new owner with no due date. This lines up with what Yoto does physically, so the two agree.

**Same-title note.** Yoto identifies cards by content, so someone who owns their own copy and borrows another copy of the same title just shows "title present" in Yoto. The app tracks ownership as per-person records rather than counting Yoto libraries, so this never causes confusion.

## Privacy and safety posture

This is the part to get right before writing feature code, because these decisions are hard to retrofit.

**Personal content stays private.** Yoto's Make Your Own cards hold family recordings and private playlists. On sync, filter them out entirely. Only official commercial cards are eligible to list. A swap tool trades fungible, re-buyable cards, never someone's recording of grandma reading a bedtime story.

**Matching is pull-based, not a directory.** There is no open, browsable list of who owns what. You say what you want, and the app surfaces owners to you; the owner chooses whether to respond. This removes the ability to scan the neighborhood for who owns a specific title, which matters when a title could reveal something about a household. People can still open their shelf to browsing if they choose, but sensitive items never have to live in a searchable directory to be swappable.

**Sharing is opt-in.** New cards synced from Yoto arrive unlisted. You actively choose what to offer. Opt-in-to-share is safer than hide-after-the-fact, because it protects people who never think to hide anything. A bulk "offer all of these" action keeps this quick for the obviously-fine kids' titles.

**Off-limits as a first-class state.** A card can be visible but explicitly not for lending or trade, so people can show a collection without pressure to part with any of it.

**Location is coarse, always.** Store an approximate point for distance sorting, display only the cross streets, never an exact address or pin.

**Store nothing about children.** No child names, ages, or profiles. Yoto's developer guidelines require keeping family and child data minimal and anonymous, and never using it for advertising or tracking. The design above already lives well within that.

**Built to stay safe if it grows.** Opt-in sharing and pull-based matching work at both small and large scale. An open who-owns-what directory would be fine in a closed group and risky in an open one, so it is never made load-bearing.

## Yoto integration notes

Yoto opened a public API and developer program (live as of 2025). Relevant pieces:

- OAuth2 with the `family:library:view` scope to read a user's library. The user logs in on Yoto's own page and grants access; the app never handles their password and access can be revoked anytime.
- Browser-based auth uses Authorization Code flow with PKCE. A device-code flow exists for headless clients.
- Base URLs: `api.yotoplay.com` for the API, `login.yotoplay.com` for auth.
- The API also exposes catalog data and icons, so the master card list and artwork can be seeded from Yoto rather than hand-built.
- Guidelines are strict on child and family data. The data model above is designed to comply by storing as little as possible.

To confirm during build: how Make Your Own cards are flagged in the library response, so they can be filtered reliably, and how often a re-sync is allowed so new cards appear automatically without hitting rate limits.

Docs: yoto.dev. Parent-facing explainer of third-party access: Yoto support site. Unofficial Python wrapper on GitHub is useful as a reference for real API calls.

## The one real fork: web vs. installable app

Push notifications are the deciding factor. A plain website cannot reliably push to a phone, especially on iPhone, unless it is installed to the home screen as a PWA or built natively.

- **PWA (recommended start):** one codebase, works as a website and installs to the home screen, can do push once installed. Lowest cost to reach a usable v1. Push on iOS works but has more limits than native.
- **Native:** best notification experience, higher build and maintenance cost, app-store overhead.

For a closed neighborhood group, a PWA is the sensible first build. Revisit if notifications become the make-or-break feature.

## Open questions to settle next

- App name.
- Signup mechanism: Yoto login only, magic link, or both.
- Exactly how invites work (organizer sends links, invite codes, a waitlist).
- Whether swaps need the app to track a permanent transfer of ownership, or whether ownership just re-syncs from Yoto next time.
- Reminder cadence and tone for return-by dates.
- Who the organizer/admin is and what powers they need for flags.
```