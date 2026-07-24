/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type Tab = "shelf" | "wishlist" | "matches";

export function Nav({ active }: { active: Tab }) {
  return (
    <nav className="nav">
      <a className={active === "shelf" ? "on" : ""} href="/shelf">
        My shelf
      </a>
      <a className={active === "wishlist" ? "on" : ""} href="/wishlist">
        My wishlist
      </a>
      <a className={active === "matches" ? "on" : ""} href="/matches">
        Matches
      </a>
    </nav>
  );
}
