/**
 * models/JobTracker.js
 * ────────────────────────────────────────────────────────────────
 * Persists background year-fetch job state in MongoDB.
 *
 * WHY MONGODB INSTEAD OF IN-MEMORY MAP?
 * ─────────────────────────────────────
 * Problem with in-memory Map:
 *   - Server crashes → Map is destroyed → job state lost forever
 *   - PM2 restarts → same problem
 *   - VPS reboots → same problem
 *   - You cannot query job state from another process or tool
 *
 * Solution: store job state as a MongoDB document.
 *   - Survives crashes, restarts, reboots
 *   - On restart: server reads existing "processing" jobs and resumes them
 *   - Status endpoint reads from DB: accurate even after restart
 *   - One document per year (e.g. year=2026, year=1940)
 *
 * RESUME-AFTER-CRASH logic:
 *   When server starts, it checks for any jobs with status="processing".
 *   If found, it resumes them from lastProcessedDate (skipping already-done dates).
 *   This means if the server dies at day 200 of 2026, it picks up from day 201.
 *
 * Fields:
 *   year             → the year being fetched (unique key)
 *   status           → "processing" | "completed" | "failed"
 *   startedAt        → when the job was first created
 *   lastProcessedDate→ the last date that was successfully attempted (for resume)
 *   fetchedCount     → total dates successfully stored so far
 *   skippedCount     → dates already in DB that were skipped
 *   errorCount       → dates that failed after all retries
 *   totalDates       → total dates in the year (365 or 366)
 *   completedAt      → when the job finished (null if still running)
 *   errorMessages    → last few error messages (for debugging)
 *   lockedAt         → timestamp when the distributed lock was acquired
 *   lockedBy         → process identifier (hostname + pid) holding the lock
 */

import mongoose from "mongoose";

const JobTrackerSchema = new mongoose.Schema(
    {
        // Year being fetched — unique: only ONE document per year
        year: {
            type: Number,
            required: true,
            unique: true,
            index: true,
        },

        // Current state of the job
        status: {
            type: String,
            enum: ["processing", "completed", "failed"],
            required: true,
            default: "processing",
        },

        // When the job was first started
        startedAt: {
            type: Date,
            default: Date.now,
        },

        // When the job finished (null while still running)
        completedAt: {
            type: Date,
            default: null,
        },

        // ✅ CRASH RESUME: The last date that was processed.
        // If the server restarts, we pick up from this date.
        // Example: if server died while processing "2026-03-15",
        //          we'll resume from "2026-03-15" (fetchService's smart cache
        //          will skip already-stored dates automatically).
        lastProcessedDate: {
            type: String,   // "YYYY-MM-DD"
            default: null,
        },

        // Counters (updated periodically as the job runs)
        fetchedCount: { type: Number, default: 0 },
        skippedCount: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 },
        totalDates: { type: Number, default: null }, // null until we know

        // Last few error messages (capped to avoid document growth)
        errorMessages: {
            type: [String],
            default: [],
        },

        // ─── Distributed Lock Fields ──────────────────────────────────
        // These prevent two processes from running the same year simultaneously.
        // lockedAt: when the lock was acquired (used to detect stale locks)
        // lockedBy: which process/host holds the lock (for debugging)
        lockedAt: { type: Date, default: null },
        lockedBy: { type: String, default: null },
    },
    {
        timestamps: true,       // Adds createdAt + updatedAt
        collection: "JobTracker",
    }
);

export default mongoose.model("JobTracker", JobTrackerSchema);
