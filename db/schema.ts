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
  date,
  unique,
} from "drizzle-orm/pg-core";

// One member. Identity comes from Yoto OAuth, not a password.
// The encrypted Yoto refresh token lives here, never in the browser.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable Yoto account identifier (the OAuth subject), used to recognise a
  // returning member. Not shown to anyone.
  yotoSub: text("yoto_sub").notNull().unique(),
  // Chosen display name. No real name required. Unique across the group.
  username: text("username").unique(),
  // Which covenant version the member agreed to, and when. Null until they
  // complete onboarding.
  covenantVersionAgreed: text("covenant_version_agreed"),
  covenantAgreedAt: timestamp("covenant_agreed_at", { withTimezone: true }),
  // AES-256-GCM ciphertext of the Yoto refresh token. Decrypted only in server
  // memory at refresh time. Never logged, never sent to the client.
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invite-only gate. An organizer mints a code; a brand-new Yoto login can only
// create an account by presenting an unused one. Existing members never need it.
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  // Optional reminder of who the code was made for. Not shown to members.
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Set atomically when the code is claimed, so a code works exactly once.
  usedByUserId: uuid("used_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  usedAt: timestamp("used_at", { withTimezone: true }),
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
}, (t) => [
  // One ownership row per member per card. Lets a re-sync insert only genuinely
  // new cards and never disturb the visibility a member already chose.
  unique("ownership_user_card_unique").on(t.userId, t.cardId),
]);

// Cards a member wants. The picker is drawn from the catalog (the union of
// everyone's synced cards), since there is no public Yoto catalog endpoint.
export const wishlist = pgTable("wishlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  unique("wishlist_user_card_unique").on(t.userId, t.cardId),
]);

// A request from one member to another to borrow or swap a card. Explicit app
// state; accept/decline is the owner's, and both sides agree to the terms.
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Who is asking, and who owns the card.
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  // borrow | swap
  type: text("type").notNull(),
  // For a swap: the card the proposer offers in exchange.
  offeredCardId: text("offered_card_id").references(() => cards.id, {
    onDelete: "set null",
  }),
  // pending | accepted | declined | completed
  status: text("status").notNull().default("pending"),
  // Borrows only. Stored as a plain date (no time); read back as 'YYYY-MM-DD'.
  returnBy: date("return_by", { mode: "string" }),
  // Agreed at acceptance by the owner.
  conditionNote: text("condition_note"),
  // Which borrow/swap terms version both sides agreed to.
  termsVersionAgreed: text("terms_version_agreed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
