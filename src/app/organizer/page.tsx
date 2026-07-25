/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Organizer view: open flags to triage, and recently resolved ones. Only
 * organizers reach this page.
 */

import { aliasedTable, desc, eq } from "drizzle-orm";
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
