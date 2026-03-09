import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  kundali,
  festivals,
  matchmaking,
  muhurat,
  panchang,
} from "../controllers/astrologyController.js";
import { getCacheStats, cleanupOldCache } from "../services/panchangCacheService.js";

const router = express.Router();

// POST /api/astrology/kundali
router.post("/kundali", asyncHandler(kundali));

// POST /api/astrology/matchmaking
router.post("/matchmaking", asyncHandler(matchmaking));

// POST /api/astrology/muhurat
router.post("/muhurat", asyncHandler(muhurat));

// GET /api/astrology/panchang?date=YYYY-MM-DD&lat=&lng=
router.get("/panchang", asyncHandler(panchang));

// GET /api/astrology/festivals?year=YYYY&month=1-12&lat=&lng=
router.get("/festivals", asyncHandler(festivals));

// GET /api/astrology/cache/stats - Get cache statistics for monitoring
router.get("/cache/stats", asyncHandler(async (req, res) => {
  const stats = getCacheStats();
  res.json({
    success: true,
    data: stats,
  });
}));

// POST /api/astrology/cache/cleanup - Clean up old cache entries
router.post("/cache/cleanup", asyncHandler(async (req, res) => {
  const maxAgeDays = Number(req.body.maxAgeDays) || 90;
  const deleted = cleanupOldCache(maxAgeDays * 24 * 60 * 60);
  res.json({
    success: true,
    deletedEntries: deleted,
  });
}));

export default router;
