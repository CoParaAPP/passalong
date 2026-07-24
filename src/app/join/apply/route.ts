/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Checks the invite code and, if it's usable, remembers it in a short-lived
 * cookie while the member logs in with Yoto. The code is only consumed later,
 * on successful account creation in the callback.
 */

import { NextResponse } from "next/server";
import { isInviteUsable } from "@/lib/invites";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData();
  const code = (form.get("code") ?? "").toString().trim();

  if (!(await isInviteUsable(code))) {
    return NextResponse.redirect(new URL("/join?error=1", url.origin), {
      status: 303,
    });
  }

  const res = NextResponse.redirect(new URL("/auth/login", url.origin), {
    status: 303,
  });
  res.cookies.set("pending_invite", code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1800,
  });
  return res;
}
