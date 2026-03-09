const LANGUAGE_KEY = "panchang:selected-language";
const LOCATION_KEY = "panchang:selected-location";
const AYANAMSA_KEY = "panchang:selected-ayanamsa";
export const LANGUAGE_CHANGE_EVENT = "panchang:language-changed";

const DEFAULTS = {
  language: "en",
  ayanamsa: "1",
  location: {
    name: "Ujjain, India",
    lat: "23.1765",
    lng: "75.7885",
    tzOffset: "+05:30",
  },
};

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadLanguage() {
  if (typeof window === "undefined") return DEFAULTS.language;
  const raw = localStorage.getItem(LANGUAGE_KEY);
  return (raw && String(raw).trim()) || DEFAULTS.language;
}

export function saveLanguage(language) {
  if (typeof window === "undefined") return;
  const nextLanguage = String(language || DEFAULTS.language);
  localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  window.dispatchEvent(
    new CustomEvent(LANGUAGE_CHANGE_EVENT, {
      detail: { language: nextLanguage },
    })
  );
}

export function loadAyanamsa() {
  if (typeof window === "undefined") return DEFAULTS.ayanamsa;
  const raw = localStorage.getItem(AYANAMSA_KEY);
  return (raw && String(raw).trim()) || DEFAULTS.ayanamsa;
}

export function saveAyanamsa(ayanamsa) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AYANAMSA_KEY, String(ayanamsa || DEFAULTS.ayanamsa));
}

export function loadLocation() {
  if (typeof window === "undefined") return DEFAULTS.location;
  const raw = localStorage.getItem(LOCATION_KEY);
  const parsed = raw ? safeParseJson(raw) : null;
  const loc = parsed && typeof parsed === "object" ? parsed : null;
  return {
    name: (loc?.name && String(loc.name)) || DEFAULTS.location.name,
    lat: (loc?.lat && String(loc.lat)) || DEFAULTS.location.lat,
    lng: (loc?.lng && String(loc.lng)) || DEFAULTS.location.lng,
    tzOffset: (loc?.tzOffset && String(loc.tzOffset)) || DEFAULTS.location.tzOffset,
  };
}

export function saveLocation(next) {
  if (typeof window === "undefined") return;
  const current = loadLocation();
  const value = {
    name: (next?.name && String(next.name)) || current.name,
    lat: (next?.lat && String(next.lat)) || current.lat,
    lng: (next?.lng && String(next.lng)) || current.lng,
    tzOffset: (next?.tzOffset && String(next.tzOffset)) || current.tzOffset,
  };
  localStorage.setItem(LOCATION_KEY, JSON.stringify(value));
}

export function getAstroDefaults() {
  const language = loadLanguage();
  const location = loadLocation();
  const ayanamsa = loadAyanamsa();
  return {
    la: language,
    lat: location.lat,
    lng: location.lng,
    tzOffset: location.tzOffset,
    ayanamsa,
    locationName: location.name,
  };
}
