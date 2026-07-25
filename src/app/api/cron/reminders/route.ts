/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Scheduled trigger for the return-reminder job. Protected by CRON_SECRET so
 * only your scheduler can run it. Point any daily scheduler at this URL, e.g.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/reminders
 * (Vercel Cron, a crontab line, or a GitHub Action all work.)
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { generateReturnReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const key =
    bearer || new URL(request.url).searchParams.get("key") || "";

  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await generateReturnReminders();
  return NextResponse.json({ ok: true, ...summary });
}

// GET for schedulers that issue GETs; POST for those that issue POSTs.
export const GET = run;
export const POST = run;
