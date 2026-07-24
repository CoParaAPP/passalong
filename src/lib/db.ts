/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Server-side Postgres access via Drizzle. The connection string is the only
 * coupling to the host, so the app stays swappable to any Postgres. All data
 * access goes through here on the server; the browser never talks to the
 * database directly.
 */

import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

// A single pool per server process. Managed Postgres hosts (incl. Supabase)
// take a plain connection string; TLS is negotiated from the URL.
const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export { schema };
