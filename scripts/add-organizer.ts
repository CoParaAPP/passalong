/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Promote a member to organizer by username. Usage:
 *   npm run organizer:add -- "neighbor_ed"
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { users } from "../db/schema.ts";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. See .env.example.");

  const username = process.argv.slice(2).join(" ").trim();
  if (!username) throw new Error('Give a username: npm run organizer:add -- "name"');

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  const updated = await db
    .update(users)
    .set({ isOrganizer: true })
    .where(eq(users.username, username))
    .returning({ id: users.id, username: users.username });
  await pool.end();

  if (updated.length === 0) {
    console.log(`No member named "${username}". Check the spelling.`);
    process.exit(1);
  }
  console.log(`\n${updated[0].username} is now an organizer.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
