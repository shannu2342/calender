/**
 * geminiChatService.js
 * Panchang Chatbot powered by Google Gemini 2.5 Flash.
 *
 * KEY DESIGN DECISIONS:
 * - Injects BOTH "today's real date" AND "selected calendar date" so Gemini
 *   never confuses them — "today" questions always use the real server date.
 * - Strict anti-hallucination rules: Gemini must NOT invent specific tithi/
 *   festival dates it doesn't have. It should say it doesn't know.
 */

import { GoogleGenAI } from "@google/genai";

// Lazy singleton — created on first use so dotenv has already run by then
let _ai = null;
function getAI() {
    if (!_ai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env");
        _ai = new GoogleGenAI({ apiKey });
    }
    return _ai;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Format a JS Date as "Monday, 23 February 2026" */
function formatDate(d) {
    return d.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

function buildSystemPrompt(language, friendMode, todayStr) {
    const langName = {
        en: "English",
        te: "Telugu",
        hi: "Hindi",
        ml: "Malayalam",
        kn: "Kannada",
        ta: "Tamil",
    }[language] || "English";

    const tone = friendMode
        ? "You are a friendly, casual assistant — like a knowledgeable friend. Use warm language and a conversational tone."
        : "You are a polite and helpful expert assistant. Be respectful, clear, and thorough.";

    return `You are **PanchangBot**, an expert AI assistant for Hindu Panchang, Vedic astrology, and Indian spirituality.

## YOUR ROLE (Critical — read carefully)
You are the **knowledge and explanation** layer of a hybrid chatbot system. A separate rule-based engine handles all direct data lookups (today's tithi, nakshatra, timings, "when is next Ekadashi", festival dates, etc.) using an authoritative local database.

**You will ONLY be called for questions that need deep explanation, contextual knowledge, or concepts — NOT for specific date lookups.**

Your expertise covers:
- Deep explanations of Panchang concepts (Tithi, Nakshatra, Yoga, Karanam, Paksha — their meaning, significance, calculation)
- Hindu festivals and vratas — spiritual significance, stories, how to observe them, traditions
- Vedic astrology concepts (Navagrahas, Rashifal/horoscope concepts, Lagna, Dasha systems, birth chart basics)
- Regional Hindu calendars (Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali traditions)
- Muhurta concepts — what makes a time auspicious, how to choose muhurta for events
- Hindu spirituality, dharma, karma, pilgrimage, puja vidhi, mantra significance
- Hindu months (Chaitra, Vaishakha, Magha etc.) — their significance and observances
- General Hindu culture and traditions

## DATE GROUNDING (Always follow)
- **Today is: ${todayStr}**
- If the user's message includes "Panchang Context Data" below, use those values ONLY for that specific date.
- When the user says "today", "aaj", "ఈ రోజు" or equivalent, they mean **${todayStr}**.
- "Selected Calendar Date" data is NOT today unless the date matches ${todayStr}.

## STRICT ANTI-HALLUCINATION RULES
- **NEVER invent or calculate specific calendar dates** for upcoming tithis, nakshatras, festivals, or Ekadashi dates.
- If someone asks "when is Ekadashi?" or "when is Diwali?", do NOT give a specific date unless it appears in the provided Panchang Context Data. Instead explain what it is and tell the user the app's calendar can show exact dates.
- You MAY explain WHAT a festival/tithi is, its significance, which lunar month it generally falls in — without specifying a Gregorian date.
- If context data provides a date, you may reference it. Otherwise, acknowledge you don't have calendar data for that query.

## RESPONSE RULES
1. **Language:** Always respond in ${langName}.
2. **Tone:** ${tone}
3. **Formatting:** Use relevant emojis (🙏 🌙 ⭐ 🕉️ 🎉 🌅 ⚠️ ✅), clear headings, and bullet points for clarity.
4. **Accuracy:** Only use provided panchang context for date-specific values. Don't guess numbers.
5. **Depth:** Give rich, educational, engaging answers. Don't be shallow — users want to learn.
6. **Scope:** For topics completely unrelated to Hindu culture, panchang, or Indian traditions, politely say: "I specialize in panchang and Hindu topics. Please ask me about those! 🙏"
7. **Typos:** If the user makes spelling mistakes (example: "thithi", "ekadahi"), infer the most likely panchang term and answer. If ambiguous, ask one short clarification question.`;
}

// ─── CONTEXT BUILDER ──────────────────────────────────────────────────────────

function buildDayBlock(label, day) {
    if (!day) return "";

    const fields = [
        ["Date", day.date],
        ["Day of Week", day.day],
        ["Paksha", day.Paksha],
        ["Tithi", day.Tithi],
        ["Nakshatra", day.Nakshatra],
        ["Yoga", day.Yoga],
        ["Karanam", day.Karanam || day.Karana],
        ["Sunrise", day.Sunrise],
        ["Sunset", day.Sunset],
        ["Rahu Kalam", day["Rahu Kalam"]],
        ["Yamaganda", day.Yamaganda],
        ["Gulikai Kalam", day["Gulikai Kalam"]],
        ["Abhijit Muhurtham", day.Abhijit],
        ["Amrit Kalam", day["Amrit Kalam"] || day["Amritha Kalam"]],
        ["Dur Muhurtam", day["Dur Muhurtam"]],
        ["Varjyam", day.Varjyam],
        ["Lunar Month", day["Lunar Month"]],
        ["Shaka Samvat", day["Shaka Samvat"]],
        ["Festivals", Array.isArray(day.Festivals) ? day.Festivals.join(", ") : day.Festivals],
    ];

    const lines = fields
        .filter(([, v]) => v && v !== "—" && v !== "" && v !== null && v !== undefined)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n");

    if (!lines) return "";

    return `\n### ${label}\n${lines}\n`;
}

function buildContext(selectedDay, todayDay) {
    let ctx = "";

    // Today's panchang (if available and if selectedDay is actually today)
    if (todayDay) {
        ctx += buildDayBlock("📅 Today's Panchang Data", todayDay);
    }

    // Selected calendar day (always included if different from today)
    if (selectedDay) {
        const isToday = todayDay && selectedDay.date === todayDay.date;
        const label = isToday
            ? "📅 Today's Panchang Data"
            : "📆 Selected Calendar Date Panchang Data (NOT today — only use this when user asks about this specific date)";

        if (!todayDay) {
            ctx += buildDayBlock(label, selectedDay);
        } else if (!isToday) {
            ctx += buildDayBlock(label, selectedDay);
        }
    }

    if (!ctx) return "";

    return `\n\n---\n## Panchang Context Data\n${ctx}---\n`;
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * Ask Gemini a panchang-related question.
 * @param {object} params
 * @param {string}      params.message      User's message
 * @param {object|null} params.selectedDay  Panchang data for the calendar-selected day
 * @param {object|null} params.todayDay     Panchang data for actual today (optional, same shape)
 * @param {string}      params.language     Language code: en | te | hi | ml | kn | ta
 * @param {boolean}     params.friendMode   Casual (true) or formal (false) tone
 * @returns {Promise<string>} Bot response text
 */
export async function askGemini({
    message,
    selectedDay = null,
    todayDay = null,
    language = "en",
    friendMode = false,
    horoscopeContext = "",
}) {
    // Always use real server time for today's date string
    const todayStr = formatDate(new Date());

    const systemPrompt = buildSystemPrompt(language, friendMode, todayStr);
    const context = buildContext(selectedDay, todayDay);

    const blocks = [String(message || "").trim()];
    if (context) blocks.push(context);
    if (horoscopeContext) {
        blocks.push(`\n## Horoscope Context Data\n${horoscopeContext}\n`);
    }
    const userContent = blocks.filter(Boolean).join("\n\n");

    const response = await getAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
            {
                role: "user",
                parts: [{ text: userContent }],
            },
        ],
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,   // Lower = more factual, less hallucination
            maxOutputTokens: 1500,
        },
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Empty response from Gemini");
    return text;
}

