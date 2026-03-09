import {
  RASHIS,
  RASHI_NAMES,
  RASHIPHALALU_DATA,
  getCurrentRashi,
  getRashiText,
} from "../../frontend/src/data/rashiphalalu.js";

const PERIOD_KEYWORDS = {
  daily: ["daily", "today", "todays", "day"],
  weekly: ["weekly", "week", "this week"],
  monthly: ["monthly", "month", "this month"],
  yearly: ["yearly", "year", "annual", "2026"],
};

const RASHI_ALIASES = {
  mesha: "mesha",
  aries: "mesha",
  vrishabha: "vrishabha",
  vrushabha: "vrishabha",
  taurus: "vrishabha",
  mithuna: "mithuna",
  gemini: "mithuna",
  karka: "karka",
  karkataka: "karka",
  cancer: "karka",
  simha: "simha",
  leo: "simha",
  kanya: "kanya",
  virgo: "kanya",
  tula: "tula",
  libra: "tula",
  vrishchika: "vrishchika",
  vruschika: "vrishchika",
  scorpio: "vrishchika",
  dhanu: "dhanu",
  sagittarius: "dhanu",
  makara: "makara",
  capricorn: "makara",
  kumbha: "kumbha",
  aquarius: "kumbha",
  meena: "meena",
  meenam: "meena",
  pisces: "meena",
};

const HOROSCOPE_TERMS = [
  "horoscope",
  "horoscopes",
  "rashifal",
  "rashiphal",
  "rashiphalalu",
  "rashi",
  "rasi",
  "zodiac",
  "moon sign",
  "sun sign",
  ...Object.keys(RASHI_ALIASES),
  "lucky color",
  "lucky colors",
  "lucky colour",
  "lucky colours",
  "auspicious color",
  "auspicious colors",
  "colour",
  "color",
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectPeriod(message) {
  const text = normalize(message);
  for (const [period, keywords] of Object.entries(PERIOD_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) {
      return period;
    }
  }
  return "daily";
}

function detectRashiId(message) {
  const text = normalize(message);
  const words = text.split(" ").filter(Boolean);
  for (const word of words) {
    if (RASHI_ALIASES[word]) return RASHI_ALIASES[word];
  }
  for (const rashi of RASHIS) {
    if (text.includes(String(rashi.id || "").toLowerCase())) return rashi.id;
  }
  return null;
}

function isLuckyColorQuery(message) {
  const text = normalize(message);
  return /\b(lucky|auspicious)\s*(color|colors|colour|colours)\b/i.test(text)
    || /\b(color|colors|colour|colours)\b/i.test(text);
}

function periodLabel(period, language) {
  const labels = {
    en: { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" },
    te: { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" },
    hi: { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" },
    ml: { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" },
    kn: { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" },
    ta: { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" },
  };
  return labels[language]?.[period] || labels.en[period] || "Daily";
}

function rashiName(rashiId, language) {
  const names = RASHI_NAMES?.[rashiId];
  if (!names) return rashiId;
  return names[language] || names.en || rashiId;
}

function getRashiColors(rashiId, period = "daily", language = "en") {
  const periodData = RASHIPHALALU_DATA?.[rashiId]?.[period];
  if (!periodData?.colors) return [];
  const localized = periodData.colors[language] || periodData.colors.en || [];
  return Array.isArray(localized) ? localized.filter(Boolean) : [];
}

export function isHoroscopeQuery(message) {
  const text = normalize(message);
  return HOROSCOPE_TERMS.some((term) => text.includes(term));
}

export function answerHoroscopeQuery({ message, language = "en" }) {
  if (!isHoroscopeQuery(message)) return null;

  const period = detectPeriod(message);
  const now = new Date();
  const rashiId = detectRashiId(message) || getCurrentRashi(now);
  const wantsLuckyColors = isLuckyColorQuery(message);

  if (!rashiId || !RASHIPresent(rashiId)) return null;

  if (wantsLuckyColors) {
    const colors = getRashiColors(rashiId, period, language);
    if (colors.length) {
      return `🌈 Lucky colors for ${rashiName(rashiId, language)}: ${colors.join(", ")}`;
    }
  }

  const text = getRashiText(rashiId, period, now, language);
  if (!text || /no data available/i.test(String(text))) return null;

  const heading = `${periodLabel(period, language)} Horoscope - ${rashiName(rashiId, language)}`;
  return `\uD83C\uDF1F ${heading}\n\n${String(text).trim()}`;
}

function RASHIPresent(rashiId) {
  return Boolean(RASHI_NAMES?.[rashiId]);
}

export function buildHoroscopeContext({ message, language = "en" }) {
  if (!isHoroscopeQuery(message)) return "";
  const now = new Date();
  const period = detectPeriod(message);
  const rashiId = detectRashiId(message) || getCurrentRashi(now);
  const sample = rashiId ? getRashiText(rashiId, period, now, language) : "";

  return [
    "Local Horoscope Data Context:",
    `- Supported periods: daily, weekly, monthly, yearly (2026 text available).`,
    `- Supported rashis: ${Object.keys(RASHI_NAMES || {}).join(", ")}.`,
    rashiId ? `- User rashi inferred: ${rashiId}.` : "- User rashi not explicitly mentioned.",
    sample ? `- ${period} text sample for inferred rashi: ${String(sample).trim()}` : "",
    "- Prefer these local horoscope statements when user asks horoscope/rashi questions.",
  ]
    .filter(Boolean)
    .join("\n");
}
