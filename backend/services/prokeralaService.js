import axios from "axios";
import { getProkeralaAccessToken, getProkeralaCredentialCount } from "./prokeralaAuth.js";
import { HttpError } from "../utils/httpError.js";

const DEFAULT_BASE_URL = "https://api.prokerala.com/v2";
const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_RATE_LIMIT_RETRIES = 2;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 500;

const client = axios.create({
  baseURL: process.env.PROKERALA_BASE_URL || DEFAULT_BASE_URL,
  timeout: Number(process.env.PROKERALA_TIMEOUT_MS) || 15_000,
});

const cacheTtlMs = Math.max(0, Number(process.env.PROKERALA_CACHE_TTL_MS) || DEFAULT_CACHE_TTL_MS);
const rateLimitRetries = Math.max(
  0,
  Number(process.env.PROKERALA_RATE_LIMIT_RETRIES) || DEFAULT_RATE_LIMIT_RETRIES
);
const rateLimitBackoffMs = Math.max(
  100,
  Number(process.env.PROKERALA_RATE_LIMIT_BACKOFF_MS) || DEFAULT_RATE_LIMIT_BACKOFF_MS
);
const responseCache = new Map(); // key -> { expiresAt:number, value:any }
const inflight = new Map(); // key -> Promise<any>

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableStringify(value) {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(",")}}`;
}

function makeCacheKey({ method, url, params }) {
  const m = String(method || "GET").toUpperCase();
  const u = String(url || "");
  const p = params ? stableStringify(params) : "";
  return `${m} ${u}?${p}`;
}

function toHttpError(err, fallbackMessage) {
  if (!err?.isAxiosError) return err;

  const status = err.response?.status;
  const providerPayload = err.response?.data;

  // If Prokerala is unreachable or responds without a status, surface as 502.
  const safeStatus = Number.isInteger(status) ? status : 502;

  return new HttpError(safeStatus, fallbackMessage, {
    code: "PROKERALA_API_ERROR",
    details: {
      status,
      providerPayload,
    },
    cause: err,
  });
}

function isInsufficientCreditError(err) {
  const status = err?.response?.status ?? err?.details?.status;
  if (status !== 403) return false;
  const payload = err?.response?.data ?? err?.details?.providerPayload;
  const text = JSON.stringify(payload || "").toLowerCase();
  return text.includes("insufficient credit balance");
}

function isRetryableForNextCredential(err) {
  const status = err?.response?.status ?? err?.details?.status;
  const code = err?.code;

  if (
    code === "PROKERALA_TOKEN_FETCH_FAILED" ||
    code === "PROKERALA_TOKEN_INVALID_RESPONSE" ||
    code === "PROKERALA_CREDENTIALS_MISSING"
  ) {
    return true;
  }

  // 401: token/account auth problem on this key
  // 403: quota/credit/scope issue on this key
  // 429: per-key throttling
  if (status === 401 || status === 403 || status === 429) return true;
  return isInsufficientCreditError(err);
}

/**
 * Low-level request helper for Prokerala.
 * Handles auth header injection and one retry on 401 (token expiry / invalidation).
 */
export async function prokeralaRequest(config) {
  const credentialCount = getProkeralaCredentialCount();
  let lastErr = null;
  const failures = [];

  const doRequest = async (token) =>
    client.request({
      ...config,
      headers: {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  // Start from a random credential to distribute load across multiple keys
  // Or use PROKERALA_START_INDEX environment variable to start from a specific credential
  const envStartIndex = Number(process.env.PROKERALA_START_INDEX);
  const startIndex = Number.isInteger(envStartIndex) && envStartIndex >= 0 && envStartIndex < credentialCount
    ? envStartIndex
    : Math.floor(Math.random() * credentialCount);

  console.log(`[Prokerala] Using credential start index: ${startIndex} (total: ${credentialCount})`);

  for (let i = 0; i < credentialCount; i++) {
    // Cycle through credentials, wrapping around to the beginning
    const credentialIndex = (startIndex + i) % credentialCount;
    let localRateLimitRetry = 0;
    try {
      while (true) {
        const token = await getProkeralaAccessToken({ credentialIndex });
        try {
          return await doRequest(token);
        } catch (rateErr) {
          const rateStatus = rateErr?.response?.status ?? rateErr?.details?.status;
          if (rateStatus === 429 && localRateLimitRetry < rateLimitRetries) {
            const waitMs = rateLimitBackoffMs * (localRateLimitRetry + 1);
            localRateLimitRetry += 1;
            await sleep(waitMs);
            continue;
          }
          throw rateErr;
        }
      }
    } catch (err) {
      const status = err?.response?.status ?? err?.details?.status;
      lastErr = err;
      failures.push({
        credentialIndex,
        code: err?.code || null,
        status: Number.isInteger(status) ? status : null,
        insufficientCredit: isInsufficientCreditError(err),
      });

      // Log which credential failed for debugging
      console.error(`[Prokerala] Credential ${credentialIndex + 1} failed:`, {
        status,
        code: err?.code,
        message: err?.message,
        details: err?.details?.providerPayload?.errors?.[0]?.detail || err?.response?.data?.errors?.[0]?.detail
      });

      // Token may be expired/revoked for this credential: refresh once.
      if (status === 401 && err?.response) {
        try {
          const freshToken = await getProkeralaAccessToken({ forceRefresh: true, credentialIndex });
          return await doRequest(freshToken);
        } catch (retryErr) {
          lastErr = retryErr;
          const retryStatus = retryErr?.response?.status ?? retryErr?.details?.status;
          if (
            credentialIndex < credentialCount - 1 &&
            (retryStatus === 401 || isRetryableForNextCredential(retryErr))
          ) {
            continue;
          }
          throw toHttpError(retryErr, "Prokerala request failed.");
        }
      }

      if (credentialIndex < credentialCount - 1 && isRetryableForNextCredential(err)) {
        continue;
      }

      throw toHttpError(err, "Prokerala request failed.");
    }
  }

  const allCreditExhausted =
    failures.length === credentialCount &&
    failures.every((f) => f.insufficientCredit === true);
  if (allCreditExhausted) {
    console.error("[Prokerala] All credentials exhausted:", failures);
    throw new HttpError(403, "All configured Prokerala credentials are out of credits.", {
      code: "PROKERALA_ALL_CREDENTIALS_EXHAUSTED",
      details: {
        attemptedCredentials: credentialCount,
        failures,
      },
    });
  }

  if (lastErr) {
    console.error("[Prokerala] Final error after trying all credentials:", {
      credentialCount,
      failures,
      lastError: lastErr?.message,
      lastStatus: lastErr?.response?.status
    });
    throw toHttpError(lastErr, "Prokerala request failed.");
  }

  throw new HttpError(502, "Prokerala request failed.", {
    code: "PROKERALA_API_ERROR",
  });
}

export async function prokeralaPost(path, data, options = {}) {
  const response = await prokeralaRequest({
    method: "POST",
    url: path,
    data,
    ...options,
  });
  return response.data;
}

export async function prokeralaGet(path, params, options = {}) {
  const useCache = cacheTtlMs > 0 && options?.cache !== false;
  const key = useCache ? makeCacheKey({ method: "GET", url: path, params }) : null;

  if (useCache) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const requestPromise = (async () => {
    const response = await prokeralaRequest({
      method: "GET",
      url: path,
      params,
      ...options,
    });

    const value = response.data;
    if (useCache) {
      responseCache.set(key, { expiresAt: Date.now() + cacheTtlMs, value });
    }
    return value;
  })();

  if (useCache) inflight.set(key, requestPromise);

  try {
    return await requestPromise;
  } finally {
    if (useCache) inflight.delete(key);
  }
}
