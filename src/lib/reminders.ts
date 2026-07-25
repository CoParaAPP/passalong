/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The return-reminder job. Scans active borrows and creates one in-app
 * notification per loan when it is due soon or overdue. Idempotent: a unique
 * constraint means re-running never nags twice. Triggered daily by the
 * scheduler via /api/cron/reminders; later these records also feed Web Push.
 */

import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "./db";

// How many days ahead counts as "due soon".
const DUE_SOON_DAYS = 2;

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ReminderRun {
  scanned: number;
  dueSoon: number;
  overdue: number;
  created: number;
}

export async function generateReturnReminders(
  now: Date = new Date()
): Promise<ReminderRun> {
  const today = dayString(now);
  const soonCutoff = dayString(
    new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000)
  );

  // Active borrows with a due date, plus the card title and lender name.
  const loans = await db
    .select({
      loanId: schema.loans.id,
      borrowerId: schema.loans.borrowerId,
      dueBy: schema.loans.dueBy,
      cardTitle: schema.cards.title,
      lender: schema.users.username,
    })
    .from(schema.loans)
    .innerJoin(schema.cards, eq(schema.cards.id, schema.loans.cardId))
    .innerJoin(schema.users, eq(schema.users.id, schema.loans.lenderId))
    .where(
      and(eq(schema.loans.status, "active"), isNotNull(schema.loans.dueBy))
    );

  const rows: {
    userId: string;
    kind: string;
    loanId: string;
    body: string;
  }[] = [];
  let dueSoon = 0;
  let overdue = 0;

  for (const l of loans) {
    const due = l.dueBy as string;
    const lender = l.lender ?? "the owner";
    if (due < today) {
      overdue++;
      rows.push({
        userId: l.borrowerId,
        kind: "return_overdue",
        loanId: l.loanId,
        body: `"${l.cardTitle}" was due back to ${lender} on ${due}. Message them to sort out the return.`,
      });
    } else if (due <= soonCutoff) {
      dueSoon++;
      rows.push({
        userId: l.borrowerId,
        kind: "return_due_soon",
        loanId: l.loanId,
        body: `Heads up: "${l.cardTitle}" is due back to ${lender} on ${due}.`,
      });
    }
  }

  let created = 0;
  if (rows.length > 0) {
    const inserted = await db
      .insert(schema.notifications)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: schema.notifications.id });
    created = inserted.length;
  }

  return { scanned: loans.length, dueSoon, overdue, created };
}
