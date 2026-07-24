/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Yoto redirects back here with an authorization code. We verify state, swap
 * the code for tokens, store the refresh token encrypted, sync the commercial
 * cards, start a session, and send the member to their shelf.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { syncLibrary } from "@/lib/sync";
import { decodeJwtSub, exchangeCode, getLibraryRaw } from "@/lib/yoto";

export const dynamic = "force-dynamic";

function errorPage(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Login error</title>` +
      `<body style="font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#22302a">` +
      `<h1>Login didn't finish</h1><p>${message}</p><p><a href="/">Start over</a></p></body>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return errorPage(`Yoto returned "${oauthError}".`);
  }

  const cookieStore = await cookies();
  const stash = cookieStore.get("yoto_pkce")?.value;
  if (!code || !stash) {
    return errorPage("Missing the login code or session.");
  }

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
  if (!sub) {
    return errorPage("Could not read the account id from Yoto.");
  }

  // Upsert the member and store the refresh token encrypted. This same path
  // runs on every future refresh (single-use rotation), so it is never stale.
  const refreshTokenEncrypted = tokens.refresh_token
    ? encrypt(tokens.refresh_token)
    : null;
  const [member] = await db
    .insert(schema.users)
    .values({ yotoSub: sub, refreshTokenEncrypted })
    .onConflictDoUpdate({
      target: schema.users.yotoSub,
      // Only overwrite the token when we actually got a new one.
      set: refreshTokenEncrypted ? { refreshTokenEncrypted } : { yotoSub: sub },
    })
    .returning({ id: schema.users.id });

  // Sync commercial cards. They land unlisted; nothing is offered yet.
  const library = await getLibraryRaw(tokens.access_token);
  const { synced } = await syncLibrary(member.id, library);
  console.log(`Synced ${synced} commercial card(s) for member ${member.id}.`);

  const res = NextResponse.redirect(new URL("/shelf", url.origin));
  res.cookies.set(SESSION_COOKIE, signSession(member.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
