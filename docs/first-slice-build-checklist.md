# First Slice — Build Checklist

Goal of this slice: a parent connects their Yoto account, their commercial cards sync in, personal recordings never enter the app, and the cards render on screen. This proves the one part with real unknowns, the Yoto integration. Everything sourced from yoto.dev, July 2026.

## The key finding, up front

Privacy for Make Your Own (MYO) cards is a scope decision, not a filtering step.

Yoto splits access by OAuth scope:

- `family:library:view` sees the family's card library.
- `user:content:view` sees Make Your Own content (personal recordings, playlists).

If the app never requests `user:content:view`, it structurally cannot read anyone's personal recordings. That is a stronger guarantee than pulling everything and filtering MYO out afterward, and it lines up with Yoto's own rule to request only the data you need. So the app requests `family:library:view offline_access` and nothing more.

One thing to confirm with a live call (noted below): the docs are inconsistent about what `GET /content/mine` returns under `family:library:view` alone. The browser-auth tutorial calls `/content/mine` with `family:library:view` and reads back `data.cards`; the API reference labels `/content/mine` as "Get User's MYO Content" needing `user:content:view`. Verify empirically before trusting either. There is no documented public store-catalog endpoint, which affects how wishlists get their card list (see step 6).

## Step 0: Register the app

- [ ] Create a developer account at the developer portal: `https://dashboard.yoto.dev/`
- [ ] Get your `client_id` (and `client_secret`, kept server-side only, never in the browser).
- [ ] Register your redirect URI (e.g. `https://your-app.com/callback`, plus a localhost one for development). It must match exactly at token exchange.
- [ ] Read the Developer Security & Data Protection Policy and API Terms of Service, both linked from yoto.dev.
- [ ] Check the Verification Status page. Unverified apps may face a user cap or reduced access; a neighborhood group could hit that ceiling, so find out early.

## Step 1: Log the user in (OAuth2 Authorization Code + PKCE)

This is browser-based auth. The user logs in on Yoto's page; the app never sees their password.

- [ ] `npm install pkce-challenge jwt-decode`
- [ ] Generate a PKCE verifier and challenge, store the verifier in session storage.
- [ ] Redirect to `https://login.yotoplay.com/authorize` with:
  - `audience=https://api.yotoplay.com`
  - `scope=family:library:view offline_access`  (deliberately no `user:content:view`)
  - `response_type=code`
  - `client_id=YOUR_CLIENT_ID`
  - `code_challenge=<challenge>`
  - `code_challenge_method=S256`
  - `redirect_uri=https://your-app.com/callback`

`offline_access` is what gets you a refresh token so the library can re-sync later without the user logging in each time.

## Step 2: Exchange the code for tokens

- [ ] On the callback, read `code` from the query string.
- [ ] Read the PKCE verifier back from session storage.
- [ ] POST to `https://login.yotoplay.com/oauth/token` (form-urlencoded) with:
  - `grant_type=authorization_code`
  - `client_id`
  - `code_verifier`
  - `code`
  - `redirect_uri` (same as step 1)
- [ ] Response returns `access_token` and `refresh_token`. Clear the PKCE verifier.
- [ ] Store the refresh token server-side, encrypted. Do not keep it in the browser.

## Step 3: Pull the library

- [ ] Call the library endpoint with `Authorization: Bearer <access_token>`. Per the tutorial:
  `GET https://api.yotoplay.com/content/mine`
- [ ] Read the `cards` array off the response.
- [ ] **Verify what you got.** Log the raw response and confirm whether `family:library:view` alone returns purchased/commercial cards, MYO cards, or both. This determines the filter in step 4. Ask in the Yoto developer Discord if the response shape is unclear; it is an active channel.

## Step 4: Keep only commercial cards

Even with scope minimization, confirm nothing personal slips through. In the returned card objects, likely signals of a personal MYO card versus a commercial one:

- [ ] `creatorEmail` or `userId` matching the authenticated user points to a self-created MYO card. Exclude those.
- [ ] `availability` / `clubAvailability` and a real `metadata.category` point to store content.
- [ ] When in doubt, exclude. A false exclude is a missing card; a false include could expose a private recording.
- [ ] Store only what the app needs per card: stable `cardId`, `title`, cover image (`metadata.cover.imageL`). Nothing else.

## Step 5: Render the shelf

- [ ] Show the synced commercial cards as a grid with title and cover art.
- [ ] Every card lands as `unlisted` by default (opt-in-to-share, per the spec). No card is offered until the user chooses.
- [ ] Give a bulk "offer these to the group" action so it is quick to list the obviously-fine kids' titles.
- [ ] Artwork: cover images come through on the card metadata; `GET /icons` public icons are available if you need pixel-art icons too.

## Step 6: Token refresh (do this now, not later)

- [ ] Access tokens are JWTs and expire quickly. Use `jwt-decode` to check `exp` before calls.
- [ ] To refresh: POST `https://login.yotoplay.com/oauth/token` with `grant_type=refresh_token`, `client_id`, `refresh_token`.
- [ ] Refresh tokens are single-use. Every refresh returns a new refresh token; overwrite the stored one immediately or you will lock the user out.
- [ ] Re-sync the library on a sensible cadence (e.g. on login and a periodic background refresh) so new cards appear automatically. Respect rate limits; do not poll aggressively.

## What this slice deliberately leaves for later

- **The wishlist catalog.** No public store-catalog or search endpoint is documented, so you cannot browse "all Yoto cards" from the API. For a closed group, the practical first version builds the wishlist picker from the union of cards already synced across members' shelves. That grows itself as people join. Revisit if you want the full catalog (may need a data source outside this API).
- Matching, proposals, messaging, push, location, the agreements. All from the main spec, none blocked by this slice.

## Compliance notes carried from Yoto's guidelines

- Request only the scopes you need (done: no MYO scope).
- Store the minimum, keep it anonymous, never use it for ads or tracking.
- Report any data or safety incident to security@yotoplay.com.
- If you ever want Yoto to feature the app, it goes through their review; not required to just build and run it for your group.

## Sources

- API Reference: https://yoto.dev/api/
- Browser-Based Authentication: https://yoto.dev/authentication/browser-auth/
- API Scopes: https://yoto.dev/authentication/scopes/
- Get User's MYO Content (`/content/mine`): https://yoto.dev/api/content/getUserSMyoContent
- Get Content (`/content/{cardId}`): https://yoto.dev/api/content/getContent
- Developer Guidelines: https://yoto.dev/get-started/api-guidelines/
- Start Here / portal: https://yoto.dev/get-started/start-here/ and https://dashboard.yoto.dev/
