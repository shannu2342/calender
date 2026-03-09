/**
 * cron/yearlyFetchCron.js
 * ────────────────────────────────────────────────────────────────
 * Daily cron job that runs at 2 AM server time.
 *
 * Logic Flow:
 * ─────────────────────────────────────────────────────────────────
 * STEP 1: Check if year 2026 is fully fetched
 *   → If NOT: fetch/complete year 2026 using FREE key (bootstrap phase)
 *
 * STEP 2: Once 2026 is done, switch to historical phase
 *   → Read FetchTracker to know which year to fetch next
 *   → Fetch 1 year per day (starting from 1940)
 *   → After each year, increment the tracker year
 *   → STOP automatically when year 2125 is reached
 *
 * STEP 3: Update FetchTracker after each run
 *   → Record what happened (success, failure, year completed)
 *
 * Uses node-cron:
 *   - Schedule: "0 2 * * *" → At 02:00 AM every day
 *   - "0 2 * * *" means: second=0, minute=0, hour=2, day=*, month=*, weekday=*
 *
 * Why 1 year per day?
 *   - Fetching a full year = 365 dates × 5 endpoints × 1.1s = ~33 minutes
 *   - This is a safe amount to do daily without overloading the API
 */

import cron from "node-cron";
import FetchTracker from "../models/FetchTracker.js";
import { fetchYear, isYearComplete } from "../services/fetchService.js";
import logger from "../config/logger.js";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const BOOTSTRAP_YEAR = 2026;    // First priority — fetch using FREE key
const HISTORICAL_START = 1940;   // Historical fetch starts here
const HISTORICAL_END = 2125;     // Stop after this year

// ─────────────────────────────────────────────────────────────────
// HELPER: Get or create FetchTracker document
// ─────────────────────────────────────────────────────────────────

/**
 * getOrCreateTracker()
 * ─────────────────────
 * MongoDB only has ONE FetchTracker document (like a settings record).
 * If it doesn't exist yet, we create it with defaults.
 */
async function getOrCreateTracker() {
    let tracker = await FetchTracker.findOne();

    if (!tracker) {
        logger.info("[YearlyFetchCron] Creating new FetchTracker document...");
        tracker = await FetchTracker.create({
            phase: "bootstrap",
            currentYear: BOOTSTRAP_YEAR,
            status: "pending",
        });
        logger.info("[YearlyFetchCron] FetchTracker created with bootstrap phase, year 2026.");
    }

    return tracker;
}

// ─────────────────────────────────────────────────────────────────
// MAIN CRON TASK FUNCTION
// ─────────────────────────────────────────────────────────────────

/**
 * runDailyCronTask()
 * ───────────────────
 * This is the function that runs every day at 2 AM.
 * It decides what to fetch and then calls fetchYear().
 */
