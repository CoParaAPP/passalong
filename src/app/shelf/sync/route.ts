/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Re-pull the member's Yoto library on demand, using their stored refresh
 * token (so no fresh login needed). Yoto refresh tokens are single-use, so the
 * new one is stored immediately. If the token is gone or rejected, send them
 * through a full reconnect instead.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { decrypt, encrypt } from "@/lib/crypto";
import { getLibraryRaw, refreshTokens } from "@/lib/yoto";
import { syncLibrary } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();
  const shelf = new URL("/shelf", origin);

  const [u] = await db
    .select({ rt: schema.users.refreshTokenEncrypted })
    .from(schema.users)
    .where(eq(schema.users.id, me))
    .limit(1);

  // No stored token: nothing to refresh, so do a full reconnect.
  if (!u?.rt) {
    return NextResponse.redirect(new URL("/auth/login", origin), { status: 303 });
  }

  let accessToken: string;
  try {
    const tokens = await refreshTokens(decrypt(u.rt));
    accessToken = tokens.access_token;
    // Single-use rotation: persist the new refresh token right away.
    if (tokens.refresh_token) {
      await db
        .update(schema.users)
        .set({ refreshTokenEncrypted: encrypt(tokens.refresh_token) })
        .where(eq(schema.users.id, me));
    }
  } catch (err) {
    console.error("[shelf/sync] token refresh failed:", err);
    // Token revoked or expired → a full reconnect is the only recovery.
    return NextResponse.redirect(new URL("/auth/login", origin), { status: 303 });
  }

  try {
    const library = await getLibraryRaw(accessToken);
    const { synced } = await syncLibrary(me, library);
    shelf.searchParams.set("synced", String(synced));
  } catch (err) {
    console.error("[shelf/sync] library read failed:", err);
    shelf.searchParams.set("syncerror", "1");
  }

  return NextResponse.redirect(shelf, { status: 303 });
}
