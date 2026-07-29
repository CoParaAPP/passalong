# Co-parents sharing one Yoto account

A real case from early testing, worth capturing because it will come up for other
families in a neighborhood group.

## The situation

Two separated co-parents share one Yoto account and one player. Their child
carries a book of physical cards between the two homes. The card library lives
under that single shared account.

## Why it lands this way

A Yoto player links to one account at a time, and the card library follows
whichever account the player is linked to. So a shared player means a shared
account, and all the cards sit in that one library. Passalong only ever sees
what Yoto shows it, and Yoto shows it one account.

## How Passalong behaves today

One Yoto login is one identity, so it maps to exactly one Passalong shelf.
Both parents connecting the same account land on the same shelf (here,
`mateosdad`). There is no separate shelf, wishlist, or identity per person from
a single shared login.

## The decision (2026-07-28)

For this household, the current behavior is fine. They keep one shared shelf and
coordinate socially:

- A quick "cool to offer these?" before listing cards, since it is a shared
  library and really the child's cards.
- "Keep this one off-limits" for anything precious.
- A heads-up to each other when making a borrow or a lend, so both know where a
  card is.

No code change needed. The app already supports this; the coordination is a
conversation, not a feature.

## If this ever gets its own chapter

The interesting unsolved version: a **shared shelf that two separate logins can
both sign into and both see and manage**, for co-parents who share one card
collection across two homes. Yoto assumes one account is one household; a
separated family is one account and two households. Nothing out there seems to
handle this well, so it could be a genuinely useful thing to build. Out of scope
for now, noted here for later.
