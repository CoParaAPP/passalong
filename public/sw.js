/*
 * Passalong service worker: a minimal offline app shell.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * This shell caches the landing route so the app opens when offline. It does
 * not cache any Yoto data or authenticated responses. Bump CACHE_VERSION to
 * roll the cache when the shell changes.
 */

const CACHE_VERSION = "passalong-shell-v3";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GETs. Never touch API calls, auth, or other hosts,
  // so no authenticated or Yoto response is ever cached.
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Network-first for navigations, falling back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  // Cache-first for the static shell assets.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Web Push: show the notification the server sent.
self.addEventListener("push", (event) => {
  let data = { title: "Passalong", body: "", url: "/shelf" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/shelf" },
    })
  );
});

// Tapping a notification focuses an open tab or opens the app at the target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/shelf";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
