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
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { isInviteUsable } from "@/lib/invites";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { syncLibrary } from "@/lib/sync";
import { decodeJwtSub, exchangeCode, getLibraryRaw } from "@/lib/yoto";

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

  if (oauthError) return errorPage(`Yoto returned "${oauthError}".`);

  const cookieStore = await cookies();
  const stash = cookieStore.get("yoto_pkce")?.value;
  if (!code || !stash) return errorPage("Missing the login code or session.");

  const { verifier, state } = JSON.parse(stash) as {
    verifier: string;
    state: string;
  };
  if (!returnedState || returnedState !== state) {
    return errorPage("Could not verify that login (state mismatch).");
  }

  const tokens = await exchangeCode(code, verifier);
  cookieStore.delete("yoto_pkce");

  const sub = decodeJwtSub(tokens.access_token);
  if (!sub) return errorPage("Could not read the account id from Yoto.");

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
    // Brand new account: only allowed in with a valid, unused invite.
    const inviteCode = cookieStore.get(PENDING_INVITE)?.value ?? "";
    if (!(await isInviteUsable(inviteCode))) {
      return errorPage(
        "You need a valid invite to join Passalong. Ask the group's organizer for one."
      );
    }

    try {
      member = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(schema.users)
          .values({ yotoSub: sub, refreshTokenEncrypted })
          .returning({
            id: schema.users.id,
            username: schema.users.username,
            covenantVersionAgreed: schema.users.covenantVersionAgreed,
          });

        // Claim the invite atomically: only succeeds if still unused.
        const claimed = await tx
          .update(schema.invites)
          .set({ usedByUserId: created.id, usedAt: new Date() })
          .where(
            and(
              eq(schema.invites.code, inviteCode),
              isNull(schema.invites.usedByUserId)
            )
          )
          .returning({ id: schema.invites.id });
        if (claimed.length === 0) throw new Error("INVITE_TAKEN");

        return created;
      });
    } catch {
      return errorPage("That invite was just used. Ask the organizer for another.");
    }
    cookieStore.delete(PENDING_INVITE);
  }

  const library = await getLibraryRaw(tokens.access_token);
  const { synced } = await syncLibrary(member.id, library);
  console.log(`Synced ${synced} commercial card(s) for member ${member.id}.`);

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
}
