/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Per-member push toggle. Shows the current state and lets a member turn
 * notifications on or off anytime. Notifications are off until they choose.
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

type State = "unsupported" | "blocked" | "off" | "on" | "working";

export function EnablePush() {
  const [state, setState] = useState<State>("off");

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
      setState(existing ? "on" : "off");
    });
  }, []);

  async function turnOn() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
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
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sub),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "unsupported") return null;

  if (state === "blocked") {
    return (
      <p className="push-note">
        Notifications are blocked in your browser settings. Turn them on for this
        site to get return reminders and proposals.
      </p>
    );
  }

  if (state === "on") {
    return (
      <div className="push-note">
        <span>🔔 Notifications are on.</span>
        <button type="button" className="dismiss" onClick={turnOff}>
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className="push-note">
      <span>Get a nudge when someone proposes or a return is due?</span>
      <button
        type="button"
        className="toggle offer"
        style={{ width: "auto" }}
        onClick={turnOn}
        disabled={state === "working"}
      >
        {state === "working" ? "Working…" : "Turn on notifications"}
      </button>
    </div>
  );
}
