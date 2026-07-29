/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Organizer view: open flags to triage, and recently resolved ones. Only
 * organizers reach this page.
 */

import { aliasedTable, count, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOrganizer } from "@/lib/guards";
import { Hero } from "../hero";

export const dynamic = "force-dynamic";

function when(ts: Date): string {
  return ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Organizer() {
  await requireOrganizer();

  const reporter = aliasedTable(schema.users, "reporter");

  const flags = await db
    .select({
      id: schema.flags.id,
      body: schema.flags.body,
      context: schema.flags.context,
      status: schema.flags.status,
      createdAt: schema.flags.createdAt,
      resolvedAt: schema.flags.resolvedAt,
      resolutionNote: schema.flags.resolutionNote,
      reporterName: reporter.username,
    })
    .from(schema.flags)
    .innerJoin(reporter, eq(reporter.id, schema.flags.reporterId))
    .orderBy(desc(schema.flags.createdAt));

  const open = flags.filter((f) => f.status === "open");
  const resolved = flags.filter((f) => f.status === "resolved").slice(0, 20);

  // Standing invite codes to share with neighbors.
  const invites = await db
    .select({
      code: schema.invites.code,
      uses: schema.invites.uses,
      note: schema.invites.note,
    })
    .from(schema.invites)
    .orderBy(desc(schema.invites.createdAt));

  // Group pulse: aggregate counts only, never a who-owns-what list.
  const [{ members }] = await db
    .select({ members: count() })
    .from(schema.users);
  const [{ offered }] = await db
    .select({ offered: count() })
    .from(schema.ownership)
    .where(inArray(schema.ownership.visibility, ["lend", "trade"]));
  const [{ borrows }] = await db
    .select({ borrows: count() })
    .from(schema.loans)
    .where(eq(schema.loans.status, "active"));

  return (
    <>
      <Hero active="organizer" />
      <main className="shelf">
      <header className="shelf-head">
        <h1>Organizer</h1>
        <p>
          {open.length} open flag{open.length === 1 ? "" : "s"} to look at.
        </p>
      </header>

      <header className="shelf-head section">
        <h2>Group</h2>
        <p>
          {members} member{members === 1 ? "" : "s"} · {offered} card
          {offered === 1 ? "" : "s"} offered · {borrows} active borrow
          {borrows === 1 ? "" : "s"}
        </p>
      </header>

      <header className="shelf-head section">
        <h2>Invite codes</h2>
        <p>Share one of these with a neighbor to let them join. They&apos;re
          reusable, so one code works for the whole group.</p>
      </header>
      {invites.length === 0 ? (
        <p className="empty">
          No codes yet. Make one with <code>npm run invite:new</code>.
        </p>
      ) : (
        <ul className="proposals">
          {invites.map((inv) => (
            <li key={inv.code} className="proposal">
              <p className="proposal-line">
                <strong>{inv.code}</strong>
                {inv.note ? ` · ${inv.note}` : ""}
              </p>
              <p className="status status-pending">
                {inv.uses} joined with this code
              </p>
            </li>
          ))}
        </ul>
      )}

      {open.length === 0 ? (
        <p className="empty">Nothing open. All quiet.</p>
      ) : (
        <ul className="proposals">
          {open.map((f) => (
            <li key={f.id} className="proposal">
              <p className="proposal-line">
                <strong>{f.reporterName ?? "A neighbor"}</strong> ·{" "}
                {when(f.createdAt)}
                {f.context ? ` · ${f.context}` : ""}
              </p>
              <p className="flag-body">{f.body}</p>
              <form method="post" action="/organizer/resolve" className="accept-form">
                <input type="hidden" name="flagId" value={f.id} />
                <input
                  type="text"
                  name="note"
                  placeholder="Resolution note (optional)"
                  maxLength={500}
                />
                <button type="submit" className="toggle offer">
                  Mark resolved
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <>
          <header className="shelf-head section">
            <h2>Recently resolved</h2>
          </header>
          <ul className="proposals">
            {resolved.map((f) => (
              <li key={f.id} className="proposal">
                <p className="proposal-line">
                  <strong>{f.reporterName ?? "A neighbor"}</strong>
                  {f.context ? ` · ${f.context}` : ""}
                </p>
                <p className="flag-body">{f.body}</p>
                <p className="status status-accepted">
                  resolved
                  {f.resolutionNote ? ` — "${f.resolutionNote}"` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      </main>
    </>
  );
}
