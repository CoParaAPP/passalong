/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * First-login onboarding: pick a username and agree to the community covenant.
 * Shown until both are done; a member who is already set up is sent to the shelf.
 */

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { Hero } from "../hero";
import {
  COVENANT_CLOSING,
  COVENANT_INTRO,
  COVENANT_PROMISES,
  COVENANT_TITLE,
} from "@/lib/covenant";
import { TERMS_CLOSING, TERMS_PROMISES, TERMS_TITLE } from "@/lib/terms";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  username: "Pick a username 2–30 characters, using letters, numbers, spaces, - or _.",
  taken: "That username is taken. Try another.",
  agree: "Please agree to the covenant to join.",
};

export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; username?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [member] = await db
    .select({
      username: schema.users.username,
      covenantVersionAgreed: schema.users.covenantVersionAgreed,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (member?.username && member.covenantVersionAgreed) redirect("/shelf");

  const { error, username } = await searchParams;

  return (
    <>
      <Hero />
      <main className="onboard">
      <h1>Welcome</h1>
      <p>
        Your cards are synced and private. Two quick things before your shelf:
        pick a name and agree to how we treat each other here.
      </p>

      {error && <p className="form-error">{ERRORS[error] ?? "Please check the form."}</p>}

      <form method="post" action="/welcome/save" className="stack">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          defaultValue={username ?? ""}
          placeholder="no real name needed"
          autoComplete="off"
          maxLength={30}
          required
        />

        <section className="covenant" aria-label={COVENANT_TITLE}>
          <h2>{COVENANT_TITLE}</h2>
          <p>{COVENANT_INTRO}</p>
          <dl>
            {COVENANT_PROMISES.map((p) => (
              <div key={p.title}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
          <p>{COVENANT_CLOSING}</p>
        </section>

        <section className="covenant" aria-label={TERMS_TITLE}>
          <h2>{TERMS_TITLE}</h2>
          <p>When you borrow or swap, these apply:</p>
          <dl>
            {TERMS_PROMISES.map((p) => (
              <div key={p.title}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
          <p>{TERMS_CLOSING}</p>
        </section>

        <label className="agree">
          <input type="checkbox" name="agree" value="yes" required /> I&apos;ve
          read and agree to the covenant and the borrow &amp; swap terms.
        </label>

        <button type="submit" className="primary">
          Go to my shelf
        </button>
      </form>
      </main>
    </>
  );
}
