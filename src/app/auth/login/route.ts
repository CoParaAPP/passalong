/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Starts the Yoto login. Generates a PKCE pair and a state value, stores them
 * in a short-lived httpOnly cookie (never in the browser's reach), and sends
 * the user to Yoto's own login page.
 */

import { NextResponse } from "next/server";
import { authorizeUrl, createPkce, createState } from "@/lib/yoto";

export const dynamic = "force-dynamic";

export async function GET() {
  const { verifier, challenge } = createPkce();
  const state = createState();

  const res = NextResponse.redirect(authorizeUrl(challenge, state));
  res.cookies.set("yoto_pkce", JSON.stringify({ verifier, state }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
