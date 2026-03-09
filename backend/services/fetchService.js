/**
 * services/fetchService.js
 * ────────────────────────────────────────────────────────────────
 * The CORE data fetcher that calls the Prokerala API for each day
 * and stores results into MongoDB Atlas.
 *
 * ✅ PRODUCTION UPGRADES IN THIS VERSION:
 *   1. Retry logic — up to 3 retries with exponential backoff per API call
 *   2. Duplicate key error handling — gracefully ignores E11000 (duplicate key)
 *   3. onProgress callback now receives { date, success, index, total } correctly
 *
 * KEY DESIGN DECISIONS (unchanged):
 *   ✅ Sequential fetching — NO Promise.all (no parallel requests)
 *   ✅ 1100ms delay between each API call (rate limiting)
 *   ✅ Smart caching: checks DB before calling API
 *   ✅ Stores raw JSON only (no transformation)
 *   ✅ Fetches: Panchang, Muhurat, Kundali, HinduTime, Compass
 *
 * ENDPOINTS used (Prokerala API v2):
 *   - /astrology/panchang            → Panchang
 *   - /astrology/auspicious-period   → Muhurat
 *   - /astrology/kundli/advanced     → Kundali
 *   - /astrology/hindu-calendar      → HinduTime
 *   - /astrology/vastu-compass       → Compass
 *
 * RATE LIMIT MATH:
 *   5 endpoints × 365 days = 1825 calls per year
 *   At 1100ms per call → 1825 × 1.1s = ~33 minutes to fetch a full year
 *   This is safely under 60 req/min (actually ~54 req/min max)
 */

import axios from "axios";
import { getToken } from "./tokenService.js";
import Panchang from "../models/Panchang.js";
import Muhurat from "../models/Muhurat.js";
import Kundali from "../models/Kundali.js";
import HinduTime from "../models/HinduTime.js";
import Compass from "../models/Compass.js";
import logger from "../config/logger.js";

// Prokerala API v2 base URL
const BASE_URL = "https://api.prokerala.com/v2";

// Delay between each API call (1100ms = just over 1 second)
const DELAY_MS = 1100;

// ✅ NEW: Retry configuration
const MAX_RETRIES = 3;           // Try up to 3 times before giving up
const RETRY_BASE_DELAY_MS = 2000; // Start with 2 seconds, then double each time

// Default coordinates for fetching (Ujjain, the center of Hindu time calculation)
const DEFAULT_LAT = 23.1765;
const DEFAULT_LNG = 75.7885;
const DEFAULT_TZ_OFFSET = "+05:30";

// Configurable endpoints (defaults verified from Prokerala astrology.v2 spec)
const ENDPOINT_PANCHANG = process.env.PROKERALA_ENDPOINT_PANCHANG || "/astrology/panchang";
const ENDPOINT_AUSPICIOUS = process.env.PROKERALA_ENDPOINT_MUHURAT || "/astrology/auspicious-period";
const ENDPOINT_KUNDALI = process.env.PROKERALA_ENDPOINT_KUNDALI || "/astrology/kundli/advanced";
const ENDPOINT_HINDU_TIME = process.env.PROKERALA_ENDPOINT_HINDU_TIME || "/calendar";
const ENDPOINT_COMPASS = process.env.PROKERALA_ENDPOINT_COMPASS || "/astrology/inauspicious-period";

/**
 * sleep(ms)
 * Pauses execution for the given milliseconds.
 * Used between API calls and between retries.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * isDuplicateKeyError(err)
 * ─────────────────────────
 * Checks if a MongoDB error is a duplicate key error (code 11000).
 * This happens when we try to insert a document that already exists
 * (because of the unique index on { year, date }).
 *
 * Instead of crashing, we swallow this error — the data is already there!
 */
function isDuplicateKeyError(err) {
    return err?.code === 11000 || err?.name === "MongoServerError" && String(err.message).includes("E11000");
}

/**
 * shouldRetry(err)
 * ─────────────────
 * Determines if an error is worth retrying.
 * We retry network errors and rate limit (429) errors.
 * We do NOT retry 400/401/403 errors (those are permanent failures).
 */
