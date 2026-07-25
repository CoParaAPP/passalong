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

// Fun, kid-silly word pairs — easy to say, fun to get, and they fit a group of
// families way better than a random string. e.g. "turbo-taco", "zoomy-dino".
const ADJECTIVES = [
  "giggly", "wiggly", "silly", "zappy", "zoomy", "bouncy", "sparkly", "wobbly",
  "sneaky", "mighty", "turbo", "mega", "super", "jumbo", "funky", "zesty",
  "dizzy", "goofy", "speedy", "cheeky", "wacky", "snazzy", "bubbly", "peppy",
];
const NOUNS = [
  "pizza", "cookie", "dino", "robot", "rocket", "bubble", "noodle", "waffle",
  "pickle", "banana", "dragon", "unicorn", "jellybean", "popsicle", "muffin",
  "taco", "penguin", "narwhal", "sprinkle", "wombat", "doodle", "gizmo",
  "donut", "dumpling",
];

function pick(list: string[]): string {
  return list[randomBytes(1)[0] % list.length];
}

function makeCode(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
}

// The pg unique-violation code can sit on the driver error or its cause.
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; cur && i < 5; i++) {
    if (typeof cur === "object" && "code" in cur && cur.code === "23505") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  const note = process.argv.slice(2).join(" ") || null;

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  // Word pairs can collide; retry on a taken code until we land a free one.
  let code = "";
  for (let attempt = 0; attempt < 25; attempt++) {
    code = makeCode();
    try {
      await db.insert(invites).values({ code, note });
      break;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 24) continue;
      await pool.end();
      throw err;
    }
  }
  await pool.end();

  console.log(`\nInvite code: ${code}`);
  if (note) console.log(`Note: ${note}`);
  console.log(`\nShare a join link: <your-app-url>/join?code=${code}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
