/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Per-member opt-in to push. Asks permission, subscribes via the service
 * worker, and stores the subscription server-side. Notifications are off until
 * the member chooses this.
 */

"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "prompt" | "enabled" | "blocked" | "working";

export function EnablePush() {
  const [state, setState] = useState<State>("prompt");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "enabled" : "prompt");
    });
  }, []);

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "prompt");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "enabled" : "prompt");
    } catch {
      setState("prompt");
    }
  }

  if (state === "unsupported" || state === "enabled") return null;

  if (state === "blocked") {
    return (
      <p className="push-note">
        Notifications are blocked in your browser settings. Enable them for this
        site to get return reminders and proposals.
      </p>
    );
  }

  return (
    <div className="push-note">
      <span>Get a nudge when someone proposes or a return is due?</span>
      <button
        type="button"
        className="toggle offer"
        onClick={enable}
        disabled={state === "working"}
      >
        {state === "working" ? "Enabling…" : "Enable notifications"}
      </button>
    </div>
  );
}
