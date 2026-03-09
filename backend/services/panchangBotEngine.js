/**
 * ===========================================================================
 *  panchangBotEngine.js
 *  Self-contained Panchang Chatbot Engine — NO external AI APIs required.
 *  Uses the local JSON data files to answer panchang-related queries.
 * ===========================================================================
 */

import fs from "fs/promises";
import path from "path";

// ─── DATA CACHE ──────────────────────────────────────────────────────────────

const yearCache = new Map();
const festivalCache = new Map();
let dataRoot = null;

async function getDataRoot() {
    if (dataRoot) return dataRoot;
    const cwd = process.cwd();
    const candidates = [
        path.join(cwd, "..", "frontend", "public", "data"),
        path.join(cwd, "frontend", "public", "data"),
        path.join(cwd, "public", "data"),
    ];
    for (const c of candidates) {
        try { await fs.access(c); dataRoot = c; return c; } catch { }
    }
    dataRoot = candidates[0];
    return dataRoot;
}

async function loadYear(year) {
    if (yearCache.has(year)) return yearCache.get(year);
    const root = await getDataRoot();
    try {
        const raw = await fs.readFile(path.join(root, `${year}.json`), "utf8");
        const data = JSON.parse(raw);
        yearCache.set(year, data);
        return data;
    } catch { return []; }
}

async function loadFestivals(year) {
    if (festivalCache.has(year)) return festivalCache.get(year);
    const root = await getDataRoot();
    try {
        const raw = await fs.readFile(path.join(root, "festivals", `${year}.json`), "utf8");
        const data = JSON.parse(raw);
        festivalCache.set(year, data);
        return data;
    } catch { return {}; }
}

function getDayRecord(yearData, date) {
    // date: JS Date object → format DD/MM/YYYY
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const key = `${dd}/${mm}/${yyyy}`;
    return yearData.find(r => r.date === key) || null;
}

// ─── FUZZY TYPO CORRECTION ───────────────────────────────────────────────────

// Levenshtein distance
function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

// Vocabulary of all known panchang terms (English, transliterated Telugu/Hindi)
const VOCAB = [
    // Core concepts
    "tithi", "nakshatra", "yoga", "karanam", "paksha", "panchang", "panchanga",
    // Tithis
    "prathama", "padyami", "dvitiya", "vidiya", "tritiya", "chaturthi", "panchami",
    "shashthi", "saptami", "ashtami", "navami", "dashami", "ekadashi", "ekadasi",
    "ekadeshi", "dwadashi", "trayodashi", "chaturdashi", "purnima", "amavasya",
    // Nakshatra
    "ashwini", "bharani", "krittika", "rohini", "mrigashira", "ardra", "punarvasu",
    "pushya", "ashlesha", "magha", "purva phalguni", "uttara phalguni", "hasta",
    "chitra", "swati", "vishakha", "anuradha", "jyeshtha", "mula", "purva ashadha",
    "uttara ashadha", "shravana", "dhanishta", "shatabhisha", "purva bhadrapada",
    "uttara bhadrapada", "revati",
    // Timings
    "rahu", "rahukalam", "rahu kalam", "yamaganda", "gulikai", "abhijit", "amrit kalam",
    "amritha kalam", "dur muhurtam", "durmuhurtam", "varjyam", "sunrise", "sunset",
    // Yoga names
    "vishkumbha", "priti", "ayushman", "saubhagya", "shobhana", "atiganda",
    "sukarma", "dhriti", "shoola", "ganda", "vriddhi", "dhruva", "vyaghata",
    "harshana", "vajra", "siddhi", "vyatipata", "variyana", "parigha", "shiva",
    "siddha", "sadhya", "shubha", "shukla", "brahma", "indra", "vaidhriti",
    // Paksha
    "shukla paksha", "krishna paksha",
    // Festivals / common
    "festival", "holiday", "vrat", "puja", "jayanti", "navratri", "purnima",
    "ekadashi", "sankranti", "shivaratri", "holi", "diwali", "dussehra",
    "ganesh", "krishna", "janmashtami", "ugadi", "rama navami", "hanuman",
    // Greetings
    "hello", "hi", "hey", "namaste", "good morning", "good evening",
    // Intent keywords
    "today", "tomorrow", "yesterday", "auspicious", "muhurtam", "good time",
    "travel", "shopping", "start", "begin", "work", "marriage", "wedding",
    "what", "when", "which", "tell me", "show", "give",
];

function correctTypo(word) {
    const w = word.toLowerCase();
    // Check exact match first
    if (VOCAB.includes(w)) return w;
    // Find closest vocab word within edit distance 3
    let best = null, bestDist = 999;
    for (const v of VOCAB) {
        const d = levenshtein(w, v);
        if (d < bestDist && d <= Math.max(2, Math.floor(v.length / 4))) {
            bestDist = d;
            best = v;
        }
    }
    return best || w;
}

