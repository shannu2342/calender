/**
 * services/lockService.js
 * ────────────────────────────────────────────────────────────────
 * Distributed Lock using MongoDB atomic operations.
 *
 * WHY A DISTRIBUTED LOCK?
 * ────────────────────────
 * Without a lock, two things can start the same year's fetch simultaneously:
 *   - Cron job fires at 2 AM AND someone hits POST /cron/run-now
 *   - Two API requests for the same year arrive at the same time
 *
 * Even though the unique index prevents duplicate MongoDB documents,
 * two concurrent fetch processes still waste API credits and can cause
 * confusing log output. The lock ensures ONLY ONE job runs per year.
 *
 * HOW THE LOCK WORKS (atomic MongoDB operation):
 * ───────────────────────────────────────────────
 * A lock = a document in JobTracker with status="processing" and a lockedAt timestamp.
 *
 *   To ACQUIRE a lock:
 *     Use findOneAndUpdate with a filter that only matches UNLOCKED docs:
 *       { year, status: { $ne: "processing" } }   ← only if NOT already processing
 *     Set: { status: "processing", lockedAt: now, lockedBy: "myprocess" }
 *
 *   MongoDB makes this ATOMIC — even if 100 processes try simultaneously,
 *   only ONE will succeed (the first one). The rest get null back.
 *
 *   To RELEASE a lock:
 *     Update the document: { status: "completed" | "failed", lockedBy: null }
 *
 *   STALE LOCK DETECTION:
 *     If a process crashes without releasing the lock, the document stays
 *     "processing" forever. We detect this by checking if lockedAt is
 *     older than LOCK_TIMEOUT_MS (default: 2 hours). If so, we forcibly
 *     release the stale lock and allow anyone to claim it.
 *
 * LOCK OWNER IDENTIFIER:
 *   We use hostname + PID to identify which process holds the lock.
 *   This is for debugging — you can see in logs "lock held by server1:12345".
 */

import os from "os";
import JobTracker from "../models/JobTracker.js";
import logger from "../config/logger.js";

// A lock older than 2 hours is considered stale (the process likely crashed)
const LOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * getLockOwner()
 * ─────────────────
 * Returns a unique identifier for this process.
 * Used to label which process holds the lock.
 */
function getLockOwner() {
    return `${os.hostname()}:${process.pid}`;
}

/**
 * acquireLock(year)
 * ──────────────────
 * Tries to acquire the distributed lock for a given year.
 *
 * Returns:
 *   { acquired: true,  job: <JobTracker document> }  — lock acquired, job created/updated
 *   { acquired: false, job: <existing job> }          — another process already holds it
 *
 * How it works:
 *   1. Check if a JobTracker document for this year exists
 *   2. If it exists and status="processing" and lockedAt is recent → lock is held → return false
 *   3. If it doesn't exist or status!="processing" or lock is stale → atomically claim it
 *
 * @param {number} year
 * @returns {Promise<{ acquired: boolean, job: object }>}
 */
export async function acquireLock(year) {
    const lockOwner = getLockOwner();
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

    try {
        // Try to find an existing document for this year
        const existingJob = await JobTracker.findOne({ year });

        if (existingJob) {
            // ── Check if lock is actively held (not stale) ──────────────
            const isActiveLock =
                existingJob.status === "processing" &&
                existingJob.lockedAt &&
                existingJob.lockedAt > staleThreshold;

            if (isActiveLock) {
                logger.warn(
                    `[LockService] 🔒 Lock for year ${year} is held by ${existingJob.lockedBy}` +
                    ` (acquired ${existingJob.lockedAt.toISOString()}). Cannot acquire.`
                );
                return { acquired: false, job: existingJob };
            }

            // Lock is either stale or job is not "processing" — claim it
            if (existingJob.status === "processing" && existingJob.lockedAt <= staleThreshold) {
                logger.warn(
                    `[LockService] ⏰ Found STALE lock for year ${year} (held by ${existingJob.lockedBy}` +
                    ` since ${existingJob.lockedAt?.toISOString()}). Forcibly claiming.`
                );
            }
        }

        // ── Atomically create or update the job document ─────────────────
        // Using findOneAndUpdate with upsert ensures this is atomic:
        // Even if two processes reach this point simultaneously, only ONE
        // will get "new:true" back — the other will see the first one's lock.
        const job = await JobTracker.findOneAndUpdate(
            {
                year,
                // Only match if: no document exists, OR it's not processing, OR lock is stale
                $or: [
                    { status: { $ne: "processing" } },
                    { lockedAt: { $lte: staleThreshold } },
                    { lockedAt: null },
                ],
            },
            {
                $set: {
                    year,
                    status: "processing",
                    startedAt: existingJob ? existingJob.startedAt : now,
                    lockedAt: now,
                    lockedBy: lockOwner,
                    completedAt: null,
                    // Reset counters only for fresh jobs, not resumed ones
                    ...(existingJob ? {} : {
                        fetchedCount: 0,
                        skippedCount: 0,
                        errorCount: 0,
                        totalDates: null,
                        errorMessages: [],
                        lastProcessedDate: null,
                    }),
                },
            },
            { upsert: true, new: true }
        );

        logger.info(`[LockService] ✅ Lock acquired for year ${year} by ${lockOwner}`);
        return { acquired: true, job };

    } catch (err) {
        // If upsert races with another process and both try to insert simultaneously,
        // one will get a duplicate key error — treat it as "lock not acquired"
        if (err.code === 11000) {
            logger.warn(`[LockService] Lock race condition for year ${year} — another process won.`);
            const existingJob = await JobTracker.findOne({ year });
            return { acquired: false, job: existingJob };
        }
        throw err;
    }
}

