/**
 * controllers/yearController.js
 * ────────────────────────────────────────────────────────────────
 * Handles GET /api/prokerala/year/:year
 *
 * ✅ UPGRADED: Persistent Job Tracking + Distributed Lock
 * ────────────────────────────────────────────────────────
 * Previous version used an in-memory Map — job state was lost on restart.
 * This version uses MongoDB (JobTracker collection) for ALL state.
 *
 * JOB LIFECYCLE:
 *   1. Request arrives for year X
 *   2. Year complete in DB? → return data immediately
 *   3. Try to acquire distributed lock (atomic MongoDB op)
 *      → Lock acquired? → Start background fetch, respond 202
 *      → Lock NOT acquired (another job running)? → return current job status
 *   4. Background fetch runs, updates JobTracker every 5 dates
 *   5. On finish: release lock, set status = "completed" | "failed"
 *
 * CRASH RESUME (handled in server.js startup):
 *   If server dies mid-fetch, JobTracker has status="processing" with stale lock.
 *   On restart, server.js calls resumeInterruptedJobs() → picks up where it left off.
 */

import { fetchYear, getYearStatus } from "../services/fetchService.js";
import { acquireLock, releaseLock, updateJobProgress, getJobStatus } from "../services/lockService.js";
import Panchang from "../models/Panchang.js";
import Muhurat from "../models/Muhurat.js";
import Kundali from "../models/Kundali.js";
import HinduTime from "../models/HinduTime.js";
import Compass from "../models/Compass.js";
import logger from "../config/logger.js";

/**
 * Validate year from URL params. Returns null + sends 400 if invalid.
 */
function parseYear(req, res) {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 1940 || year > 2125) {
        res.status(400).json({
            success: false,
            error: `Invalid year "${req.params.year}". Must be between 1940 and 2125.`,
        });
        return null;
    }
    return year;
}

// ─────────────────────────────────────────────────────────────────
// BACKGROUND FETCH RUNNER
// ─────────────────────────────────────────────────────────────────

/**
 * launchBackgroundFetch(year)
 * ────────────────────────────
 * Runs fetchYear() in the background (called WITHOUT await).
 * Updates MongoDB JobTracker every 5 dates for live progress.
 * Releases the distributed lock when done or on failure.
 */
