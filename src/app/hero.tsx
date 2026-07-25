/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The top hero: the inverted logo and wordmark, with the nav pills when a member
 * is signed in (pass `active`). Landing and onboarding render it with no
 * `active`, so it shows brand only.
 */

import { viewerIsOrganizer } from "@/lib/guards";

type Tab = "shelf" | "wishlist" | "matches" | "proposals" | "report" | "organizer";

export async function Hero({ active }: { active?: Tab }) {
  const isOrganizer = active ? await viewerIsOrganizer() : false;

  return (
    <header className="hero">
      <div className="hero-inner">
        <a className="brand" href={active ? "/shelf" : "/"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo-mark.png" alt="" width={46} height={46} />
          <span className="brand-name">Passalong</span>
        </a>
        {active && (
          <nav className="hnav">
            <a className={active === "shelf" ? "on" : ""} href="/shelf">Shelf</a>
            <a className={active === "wishlist" ? "on" : ""} href="/wishlist">Wishlist</a>
            <a className={active === "matches" ? "on" : ""} href="/matches">Matches</a>
            <a className={active === "proposals" ? "on" : ""} href="/proposals">Proposals</a>
            <a className={active === "report" ? "on" : ""} href="/flag">Report</a>
            {isOrganizer && (
              <a className={active === "organizer" ? "on" : ""} href="/organizer">Organizer</a>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
