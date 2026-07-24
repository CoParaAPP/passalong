/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Mint an invite code for the organizer to share. Usage:
 *   npm run invite:new -- "for the Patels"
 * The optional argument is a private note, never shown to members.
 */

import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { invites } from "../db/schema.ts";

// Unambiguous alphabet: no 0/O/1/I/L to keep spoken codes reliable.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  const note = process.argv.slice(2).join(" ") || null;

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  const code = makeCode();
  await db.insert(invites).values({ code, note });
  await pool.end();

  console.log(`\nInvite code: ${code}`);
  if (note) console.log(`Note: ${note}`);
  console.log(`\nShare a join link: <your-app-url>/join?code=${code}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
