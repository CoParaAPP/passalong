/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * New members start here with an invite code. A valid code is remembered while
 * they log in with Yoto; the account is only created once they return.
 */

export const dynamic = "force-dynamic";

export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const { error, code } = await searchParams;
  return (
    <main className="onboard">
      <h1>Join the group</h1>
      <p>
        Passalong is invite-only. Enter the code a neighbor or organizer gave
        you, then connect your Yoto account.
      </p>
      {error && (
        <p className="form-error">
          That code isn&apos;t valid or has already been used. Check it, or ask
          for a new one.
        </p>
      )}
      <form method="post" action="/join/apply" className="stack">
        <label htmlFor="code">Invite code</label>
        <input
          id="code"
          name="code"
          defaultValue={code ?? ""}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
        />
        <button type="submit" className="primary">
          Continue to Yoto
        </button>
      </form>
      <p className="fineprint">
        Already a member? <a href="/auth/login">Connect your Yoto account</a>.
      </p>
    </main>
  );
}