async function runDailyCronTask() {
    logger.info("==================================================");
    logger.info("[YearlyFetchCron] 🕐 Daily cron job started at 2 AM");
    logger.info(`[YearlyFetchCron] Current time: ${new Date().toISOString()}`);
    logger.info("==================================================");

    try {
        const tracker = await getOrCreateTracker();

        // ── PHASE 1: Bootstrap (fetch year 2026 first) ─────────────────
        if (tracker.phase === "bootstrap") {
            logger.info(`[YearlyFetchCron] Phase: BOOTSTRAP — Fetching year ${BOOTSTRAP_YEAR} (FREE key)`);

            // Check if 2026 is already complete
            const already2026Complete = await isYearComplete(BOOTSTRAP_YEAR);

            if (already2026Complete) {
                logger.info(`[YearlyFetchCron] ✅ Year ${BOOTSTRAP_YEAR} is already complete! Switching to historical phase.`);

                // Switch to historical phase, starting from 1940
                await FetchTracker.findByIdAndUpdate(tracker._id, {
                    phase: "historical",
                    currentYear: HISTORICAL_START,
                    status: "pending",
                    completedAt: new Date(),
                    $addToSet: { completedYears: BOOTSTRAP_YEAR },
                });

                logger.info(`[YearlyFetchCron] Switched to HISTORICAL phase. Will fetch from ${HISTORICAL_START} onwards.`);
                return; // Next cron run will handle the historical phase
            }

            // Fetch year 2026 (this may take ~33 minutes)
            await FetchTracker.findByIdAndUpdate(tracker._id, {
                status: "in_progress",
                lastRunAt: new Date(),
            });

            const result = await fetchYear(BOOTSTRAP_YEAR, async (progress) => {
                // Update tracker with progress every 10 dates
                if (progress.index % 10 === 0) {
                    await FetchTracker.findByIdAndUpdate(tracker._id, {
                        totalDaysFetched: progress.index,
                    });
                }
            });

            // Check if 2026 is now complete after this run
            const isNowComplete = await isYearComplete(BOOTSTRAP_YEAR);

            if (isNowComplete) {
                // 2026 done! Switch to historical
                await FetchTracker.findByIdAndUpdate(tracker._id, {
                    phase: "historical",
                    currentYear: HISTORICAL_START,
                    status: "completed",
                    completedAt: new Date(),
                    totalDaysFetched: result.fetchedCount + result.skippedCount,
                    $addToSet: { completedYears: BOOTSTRAP_YEAR },
                    errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
                });
                logger.info(`[YearlyFetchCron] 🎉 Year ${BOOTSTRAP_YEAR} COMPLETED! Switching to historical phase.`);
            } else {
                // Still incomplete — will continue next run
                await FetchTracker.findByIdAndUpdate(tracker._id, {
                    status: "pending",
                    totalDaysFetched: result.fetchedCount + result.skippedCount,
                    errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
                });
                logger.info(`[YearlyFetchCron] Year ${BOOTSTRAP_YEAR} partially fetched. Will continue next run.`);
            }

            return;
        }

        // ── PHASE 2: Historical (1940 → 2125, 1 year per day run) ─────
        if (tracker.phase === "historical") {
            const yearToFetch = tracker.currentYear;

            // 🛑 STOP CONDITION: Reached or passed the end year
            if (yearToFetch > HISTORICAL_END) {
                logger.info(`[YearlyFetchCron] 🏁 All years (${HISTORICAL_START}–${HISTORICAL_END}) have been fetched! Cron is complete.`);
                await FetchTracker.findByIdAndUpdate(tracker._id, {
                    status: "completed",
                    errorMessage: null,
                });
                return;
            }

            logger.info(`[YearlyFetchCron] Phase: HISTORICAL — Fetching year ${yearToFetch}`);

            // Mark as in progress
            await FetchTracker.findByIdAndUpdate(tracker._id, {
                status: "in_progress",
                lastRunAt: new Date(),
                currentYear: yearToFetch,
            });

            // Check if this year is already complete
            const alreadyComplete = await isYearComplete(yearToFetch);

            if (alreadyComplete) {
                logger.info(`[YearlyFetchCron] Year ${yearToFetch} already complete, skipping.`);
                // Advance to next year
                const nextYear = yearToFetch + 1;
                await FetchTracker.findByIdAndUpdate(tracker._id, {
                    currentYear: nextYear,
                    status: "pending",
                    $addToSet: { completedYears: yearToFetch },
                });
                logger.info(`[YearlyFetchCron] Advanced to year ${nextYear}.`);
                return;
            }

            // Fetch this year
            const result = await fetchYear(yearToFetch, async (progress) => {
                if (progress.index % 10 === 0) {
                    await FetchTracker.findByIdAndUpdate(tracker._id, {
                        totalDaysFetched: progress.index,
                    });
                }
            });

            // After fetch, advance to next year
            const nextYear = yearToFetch + 1;
            await FetchTracker.findByIdAndUpdate(tracker._id, {
                currentYear: nextYear, // Ready for tomorrow's run
                status: "pending",
                completedAt: new Date(),
                totalDaysFetched: result.fetchedCount + result.skippedCount,
                $addToSet: { completedYears: yearToFetch },
                errorMessage: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
            });

            logger.info(`[YearlyFetchCron] ✅ Year ${yearToFetch} fetched. Next run will fetch: ${nextYear}`);
        }

    } catch (err) {
        logger.error("[YearlyFetchCron] ❌ Cron job failed:", err.message);

        // Update tracker with failure info
        try {
            const tracker = await FetchTracker.findOne();
            if (tracker) {
                await FetchTracker.findByIdAndUpdate(tracker._id, {
                    status: "failed",
                    errorMessage: err.message,
                });
            }
        } catch (updateErr) {
            logger.error("[YearlyFetchCron] Failed to update tracker after error:", updateErr.message);
        }
    }

    logger.info("[YearlyFetchCron] Daily cron job finished.");
}

// ─────────────────────────────────────────────────────────────────
// EXPORTED: Schedule the cron job
// ─────────────────────────────────────────────────────────────────

/**
 * startYearlyFetchCron()
 * ───────────────────────
 * Register the cron schedule. Call this once at server startup.
 *
 * Schedule: "0 2 * * *" = Every day at 2:00 AM
 * │ │ │ │ └── Every day of week
 * │ │ │ └──── Every month
 * │ │ └────── Every day of month
 * │ └──────── Hour: 2 (2 AM)
 * └────────── Minute: 0
 */
export function startYearlyFetchCron() {
    logger.info("[YearlyFetchCron] Registering cron job: EVERY DAY AT 2 AM");

    cron.schedule("0 2 * * *", async () => {
        await runDailyCronTask();
    }, {
        timezone: "Asia/Kolkata", // Use Indian Standard Time (IST)
    });

    logger.info("[YearlyFetchCron] ✅ Cron job registered. Will run daily at 02:00 AM IST.");
}

/**
 * runCronNow()
 * ─────────────
 * For TESTING ONLY: Triggers the cron task immediately without waiting for 2 AM.
 * Call this via: GET /api/prokerala/cron/run-now (admin only)
 */
export async function runCronNow() {
    logger.info("[YearlyFetchCron] Manual trigger: running cron task NOW...");
    await runDailyCronTask();
}
