/**
 * routes/prokerala.js
 * ────────────────────────────────────────────────────────────────
 * All routes for the new MongoDB-backed Prokerala data system.
 *
 * Base path: /api/prokerala (registered in server.js)
 *
 * Routes:
 * ──────────────────────────────────────────────────────────────
 *   GET  /api/prokerala/year/:year         → Smart year fetch
 *   GET  /api/prokerala/year/:year/status  → Just the status
 *   GET  /api/prokerala/panchang           → Single date panchang
 *   GET  /api/prokerala/muhurat            → Single date muhurat
 *   GET  /api/prokerala/kundali            → Single date kundali
 *   GET  /api/prokerala/hindu-time         → Single date hindu time
 *   GET  /api/prokerala/compass            → Single date compass
 *   GET  /api/prokerala/tracker            → Cron progress tracker
 *   GET  /api/prokerala/token-status       → Auth token cache info
 *   POST /api/prokerala/cron/run-now       → Manual cron trigger
 */

import express from "express";
import {
    getPanchang,
    getMuhurat,
    getKundali,
    getHinduTime,
    getCompass,
    getTrackerStatus,
    getTokenStatus,
    triggerCronNow,
} from "../controllers/prokeralaController.js";
import { getYear, getYearStatusOnly } from "../controllers/yearController.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// YEAR ROUTES
// ─────────────────────────────────────────────────────────────────

// GET /api/prokerala/year/2026
// Fetches full year data (smart cache: DB first, API if missing)
router.get("/year/:year", getYear);

// GET /api/prokerala/year/2026/status
// Just shows how many dates are stored (no data returned)
router.get("/year/:year/status", getYearStatusOnly);

// ─────────────────────────────────────────────────────────────────
// SINGLE DATE ROUTES
// ─────────────────────────────────────────────────────────────────

// GET /api/prokerala/panchang?date=2026-01-01
router.get("/panchang", getPanchang);

// GET /api/prokerala/muhurat?date=2026-01-01
router.get("/muhurat", getMuhurat);

// GET /api/prokerala/kundali?date=2026-01-01
router.get("/kundali", getKundali);

// GET /api/prokerala/hindu-time?date=2026-01-01
router.get("/hindu-time", getHinduTime);

// GET /api/prokerala/compass?date=2026-01-01
router.get("/compass", getCompass);

// ─────────────────────────────────────────────────────────────────
// MONITORING & ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────

// GET /api/prokerala/tracker
// Shows cron job progress (which year is being fetched, status, errors)
router.get("/tracker", getTrackerStatus);

// GET /api/prokerala/token-status
// Shows if FREE and PAID tokens are cached and when they expire
router.get("/token-status", getTokenStatus);

// POST /api/prokerala/cron/run-now
// Manually trigger the cron job for testing (doesn't wait for 2 AM)
router.post("/cron/run-now", triggerCronNow);

export default router;
