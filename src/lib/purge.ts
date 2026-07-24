/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Data purge. Deletes all Yoto-derived data for a member. Built now, before any
 * real member data is stored, so the guarantee in SECURITY.md is real from day
 * one. Called on an explicit delete request, and whenever Yoto API access for a
 * member is revoked.
 */

import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Remove everything tied to a member: their ownership rows and their stored
 * refresh token. Ownership rows cascade from the user delete, so removing the
 * user row clears the member's data in one step. Catalog `cards` are shared,
 * public commercial data and are intentionally left in place.
 */
export async function purgeMember(userId: string): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/**
 * Called when Yoto access is revoked but we keep the member row (e.g. they may
 * reconnect). Drops just the stored token and their card offers, so no stale
 * credential lingers.
 */
export async function purgeYotoAccess(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.ownership)
      .where(eq(schema.ownership.userId, userId));
    await tx
      .update(schema.users)
      .set({ refreshTokenEncrypted: null })
      .where(eq(schema.users.id, userId));
  });
}
