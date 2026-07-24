/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * A minimal signed-cookie session. It holds only the member's internal user id,
 * signed with SESSION_SECRET so it cannot be forged. Identity itself comes from
 * Yoto OAuth; this cookie just remembers who already logged in. No Supabase Auth
 * and no browser-side data access.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "passalong_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set. See .env.example.");
  return s;
}

function mac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Signed cookie value for a logged-in member. */
export function signSession(userId: string): string {
  return `${userId}.${mac(userId)}`;
}

function verify(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const value = signed.slice(0, dot);
  const provided = Buffer.from(signed.slice(dot + 1));
  const expected = Buffer.from(mac(value));
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }
  return value;
}

/** The current member's id, or null if not signed in. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? verify(raw) : null;
}
