/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Yoto redirects back here with an authorization code. We verify state, swap
 * the code for tokens, store the refresh token encrypted, then pull the raw
 * library and show it. This is the checkpoint from the build checklist: inspect
 * what `/content/mine` actually returns before writing any card filter. No card
 * is stored or filtered yet.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  decodeJwtSub,
  exchangeCode,
  getLibraryRaw,
} from "@/lib/yoto";

export const dynamic = "force-dynamic";

function page(title: string, bodyHtml: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title}</title>` +
      `<body style="font-family:-apple-system,system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#22302a">` +
      bodyHtml +
      `</body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return page(
      "Login cancelled",
      `<h1>Login didn't finish</h1><p>Yoto returned: <code>${escapeHtml(
        oauthError
      )}</code>. <a href="/">Try again</a>.</p>`
    );
  }

  const cookieStore = await cookies();
  const stash = cookieStore.get("yoto_pkce")?.value;
  if (!code || !stash) {
    return page(
      "Login error",
      `<h1>Something went wrong</h1><p>Missing code or session. <a href="/">Start over</a>.</p>`
    );
  }

  const { verifier, state } = JSON.parse(stash) as {
    verifier: string;
    state: string;
  };

  // State check: guards against CSRF on the callback.
  if (!returnedState || returnedState !== state) {
    return page(
      "Login error",
      `<h1>Couldn't verify that login</h1><p>State mismatch. <a href="/">Start over</a>.</p>`
    );
  }

  const tokens = await exchangeCode(code, verifier);

  // The PKCE stash has done its job.
  cookieStore.delete("yoto_pkce");

  // Store the refresh token encrypted, keyed by the Yoto account. This same
  // write path overwrites the token on every future refresh (single-use
  // rotation), so it is never stale.
  const sub = decodeJwtSub(tokens.access_token);
  if (sub && tokens.refresh_token) {
    const refreshTokenEncrypted = encrypt(tokens.refresh_token);
    await db
      .insert(schema.users)
      .values({ yotoSub: sub, refreshTokenEncrypted })
      .onConflictDoUpdate({
        target: schema.users.yotoSub,
        set: { refreshTokenEncrypted },
      });
  }

  // The checkpoint: fetch and reveal the raw library response. Logged to the
  // server console and shown here. Nothing is filtered or stored as a card yet.
  const library = await getLibraryRaw(tokens.access_token);
  const rawJson = JSON.stringify(library, null, 2);
  console.log("=== raw /card/family/library response ===");
  console.log(rawJson);
  console.log("=== end /card/family/library ===");

  return page(
    "Raw library response",
    `<h1>Connected. Here is the raw /content/mine response.</h1>` +
      `<p>This is the checkpoint before any filter. Granted scope: <code>${escapeHtml(
        tokens.scope ?? "(not reported)"
      )}</code>. Refresh token stored: <strong>${
        tokens.refresh_token ? "yes (encrypted)" : "no"
      }</strong>.</p>` +
      `<p>Token values are not shown here on purpose. The full JSON is also printed in the dev server log.</p>` +
      `<pre style="background:#f4f1ea;padding:1rem;border-radius:.5rem;overflow:auto;font-size:.8rem">${escapeHtml(
        rawJson
      )}</pre>`
  );
}