function normalizeMessage(msg) {
    // Replace every word with closest vocab word if within edit distance
    return msg.toLowerCase()
        .replace(/['']/g, "'")
        .replace(/[^\w\s']/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ─── INTENT CLASSIFICATION ───────────────────────────────────────────────────

// Tithi names for calendar search
const TITHI_NAMES = [
    "prathama", "padyami", "dvitiya", "vidiya", "tritiya", "chaturthi", "panchami",
    "shashthi", "saptami", "ashtami", "navami", "dashami", "ekadashi", "ekadasi",
    "dwadashi", "trayodashi", "chaturdashi", "purnima", "amavasya", "pratipada",
];
const NAKSHATRA_NAMES = [
    "ashwini", "bharani", "krittika", "rohini", "mrigashira", "ardra", "punarvasu",
    "pushya", "ashlesha", "magha", "hasta", "chitra", "swati", "vishakha", "anuradha",
    "jyeshtha", "mula", "shravana", "dhanishta", "shatabhisha", "revati",
    "purva phalguni", "uttara phalguni", "purva ashadha", "uttara ashadha",
    "purva bhadrapada", "uttara bhadrapada",
];

const TITHI_ALIASES = {
    thithi: "tithi",
    ekadahi: "ekadashi",
    ekadsi: "ekadashi",
    ekadasi: "ekadashi",
    amavas: "amavasya",
    purnami: "purnima",
    pournami: "purnima",
    dwadashi: "dwadashi",
    dvadashi: "dwadashi",
};

const NAKSHATRA_ALIASES = {
    rohni: "rohini",
    roihini: "rohini",
    aswini: "ashwini",
    kritika: "krittika",
};

const FESTIVAL_HINT_WORDS = new Set([
    "festival", "vrat", "puja", "jayanti", "jayanthi", "utsav", "celebration",
    "janmashtami", "sankranti", "shivaratri", "shivratri", "diwali", "deepavali",
    "holi", "ugadi", "ramnavami", "rama", "ganesh", "hanuman", "amalaki", "papamochani",
    "kamada", "nirjala", "devshayani", "prabodhini", "mokshada", "vaikuntha",
]);

const TITHI_STOP_WORDS = new Set(["when", "is", "next", "upcoming", "date", "of", "the", "tithi", "on", "in"]);

function normalizedWords(msg) {
    return String(msg || "")
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean);
}

function closestFromList(word, list) {
    let best = null;
    let bestDist = Infinity;
    for (const candidate of list) {
        const dist = levenshtein(word, candidate);
        const threshold = Math.max(1, Math.floor(candidate.length / 4));
        if (dist <= threshold && dist < bestDist) {
            best = candidate;
            bestDist = dist;
        }
    }
    return best;
}

function resolveTithiWord(word) {
    const w = TITHI_ALIASES[word] || word;
    if (TITHI_NAMES.includes(w)) return w;
    return closestFromList(w, TITHI_NAMES);
}

function resolveNakshatraWord(word) {
    const w = NAKSHATRA_ALIASES[word] || word;
    if (NAKSHATRA_NAMES.includes(w)) return w;
    return closestFromList(w, NAKSHATRA_NAMES);
}

// Check if message is asking WHEN a specific tithi/nakshatra occurs
function extractTithiSearch(msg) {
    const m = String(msg || "").toLowerCase();
    // "when is ekadashi", "next purnima", "when is amavasya", "when is ekadashi tithi"
    if (!/when|next|upcoming|date of/i.test(m)) return null;
    for (const t of TITHI_NAMES) {
        if (m.includes(t)) return { type: "tithi", name: t };
    }
    const words = normalizedWords(m);
    for (const word of words) {
        if (TITHI_STOP_WORDS.has(word)) continue;
        const resolved = resolveTithiWord(word);
        if (resolved) return { type: "tithi", name: resolved };
    }
    return null;
}

function extractNakshatraSearch(msg) {
    const m = String(msg || "").toLowerCase();
    if (!/when|next|upcoming|date of/i.test(m)) return null;
    for (const n of NAKSHATRA_NAMES) {
        if (m.includes(n)) return { type: "nakshatra", name: n };
    }
    const words = normalizedWords(m);
    for (const word of words) {
        const resolved = resolveNakshatraWord(word);
        if (resolved) return { type: "nakshatra", name: resolved };
    }
    return null;
}

const INTENT_PATTERNS = [
    { intent: "greeting", patterns: [/^\s*(hi|hello|hey|namaste|good\s*(morning|evening|afternoon|day)|greetings|namaskar)(\s+(hi|hello|hey|namaste|namaskar|greetings|good\s*(morning|evening|afternoon|day)))?\s*[!.?]*\s*$/i] },
    { intent: "farewell", patterns: [/\b(bye|goodbye|see you|thanks|thank you|dhanyavaad|ధన్యవాదాలు)\b/i] },
    { intent: "what_is_tithi", patterns: [/what\s+(is\s+)?a?\s*tithi|tithi\s+(mean|definition|explain)/i] },
    { intent: "what_is_nakshatra", patterns: [/what\s+(is\s+)?a?\s*nakshatra|nakshatra\s+(mean|definition|explain)/i] },
    { intent: "what_is_yoga", patterns: [/what\s+(is\s+)?a?\s*yoga\s+(in\s+panchang|in\s+vedic)|yoga\s+(mean|definition|explain)\s+panchang/i] },
    { intent: "count_nakshatra", patterns: [/how\s+many\s+nakshatra|total\s+nakshatra/i] },
    { intent: "count_tithi", patterns: [/how\s+many\s+tithi|total\s+tithi/i] },
    { intent: "count_yoga", patterns: [/how\s+many\s+yoga|total\s+yoga/i] },
    { intent: "good_time_summary", patterns: [/\b(what|which|tell).{0,20}(good|best|auspicious).{0,20}time|best time today|shubh muhurta today|good muhurta/i] },
    { intent: "rahu_kalam", patterns: [/\b(rahu|raahu|rahukaal|rahu\s*kalam|rahukata|rahukalam)\b/i] },
    { intent: "yamaganda", patterns: [/\b(yamaganda|yamagnda|yama\s*ganda|yama)\b/i] },
    { intent: "gulikai", patterns: [/\b(gulikai|gulika|guligai|gulika\s*kalam)\b/i] },
    { intent: "abhijit", patterns: [/\b(abhijit|abhijeet|abhijith)\b/i] },
    { intent: "amrit_kalam", patterns: [/\b(amrit|amritha|amrit\s*kalam|amrita)\b/i] },
    { intent: "dur_muhurtam", patterns: [/\b(dur\s*muhurtam|durmuhurtam)\b/i] },
    { intent: "sunrise_sunset", patterns: [/\b(sunrise|sunset|sun\s*rise|sun\s*set|dawn|dusk)\b/i] },
    { intent: "full_panchang", patterns: [/\b(full\s*panchang|complete\s*panchang|all\s*(details|info)|show\s*(me\s+)?(today|everything)|panchang\s*(today|for|of))\b/i] },
    { intent: "lunar_month", patterns: [/\b(lunar\s*month|masa|maas|month\s*name|chandramana)\b/i] },
    { intent: "shaka_samvat", patterns: [/\b(samvat|shaka|vikram|year\s*name)\b/i] },
];

// Helper: does this message reference a specific date?
const HAS_DATE_REF = (msg) =>
    /\b(today|tomorrow|yesterday|aaj|kal|ఈ\s*రోజు|రేపు|నిన్న)\b/i.test(msg) ||
    /\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(msg) ||
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(msg) ||
    /\d{1,2}\/\d{1,2}\/\d{4}/.test(msg) ||
    /\d{4}-\d{1,2}-\d{1,2}/.test(msg);

// Map: general-knowledge intent → data-lookup intent (used when date is present)
const GK_TO_DATA = {
    "what_is_tithi": "tithi",
    "what_is_nakshatra": "nakshatra",
    "what_is_yoga": "yoga",
};

function detectIntent(msg) {
    // 1. Typo-correct the message by correcting each significant word
    const corrected = msg.split(/\s+/).map(w => w.length > 3 ? correctTypo(w) : w).join(" ");
    const combined = `${msg} ${corrected}`;
    const words = normalizedWords(combined);
    const dateLookupHint = /\b(when|next|upcoming|date|coming)\b/i.test(combined);

    // 2. HIGHEST PRIORITY: "when is [tithi_name]" → calendar search
    if (dateLookupHint) {
        const tithiSearch = extractTithiSearch(combined);
        const nakshatraSearch = extractNakshatraSearch(combined);
        const hasFestivalHint = words.some((w) => FESTIVAL_HINT_WORDS.has(w));
        const hasMultiwordFestivalQuery = hasFestivalHint || words.filter((w) => !TITHI_STOP_WORDS.has(w)).length >= 3;
        if (tithiSearch && !hasMultiwordFestivalQuery) return "find_next_tithi";
        if (nakshatraSearch) return "find_next_nakshatra";
        if (!tithiSearch) {
            const fuzzyTithiMention = words.some((w) => resolveTithiWord(w));
            if (fuzzyTithiMention && !hasMultiwordFestivalQuery) return "find_next_tithi";
            const fuzzyNakshatraMention = words.some((w) => resolveNakshatraWord(w));
            if (fuzzyNakshatraMention) return "find_next_nakshatra";
        }
        // "when is diwali" etc → festival
        if (hasMultiwordFestivalQuery) return "festival";
        if (/\b(festival|vrat|puja|holiday|jayanti|celebration)\b/i.test(combined) ||
            !tithiSearch) {
            return "festival";
        }
    }

    // 3. Pattern match on original + corrected message
    for (const { intent, patterns } of INTENT_PATTERNS) {
        for (const p of patterns) {
            if (p.test(msg) || p.test(corrected)) {
                // 3a. If it matched a general-knowledge intent BUT the message
                //     also has a date reference, override to data-lookup intent.
                //     e.g. "what is tithi today" → "tithi" not "what_is_tithi"
                //     e.g. "on 28th feb what is tithi" → "tithi"
                if (GK_TO_DATA[intent] && HAS_DATE_REF(msg)) {
                    return GK_TO_DATA[intent];
                }
                return intent;
            }
        }
    }

    // 4. Typo fallback: check if corrected words match known keywords
    const correctedL = corrected.toLowerCase();
    if (/\b(nakshatra|nakshatram)\b/.test(correctedL)) return "nakshatra";
    if (/\b(tithi|thithi)\b/.test(correctedL)) return "tithi";
    if (/\b(rahu)\b/.test(correctedL)) return "rahu_kalam";
    if (/\b(yoga|yogam)\b/.test(correctedL)) return "yoga";
    if (/\b(karanam|karana)\b/.test(correctedL)) return "karanam";
    if (/\b(paksha)\b/.test(correctedL)) return "paksha";
    if (/\b(time_check|good time|auspicious|can i|should i)\b/.test(correctedL)) return "time_check";

    // 5. Default
    if (/\b(today|tomorrow|yesterday|panchang|aaj|kal)\b/i.test(msg)) return "full_panchang";
    return "unknown";
}

// ─── DATE ENTITY EXTRACTION ───────────────────────────────────────────────────

const MONTH_MAP = {
    january: 1, jan: 1, జనవరి: 1,
    february: 2, feb: 2, ఫిబ్రవరి: 2,
    march: 3, mar: 3, మార్చి: 3,
    april: 4, apr: 4, ఏప్రిల్: 4,
    may: 5, మే: 5,
    june: 6, jun: 6, జూన్: 6,
    july: 7, jul: 7, జూలై: 7,
    august: 8, aug: 8, ఆగస్టు: 8,
    september: 9, sep: 9, sept: 9, సెప్టెంబర్: 9,
    october: 10, oct: 10, అక్టోబర్: 10,
    november: 11, nov: 11, నవంబర్: 11,
    december: 12, dec: 12, డిసెంబర్: 12,
};

function extractTargetDate(msg, selectedDay) {
    const now = new Date();
    const msgL = msg.toLowerCase();

    // Named relative references
    if (/\b(today|aaj|ఈ\s*రోజు)\b/i.test(msg)) return now;
    if (/\b(tomorrow|kal|రేపు)\b/i.test(msg)) {
        const t = new Date(now); t.setDate(t.getDate() + 1); return t;
    }
    if (/\b(yesterday|kal\s*raat|నిన్న)\b/i.test(msg)) {
        const t = new Date(now); t.setDate(t.getDate() - 1); return t;
    }

    // Explicit date: "20th february", "february 20", "20 feb", "on 20th of march"
    const MONTH_KEYS = Object.keys(MONTH_MAP).join("|");
    const patterns = [
        new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_KEYS})(?:\\s+(\\d{4}))?`, "i"),
        new RegExp(`(${MONTH_KEYS})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?`, "i"),
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/,
    ];

    for (const p of patterns) {
        const m = msg.match(p);
        if (!m) continue;
        let day, month, year = now.getFullYear();

        if (p.source.startsWith("(\\d")) {
            // DD Month YYYY
            day = parseInt(m[1]);
            month = MONTH_MAP[m[2].toLowerCase()] || now.getMonth() + 1;
            if (m[3]) year = parseInt(m[3]);
        } else if (p.source.startsWith(`(${MONTH_KEYS.substring(0, 5)}`)) {
            // Month DD YYYY
            month = MONTH_MAP[m[1].toLowerCase()] || now.getMonth() + 1;
            day = parseInt(m[2]);
            if (m[3]) year = parseInt(m[3]);
        } else if (m[3] && m[3].length === 4) {
            // DD/MM/YYYY
            day = parseInt(m[1]); month = parseInt(m[2]); year = parseInt(m[3]);
        } else {
            // YYYY-MM-DD
            year = parseInt(m[1]); month = parseInt(m[2]); day = parseInt(m[3]);
        }
        if (day && month) return new Date(year, month - 1, day);
    }

    // Use selectedDay from frontend if present
    if (selectedDay?.date) {
        const parts = selectedDay.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (parts) return new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    }

    return now;
}

// ─── TIME CHECK ───────────────────────────────────────────────────────────────

function parseTimeStr(s) {
    if (!s) return null;
    // "06:47 AM" → minutes since midnight
    const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    const period = m[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + min;
}

function timeRangeToMinutes(rangeStr) {
    if (!rangeStr) return [];
    // Could be "06:47 AM to 08:10 AM, 03:10 PM to 04:33 PM"
    return rangeStr.split(",").map(r => {
        const parts = r.trim().match(/(.+?)\s+to\s+(.+)/i);
        if (!parts) return null;
        return { start: parseTimeStr(parts[1].trim()), end: parseTimeStr(parts[2].trim()) };
    }).filter(Boolean);
}

function isInRange(minutesSinceMidnight, ranges) {
    for (const r of ranges) {
        if (r.start !== null && r.end !== null && minutesSinceMidnight >= r.start && minutesSinceMidnight <= r.end) {
            return true;
        }
    }
    return false;
}

function extractQueryTime(msg) {
    // Extract time from message: "at 4 PM", "4:30 PM", "4pm"
    const m = msg.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!m) return null;
    let h = parseInt(m[1]), min = m[2] ? parseInt(m[2]) : 0;
    const period = m[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + min;
}

// ─── FESTIVAL SEARCH ──────────────────────────────────────────────────────────

async function searchFestival(query, year) {
    const festivals = await loadFestivals(year);
    const q = query.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
    const queryWords = q.split(" ").filter(Boolean);
    const minWordMatches = queryWords.length <= 1 ? 1 : Math.max(2, Math.ceil(queryWords.length * 0.6));
    const scoredResults = [];
    for (const [dateKey, fests] of Object.entries(festivals)) {
        for (const f of fests) {
            const fNorm = f.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
            const festivalWords = fNorm.split(" ").filter(Boolean);
            const hasDirectMatch = fNorm.includes(q) || q.includes(fNorm);
            const matchedWords = queryWords.filter((qw) =>
                festivalWords.some((fw) => levenshtein(qw, fw) <= Math.max(1, Math.floor(fw.length / 4)))
            );
            const wordMatchCount = matchedWords.length;
            if (hasDirectMatch || wordMatchCount >= minWordMatches) {
                const [y, m, d] = dateKey.split("-").map(Number);
                const dateObj = new Date(y, m - 1, d);
                const opts = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
                const score = (hasDirectMatch ? 10 : 0) + wordMatchCount;
                scoredResults.push({
                    score,
                    date: dateKey,
                    display: dateObj.toLocaleDateString("en-IN", opts),
                    festivals: fests,
                });
                break;
            }
        }
    }
    scoredResults.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
    return scoredResults.slice(0, 5).map(({ score, ...rest }) => rest);
}

// Search next occurrence of a Tithi in year's data from today onwards
async function findNextTithi(tithiName, fromDate) {
    const year = fromDate.getFullYear();
    const yearData = await loadYear(year);
    const tL = tithiName.toLowerCase();
    const results = [];
    for (const rec of yearData) {
        const [dd, mm, yy] = rec.date.split("/").map(Number);
        const recDate = new Date(yy, mm - 1, dd);
        if (recDate < fromDate) continue;
        const recTithi = (rec.Tithi || "").toLowerCase();
        if (recTithi.includes(tL) || levenshtein(tL, recTithi.split(" ")[0]) <= 2) {
            results.push({ date: recDate, record: rec });
            if (results.length >= 5) break;
        }
    }
    // If not enough results, check next year
    if (results.length < 3) {
        const nextYearData = await loadYear(year + 1);
        for (const rec of nextYearData) {
            const [dd, mm, yy] = rec.date.split("/").map(Number);
            const recDate = new Date(yy, mm - 1, dd);
            const recTithi = (rec.Tithi || "").toLowerCase();
            if (recTithi.includes(tL) || levenshtein(tL, recTithi.split(" ")[0]) <= 2) {
                results.push({ date: recDate, record: rec });
                if (results.length >= 5) break;
            }
        }
    }
    return results;
}

async function findNextNakshatra(nakshatraName, fromDate) {
    const year = fromDate.getFullYear();
    const yearData = await loadYear(year);
    const nL = nakshatraName.toLowerCase();
    const results = [];
    for (const rec of yearData) {
        const [dd, mm, yy] = rec.date.split("/").map(Number);
        const recDate = new Date(yy, mm - 1, dd);
        if (recDate < fromDate) continue;
        const recNak = (rec.Nakshatra || "").toLowerCase();
        if (recNak.includes(nL) || levenshtein(nL, recNak.split(" ")[0]) <= 2) {
            results.push({ date: recDate, record: rec });
            if (results.length >= 5) break;
        }
    }
    return results;
}

// ─── MULTILINGUAL RESPONSE TEMPLATES ─────────────────────────────────────────

function fmtDate(d, lang) {
    const months = {
        en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        te: ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"],
        hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
    };
    const days = {
        en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        te: ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"],
        hi: ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
    };
    const l = months[lang] ? lang : "en";
    return `${days[l][d.getDay()]}, ${d.getDate()} ${months[l][d.getMonth()]} ${d.getFullYear()}`;
}

const TRANSLATIONS = {
    tithi: { en: "Tithi", te: "తిథి", hi: "तिथि" },
    nakshatra: { en: "Nakshatra", te: "నక్షత్రం", hi: "नक्षत्र" },
    yoga: { en: "Yoga", te: "యోగం", hi: "योग" },
    karanam: { en: "Karanam", te: "కరణం", hi: "करण" },
    paksha: { en: "Paksha", te: "పక్షం", hi: "पक्ष" },
    sunrise: { en: "Sunrise", te: "సూర్యోదయం", hi: "सूर्योदय" },
    sunset: { en: "Sunset", te: "సూర్యాస్తమయం", hi: "सूर्यास्त" },
    rahu: { en: "Rahu Kalam", te: "రాహు కాలం", hi: "राहु काल" },
    yamaganda: { en: "Yamaganda", te: "యమగండం", hi: "यमगण्ड" },
    gulikai: { en: "Gulikai Kalam", te: "గులికై కాలం", hi: "गुलिकाल" },
    abhijit: { en: "Abhijit Muhurtham", te: "అభిజిత్ ముహూర్తం", hi: "अभिजित् मुहूर्त" },
    amrit: { en: "Amrit Kalam", te: "అమృత కాలం", hi: "अमृत काल" },
    dur: { en: "Dur Muhurtam", te: "దుర్ముహూర్తం", hi: "दुर्मुहूर्त" },
    varjyam: { en: "Varjyam", te: "వర్జ్యం", hi: "वर्ज्य" },
    lunar_month: { en: "Lunar Month", te: "చాంద్రమాన మాసం", hi: "चंद्र मास" },
    festivals: { en: "Festivals", te: "పండుగలు", hi: "त्योहार" },
    greet: {
        en: { friend: "Hello! 🙏 How can I help you today?", formal: "🙏 Namaste! How may I assist you today?" },
        te: { friend: "ఏమిటి బ్రో! 🙏 ఈ రోజు ఏం సహాయం కావాలి?", formal: "🙏 నమస్కారం! మీకు ఎలా సహాయపడగలను?" },
        hi: { friend: "क्या हाल दोस्त! 🙏 आज कैसे मदद करूं?", formal: "🙏 नमस्ते! आज कैसे सहायता करूं?" },
    },
    no_data: {
        en: "Sorry, I couldn't find data for that date. Please try a date between 1940 and 2125.",
        te: "క్షమించండి, ఆ తేదీ డేటా దొరకలేదు. 1940 నుండి 2125 మధ్య తేదీ ప్రయత్నించండి.",
        hi: "माफ़ करें, उस तारीख का डेटा नहीं मिला। कृपया 1940 से 2125 के बीच की तारीख आज़माएं।",
    },
    good_time: {
        en: "✅ {time} appears to be a **good time**! It falls in **{name}**, which is considered auspicious. Go ahead! 🙏",
        te: "✅ {time} మంచి సమయంగా ఉంది! ఇది **{name}** లో పడుతోంది, ఇది శుభకరమైనది. ముందుకు వెళ్ళండి! 🙏",
        hi: "✅ {time} एक **अच्छा समय** लगता है! यह **{name}** में पड़ता है, जो शुभ माना जाता है। आगे बढ़िए! 🙏",
    },
    bad_time: {
        en: "⚠️ Caution! {time} falls in **{name}** ({range}), which is considered inauspicious. Please **avoid** important activities during this time.",
        te: "⚠️ జాగ్రత్త! {time} **{name}** ({range}) లో పడుతోంది, ఇది అశుభంగా పరిగణించబడుతుంది. ఈ సమయంలో ముఖ్యమైన పనులు **నివారించండి**.",
        hi: "⚠️ सावधान! {time} **{name}** ({range}) में पड़ता है, जो अशुभ माना जाता है। इस समय महत्वपूर्ण कार्य **टालें**।",
    },
    neutral_time: {
        en: "ℹ️ {time} appears to be a **neutral time** today. No major inauspicious periods. You may proceed normally. 🙏",
        te: "ℹ️ {time} ఈ రోజు **సాధారణ సమయం**గా ఉంది. ఏ ముఖ్యమైన అశుభ కాలాలు లేవు. మీరు సాధారణంగా ముందుకు వెళ్ళవచ్చు. 🙏",
        hi: "ℹ️ {time} आज एक **सामान्य समय** लगता है। कोई बड़े अशुभ काल नहीं हैं। आप सामान्य रूप से आगे बढ़ सकते हैं। 🙏",
    },
    farewell: {
        en: "🙏 You're welcome! Have an auspicious day!",
        te: "🙏 సంతోషంగా సహాయపడ్డాను! శుభ దినమగుగాక!",
        hi: "🙏 खुशी से! आपका दिन शुभ हो!",
    },
};

function t(key, lang) {
    return TRANSLATIONS[key]?.[lang] || TRANSLATIONS[key]?.en || key;
}

// ─── GENERAL KNOWLEDGE BASE ───────────────────────────────────────────────────

const KNOWLEDGE = {
    what_is_tithi: {
        en: "🌙 **What is a Tithi?**\n\nA Tithi is a **lunar day** in the Hindu calendar. It represents the time taken for the longitudinal angle between the Moon and Sun to increase by 12°.\n\n- There are **30 Tithis** in a lunar month\n- 15 in **Shukla Paksha** (waxing moon) and 15 in **Krishna Paksha** (waning moon)\n- The 15th Tithi of Shukla Paksha is **Purnima** (Full Moon)\n- The 15th Tithi of Krishna Paksha is **Amavasya** (New Moon)\n- A Tithi can be shorter or longer than 24 hours",
        te: "🌙 **తిథి అంటే ఏమిటి?**\n\nతిథి అంటే హిందూ పంచాంగంలో **చాంద్రమాన దివసం**. సూర్యుడు మరియు చంద్రుడి మధ్య రేఖాంశ కోణం 12° పెరగడానికి పట్టే సమయమే తిథి.\n\n- చాంద్రమాన మాసంలో **30 తిథులు** ఉంటాయి\n- 15 **శుక్ల పక్షం**లో, 15 **కృష్ణ పక్షం**లో\n- శుక్ల పక్షం 15వ తిథి **పూర్ణిమ**\n- కృష్ణ పక్షం 15వ తిథి **అమావాస్య**",
        hi: "🌙 **तिथि क्या होती है?**\n\nतिथि हिंदू पंचांग में **चंद्र दिवस** होती है। यह वह समय है जब सूर्य और चंद्र के देशांतर का अंतर 12° बढ़ता है।\n\n- एक चंद्र महीने में **30 तिथियां** होती हैं\n- 15 **शुक्ल पक्ष** में और 15 **कृष्ण पक्ष** में\n- शुक्ल पक्ष की 15वीं तिथि **पूर्णिमा** है\n- कृष्ण पक्ष की 15वीं तिथि **अमावस्या** है",
    },
    what_is_nakshatra: {
        en: "⭐ **What is a Nakshatra?**\n\nA Nakshatra is a **lunar mansion** or constellation that the Moon passes through. The zodiac is divided into 27 (or 28) Nakshatras.\n\n- Each Nakshatra spans **13°20'** of the zodiac\n- The Moon takes about **1 day** to pass through each Nakshatra\n- Each Nakshatra has a ruling planet (**Graha**) and deity\n- Nakshatras are used for birth charts, muhurta, and daily panchang",
        te: "⭐ **నక్షత్రం అంటే ఏమిటి?**\n\nనక్షత్రం అనేది చంద్రుడు దాటే **చాంద్ర మందిరం** లేదా నక్షత్రపు సమూహం. రాశిచక్రం 27 (లేదా 28) నక్షత్రాలుగా విభజించబడింది.\n\n- ప్రతి నక్షత్రం రాశిలో **13°20'** విస్తరించి ఉంటుంది\n- చంద్రుడు ప్రతి నక్షత్రం గుండా దాదాపు **1 రోజు**లో వెళ్తాడు\n- ప్రతి నక్షత్రానికి ఒక అధిపతి గ్రహం మరియు దేవత ఉంటారు",
        hi: "⭐ **नक्षत्र क्या होता है?**\n\nनक्षत्र एक **चंद्र नक्षत्र** है जिससे चंद्रमा गुजरता है। राशिचक्र को 27 (या 28) नक्षत्रों में विभाजित किया गया है।\n\n- प्रत्येक नक्षत्र राशि में **13°20'** तक फैला है\n- चंद्रमा प्रत्येक नक्षत्र से लगभग **1 दिन** में गुजरता है\n- प्रत्येक नक्षत्र का एक स्वामी ग्रह और देवता है",
    },
    what_is_yoga: {
        en: "🕉️ **What is Yoga in Panchang?**\n\nIn Panchang, Yoga is one of the **five elements (Pancha Anga)**. It is calculated based on the combined longitude of the Sun and Moon.\n\n- There are **27 Yogas** in total\n- Some are auspicious (**Shubha**): Siddhi, Amrita, Priti, Ayushman, Shobhana...\n- Some are inauspicious (**Ashubha**): Vishkumbha, Atiganda, Shoola, Ganda, Vyaghata...\n- Yogas are used for timing auspicious events",
        te: "🕉️ **పంచాంగంలో యోగం అంటే ఏమిటి?**\n\nపంచాంగంలో యోగం **పంచాంగ అంగాలలో** ఒకటి. సూర్యుడు మరియు చంద్రుడి రేఖాంశాల మొత్తం ఆధారంగా లెక్కించబడుతుంది.\n\n- మొత్తం **27 యోగాలు** ఉన్నాయి\n- కొన్ని శుభమైనవి: సిద్ధి, అమృత, ప్రీతి...\n- కొన్ని అశుభమైనవి: విష్కంభ, అతిగండ, శూల...",
        hi: "🕉️ **पंचांग में योग क्या होता है?**\n\nपंचांग में योग **पंच अंगों** में से एक है। यह सूर्य और चंद्र की संयुक्त रेखांश पर आधारित है।\n\n- कुल **27 योग** होते हैं\n- कुछ शुभ हैं: सिद्धि, अमृत, प्रीति, आयुष्मान...\n- कुछ अशुभ हैं: विष्कुंभ, अतिगंड, शूल, गंड...",
    },
    count_nakshatra: {
        en: "⭐ There are **27 Nakshatras** in Vedic astrology (some traditions include a 28th — **Abhijit**). They are: Ashwini, Bharani, Krittika, Rohini, Mrigashira, Ardra, Punarvasu, Pushya, Ashlesha, Magha, Purva Phalguni, Uttara Phalguni, Hasta, Chitra, Swati, Vishakha, Anuradha, Jyeshtha, Mula, Purva Ashadha, Uttara Ashadha, Shravana, Dhanishta, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati.",
        te: "⭐ వేద జ్యోతిష్యంలో **27 నక్షత్రాలు** ఉన్నాయి (కొన్ని సంప్రదాయాలు 28వదైన **అభిజిత్** ను కూడా చేర్చుతాయి). అవి: అశ్విని, భరణి, కృత్తిక, రోహిణి, మృగశిర, ఆర్ద్ర, పునర్వసు, పుష్య, ఆశ్లేష, మఘ, పూర్వ ఫల్గుణి, ఉత్తర ఫల్గుణి, హస్త, చిత్ర, స్వాతి, విశాఖ, అనూరాధ, జ్యేష్ఠ, మూల, పూర్వాషాఢ, ఉత్తరాషాఢ, శ్రవణ, ధనిష్ఠ, శతభిష, పూర్వభాద్ర, ఉత్తరభాద్ర, రేవతి.",
        hi: "⭐ वैदिक ज्योतिष में **27 नक्षत्र** होते हैं (कुछ परंपराएं 28वां नक्षत्र **अभिजित** भी मानती हैं)। वे हैं: अश्विनी, भरणी, कृत्तिका, रोहिणी, मृगशिरा, आर्द्रा, पुनर्वसु, पुष्य, आश्लेषा, मघा, पू. फाल्गुनी, उ. फाल्गुनी, हस्त, चित्रा, स्वाती, विशाखा, अनुराधा, ज्येष्ठा, मूल, पू. आषाढ़ा, उ. आषाढ़ा, श्रवण, धनिष्ठा, शतभिषा, पू. भाद्रपद, उ. भाद्रपद, रेवती।",
    },
    count_tithi: {
        en: "🌙 There are **30 Tithis** in a lunar month — 15 in Shukla Paksha and 15 in Krishna Paksha.",
        te: "🌙 చాంద్రమాన మాసంలో **30 తిథులు** ఉంటాయి — శుక్ల పక్షంలో 15, కృష్ణ పక్షంలో 15.",
        hi: "🌙 एक चंद्र महीने में **30 तिथियां** होती हैं — शुक्ल पक्ष में 15 और कृष्ण पक्ष में 15।",
    },
    count_yoga: {
        en: "🕉️ There are **27 Yogas** in Panchang.",
        te: "🕉️ పంచాంగంలో **27 యోగాలు** ఉన్నాయి.",
        hi: "🕉️ पंचांग में **27 योग** होते हैं।",
    },
};

// ─── RESPONSE BUILDERS ────────────────────────────────────────────────────────

function buildDayLine(record, lang) {
    // Extract first meaningful part up to "upto"
    const clean = (s) => {
        if (!s) return "—";
        const m = String(s).match(/^(.+?)(?:\s+upto\s+.+)?$/i);
        return m ? m[1].trim() : String(s);
    };
    return {
        tithi: clean(record.Tithi),
        nakshatra: clean(record.Nakshatra),
        yoga: clean(record.Yoga),
        karanam: clean(record.Karanam || record.Karana),
        paksha: record.Paksha || "—",
        sunrise: record.Sunrise || "—",
        sunset: record.Sunset || "—",
        rahu: record["Rahu Kalam"] || "—",
        yamaganda: record.Yamaganda || "—",
        gulikai: record["Gulikai Kalam"] || "—",
        abhijit: record.Abhijit || "—",
        amrit: record["Amrit Kalam"] || record["Amritha Kalam"] || "—",
        dur: record["Dur Muhurtam"] || "—",
        varjyam: record.Varjyam || "—",
        lunar: record["Lunar Month"] || "—",
        samvat: record["Shaka Samvat"] || "—",
        festivals: Array.isArray(record.Festivals) ? record.Festivals : [],
    };
}

function buildFullPanchang(record, date, lang) {
    const d = buildDayLine(record, lang);
    const T = (k) => TRANSLATIONS[k]?.[lang] || TRANSLATIONS[k]?.en;
    const header = {
        en: `📅 **Panchang for ${fmtDate(date, "en")}**`,
        te: `📅 **${fmtDate(date, "te")} పంచాంగం**`,
        hi: `📅 **${fmtDate(date, "hi")} का पंचांग**`,
    }[lang] || `📅 **Panchang for ${fmtDate(date, "en")}**`;

    let r = `${header}\n\n`;

    // Core panchang
    const labels = {
        en: { p: "Paksha", t: "Tithi", n: "Nakshatra", y: "Yoga", k: "Karanam" },
        te: { p: "పక్షం", t: "తిథి", n: "నక్షత్రం", y: "యోగం", k: "కరణం" },
        hi: { p: "पक्ष", t: "तिथि", n: "नक्षत्र", y: "योग", k: "करण" },
    }[lang] || { p: "Paksha", t: "Tithi", n: "Nakshatra", y: "Yoga", k: "Karanam" };

    r += `🌗 **${labels.p}:** ${d.paksha}\n`;
    r += `🌙 **${labels.t}:** ${d.tithi}\n`;
    r += `⭐ **${labels.n}:** ${d.nakshatra}\n`;
    r += `🕉️ **${labels.y}:** ${d.yoga}\n`;
    r += `🔷 **${labels.k}:** ${d.karanam}\n\n`;

    // Timings
    const tl = {
        en: { sr: "Sunrise", ss: "Sunset", rk: "Rahu Kalam ⚠️", yg: "Yamaganda ⚠️", gk: "Gulikai Kalam ⚠️", ab: "Abhijit Muhurtham ✅", am: "Amrit Kalam ✅", dm: "Dur Muhurtam ⚠️", vj: "Varjyam ⚠️" },
        te: { sr: "సూర్యోదయం", ss: "సూర్యాస్తమయం", rk: "రాహు కాలం ⚠️", yg: "యమగండం ⚠️", gk: "గులికై కాలం ⚠️", ab: "అభిజిత్ ముహూర్తం ✅", am: "అమృత కాలం ✅", dm: "దుర్ముహూర్తం ⚠️", vj: "వర్జ్యం ⚠️" },
        hi: { sr: "सूर्योदय", ss: "सूर्यास्त", rk: "राहु काल ⚠️", yg: "यमगण्ड ⚠️", gk: "गुलिकाल ⚠️", ab: "अभिजित् मुहूर्त ✅", am: "अमृत काल ✅", dm: "दुर्मुहूर्त ⚠️", vj: "वर्ज्य ⚠️" },
    }[lang] || { sr: "Sunrise", ss: "Sunset", rk: "Rahu Kalam ⚠️", yg: "Yamaganda ⚠️", gk: "Gulikai Kalam ⚠️", ab: "Abhijit Muhurtham ✅", am: "Amrit Kalam ✅", dm: "Dur Muhurtam ⚠️", vj: "Varjyam ⚠️" };

    r += `**${lang === "te" ? "సమయాలు" : lang === "hi" ? "समय" : "Timings"}**\n`;
    r += `🌅 **${tl.sr}:** ${d.sunrise} | 🌇 **${tl.ss}:** ${d.sunset}\n`;
    r += `- **${tl.rk}:** ${d.rahu}\n`;
    r += `- **${tl.yg}:** ${d.yamaganda}\n`;
    r += `- **${tl.gk}:** ${d.gulikai}\n`;
    r += `- **${tl.ab}:** ${d.abhijit}\n`;
    r += `- **${tl.am}:** ${d.amrit}\n`;
    r += `- **${tl.dm}:** ${d.dur}\n`;
    if (d.varjyam !== "—") r += `- **${tl.vj}:** ${d.varjyam}\n`;

    // Lunar month & Samvat
    r += `\n📖 **${T("lunar_month")}:** ${d.lunar}`;
    if (d.samvat !== "—") r += ` | **Shaka Samvat:** ${d.samvat}`;
    r += "\n";

    // Festivals
    if (d.festivals.length) {
        r += `\n🎉 **${T("festivals")}:** ${d.festivals.join(", ")}\n`;
    }

    return r.trim();
}

function buildSingleField(record, date, intent, lang) {
    const d = buildDayLine(record, lang);
    const dateStr = fmtDate(date, lang);
    const T = (k) => TRANSLATIONS[k]?.[lang] || TRANSLATIONS[k]?.en;

    const fieldMap = {
        tithi: { icon: "🌙", label: T("tithi"), value: d.tithi },
        nakshatra: { icon: "⭐", label: T("nakshatra"), value: d.nakshatra },
        yoga: { icon: "🕉️", label: T("yoga"), value: d.yoga },
        karanam: { icon: "🔷", label: T("karanam"), value: d.karanam },
        paksha: { icon: "🌗", label: T("paksha"), value: d.paksha },
        rahu_kalam: { icon: "⚠️", label: T("rahu"), value: d.rahu },
        yamaganda: { icon: "⚠️", label: T("yamaganda"), value: d.yamaganda },
        gulikai: { icon: "⚠️", label: T("gulikai"), value: d.gulikai },
        abhijit: { icon: "✅", label: T("abhijit"), value: d.abhijit },
        amrit_kalam: { icon: "✅", label: T("amrit"), value: d.amrit },
        dur_muhurtam: { icon: "⚠️", label: T("dur"), value: d.dur },
        sunrise_sunset: { icon: "🌅", label: T("sunrise"), value: `${d.sunrise} | 🌇 ${T("sunset")}: ${d.sunset}` },
        lunar_month: { icon: "📖", label: T("lunar_month"), value: d.lunar },
        shaka_samvat: { icon: "📜", label: "Shaka Samvat", value: d.samvat },
    };

    const f = fieldMap[intent];
    if (!f) return null;

    const on = { en: "on", te: "న", hi: "को" }[lang] || "on";
    const lines = { en: "is", te: ":", hi: "है" }[lang] || "is";
    return `${f.icon} **${f.label}** ${on} **${dateStr}** ${lines}\n\n**${f.value}**`;
}

// ─── MAIN ENGINE FUNCTION ─────────────────────────────────────────────────────

export async function processMessage({ message, selectedDay, language = "en", friendMode = false }) {
    const lang = ["en", "te", "hi"].includes(language) ? language : "en";
    const mode = friendMode ? "friend" : "formal";
    const msg = message.trim();

    if (!msg) return { response: "Please ask a question." };

    // --- Intent detection ---
    const norm = normalizeMessage(msg);
    const intent = detectIntent(msg);

    // --- Greetings ---
    if (intent === "greeting") {
        const g = TRANSLATIONS.greet[lang][mode];
        const extra = {
            en: "\n\nAsk me about today's **Tithi, Nakshatra, Rahu Kalam, festivals**, auspicious times, or anything about Panchang!",
            te: "\n\nఈ రోజు **తిథి, నక్షత్రం, రాహు కాలం, పండుగలు**, శుభ సమయాల గురించి అడగండి!",
            hi: "\n\nआज की **तिथि, नक्षत्र, राहु काल, त्योहार**, शुभ समय के बारे में पूछें!",
        }[lang] || "";
        return { response: g + extra };
    }

    // --- Farewell ---
    if (intent === "farewell") {
        return { response: TRANSLATIONS.farewell[lang] };
    }

    // --- General Knowledge ---
    if (["what_is_tithi", "what_is_nakshatra", "what_is_yoga", "count_nakshatra", "count_tithi", "count_yoga"].includes(intent)) {
        const k = KNOWLEDGE[intent];
        return { response: k?.[lang] || k?.en || "Sorry, I don't have that information." };
    }

    // --- Find next Tithi occurrence ---
    if (intent === "find_next_tithi") {
        const search = extractTithiSearch(msg);
        const tName = search?.name || "ekadashi";
        const fromDate = new Date();
        const results = await findNextTithi(tName, fromDate);
        if (results.length === 0) {
            return { response: { en: `Sorry, I couldn't find upcoming ${tName} dates.`, te: `క్షమించండి, ${tName} తేదీలు దొరకలేదు.`, hi: `माफ़ करें, ${tName} तिथि नहीं मिली।` }[lang] };
        }
        const capitalName = tName.charAt(0).toUpperCase() + tName.slice(1);
        const header = { en: `🌙 Upcoming **${capitalName}** dates`, te: `🌙 రాబోయే **${capitalName}** తేదీలు`, hi: `🌙 आगामी **${capitalName}** तिथियां` }[lang];
        const festMap = await loadFestivals(fromDate.getFullYear());
        const body = results.map(r => {
            const tithiStr = (r.record.Tithi || "").split("upto")[0].trim();
            const fKey = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}-${String(r.date.getDate()).padStart(2, "0")}`;
            const fests = festMap[fKey] ? ` — ${festMap[fKey].join(", ")}` : "";
            return `- **${fmtDate(r.date, lang)}**: ${tithiStr}${fests}`;
        }).join("\n");
        return { response: `${header}\n\n${body}` };
    }

    // --- Find next Nakshatra occurrence ---
    if (intent === "find_next_nakshatra") {
        const search = extractNakshatraSearch(msg);
        const nName = search?.name || "rohini";
        const fromDate = new Date();
        const results = await findNextNakshatra(nName, fromDate);
        if (results.length === 0) {
            return { response: { en: `Sorry, couldn't find upcoming ${nName} dates.`, te: `క్షమించండి, ${nName} తేదీలు దొరకలేదు.`, hi: `माफ़ करें, ${nName} नक्षत्र नहीं मिला।` }[lang] };
        }
        const capitalName = nName.charAt(0).toUpperCase() + nName.slice(1);
        const header = { en: `⭐ Upcoming **${capitalName}** Nakshatra dates`, te: `⭐ రాబోయే **${capitalName}** నక్షత్రం తేదీలు`, hi: `⭐ आगामी **${capitalName}** नक्षत्र तिथियां` }[lang];
        const body = results.map(r => {
            const nakStr = (r.record.Nakshatra || "").split("upto")[0].trim();
            return `- **${fmtDate(r.date, lang)}**: ${nakStr}`;
        }).join("\n");
        return { response: `${header}\n\n${body}` };
    }

    // --- Festival search ---
    if (intent === "festival") {
        const stopWords = new Set(["when", "is", "are", "the", "festival", "date", "of", "in", "on", "what", "day", "which", "next", "upcoming"]);
        const queryWords = msg
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(w => !stopWords.has(w) && !/^\d{4}$/.test(w) && w.length > 2);
        const query = queryWords.join(" ");
        if (query.length > 0) {
            const targetDate = extractTargetDate(msg, selectedDay);
            const year = /20\d\d/i.test(msg) ? parseInt(msg.match(/20\d\d/)[0]) : targetDate.getFullYear();
            const results = await searchFestival(query, year);
            if (results.length > 0) {
                const header = { en: `🎉 Festivals matching **"${queryWords.join(" ")}"** in ${year}`, te: `🎉 "${queryWords.join(" ")}" పండుగలు ${year}లో`, hi: `🎉 "${queryWords.join(" ")}" त्योहार ${year} में` }[lang];
                const body = results.map(r => `- **${r.display}**: ${r.festivals.join(", ")}`).join("\n");
                return { response: `${header}\n\n${body}` };
            }
            const notFound = { en: `I couldn't find **"${queryWords.join(" ")}"** in ${year}. Try a different spelling or year.`, te: `**"${queryWords.join(" ")}"** ${year}లో దొరకలేదు.`, hi: `**"${queryWords.join(" ")}"** ${year} में नहीं मिला।` }[lang];
            return { response: notFound };
        }
    }

    // --- Data-based queries (require date + day record) ---
    const targetDate = extractTargetDate(msg, selectedDay);
    const year = targetDate.getFullYear();
    const yearData = await loadYear(year);

    if (!yearData.length) {
        return { response: TRANSLATIONS.no_data[lang] };
    }

    // Merge festivals from the festivals JSON
    const festivalsJson = await loadFestivals(year);
    const dd2 = String(targetDate.getDate()).padStart(2, "0");
    const mm2 = String(targetDate.getMonth() + 1).padStart(2, "0");
    const festKey = `${year}-${mm2}-${dd2}`;
    let record = getDayRecord(yearData, targetDate);

    if (!record) {
        return { response: TRANSLATIONS.no_data[lang] };
    }

    // If frontend provided selectedDay for this exact date (often enriched from Prokerala),
    // prefer those live values for chat responses.
    const targetKey = `${dd2}/${mm2}/${year}`;
    if (selectedDay?.date === targetKey) {
        record = { ...record, ...selectedDay };
    }

    // Merge in festivals data from festivals JSON if available
    if (festivalsJson[festKey] && Array.isArray(festivalsJson[festKey])) {
        record.Festivals = festivalsJson[festKey];
    }

    // --- Full Panchang ---
    if (intent === "full_panchang" || intent === "shaka_samvat") {
        return { response: buildFullPanchang(record, targetDate, lang) };
    }

    // --- Good time summary ---
    if (intent === "good_time_summary") {
        const d = buildDayLine(record, lang);
        const dateStr = fmtDate(targetDate, lang);
        const header = { en: `✨ **Auspicious & Inauspicious Times for ${dateStr}**`, te: `✨ **${dateStr} కి శుభాశుభ సమయాలు**`, hi: `✨ **${dateStr} के शुभ-अशुभ काल**` }[lang];
        const goodLabel = { en: "✅ Good / Auspicious Times", te: "✅ శుభ సమయాలు", hi: "✅ शुभ काल" }[lang];
        const badLabel = { en: "⚠️ Times to Avoid", te: "⚠️ నివారించాల్సిన సమయాలు", hi: "⚠️ बचने योग्य काल" }[lang];
        let r = `${header}\n\n**${goodLabel}**\n`;
        r += `- **${TRANSLATIONS.abhijit[lang]}:** ${d.abhijit}\n`;
        r += `- **${TRANSLATIONS.amrit[lang]}:** ${d.amrit}\n`;
        r += `\n**${badLabel}**\n`;
        r += `- **${TRANSLATIONS.rahu[lang]}:** ${d.rahu}\n`;
        r += `- **${TRANSLATIONS.yamaganda[lang]}:** ${d.yamaganda}\n`;
        r += `- **${TRANSLATIONS.gulikai[lang]}:** ${d.gulikai}\n`;
        r += `- **${TRANSLATIONS.dur[lang]}:** ${d.dur}\n`;
        if (d.varjyam !== "—") r += `- **${TRANSLATIONS.varjyam[lang]}:** ${d.varjyam}\n`;
        return { response: r.trim() };
    }

    // --- Time check ---
    if (intent === "time_check") {
        const queryMin = extractQueryTime(msg);
        const d = buildDayLine(record, lang);

        // Current time if not specified
        const checkMin = queryMin !== null ? queryMin : (new Date().getHours() * 60 + new Date().getMinutes());
        const hh = Math.floor(checkMin / 60);
        const mm = checkMin % 60;
        const period = hh >= 12 ? "PM" : "AM";
        const h12 = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
        const timeLabel = `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${period}`;

        // Bad times
        const badTimes = [
            { name: TRANSLATIONS.rahu[lang], range: d.rahu },
            { name: TRANSLATIONS.yamaganda[lang], range: d.yamaganda },
            { name: TRANSLATIONS.gulikai[lang], range: d.gulikai },
            { name: TRANSLATIONS.dur[lang], range: d.dur },
        ];

        for (const bt of badTimes) {
            if (!bt.range || bt.range === "—") continue;
            const ranges = timeRangeToMinutes(bt.range);
            if (isInRange(checkMin, ranges)) {
                const resp = TRANSLATIONS.bad_time[lang]
                    .replace("{time}", timeLabel).replace("{name}", bt.name).replace("{range}", bt.range);
                return { response: resp };
            }
        }

        // Good times
        const goodTimes = [
            { name: TRANSLATIONS.abhijit[lang], range: d.abhijit },
            { name: TRANSLATIONS.amrit[lang], range: d.amrit },
        ];

        for (const gt of goodTimes) {
            if (!gt.range || gt.range === "—") continue;
            const ranges = timeRangeToMinutes(gt.range);
            if (isInRange(checkMin, ranges)) {
                const resp = TRANSLATIONS.good_time[lang]
                    .replace("{time}", timeLabel).replace("{name}", gt.name);
                return { response: resp };
            }
        }

        // Neutral
        const resp = TRANSLATIONS.neutral_time[lang].replace("{time}", timeLabel);
        return { response: resp };
    }

    // --- Single field queries ---
    const singleFields = ["tithi", "nakshatra", "yoga", "karanam", "paksha", "rahu_kalam",
        "yamaganda", "gulikai", "abhijit", "amrit_kalam", "dur_muhurtam", "sunrise_sunset", "lunar_month"];

    if (singleFields.includes(intent)) {
        const out = buildSingleField(record, targetDate, intent, lang);
        if (out) return { response: out };
    }

    // --- Festival on a specific date ---
    const d = buildDayLine(record, lang);
    if (d.festivals.length) {
        const header = { en: `🎉 Festivals on **${fmtDate(targetDate, "en")}**`, te: `🎉 **${fmtDate(targetDate, "te")}** పండుగలు`, hi: `🎉 **${fmtDate(targetDate, "hi")}** को त्योहार` }[lang];
        return { response: `${header}\n\n${d.festivals.join(" | ")}` };
    }

    // --- Fallback: show full panchang ---
    return { response: buildFullPanchang(record, targetDate, lang) };
}

// Export detectIntent so the chatbot router can route before calling processMessage
export { detectIntent };

