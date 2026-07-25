/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Page guards. Bounce anyone who isn't signed in and onboarded, so member-only
 * pages can assume a real, set-up member.
 */

import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { getSessionUserId } from "./session";

/** Returns the member's id, or redirects to login / onboarding as needed. */
export async function requireOnboardedUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [member] = await db
    .select({
      username: schema.users.username,
      covenantVersionAgreed: schema.users.covenantVersionAgreed,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!member?.username || !member.covenantVersionAgreed) redirect("/welcome");
  return userId;
}

/** True if the signed-in member is an organizer. Cheap check for nav/links. */
export async function viewerIsOrganizer(): Promise<boolean> {
  const userId = await getSessionUserId();
  if (!userId) return false;
  const [member] = await db
    .select({ isOrganizer: schema.users.isOrganizer })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return Boolean(member?.isOrganizer);
}

/** Returns the organizer's id, or redirects away if the viewer isn't one. */
export async function requireOrganizer(): Promise<string> {
  const userId = await requireOnboardedUserId();
  const [member] = await db
    .select({ isOrganizer: schema.users.isOrganizer })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!member?.isOrganizer) redirect("/shelf");
  return userId;
}
