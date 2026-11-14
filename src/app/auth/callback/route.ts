/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Yoto redirects back here with an authorization code. We verify state, swap
 * the code for tokens, then either recognise a returning member or, for a brand
 * new Yoto account, require a valid invite before creating one. We store the
 * refresh token encrypted, sync the commercial cards, start a session, and send
 * the member to onboarding or their shelf.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { isInviteUsable } from "@/lib/invites";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { syncLibrary } from "@/lib/sync";
import {
  decodeJwtSub,
  exchangeCode,
  getLibraryRaw,
  type TokenResponse,
} from "@/lib/yoto";

export const dynamic = "force-dynamic";

const PENDING_INVITE = "pending_invite";

function errorPage(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Login error</title>` +
      `<body style="font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#22302a">` +
      `<h1>Login didn't finish</h1><p>${message}</p><p><a href="/">Back to start</a></p></body>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

interface Member {
  id: string;
  username: string | null;
  covenantVersionAgreed: string | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return errorPage(`Yoto reported "${oauthError}". Please try connecting again.`);
  }

  const cookieStore = await cookies();
  const stash = cookieStore.get("yoto_pkce")?.value;
  if (!code || !stash) {
    return errorPage(
      "Your sign-in didn't carry over (the session expired, or the login opened in a different browser than it returned to). Please start again from the app."
    );
  }

  // Guard the cookie parse: a corrupted cookie must not blank out the page.
  let verifier: string;
  let state: string;
  try {
    ({ verifier, state } = JSON.parse(stash) as {
      verifier: string;
      state: string;
    });
  } catch {
    return errorPage("Your sign-in session looked corrupted. Please start again from the app.");
  }

  if (!returnedState || returnedState !== state) {
    return errorPage("Could not verify that sign-in (state mismatch). Please start again from the app.");
  }

  // The token exchange is the most common failure point (a reused or expired
  // authorization code, often from an in-app browser loading the callback
  // twice). It must surface a readable message, never a blank 500.
  let tokens: TokenResponse;
  try {
    tokens = await exchangeCode(code, verifier);
  } catch (err) {
    console.error("[auth/callback] token exchange failed:", err);
    return errorPage(
      'That sign-in link expired or was already used. Tap "Back to start" below and connect your Yoto account again.'
    );
  }
  cookieStore.delete("yoto_pkce");

  // Everything past the exchange: a failure here still returns a readable page
  // and logs the real cause, so we can see it in the server logs.
  try {
    const sub = decodeJwtSub(tokens.access_token);
    if (!sub) return errorPage("Could not read your account id from Yoto. Please try again.");

    const refreshTokenEncrypted = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    // Recognise a returning member by their Yoto subject.
    const existing = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        covenantVersionAgreed: schema.users.covenantVersionAgreed,
      })
      .from(schema.users)
      .where(eq(schema.users.yotoSub, sub))
      .limit(1);

    let member: Member;

    if (existing.length > 0) {
      member = existing[0];
      if (refreshTokenEncrypted) {
        await db
          .update(schema.users)
          .set({ refreshTokenEncrypted })
          .where(eq(schema.users.id, member.id));
      }
    } else {
      // Brand new account: needs a valid invite. Codes are reusable, so this
      // just checks the code exists, then counts the join for the organizer.
      const inviteCode = cookieStore.get(PENDING_INVITE)?.value ?? "";
      if (!(await isInviteUsable(inviteCode))) {
        return errorPage(
          "You need a valid invite to join Passalong. Ask the group's organizer for one."
        );
      }

      const [created] = await db
        .insert(schema.users)
        .values({ yotoSub: sub, refreshTokenEncrypted })
        .returning({
          id: schema.users.id,
          username: schema.users.username,
          covenantVersionAgreed: schema.users.covenantVersionAgreed,
        });
      member = created;

      await db
        .update(schema.invites)
        .set({ uses: sql`${schema.invites.uses} + 1` })
        .where(eq(schema.invites.code, inviteCode));

      cookieStore.delete(PENDING_INVITE);
    }

    // Library sync is best-effort: if Yoto's API hiccups, still sign the member
    // in rather than blocking them. Their cards sync on the next visit.
    try {
      const library = await getLibraryRaw(tokens.access_token);
      const { synced } = await syncLibrary(member.id, library);
      console.log(`Synced ${synced} commercial card(s) for member ${member.id}.`);
    } catch (err) {
      console.error("[auth/callback] library sync failed (continuing login):", err);
    }

    const onboarded = Boolean(member.username && member.covenantVersionAgreed);
    const res = NextResponse.redirect(
      new URL(onboarded ? "/shelf" : "/welcome", url.origin)
    );
    res.cookies.set(SESSION_COOKIE, signSession(member.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("[auth/callback] failed after token exchange:", err);
    return errorPage("Something went wrong finishing your sign-in. Please try again in a moment.");
  }
}
