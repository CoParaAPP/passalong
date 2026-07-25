/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Hero } from "./hero";

export default function Home() {
  return (
    <>
      <Hero />
      <main className="landing">
        <h1>Share the shelf</h1>
        <p>
          Our neighborhood shelf for Yoto cards. Connect your Yoto account and
          your cards sync in. Nothing is shared until you choose to share it.
        </p>
      <a className="connect" href="/join">
        Join with an invite
      </a>
      <p className="fineprint">
        Already a member? <a href="/auth/login">Connect your Yoto account</a>.
      </p>
      <p className="fineprint">
        Unofficial, and not affiliated with Yoto. Personal Make Your Own
        recordings are never visible to this app.
      </p>
      </main>
    </>
  );
}
