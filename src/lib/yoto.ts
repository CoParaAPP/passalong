/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The only module that talks to Yoto. Authorization Code + PKCE login, token
 * exchange, single-use refresh-token rotation, and the library read. Requests
 * only `family:library:view offline_access`; never `user:content:view`, so
 * personal Make Your Own recordings are structurally unreadable.
 */

import "server-only";
import { createHash, randomBytes } from "node:crypto";

const LOGIN_BASE = "https://login.yotoplay.com";
const API_BASE = "https://api.yotoplay.com";

export const AUDIENCE = "https://api.yotoplay.com";
export const SCOPE = "family:library:view offline_access";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function createState(): string {
  return base64url(randomBytes(16));
}

function config() {
  const clientId = process.env.YOTO_CLIENT_ID;
  const redirectUri = process.env.YOTO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error(
      "YOTO_CLIENT_ID and YOTO_REDIRECT_URI must be set. See .env.example."
    );
  }
  // Optional: confidential clients also send a secret. Public PKCE clients omit
  // it. Either is supported.
  return { clientId, redirectUri, clientSecret: process.env.YOTO_CLIENT_SECRET };
}

/** The URL to send the user to on Yoto's own login page. */
export function authorizeUrl(challenge: string, state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    audience: AUDIENCE,
    scope: SCOPE,
    response_type: "code",
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    state,
  });
  return `${LOGIN_BASE}/authorize?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${LOGIN_BASE}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Yoto token endpoint ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Exchange the authorization code for tokens (uses the same redirect_uri). */
export function exchangeCode(
  code: string,
  verifier: string
): Promise<TokenResponse> {
  const { clientId, redirectUri, clientSecret } = config();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code_verifier: verifier,
    code,
    redirect_uri: redirectUri,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  return postToken(body);
}

/**
 * Refresh the access token. Yoto refresh tokens are single-use: the response
 * carries a new refresh token that the caller must persist immediately,
 * overwriting the old one, or the member gets locked out.
 */
export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = config();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  return postToken(body);
}

/**
 * Raw family-library read. `/card/family/library` is the endpoint that pairs
 * with the `family:library:view` scope and returns the family's owned cards.
 * (`/content/mine` is the Make Your Own endpoint and requires the personal
 * `user:content:view` scope, which we deliberately never request; calling it
 * returns 403, confirming personal recordings are out of reach.) The returned
 * shape is inspected before any filter is written.
 */
export async function getLibraryRaw(accessToken: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/card/family/library`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`/card/family/library ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Pull the `sub` claim from a JWT without verifying it (our own token, over TLS). */
export function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    const claims = JSON.parse(json) as { sub?: string };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
