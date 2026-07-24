/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * First-slice schema. Only the tables the sync-and-shelf slice needs.
 * Matching, loans, proposals, messaging, and location come later and get their
 * own migrations. Kept to standard SQL so it stays portable to any Postgres.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

// One member. Identity comes from Yoto OAuth, not a password.
// The encrypted Yoto refresh token lives here, never in the browser.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable Yoto account identifier (the OAuth subject), used to recognise a
  // returning member. Not shown to anyone.
  yotoSub: text("yoto_sub").notNull().unique(),
  username: text("username"),
  // AES-256-GCM ciphertext of the Yoto refresh token. Decrypted only in server
  // memory at refresh time. Never logged, never sent to the client.
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The commercial-card catalog, seeded from what members sync. Public catalog
// data only: no personal content ever reaches this table.
export const cards = pgTable("cards", {
  // Yoto's stable cardId is the primary key.
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  coverImageUrl: text("cover_image_url"),
});

// Which member has which card, and whether it is offered to the group.
// Everything synced arrives unlisted; sharing is an explicit opt-in.
export const ownership = pgTable("ownership", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  // unlisted (default) | lend | trade. Off-limits and loan states arrive later.
  visibility: text("visibility").notNull().default("unlisted"),
  firstSyncedAt: timestamp("first_synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
