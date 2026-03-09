/**
 * routes/system.js
 * ────────────────────────────────────────────────────────────────
 * System monitoring routes.
 * Base path: /api/system (registered in server.js)
 *
 *   GET /api/system/db-stats
 *     → Storage usage, per-collection counts, Atlas M0 limit check
 */

import express from "express";
import { getDbStats } from "../controllers/systemController.js";

const router = express.Router();

// GET /api/system/db-stats
// Returns storage usage and warns at 70% / 90% of Atlas M0 limit (512MB)
router.get("/db-stats", getDbStats);

export default router;
