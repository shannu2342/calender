/**
 * models/HinduTime.js
 * ────────────────────────────────────────────────────────────────
 * Stores raw Hindu Calendar / Time data from the Prokerala API.
 * One document = one day's Hindu time data.
 *
 * ✅ INDEXES:
 *   - { date: 1 }             — fast single-date lookups
 *   - { year: 1 }             — fast full-year queries
 *   - { year: 1, date: 1 }    — compound unique (prevents duplicates)
 */

import mongoose from "mongoose";

const HinduTimeSchema = new mongoose.Schema(
    {
        date: { type: String, required: true },
        year: { type: Number, required: true },
        rawData: { type: mongoose.Schema.Types.Mixed, required: true },
        fetchedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
        collection: "HinduTime",
    }
);

HinduTimeSchema.index({ date: 1 });
HinduTimeSchema.index({ year: 1 });
HinduTimeSchema.index({ year: 1, date: 1 }, { unique: true });

export default mongoose.model("HinduTime", HinduTimeSchema);
