/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Saves onboarding: the chosen username and covenant agreement (version +
 * timestamp). Validates the username and enforces uniqueness.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { COVENANT_VERSION } from "@/lib/covenant";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[A-Za-z0-9 _-]{2,30}$/;

// Drizzle wraps the driver error, so the Postgres code can sit on `.cause`.
// Walk the chain looking for a unique-violation (23505).
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; cur && i < 5; i++) {
    if (typeof cur === "object" && "code" in cur && cur.code === "23505") {
      return true;
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

function back(origin: string, error: string, username: string): NextResponse {
  const to = new URL("/welcome", origin);
  to.searchParams.set("error", error);
  if (username) to.searchParams.set("username", username);
  return NextResponse.redirect(to, { status: 303 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/", url.origin), { status: 303 });
  }

  const form = await request.formData();
  const username = (form.get("username") ?? "").toString().trim();
  const agreed = form.get("agree") === "yes";

  if (!USERNAME_RE.test(username)) return back(url.origin, "username", username);
  if (!agreed) return back(url.origin, "agree", username);

  try {
    await db
      .update(schema.users)
      .set({
        username,
        covenantVersionAgreed: COVENANT_VERSION,
        covenantAgreedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  } catch (err) {
    if (isUniqueViolation(err)) return back(url.origin, "taken", username);
    throw err;
  }

  return NextResponse.redirect(new URL("/shelf", url.origin), { status: 303 });
}
