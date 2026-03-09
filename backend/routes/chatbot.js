/**
 * chatbot.js - Hybrid Chatbot Router
 *
 * Routing strategy:
 *  1. Detect intent from the user message using panchangBotEngine's detectIntent.
 *  2. Hard-block clearly unrelated questions with a professional scope message.
 *  3. For unknown-but-related queries, use Gemini for conceptual guidance.
 *  4. For known Panchang intents, use the rule-based engine with local JSON data.
 */
import express from "express";
import { processMessage, detectIntent } from "../services/panchangBotEngine.js";
import { askGemini } from "../services/geminiChatService.js";
import {
  answerHoroscopeQuery,
  buildHoroscopeContext,
  isHoroscopeQuery,
} from "../services/rashiphalService.js";

const router = express.Router();

const PANCHANG_DOMAIN_PATTERNS = [
  /\b(panchang|panchanga|tithi|thithi|nakshatra|nakshatram|yoga|karanam|karana|paksha)\b/i,
  /\b(rahu\s*kalam|rahukalam|yamaganda|gulikai|gulika|abhijit|amrit\s*kalam|dur\s*muhurtam|durmuhurtam|varjyam|muhurta|muhurtam|auspicious)\b/i,
  /\b(festival|vrat|puja|jayanti|ekadashi|amavasya|purnima|sankranti|ugadi|diwali|deepavali|holi|navratri|shivaratri|janmashtami|rama\s*navami|ganesh|hanuman)\b/i,
  /\b(hindu\s*calendar|vedic\s*calendar|lunar\s*month|chandramana|masa|maas|samvat|shaka)\b/i,
  /\b(today|tomorrow|yesterday|date)\b.*\b(tithi|nakshatra|rahu|yoga|karana|paksha|festival|panchang)\b/i,
  /\b(horoscope|rashifal|rashiphal|rashiphalalu|zodiac|rashi|rasi|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /\b(trump|biden|modi|putin|zelensky|pm|prime\s*minister|president|politics|election|parliament|government)\b/i,
  /\b(world\s*war|ww1|ww2|history of|roman empire|cold war)\b/i,
  /\b(stock|bitcoin|crypto|price|market|sensex|nifty)\b/i,
  /\b(football|cricket|nba|nfl|ipl|score|match result)\b/i,
  /\b(who is|tell me about|latest news|news about)\b/i,
  /\b(birthday|bday|my bdy|my birthday|age|wife|husband|boyfriend|girlfriend|i love you|relationship)\b/i,
];

function getOutOfScopeResponse() {
  return "I specialize in Panchang and Hindu calendar guidance, including tithi, nakshatra, muhurta, Rahu Kalam, and festivals. I do not have verified data for unrelated general, political, or historical topics.";
}

function hasDomainSignal(message) {
  return PANCHANG_DOMAIN_PATTERNS.some((pattern) => pattern.test(message));
}

function hasOutOfScopeSignal(message) {
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(message));
}

function isStandaloneGreeting(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const words = normalized.split(" ");
  const greetingWords = new Set([
    "hi", "hello", "hey", "namaste", "namaskar", "greetings",
    "good", "morning", "afternoon", "evening", "day",
  ]);

  return words.every((w) => greetingWords.has(w));
}

/** Get today's date string in DD/MM/YYYY (matches panchang record format) */
function getTodayKey() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const handleChatbot = async (req, res) => {
  try {
    const {
      message,
      selectedDay,
      todayDay,
      language = "en",
      friendMode = false,
    } = req.body;

    if (!message || !String(message).trim()) {
      return res.json({ response: "Please ask a question." });
    }

    const msg = String(message).trim();
    const todayKey = getTodayKey();

    let resolvedTodayDay = todayDay || null;
    if (!resolvedTodayDay && selectedDay?.date === todayKey) {
      resolvedTodayDay = selectedDay;
    }

    const intent = detectIntent(msg);
    const domainSignal = hasDomainSignal(msg);
    const horoscopeSignal = isHoroscopeQuery(msg);
    const outOfScopeSignal = hasOutOfScopeSignal(msg);
    const standaloneGreeting = isStandaloneGreeting(msg);
    const horoscopeContext = horoscopeSignal
      ? buildHoroscopeContext({ message: msg, language })
      : "";

    if (horoscopeSignal) {
      const horoscopeResponse = answerHoroscopeQuery({ message: msg, language });
      if (horoscopeResponse) {
        return res.json({ response: horoscopeResponse });
      }
    }

    if (!domainSignal && !horoscopeSignal && !standaloneGreeting && (outOfScopeSignal || intent === "unknown" || intent === "greeting")) {
      return res.json({ response: getOutOfScopeResponse(language) });
    }

    if (intent === "unknown") {
      const geminiResponse = await askGemini({
        message: msg,
        selectedDay: selectedDay || null,
        todayDay: resolvedTodayDay,
        language,
        friendMode,
        horoscopeContext,
      });
      return res.json({ response: geminiResponse });
    }

    const engineSelectedDay = resolvedTodayDay || selectedDay;

    const engineResult = await processMessage({
      message: msg,
      selectedDay: engineSelectedDay,
      language,
      friendMode,
    });

    return res.json({ response: engineResult.response });
  } catch (error) {
    console.error("Chatbot error:", error.message || error);
    try {
      const { message, selectedDay, todayDay, language = "en", friendMode = false } = req.body;
      const fallback = await askGemini({
        message: String(message).trim(),
        selectedDay,
        todayDay,
        language,
        friendMode,
        horoscopeContext: buildHoroscopeContext({ message: String(message).trim(), language }),
      });
      return res.json({ response: fallback });
    } catch {
      return res.status(500).json({
        response: "I'm having trouble right now. Please try again in a moment.",
      });
    }
  }
};

router.post("/chatbot", handleChatbot);
router.post("/", handleChatbot);

export default router;