async function launchBackgroundFetch(year) {
    logger.info(`[YearController] 🔄 Background fetch launched for year ${year}`);

    let fetchedSoFar = 0;
    let errorCount = 0;

    try {
        const result = await fetchYear(year, async (progress) => {
            fetchedSoFar = progress.index;

            // Update MongoDB every 5 dates (not every single date — saves DB writes)
            if (progress.index % 5 === 0 || progress.index === progress.total) {
                await updateJobProgress(year, {
                    lastProcessedDate: progress.date,
                    fetchedCount: progress.index,
                    totalDates: progress.total,
                    errorCount: errorCount,
                });
            }
        });

        // Done! Release lock and mark completed
        await releaseLock(year, "completed", {
            fetchedCount: result.fetchedCount,
            skippedCount: result.skippedCount,
            errorCount: result.errorCount,
            errorMessages: result.errors.slice(0, 20),
        });

        logger.info(
            `[YearController] ✅ Background fetch complete for year ${year}: ` +
            `${result.fetchedCount} fetched, ${result.skippedCount} skipped, ${result.errorCount} errors`
        );

    } catch (err) {
        // Unexpected failure — release lock and mark failed
        await releaseLock(year, "failed", {
            fetchedCount: fetchedSoFar,
            errorMessages: [err.message],
        });
        logger.error(`[YearController] ❌ Background fetch failed for year ${year}:`, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────
// MAIN ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

/**
 * getYear(req, res)
 * GET /api/prokerala/year/:year
 *
 * CASE A: Year fully in DB → return data immediately
 * CASE B: Lock already held → another job is running → return its live status
 * CASE C: No lock held → acquire lock → launch background fetch → respond 202
 */
export async function getYear(req, res) {
    const year = parseYear(req, res);
    if (!year) return;

    logger.info(`[YearController] Request for year: ${year}`);

    try {
        const status = await getYearStatus(year);

        // ── CASE A: Full year in DB ────────────────────────────────────
        if (status.isComplete) {
            logger.info(`[YearController] Year ${year} fully cached — returning from DB`);

            const [panchang, muhurat, kundali, hinduTime, compass] = await Promise.all([
                Panchang.find({ year }, { _id: 0, date: 1, rawData: 1 }).lean().sort({ date: 1 }),
                Muhurat.find({ year }, { _id: 0, date: 1, rawData: 1 }).lean().sort({ date: 1 }),
                Kundali.find({ year }, { _id: 0, date: 1, rawData: 1 }).lean().sort({ date: 1 }),
                HinduTime.find({ year }, { _id: 0, date: 1, rawData: 1 }).lean().sort({ date: 1 }),
                Compass.find({ year }, { _id: 0, date: 1, rawData: 1 }).lean().sort({ date: 1 }),
            ]);

            return res.json({
                success: true,
                source: "database",
                year,
                status,
                data: { panchang, muhurat, kundali, hinduTime, compass },
            });
        }

        // ── Try to acquire distributed lock ───────────────────────────
        const { acquired, job } = await acquireLock(year);

        // ── CASE B: Lock already held → another job is running ────────
        if (!acquired) {
            logger.info(`[YearController] Year ${year} already being fetched (lock held by ${job?.lockedBy})`);
            return res.status(202).json({
                success: true,
                message: `Year ${year} is already being fetched by another process.`,
                status: "processing",
                job: {
                    year: job.year,
                    status: job.status,
                    startedAt: job.startedAt,
                    lastProcessedDate: job.lastProcessedDate,
                    fetchedCount: job.fetchedCount,
                    totalDates: job.totalDates,
                    completionPercent: job.totalDates
                        ? Math.round((job.fetchedCount / job.totalDates) * 100)
                        : null,
                    lockedBy: job.lockedBy,
                },
                hint: `Poll GET /api/prokerala/year/${year}/status for live progress.`,
            });
        }

        // ── CASE C: Lock acquired → start background fetch ────────────
        const label = status.completionPercent > 0
            ? `partially cached (${status.completionPercent}%)`
            : "not cached";
        logger.info(`[YearController] Year ${year} is ${label}. Background fetch launched.`);

        // Fire and forget — no await, HTTP response sent below
        launchBackgroundFetch(year);

        return res.status(202).json({
            success: true,
            message: `Year ${year} fetch started in background. Fetching ${status.expectedDates} dates.`,
            status: "processing",
            year,
            currentDbStatus: status,
            hint: `Poll GET /api/prokerala/year/${year}/status to track progress (~33 min for a full year).`,
        });

    } catch (err) {
        logger.error(`[YearController] Error for year ${year}:`, err.message);
        return res.status(500).json({
            success: false,
            error: "Internal server error. Check server logs.",
            details: err.message,
        });
    }
}

// ─────────────────────────────────────────────────────────────────
// STATUS ENDPOINT
// ─────────────────────────────────────────────────────────────────

/**
 * getYearStatusOnly(req, res)
 * GET /api/prokerala/year/:year/status
 *
 * Returns BOTH:
 *   1. Database count (how many dates are actually stored in MongoDB)
 *   2. Job status from JobTracker (live progress, crash-safe)
 *
 * This is safe to poll every 10–30 seconds.
 * Data comes from DB, not in-memory, so it works after server restarts.
 */
export async function getYearStatusOnly(req, res) {
    const year = parseYear(req, res);
    if (!year) return;

    try {
        const [dbStatus, job] = await Promise.all([
            getYearStatus(year),
            getJobStatus(year),
        ]);

        const completionPercent = job?.totalDates
            ? Math.round(((job.fetchedCount + job.skippedCount) / job.totalDates) * 100)
            : dbStatus.completionPercent;

        return res.json({
            success: true,
            year,
            overall: job?.status === "processing"
                ? "processing"
                : dbStatus.isComplete
                    ? "complete"
                    : "incomplete",
            db: dbStatus,   // Actual stored counts per collection
            job: job        // Persistent job tracking (from JobTracker collection)
                ? {
                    status: job.status,
                    startedAt: job.startedAt,
                    completedAt: job.completedAt,
                    lastProcessedDate: job.lastProcessedDate,
                    fetchedCount: job.fetchedCount,
                    skippedCount: job.skippedCount,
                    errorCount: job.errorCount,
                    totalDates: job.totalDates,
                    completionPercent,
                    lockedBy: job.lockedBy,
                    errorMessages: job.errorMessages,
                }
                : null,
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
