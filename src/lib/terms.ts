/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The borrow & swap terms, agreed per exchange by both people. The version is
 * stored on the proposal. Text mirrors docs/community-agreements.md ("Borrow &
 * Swap Terms", version 1); bump the version here when that wording changes.
 */

export const TERMS_VERSION = "1";
export const TERMS_TITLE = "Borrow & Swap Terms";

export const TERMS_PROMISES: { title: string; body: string }[] = [
  {
    title: "A return date is a promise.",
    body: "When you borrow, you pick a return-by date and you commit to it. The app will give you a friendly heads-up before it arrives. If life gets in the way, message the owner early and agree on a new date.",
  },
  {
    title: "Return it as you received it.",
    body: "Same case, same condition, ready for the next family. If something goes wrong, say so honestly and make it right with the owner.",
  },
  {
    title: "Lend only what you can part with.",
    body: "Kids are kids, and things happen. Only offer what you'd be at peace losing. If a card is precious, keep it home or mark it off-limits.",
  },
  {
    title: "This app connects people; it doesn't insure them.",
    body: "It is not a party to any exchange and does not guarantee, replace, or compensate for anything lost or damaged. Lending and borrowing are between the two of you, at your own risk, in good faith.",
  },
  {
    title: "Sort disagreements kindly, loop in the organizer if you're stuck.",
    body: "Most things resolve with a friendly message. If they don't, flag it and the organizer will help.",
  },
];

export const TERMS_CLOSING =
  "By proposing or accepting a borrow or swap, both people agree to these terms for that exchange.";