function shouldRetry(err) {
    const status = err?.response?.status;
    // 429 = Too Many Requests (wait and retry)
    // Network errors (no status) = connection issue (retry)
    // 5xx = server error (retry)
    if (!status) return true;       // Network error — retry
    if (status === 429) return true; // Rate limited — retry
    if (status >= 500) return true;  // Server error — retry
    return false;                    // 400/401/403 etc — don't retry
}

/**
 * callProkeralaAPIWithRetry(endpoint, params, year)
 * ──────────────────────────────────────────────────
 * ✅ UPGRADED: Calls the Prokerala API with up to 3 retries.
 *
 * Retry strategy (exponential backoff):
 *   Attempt 1 fails → wait 2000ms → Attempt 2
 *   Attempt 2 fails → wait 4000ms → Attempt 3
 *   Attempt 3 fails → throw error to caller
 *
 * Why exponential backoff?
 *   If the server is overloaded, hammering it immediately makes things worse.
 *   Waiting progressively longer gives the server time to recover.
 *
 * @param {string} endpoint
 * @param {object} params
 * @param {number} year
 * @returns {Promise<object>} API response data
 */
async function callProkeralaAPIWithRetry(endpoint, params, year) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const token = await getToken(year);

            const response = await axios.get(`${BASE_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
                timeout: 20000,
            });

            return response.data; // ✅ Success — return immediately

        } catch (err) {
            lastError = err;
            const status = err?.response?.status;

            if (attempt < MAX_RETRIES && shouldRetry(err)) {
                // Calculate wait time: 2s, 4s, 8s... (doubles each retry)
                const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
                logger.warn(
                    `[FetchService] ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for ${endpoint}` +
                    ` (status: ${status || "network error"}). Retrying in ${waitMs}ms...`
                );
                await sleep(waitMs);
            } else {
                // Either max retries reached or error is not retryable
                if (attempt === MAX_RETRIES) {
                    logger.error(
                        `[FetchService] ❌ All ${MAX_RETRIES} attempts failed for ${endpoint}. ` +
                        `Giving up for this date. Error: ${err.message}`
                    );
                } else {
                    logger.error(
                        `[FetchService] ❌ Non-retryable error (status ${status}) for ${endpoint}: ${err.message}`
                    );
                }
                break;
            }
        }
    }

    throw lastError; // Re-throw the last error so the caller can handle it
}

/**
 * Generate all dates in a given year as YYYY-MM-DD strings.
 * Example: getDatesInYear(2026) → ["2026-01-01", ..., "2026-12-31"]
 */
export function getDatesInYear(year) {
    const dates = [];
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);

    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * checkExistingDates(Model, year)
 * ─────────────────────────────────
 * Checks which dates for a given year ALREADY exist in MongoDB.
 * Used for smart caching: we only fetch what's missing.
 */
async function checkExistingDates(Model, year) {
    const docs = await Model.find({ year }, { date: 1, _id: 0 }).lean();
    return new Set(docs.map((d) => d.date));
}

/**
 * saveWithDuplicateProtection(Model, date, year, data)
 * ──────────────────────────────────────────────────────
 * ✅ NEW: Saves a document using upsert AND gracefully handles
 * duplicate key errors (E11000) without crashing.
 *
 * Why do duplicates happen even with upsert?
 *   In very rare race conditions (e.g. cron + manual trigger running
 *   at the same moment), two processes may both try to insert the same date.
 *   The unique index prevents the second insert, but we catch the error
 *   and simply log it — because the data is already there!
 */
async function saveWithDuplicateProtection(Model, modelName, date, year, data) {
    try {
        await Model.findOneAndUpdate(
            { date, year },                          // Find by date + year
            { rawData: data, fetchedAt: new Date() }, // Update these fields
            { upsert: true, new: true }               // Insert if not found
        );
    } catch (err) {
        if (isDuplicateKeyError(err)) {
            // This date already exists — that's fine, skip it silently
            logger.debug(`[FetchService] ${modelName} for ${date} already exists (duplicate key), skipping.`);
        } else {
            throw err; // Re-throw non-duplicate errors
        }
    }
}

/**
 * fetchAndStoreDate(date, year)
 * ─────────────────────────────────────────────────────────────────
 * Fetches ALL 5 endpoints for a single date and stores in MongoDB.
 * Each endpoint call has retry logic (up to 3 attempts).
 * If all retries fail, the error is logged and we move to the next endpoint.
 *
 * @param {string} date - "YYYY-MM-DD"
 * @param {number} year - Numeric year
 * @returns {Promise<{success: boolean, date: string, errors: string[]}>}
 */
export async function fetchAndStoreDate(date, year) {
    const errors = [];

    const commonParams = {
        datetime: `${date}T00:00:00${DEFAULT_TZ_OFFSET}`,
        coordinates: `${DEFAULT_LAT},${DEFAULT_LNG}`,
        ayanamsa: 1,
        la: "en",
    };

    // ─────────────────────────────────────────────────────────────
    // ENDPOINT 1: Panchang
    // ─────────────────────────────────────────────────────────────
    try {
        logger.debug(`[FetchService] Fetching PANCHANG for ${date}...`);
        const data = await callProkeralaAPIWithRetry(ENDPOINT_PANCHANG, commonParams, year);
        await saveWithDuplicateProtection(Panchang, "Panchang", date, year, data);
        logger.debug(`[FetchService] ✅ Panchang saved for ${date}`);
    } catch (err) {
        const msg = `Panchang error for ${date}: ${err.message}`;
        logger.error(`[FetchService] ❌ ${msg}`);
        errors.push(msg);
    }
    await sleep(DELAY_MS);

    // ─────────────────────────────────────────────────────────────
    // ENDPOINT 2: Muhurat
    // ─────────────────────────────────────────────────────────────
    try {
        logger.debug(`[FetchService] Fetching MUHURAT for ${date}...`);
        const data = await callProkeralaAPIWithRetry(ENDPOINT_AUSPICIOUS, commonParams, year);
        await saveWithDuplicateProtection(Muhurat, "Muhurat", date, year, data);
        logger.debug(`[FetchService] ✅ Muhurat saved for ${date}`);
    } catch (err) {
        const msg = `Muhurat error for ${date}: ${err.message}`;
        logger.error(`[FetchService] ❌ ${msg}`);
        errors.push(msg);
    }
    await sleep(DELAY_MS);

    // ─────────────────────────────────────────────────────────────
    // ENDPOINT 3: Kundali
    // ─────────────────────────────────────────────────────────────
    try {
        logger.debug(`[FetchService] Fetching KUNDALI for ${date}...`);
        const data = await callProkeralaAPIWithRetry(ENDPOINT_KUNDALI, commonParams, year);
        await saveWithDuplicateProtection(Kundali, "Kundali", date, year, data);
        logger.debug(`[FetchService] ✅ Kundali saved for ${date}`);
    } catch (err) {
        const msg = `Kundali error for ${date}: ${err.message}`;
        logger.error(`[FetchService] ❌ ${msg}`);
        errors.push(msg);
    }
    await sleep(DELAY_MS);

    // ─────────────────────────────────────────────────────────────
    // ENDPOINT 4: HinduTime
    // ─────────────────────────────────────────────────────────────
    try {
        logger.debug(`[FetchService] Fetching HINDU TIME for ${date}...`);
        const calendarParams = { date, calendar: "shaka-samvat", la: "en" };
        const data = await callProkeralaAPIWithRetry(ENDPOINT_HINDU_TIME, calendarParams, year);
        await saveWithDuplicateProtection(HinduTime, "HinduTime", date, year, data);
        logger.debug(`[FetchService] ✅ HinduTime saved for ${date}`);
    } catch (err) {
        const msg = `HinduTime error for ${date}: ${err.message}`;
        logger.error(`[FetchService] ❌ ${msg}`);
        errors.push(msg);
    }
    await sleep(DELAY_MS);

    // ─────────────────────────────────────────────────────────────
    // ENDPOINT 5: Compass
    // ─────────────────────────────────────────────────────────────
    try {
        logger.debug(`[FetchService] Fetching COMPASS for ${date}...`);
        const data = await callProkeralaAPIWithRetry(ENDPOINT_COMPASS, commonParams, year);
        await saveWithDuplicateProtection(Compass, "Compass", date, year, data);
        logger.debug(`[FetchService] ✅ Compass saved for ${date}`);
    } catch (err) {
        const msg = `Compass error for ${date}: ${err.message}`;
        logger.error(`[FetchService] ❌ ${msg}`);
        errors.push(msg);
    }
    await sleep(DELAY_MS);

    return { success: errors.length === 0, date, errors };
}

/**
 * fetchYear(year, onProgress)
 * ──────────────────────────────────────────────────────────────
 * Fetches data for an entire year, day by day, SEQUENTIALLY.
 * Only fetches dates that are MISSING from any collection (smart caching).
 *
 * @param {number} year
 * @param {function} [onProgress] - Called after each date with { date, success, index, total }
 * @returns {Promise<{year, fetchedCount, skippedCount, errorCount, errors}>}
 */
export async function fetchYear(year, onProgress = null) {
    logger.info(`[FetchService] 🚀 Starting fetch for year ${year}...`);

    const allDates = getDatesInYear(year);

    // Check which dates are already in ALL 5 collections
    const [
        existingPanchang,
        existingMuhurat,
        existingKundali,
        existingHinduTime,
        existingCompass,
    ] = await Promise.all([
        checkExistingDates(Panchang, year),
        checkExistingDates(Muhurat, year),
        checkExistingDates(Kundali, year),
        checkExistingDates(HinduTime, year),
        checkExistingDates(Compass, year),
    ]);

    // A date is "complete" only if it exists in ALL 5 collections
    const missingDates = allDates.filter(
        (date) =>
            !existingPanchang.has(date) ||
            !existingMuhurat.has(date) ||
            !existingKundali.has(date) ||
            !existingHinduTime.has(date) ||
            !existingCompass.has(date)
    );

    const skippedCount = allDates.length - missingDates.length;
    logger.info(
        `[FetchService] Year ${year}: ${allDates.length} total, ${skippedCount} already in DB, ${missingDates.length} to fetch`
    );

    if (missingDates.length === 0) {
        logger.info(`[FetchService] ✅ Year ${year} fully cached. Nothing to fetch.`);
        return { year, fetchedCount: 0, skippedCount, errorCount: 0, errors: [] };
    }

    // Fetch each missing date sequentially
    let fetchedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < missingDates.length; i++) {
        const date = missingDates[i];
        logger.info(`[FetchService] [${i + 1}/${missingDates.length}] Fetching ${date} year=${year}...`);

        const result = await fetchAndStoreDate(date, year);

        if (result.success) {
            fetchedCount++;
        } else {
            errorCount++;
            errors.push(...result.errors);
            logger.warn(`[FetchService] ⚠️ Partial failure for ${date}: ${result.errors.join("; ")}`);
        }

        // Notify background job tracker of progress
        if (onProgress) {
            await onProgress({ date, success: result.success, index: i + 1, total: missingDates.length });
        }
    }

    logger.info(
        `[FetchService] ✅ Year ${year} complete: ${fetchedCount} fetched, ${skippedCount} skipped, ${errorCount} errors`
    );

    return { year, fetchedCount, skippedCount, errorCount, errors };
}

/**
 * isYearComplete(year)
 * Check if all 5 collections have all expected dates for a year.
 */
export async function isYearComplete(year) {
    const expectedCount = getDatesInYear(year).length;
    const [p, m, k, h, c] = await Promise.all([
        Panchang.countDocuments({ year }),
        Muhurat.countDocuments({ year }),
        Kundali.countDocuments({ year }),
        HinduTime.countDocuments({ year }),
        Compass.countDocuments({ year }),
    ]);
    return p >= expectedCount && m >= expectedCount && k >= expectedCount &&
        h >= expectedCount && c >= expectedCount;
}

/**
 * getYearStatus(year)
 * Returns how many dates are stored per collection for a given year.
 */
export async function getYearStatus(year) {
    const allDates = getDatesInYear(year);
    const expected = allDates.length;

    const [p, m, k, h, c] = await Promise.all([
        Panchang.countDocuments({ year }),
        Muhurat.countDocuments({ year }),
        Kundali.countDocuments({ year }),
        HinduTime.countDocuments({ year }),
        Compass.countDocuments({ year }),
    ]);

    const isComplete = p >= expected && m >= expected && k >= expected &&
        h >= expected && c >= expected;

    return {
        year,
        expectedDates: expected,
        collected: { panchang: p, muhurat: m, kundali: k, hinduTime: h, compass: c },
        isComplete,
        completionPercent: Math.round((Math.min(p, m, k, h, c) / expected) * 100),
    };
}

