/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The community covenant, agreed once at signup. The version string is stored
 * on the member's record with the moment they agreed. Text mirrors
 * docs/community-agreements.md ("Our Community Covenant", version 1); bump the
 * version here whenever that wording changes so agreement history stays honest.
 */

// v2 folds the borrow & swap terms into the one-time signup agreement, so
// borrowing no longer needs a checkbox every time.
export const COVENANT_VERSION = "2";
export const COVENANT_TITLE = "Our Community Covenant";

export const COVENANT_INTRO =
  "We started this because sharing is good for our kids and good for us. A card one family has outgrown is a delight in another home. Passing it around the neighborhood beats letting it sit in a drawer, and it beats buying another one. When you join, you're agreeing to a few simple promises to each other.";

export const COVENANT_PROMISES: { title: string; body: string }[] = [
  {
    title: "Move in good faith.",
    body: "Offer honestly, borrow with care, and return things the way you'd want yours returned.",
  },
  {
    title: "Look after each other's families.",
    body: "No hate speech, no harassment, no persecution of any family for who they are or what they believe. Respect what people choose to share and what they choose to keep private, and never use anything you learn here to target, pressure, or out another family. What's on someone's shelf is their business.",
  },
  {
    title: "Keep it kind and keep it legal.",
    body: "Nothing illegal, nothing that puts a child at risk, nothing you'd be uncomfortable explaining to the group.",
  },
  {
    title: "Assume the best of your neighbors.",
    body: "A late return is usually a busy week, not a slight. Reach out, give grace, and sort it out like neighbors do.",
  },
  {
    title: "This is a group of parents helping parents.",
    body: "If something feels off, tell the organizer. We'd rather hear about it early and handle it with care.",
  },
];

export const COVENANT_CLOSING =
  "By joining, you agree to these promises to each other.";
