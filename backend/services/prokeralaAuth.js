import axios from "axios";
import { HttpError } from "../utils/httpError.js";

/**
 * Prokerala uses OAuth 2.0 client_credentials flow.
 *
 * This module:
 * - fetches access tokens from the token endpoint
 * - caches tokens in-memory until expiry
 * - de-dupes concurrent refreshes (single-flight)
 *
 * Note: In-memory caching is perfect for a single Node process. In multi-instance
 * deployments (Kubernetes/PM2 cluster), each instance will maintain its own cache.
 */

const DEFAULT_TOKEN_URL = "https://api.prokerala.com/token";
const EXPIRY_SAFETY_WINDOW_MS = 30_000; // refresh a bit early to avoid edge-of-expiry failures

const tokenCacheByCredential = new Map(); // index -> { token, expiresAtMs, inFlightRefresh }

function readJsonCredentials() {
  const raw = String(process.env.PROKERALA_CLIENT_CREDENTIALS_JSON || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        clientId: String(item?.clientId || "").trim(),
        clientSecret: String(item?.clientSecret || "").trim(),
      }))
      .filter((item) => item.clientId && item.clientSecret);
  } catch {
    return [];
  }
}

function readEnvCredentials() {
  const out = [];
  const regex = /^PROKERALA_CLIENT_ID(?:_(\d+))?$/;
  const matches = Object.keys(process.env)
    .map((key) => {
      const m = key.match(regex);
      if (!m) return null;
      const rank = m[1] ? Number(m[1]) : 1;
      return { key, rank };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  for (const { key, rank } of matches) {
    const suffix = rank === 1 ? "" : `_${rank}`;
    const clientId = String(process.env[key] || "").trim();
    const clientSecret = String(process.env[`PROKERALA_CLIENT_SECRET${suffix}`] || "").trim();
    if (!clientId || !clientSecret) continue;
    out.push({ clientId, clientSecret });
  }

  return out;
}

function getTokenConfigs() {
  const tokenUrl = process.env.PROKERALA_TOKEN_URL || DEFAULT_TOKEN_URL;
  const jsonList = readJsonCredentials();
  const envList = readEnvCredentials();
  const list = [...envList, ...jsonList];

  if (!list.length) {
    throw new HttpError(500, "Prokerala credentials are not configured on the server.", {
      code: "PROKERALA_CREDENTIALS_MISSING",
    });
  }

  return list.map((item) => ({ ...item, tokenUrl }));
}

function getCacheEntry(index) {
  if (!tokenCacheByCredential.has(index)) {
    tokenCacheByCredential.set(index, {
      token: null,
      expiresAtMs: 0,
      inFlightRefresh: null,
    });
  }
  return tokenCacheByCredential.get(index);
}

async function fetchNewAccessToken(credentialIndex) {
  const configs = getTokenConfigs();
  const cfg = configs[credentialIndex];
  if (!cfg) {
    throw new HttpError(500, "Invalid Prokerala credential index.", {
      code: "PROKERALA_CREDENTIAL_INDEX_INVALID",
      details: { credentialIndex, count: configs.length },
    });
  }
  const { clientId, clientSecret, tokenUrl } = cfg;

  try {
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: Number(process.env.PROKERALA_TIMEOUT_MS) || 15_000,
      }
    );

    const accessToken = response.data?.access_token;
    const expiresInSeconds = Number(response.data?.expires_in);

    if (!accessToken || !Number.isFinite(expiresInSeconds)) {
      throw new HttpError(502, "Invalid token response from Prokerala.", {
        code: "PROKERALA_TOKEN_INVALID_RESPONSE",
        details: { tokenUrl },
      });
    }

    const entry = getCacheEntry(credentialIndex);
    entry.token = accessToken;
    entry.expiresAtMs = Date.now() + expiresInSeconds * 1000;

    return accessToken;
  } catch (err) {
    const status = err.response?.status;
    const providerPayload = err.response?.data;

    // Log token fetch failure for debugging
    console.error(`[Prokerala Auth] Token fetch failed for credential ${credentialIndex + 1}:`, {
      status,
      providerPayload
    });

    throw new HttpError(502, "Failed to authenticate with Prokerala.", {
      code: "PROKERALA_TOKEN_FETCH_FAILED",
      details: {
        status,
        providerPayload,
        credentialIndex,
      },
      cause: err,
    });
  }
}

/**
 * Returns a valid Prokerala access token.
 * @param {{ forceRefresh?: boolean, credentialIndex?: number }} [options]
 */
export async function getProkeralaAccessToken(options = {}) {
  const { forceRefresh = false, credentialIndex = 0 } = options;
  const count = getProkeralaCredentialCount();
  if (!Number.isInteger(credentialIndex) || credentialIndex < 0 || credentialIndex >= count) {
    throw new HttpError(500, "Invalid Prokerala credential index.", {
      code: "PROKERALA_CREDENTIAL_INDEX_INVALID",
      details: { credentialIndex, count },
    });
  }

  const entry = getCacheEntry(credentialIndex);
  const now = Date.now();
  const isTokenValid =
    entry.token && entry.expiresAtMs - EXPIRY_SAFETY_WINDOW_MS > now;

  if (!forceRefresh && isTokenValid) return entry.token;

  if (!entry.inFlightRefresh) {
    entry.inFlightRefresh = fetchNewAccessToken(credentialIndex).finally(() => {
      const cur = getCacheEntry(credentialIndex);
      cur.inFlightRefresh = null;
    });
  }

  return entry.inFlightRefresh;
}

export function getProkeralaCredentialCount() {
  return getTokenConfigs().length;
}
