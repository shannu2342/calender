/**
 * models/Muhurat.js
 * ────────────────────────────────────────────────────────────────
 * Stores raw Muhurat (auspicious period) data from the Prokerala API.
 * One document = one day's muhurat data.
 *
 * ✅ INDEXES:
 *   - { date: 1 }             — fast single-date lookups
 *   - { year: 1 }             — fast full-year queries
 *   - { year: 1, date: 1 }    — compound unique (prevents duplicates)
 */

import mongoose from "mongoose";

const MuhuratSchema = new mongoose.Schema(
    {
        date: { type: String, required: true },
        year: { type: Number, required: true },
        rawData: { type: mongoose.Schema.Types.Mixed, required: true },
        fetchedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
        collection: "Muhurat",
    }
);

// Individual indexes for single-field queries
MuhuratSchema.index({ date: 1 });
MuhuratSchema.index({ year: 1 });

// Compound unique index — primary key for this collection
// unique:true → MongoDB rejects any insert with a duplicate year+date pair
MuhuratSchema.index({ year: 1, date: 1 }, { unique: true });

export default mongoose.model("Muhurat", MuhuratSchema);
