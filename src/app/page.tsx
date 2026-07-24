/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export default function Home() {
  return (
    <main className="landing">
      <h1>Passalong</h1>
      <p>
        Our neighborhood shelf for Yoto cards. Connect your Yoto account and
        your cards sync in. Nothing is shared until you choose to share it.
      </p>
      {/* Wired up in the OAuth step; needs the registered client_id first. */}
      <button className="connect" disabled>
        Connect your Yoto account
      </button>
      <p className="fineprint">
        Unofficial, and not affiliated with Yoto. Personal Make Your Own
        recordings are never visible to this app.
      </p>
    </main>
  );
}