/**
 * releaseLock(year, finalStatus, summary)
 * ─────────────────────────────────────────
 * Releases the distributed lock and marks the job as done/failed.
 * Called when the year fetch completes or fails catastrophically.
 *
 * @param {number} year
 * @param {"completed"|"failed"} finalStatus
 * @param {object} summary - { fetchedCount, skippedCount, errorCount, errorMessages }
 */
export async function releaseLock(year, finalStatus, summary = {}) {
    try {
        await JobTracker.findOneAndUpdate(
            { year },
            {
                $set: {
                    status: finalStatus,
                    completedAt: new Date(),
                    lockedAt: null,
                    lockedBy: null,
                    fetchedCount: summary.fetchedCount ?? 0,
                    skippedCount: summary.skippedCount ?? 0,
                    errorCount: summary.errorCount ?? 0,
                    errorMessages: (summary.errorMessages ?? []).slice(0, 20),
                },
            }
        );
        logger.info(`[LockService] 🔓 Lock released for year ${year}. Final status: ${finalStatus}`);
    } catch (err) {
        logger.error(`[LockService] Failed to release lock for year ${year}:`, err.message);
    }
}

/**
 * updateJobProgress(year, progressData)
 * ───────────────────────────────────────
 * Updates the job document with the latest progress.
 * Called periodically during the fetch (every N dates).
 * This is how crash-resume works: we always know lastProcessedDate.
 *
 * @param {number} year
 * @param {object} progressData - { lastProcessedDate, fetchedCount, skippedCount, errorCount, totalDates }
 */
export async function updateJobProgress(year, progressData) {
    try {
        await JobTracker.findOneAndUpdate(
            { year },
            { $set: progressData }
        );
    } catch (err) {
        // Non-fatal: progress update failure doesn't stop the fetch
        logger.warn(`[LockService] Could not update progress for year ${year}:`, err.message);
    }
}

/**
 * getJobStatus(year)
 * ───────────────────
 * Reads the job status from MongoDB (crash-safe, accurate after restart).
 *
 * @param {number} year
 * @returns {Promise<object|null>}
 */
export async function getJobStatus(year) {
    return JobTracker.findOne({ year }).lean();
}

/**
 * resumeInterruptedJobs()
 * ────────────────────────
 * Called at server startup to detect and resume any jobs that were "processing"
 * when the server last crashed/restarted.
 *
 * WHY: If the server dies mid-fetch, the JobTracker document still says "processing".
 * Without this, the job would stay stuck forever. With this, it automatically resumes.
 *
 * Note: fetchYear() has smart caching - it only fetches missing dates,
 * so dates already stored are skipped. Resume is essentially free.
 */
export async function resumeInterruptedJobs(fetchYearFn) {
    try {
        const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);

        // Find jobs that were "processing" but the lock is now stale
        // (meaning the previous process that held the lock is dead)
        const stuckJobs = await JobTracker.find({
            status: "processing",
            lockedAt: { $lte: staleThreshold },
        });

        if (stuckJobs.length === 0) {
            logger.info("[LockService] No interrupted jobs to resume.");
            return;
        }

        logger.warn(`[LockService] Found ${stuckJobs.length} interrupted job(s). Scheduling resume...`);

        for (const job of stuckJobs) {
            const year = job.year;
            logger.info(
                `[LockService] Resuming year ${year} from lastProcessedDate: ${job.lastProcessedDate || "beginning"}`
            );

            // Small delay before resuming to let the server fully initialize
            setTimeout(async () => {
                const { acquired } = await acquireLock(year);
                if (!acquired) {
                    logger.info(`[LockService] Year ${year} was claimed by another process. Skipping resume.`);
                    return;
                }

                try {
                    const result = await fetchYearFn(year, async (progress) => {
                        await updateJobProgress(year, {
                            lastProcessedDate: progress.date,
                            fetchedCount: progress.index,
                            totalDates: progress.total,
                        });
                    });
                    await releaseLock(year, "completed", result);
                    logger.info(`[LockService] ✅ Resumed and completed year ${year}`);
                } catch (err) {
                    await releaseLock(year, "failed", { errorMessages: [err.message] });
                    logger.error(`[LockService] ❌ Resume failed for year ${year}:`, err.message);
                }
            }, 5000); // 5 second startup delay
        }
    } catch (err) {
        logger.error("[LockService] Error in resumeInterruptedJobs:", err.message);
    }
}
