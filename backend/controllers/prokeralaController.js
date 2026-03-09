/**
 * controllers/prokeralaController.js
 * ────────────────────────────────────────────────────────────────
 * Controllers for individual endpoint queries (single-date lookups).
 *
 * Routes:
 *   GET /api/prokerala/panchang?date=YYYY-MM-DD
 *   GET /api/prokerala/muhurat?date=YYYY-MM-DD
 *   GET /api/prokerala/kundali?date=YYYY-MM-DD
 *   GET /api/prokerala/hindu-time?date=YYYY-MM-DD
 *   GET /api/prokerala/compass?date=YYYY-MM-DD
 *
 * Logic: Check DB first → fetch from API if not found → return data
 *
 * Also includes:
 *   GET /api/prokerala/tracker   → Show FetchTracker status
 *   GET /api/prokerala/token-status → Show token cache state
 */

import Panchang from "../models/Panchang.js";
import Muhurat from "../models/Muhurat.js";
import Kundali from "../models/Kundali.js";
import HinduTime from "../models/HinduTime.js";
import Compass from "../models/Compass.js";
import FetchTracker from "../models/FetchTracker.js";
import { fetchAndStoreDate } from "../services/fetchService.js";
import { getTokenCacheStatus } from "../services/tokenService.js";
import { runCronNow } from "../cron/yearlyFetchCron.js";
import logger from "../config/logger.js";

/**
 * parseDate(req)
 * ──────────────
 * Reads ?date=YYYY-MM-DD from query string and validates it.
 */
function parseDate(req) {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw { status: 400, message: "Invalid or missing `date` query param. Use YYYY-MM-DD format." };
    }
    return date;
}

/**
 * buildYearFromDate(date)
 * Extracts the numeric year from a YYYY-MM-DD string.
 */
function buildYearFromDate(date) {
    return parseInt(date.substring(0, 4), 10);
}

/**
 * getSingleDate(Model, date, year)
 * ─────────────────────────────────
 * Generic function to get one date's data from DB or fetch from API.
 */
async function getSingleDate(Model, modelName, date, year) {
    // Check DB first
    const existing = await Model.findOne({ date, year }).lean();
    if (existing) {
        logger.debug(`[ProkeralaController] ${modelName} cache HIT for ${date}`);
        return { source: "database", data: existing.rawData };
    }

    // Not in DB — fetch from API and store
    logger.info(`[ProkeralaController] ${modelName} cache MISS for ${date} — fetching from API`);
    await fetchAndStoreDate(date, year);

    const fresh = await Model.findOne({ date, year }).lean();
    if (!fresh) {
        throw { status: 502, message: `Failed to fetch ${modelName} data for date ${date}` };
    }

    return { source: "api", data: fresh.rawData };
}

// ─────────────────────────────────────────────────────────────────
// PANCHANG
// ─────────────────────────────────────────────────────────────────

export async function getPanchang(req, res) {
    try {
        const date = parseDate(req);
        const year = buildYearFromDate(date);
        const result = await getSingleDate(Panchang, "Panchang", date, year);
        return res.json({ success: true, date, ...result });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────
// MUHURAT
// ─────────────────────────────────────────────────────────────────

export async function getMuhurat(req, res) {
    try {
        const date = parseDate(req);
        const year = buildYearFromDate(date);
        const result = await getSingleDate(Muhurat, "Muhurat", date, year);
        return res.json({ success: true, date, ...result });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────
// KUNDALI
// ─────────────────────────────────────────────────────────────────

export async function getKundali(req, res) {
    try {
        const date = parseDate(req);
        const year = buildYearFromDate(date);
        const result = await getSingleDate(Kundali, "Kundali", date, year);
        return res.json({ success: true, date, ...result });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────
// HINDU TIME
// ─────────────────────────────────────────────────────────────────

export async function getHinduTime(req, res) {
    try {
        const date = parseDate(req);
        const year = buildYearFromDate(date);
        const result = await getSingleDate(HinduTime, "HinduTime", date, year);
        return res.json({ success: true, date, ...result });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────
// COMPASS
// ─────────────────────────────────────────────────────────────────

export async function getCompass(req, res) {
    try {
        const date = parseDate(req);
        const year = buildYearFromDate(date);
        const result = await getSingleDate(Compass, "Compass", date, year);
        return res.json({ success: true, date, ...result });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────
// FETCH TRACKER STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * getTrackerStatus(req, res)
 * ───────────────────────────
 * GET /api/prokerala/tracker
 * Shows the current cron progress (phase, year, status, errors)
 */
export async function getTrackerStatus(req, res) {
    try {
        const tracker = await FetchTracker.findOne().lean();
        if (!tracker) {
            return res.json({
                success: true,
                message: "FetchTracker not initialized yet. Cron has not run.",
                tracker: null,
            });
        }
        return res.json({ success: true, tracker });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────
// TOKEN STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * getTokenStatus(req, res)
 * ─────────────────────────
 * GET /api/prokerala/token-status
 * Shows cached token info for FREE and PAID keys.
 */
export async function getTokenStatus(req, res) {
    const status = getTokenCacheStatus();
    return res.json({ success: true, tokens: status });
}

// ─────────────────────────────────────────────────────────────────
// MANUAL CRON TRIGGER (for testing)
// ─────────────────────────────────────────────────────────────────

/**
 * triggerCronNow(req, res)
 * ─────────────────────────
 * POST /api/prokerala/cron/run-now
 * Manually triggers the cron job without waiting for 2 AM.
 * Use this to TEST your setup.
 */
export async function triggerCronNow(req, res) {
    try {
        logger.info("[ProkeralaController] Manual cron trigger requested");
        res.json({
            success: true,
            message: "Cron job triggered. Check server logs for progress. This runs in the background.",
        });
        // Run in background (don't await — let it run after response is sent)
        runCronNow().catch((err) => logger.error("[ProkeralaController] Background cron error:", err.message));
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
