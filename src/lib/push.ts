/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Web Push delivery. Sends a notification to every device a member has
 * subscribed, and prunes subscriptions the push service reports as gone. VAPID
 * keys are server-side; the public key also reaches the browser to subscribe.
 */

import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Send a push to all of a member's devices. Never throws; returns how many landed. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await db
    .select({
      id: schema.pushSubscriptions.id,
      endpoint: schema.pushSubscriptions.endpoint,
      p256dh: schema.pushSubscriptions.p256dh,
      auth: schema.pushSubscriptions.auth,
    })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/shelf",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      );
      sent++;
    } catch (err) {
      // 404/410 mean the subscription is dead; drop it so we stop trying.
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id));
      }
    }
  }
  return sent;
}
