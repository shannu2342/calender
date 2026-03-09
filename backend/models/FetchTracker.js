/**
 * models/FetchTracker.js
 * ────────────────────────────────────────────────────────────────
 * Tracks progress of the cron job that fetches data year by year.
 *
 * This collection stores ONE document that acts like a "bookmark":
 * "I last fetched the year 2045, continue from there tomorrow."
 *
 * Fields:
 *   - phase: "bootstrap" (fetching 2026) or "historical" (fetching 1940–2125)
 *   - currentYear: which year is being/was fetched
 *   - status: "pending" | "in_progress" | "completed" | "failed"
 *   - lastRunAt: when the last cron execution happened
 *   - completedAt: when the full year was successfully stored
 *   - totalDaysFetched: how many individual days were fetched
 *   - errorMessage: last error (if status is "failed")
 */

import mongoose from "mongoose";

const FetchTrackerSchema = new mongoose.Schema(
    {
        // "bootstrap" = priority fetch of year 2026 first
        // "historical" = sequential fetch from 1940 onwards
        phase: {
            type: String,
            enum: ["bootstrap", "historical"],
            default: "bootstrap",
        },

        // The year currently being fetched or the last year fetched
        currentYear: {
            type: Number,
            required: true,
            default: 2026,
        },

        // Progress status for this year
        status: {
            type: String,
            enum: ["pending", "in_progress", "completed", "failed"],
            default: "pending",
        },

        // When did the cron job last run?
        lastRunAt: {
            type: Date,
            default: null,
        },

        // When did we finish fetching a specific year?
        completedAt: {
            type: Date,
            default: null,
        },

        // Total number of individual dates fetched so far (for monitoring)
        totalDaysFetched: {
            type: Number,
            default: 0,
        },

        // If something failed, the last error message is stored here
        errorMessage: {
            type: String,
            default: null,
        },

        // List of years we have FULLY completed
        completedYears: {
            type: [Number],
            default: [],
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
        collection: "FetchTracker", // Exact collection name in MongoDB Atlas
    }
);

export default mongoose.model("FetchTracker", FetchTrackerSchema);
