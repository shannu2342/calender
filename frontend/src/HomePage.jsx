import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildIsoDatetime, findActiveByTime, safeDateFromIso, ymdToday } from "./astrology/components/formatters";
import Rashiphalalu from "./components/Rashiphalalu";
import { getProkeralaPanchang } from "./services/astrologyApi";
import { languages, translateText, translations } from "./translations";
import { getAstroDefaults, LANGUAGE_CHANGE_EVENT, loadLanguage, saveLanguage } from "./utils/appSettings";

const VOICE_KEY = "panchang:voice-enabled";
const VIEW_STATE_KEY = "panchang:current-view";
const ALARM_STORAGE_KEY = "panchangAlarmSettings";
const REMINDER_TIME_OPTIONS = [15, 30, 60, 90, 120];

const defaultAlarmSettings = {
  enabledMuhurtas: {
    rahu: true,
    yamaganda: true,
    gulika: true,
    durmuhurtham: true,
    varjyam: true,
  },
  audioEnabled: true,
  reminderTime: 60,
  silentMode: false,
  disabledDays: [],
};


function getTiles(t) {
  return [
    { to: "/month-view", title: t.tileMonthView || "Month View", subtitle: t.tileMonthViewSub || "Phase and Tithi for month", icon: "▦" },
    { to: "/panchang", title: t.tilePanchang || "Panchang", subtitle: t.tilePanchangSub || "Day View, Sun and Moon rise/set times", icon: "⌖" },
    { to: "/festivals", title: t.tileFestivals || "Festivals", subtitle: t.tileFestivalsSub || "Festival and event dates", icon: "✹" },
    { to: "/my-tithi", title: t.tileMyTithi || "My Tithi", subtitle: t.tileMyTithiSub || "Add and track your own tithis", icon: "◉" },
    { to: "/kundali", title: t.tileKundali || "Kundali", subtitle: t.tileKundaliSub || "Time view, Planet Ephemeris, Lagna", icon: "✳" },
    { to: "/matchmaking", title: t.tileMatchMaking || "Match Making", subtitle: t.tileMatchMakingSub || "Guna Milan with Ashta Koota", icon: "◔" },
    { to: "/muhurat", title: t.tileMuhurt || "Muhurt", subtitle: t.tileMuhurtSub || "Muhurta, Choghadiya and Hora", icon: "◷" },
    { to: "/hindu-time", title: t.tileHinduTime || "Hindu Time", subtitle: t.tileHinduTimeSub || "Watch Ishtkaal i.e Ghati or Nazhika", icon: "◴" },
    { to: "/about", title: t.about || "About", subtitle: "Terms, Disclaimers and App Info", icon: "i" },
    { to: "/settings", title: t.tileSettings || "Settings", subtitle: t.tileSettingsSub || "Change location and preferences", icon: "⚙" }
  ];
}


function getMenuLinks(t) {
  return [
    ["/month-view", t.tileMonthView || "Month View"],
    ["/panchang", t.tilePanchang || "Panchang"],
    ["/festivals", t.tileFestivals || "Festivals"],
    ["/my-tithi", t.tileMyTithi || "My Tithi"],
    ["/kundali", t.tileKundali || "Kundali"],
    ["/matchmaking", t.tileMatchMaking || "Match Making"],
    ["/muhurat", t.tileMuhurt || "Muhurt"],
    ["/hindu-time", t.tileHinduTime || "Hindu Time"],
    ["/compass", t.tileCompass || "Compass"],
    ["/sankalp-mantra", t.tileSankalp || "Sankalp Mantra"],
  ];
}


function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return (
      String(
        value?.name ??
        value?.vedic_name ??
        value?.title ??
        value?.value ??
        value?.label ??
        value?.display_name ??
        ""
      ).trim()
    );
  }
  return "";
}


function firstText(...values) {
  for (const v of values) {
    const t = textOf(v);
    if (t) return t;
  }
  return "";
}


function cleanDash(value) {
  if (!value) return "";
  const str = String(value).trim();
  return str.replace(/^\s*-\s*|\s*-\s*$/g, "").trim();
}


function joinClean(parts, sep = ", ") {
  return parts.map(v => cleanDash(textOf(v))).filter(Boolean).join(sep);
}


function pad2(n) {
  return String(n).padStart(2, "0");
}


function toHHMM(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (s.includes("T") && s.length >= 16) return s.slice(11, 16);
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
}

function getTimeRangeText(item) {
  if (!item || typeof item !== "object") return "";
  const start = toHHMM(item?.start);
  const end = toHHMM(item?.end);
  if (start && end) return `${start} - ${end}`;
  return end || start || "";
}


function computeGhati(now, sunriseIso) {
  const sunrise = safeDateFromIso(sunriseIso);
  if (!sunrise) return null;
  const deltaSec = Math.max(0, Math.floor((now.getTime() - sunrise.getTime()) / 1000));
  return {
    ghati: Math.floor(deltaSec / 1440),
    pal: Math.floor((deltaSec % 1440) / 24),
  };
}


function shareApp() {
  const url = window.location.origin;
  const text = "Hindu Calendar";
  if (navigator.share) return navigator.share({ title: text, text, url });
  return navigator.clipboard?.writeText(url);
}

function loadInitialLanguage() {
  if (typeof window === "undefined") return "en";
  const saved = loadLanguage();
  return languages.some((l) => l.code === saved) ? saved : "en";
}

function loadInitialVoiceEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VOICE_KEY) === "1";
}


function Tile({ to, icon, title, subtitle }) {
  return (
    <Link
      to={to}
      className="rounded-2xl p-3 text-center transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(255,178,51,0.5)]"
      style={{
        background: "var(--calendar-orange-gradient)",
        border: "1.5px solid rgba(255, 200, 87, 0.6)",
        boxShadow: "0 4px 15px rgba(255, 107, 53, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(139, 69, 19, 0.2)",
      }}
    >
      <div
        className="mx-auto mb-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-lg"
        style={{
          background: "linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 50%, #f39c12 100%)",
          color: "#8B4513",
          boxShadow: "0 2px 8px rgba(253, 203, 110, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.5)",
        }}
      >
        {icon}
      </div>
      <div
        className="text-[13px] font-bold leading-tight"
        style={{
          color: "#FFF9F0",
          textShadow: "0 1px 3px rgba(139, 69, 19, 0.4)",
        }}
      >
        {title}
      </div>
      <div
        className="mt-1 text-[10px] leading-3"
        style={{
          color: "#FFE8C5",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
        }}
      >
        {subtitle}
      </div>
    </Link>
  );
}


export default function HomePage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [languagePopupOpen, setLanguagePopupOpen] = useState(false);
  const [language, setLanguage] = useState(loadInitialLanguage);
  const languageRef = useRef(language);
  const [voiceEnabled, setVoiceEnabled] = useState(loadInitialVoiceEnabled);
  const [now, setNow] = useState(() => new Date());
  const [panchang, setPanchang] = useState(null);
  const [error, setError] = useState("");
  const [alarmSettings, setAlarmSettings] = useState(defaultAlarmSettings);
  const [isAlarmPopupOpen, setIsAlarmPopupOpen] = useState(false);
  const [isHoroscopeOpen, setIsHoroscopeOpen] = useState(false);
  const [isPanchangOpen, setIsPanchangOpen] = useState(false);
  const [selectedRashi, setSelectedRashi] = useState(null);
  const [settingsNonce, setSettingsNonce] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState("");
  const abortRef = useRef(null);
  const titleByLanguage = translations[language]?.appTitle || "Talking Calendar";


  const defaults = useMemo(() => {
    void settingsNonce;
    return getAstroDefaults();
  }, [settingsNonce]);


  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    languageRef.current = language;
    if (loadLanguage() !== language) saveLanguage(language);
    // Do NOT clear panchang here — local translation lookup handles it instantly
  }, [language]);

  useEffect(() => {
    localStorage.setItem(VOICE_KEY, voiceEnabled ? "1" : "0");
  }, [voiceEnabled]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALARM_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setAlarmSettings((prev) => ({
        ...prev,
        ...parsed,
        enabledMuhurtas: {
          ...prev.enabledMuhurtas,
          ...(parsed.enabledMuhurtas || {}),
        },
        disabledDays: Array.isArray(parsed.disabledDays)
          ? parsed.disabledDays
          : prev.disabledDays,
      }));
    } catch {
      // ignore invalid localStorage
    }
  }, []);

  useEffect(() => {
    if (!languagePopupOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLanguagePopupOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [languagePopupOpen]);


  useEffect(() => {
    const refresh = () => setSettingsNonce((n) => n + 1);
    const syncLanguage = () => {
      const next = loadInitialLanguage();
      setLanguage((prev) => (prev === next ? prev : next));
      refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", syncLanguage);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    };
  }, []);


  // ── Fetch triggered by language change (fires immediately, no debounce) ──
  useEffect(() => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");

    const run = async () => {
      const currentLang = languageRef.current;
      try {
        const payload = await getProkeralaPanchang(
          {
            date: ymdToday(),
            time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
            lat: defaults.lat,
            lng: defaults.lng,
            tzOffset: defaults.tzOffset,
            ayanamsa: defaults.ayanamsa,
            la: currentLang,
          },
          { signal: controller.signal }
        );
        // Only update if this response is still for the current language
        if (languageRef.current === currentLang) {
          setPanchang(payload?.data || payload || null);
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        setPanchang(null);
        setError(e?.message || "Failed to load Panchang");
      }
    };

    // No debounce for language changes — switch instantly
    run();
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Fetch triggered by minute tick or settings change (320ms debounce) ──
  useEffect(() => {
    const controller = new AbortController();
    setError("");

    const run = async () => {
      const currentLang = languageRef.current;
      try {
        const payload = await getProkeralaPanchang(
          {
            date: ymdToday(),
            time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
            lat: defaults.lat,
            lng: defaults.lng,
            tzOffset: defaults.tzOffset,
            ayanamsa: defaults.ayanamsa,
            la: currentLang,
          },
          { signal: controller.signal }
        );
        if (languageRef.current === currentLang) {
          setPanchang(payload?.data || payload || null);
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        setPanchang(null);
        setError(e?.message || "Failed to load Panchang");
      }
    };

    const t = setTimeout(run, 320);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.getMinutes(), settingsNonce]);


  // Local translation helper — looks up a term in translations.js, fallback to raw value
  const t = translations[language] || translations.en;
  const translateTerm = (raw) => {
    if (!raw) return raw;
    const s = String(raw).trim();
    // Try exact match first, then first-word match (e.g. "Panchami Dwitiya" → "పంచమి")
    return t[s] || t[s.split(" ")[0]] || translateText(s, t) || s;
  };

  const summary = useMemo(() => {
    if (!panchang) return null;
    const refDate = safeDateFromIso(
      buildIsoDatetime({
        date: ymdToday(),
        time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
        tzOffset: defaults.tzOffset,
      })
    );


    const activeTithi = findActiveByTime(panchang?.tithi, refDate);
    const activeNakshatra = findActiveByTime(panchang?.nakshatra, refDate);
    const activeYoga = findActiveByTime(panchang?.yoga, refDate);
    const activeChoghadiya = findActiveByTime(panchang?.choghadiya, refDate);
    const activeKarana = findActiveByTime(panchang?.karana, refDate);
    const ghati = computeGhati(now, panchang?.sunrise);


    const pakshaRaw = firstText(activeTithi?.paksha, panchang?.paksha, panchang?.advanced?.paksha);
    const weekdayRaw = firstText(
      panchang?.vaara,
      panchang?.weekday,
      panchang?.day,
      panchang?.advanced?.vaara,
      panchang?.advanced?.weekday
    );
    const lunarMonthRaw = firstText(
      panchang?.lunar_month?.name,
      panchang?.lunar_month,
      panchang?.masa,
      panchang?.advanced?.lunar_month?.name,
      panchang?.advanced?.lunar_month,
      panchang?.advanced?.masa
    );
    const samvatsaraRaw = firstText(
      panchang?.samvatsara?.name,
      panchang?.samvatsara,
      panchang?.advanced?.samvatsara?.name,
      panchang?.advanced?.samvatsara
    );
    const purnimanthaMonthRaw = firstText(
      panchang?.purnimantha_month?.name,
      panchang?.purnimanta_month?.name,
      panchang?.lunar_month?.purnimanta_name,
      panchang?.advanced?.purnimantha_month?.name,
      panchang?.advanced?.purnimanta_month?.name,
      panchang?.advanced?.lunar_month?.purnimanta_name
    );
    const ayanaRaw = firstText(
      panchang?.ayana?.name,
      panchang?.ayana,
      panchang?.advanced?.ayana?.name,
      panchang?.advanced?.ayana
    );
    const rituRaw = firstText(
      panchang?.ritu?.name,
      panchang?.ritu,
      panchang?.advanced?.ritu?.name,
      panchang?.advanced?.ritu,
      panchang?.season
    );


    const choghadiyaRaw = cleanDash(activeChoghadiya?.name);
    const choghadiyaTimeStr = joinClean([toHHMM(activeChoghadiya?.start), toHHMM(activeChoghadiya?.end)], " - ");
    const choghadiyaText = joinClean([t[choghadiyaRaw] || choghadiyaRaw, choghadiyaTimeStr], " ");


    return {
      headlineTime: ghati ? `${pad2(ghati.ghati)}:${pad2(ghati.pal)}` : "",
      tithi: translateTerm(firstText(activeTithi?.name)),
      tithiFull: activeTithi,
      paksha: translateTerm(pakshaRaw),
      karana: translateTerm(firstText(activeKarana?.name)),
      karanaFull: activeKarana,
      yoga: translateTerm(firstText(activeYoga?.name)),
      yogaFull: activeYoga,
      lunarMonth: translateTerm(lunarMonthRaw),
      nakshatra: translateTerm(firstText(activeNakshatra?.name)),
      nakshatraFull: activeNakshatra,
      weekday: translateTerm(weekdayRaw),
      choghadiya: choghadiyaText,
      panchaka: translateTerm(firstText(panchang?.panchaka?.name, panchang?.panchaka)),
      samvatsara: translateTerm(samvatsaraRaw?.replace(/^\d+\s*/, "")),
      purnimanthaMonth: translateTerm(purnimanthaMonthRaw),
      ayana: translateTerm(ayanaRaw),
      ritu: translateTerm(rituRaw),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panchang, now, defaults.tzOffset, language]);


  const formattedTime = useMemo(
    () => now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [now]
  );
  const formattedDate = useMemo(
    () => now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }),
    [now]
  );

  const openDailyHoroscope = () => {
    setIsHoroscopeOpen((prev) => !prev);
  };

  const openChantingAlarm = () => {
    setIsAlarmPopupOpen((prev) => !prev);
  };

  const togglePanchangMenu = () => {
    setIsPanchangOpen((prev) => !prev);
  };

  const saveAlarmSettings = () => {
    try {
      localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(alarmSettings));
      setNotificationStatus("Settings saved!");
      setTimeout(() => setNotificationStatus(""), 3000);
    } catch {
      setNotificationStatus("Failed to save settings.");
    }
  };

  const resetAlarmSettings = () => {
    setAlarmSettings(defaultAlarmSettings);
    try {
      localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(defaultAlarmSettings));
      setNotificationStatus("Reset to defaults.");
      setTimeout(() => setNotificationStatus(""), 3000);
    } catch {
      setNotificationStatus("Failed to reset settings.");
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      setNotificationStatus("Notifications are not supported in this browser.");
      return;
    }
    if (Notification.permission === "granted") {
      setNotificationStatus("Notifications already enabled! ✓");
      setTimeout(() => setNotificationStatus(""), 3000);
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        setNotificationStatus("Notifications enabled! ✓");
        // Show a test notification
        new Notification("Hindu Calendar", {
          body: "Notifications are now enabled for auspicious time reminders.",
          icon: "/favicon.ico",
        });
      } else if (result === "denied") {
        setNotificationStatus(
          "Notifications blocked. Please allow them in your browser settings."
        );
      } else {
        setNotificationStatus("Notification permission was dismissed.");
      }
      setTimeout(() => setNotificationStatus(""), 5000);
    } catch {
      setNotificationStatus("Could not request notification permission.");
    }
  };
  return (
    <div
      className="min-h-screen overflow-x-hidden pt-4 sm:pt-6"
      style={{
        fontFamily: "'Segoe UI', 'Inter', 'Trebuchet MS', sans-serif",
        background: "radial-gradient(ellipse at top, #2a1810 0%, #1a0d08 40%, #0d0504 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 pb-36 md:max-w-6xl md:px-6 md:pb-40">
        <header
          className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-1 py-1 transition-all duration-300"
        >
          <div className="flex items-center gap-1.5">
            <div
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-base font-black flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #1a0a05 0%, #2d1208 50%, #401a0c 100%)",
                border: "2px solid rgba(255, 140, 50, 0.8)",
                color: "#FFD54F",
              }}
              title="Swastik"
            >{"\u5350"}</div>
          </div>
          <div className="min-w-0 px-0.5">
            <div
              className="whitespace-nowrap font-black leading-tight tracking-tight"
              style={{
                color: "#FFFFFF",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.85), 0 6px 18px rgba(255, 140, 50, 0.45)",
                lineHeight: "1",
                letterSpacing: "0.02em",
                fontSize: "clamp(0.82rem, 4.2vw, 1.35rem)",
                fontWeight: "900",
              }}
            >
              {titleByLanguage}
            </div>
          </div>
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black transition-all duration-200 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                color: "#FFE4B5",
                border: "2px solid rgba(255, 140, 50, 0.7)",
                boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
              }}
              aria-label={voiceEnabled ? "Mute enabled" : "Mute disabled"}
              title={voiceEnabled ? "Mute enabled" : "Mute disabled"}
            >
              {voiceEnabled ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73z" />
                  <path d="M15 11.01V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setLanguagePopupOpen(true)}
              className="inline-flex h-7 min-w-[54px] items-center justify-center gap-1 rounded-lg px-1.5 text-[10px] font-black outline-none transition-all duration-200 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                color: "#FFF4D8",
                border: "2px solid rgba(255, 140, 50, 0.7)",
                boxShadow: "0 0 12px rgba(255, 140, 50, 0.45), inset 0 0 8px rgba(255, 200, 100, 0.25)",
              }}
              aria-label="Open language selector"
            >
              <span>{String(language || "").toUpperCase()}</span>
              <span aria-hidden="true" className="text-[10px]">▼</span>
            </button>
            <Link
              to="/settings"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-all duration-200 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(255, 224, 130, 0.3) 0%, rgba(255, 183, 77, 0.25) 100%)",
                color: "#FFF5E1",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 224, 130, 0.3)",
              }}
              aria-label="Settings">{"\u2699"}</Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="h-7 w-7 rounded-lg text-sm transition-all duration-200 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(255, 224, 130, 0.3) 0%, rgba(255, 183, 77, 0.25) 100%)",
                color: "#FFF5E1",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 224, 130, 0.3)",
              }}
              aria-label="Open menu"
            >{"\u2630"}</button>
          </div>
        </header>


        <div
          className="rounded-xl p-2 backdrop-blur-md"
          style={{
            background: "var(--calendar-orange-shell)",
            border: "3px solid rgba(255, 140, 50, 0.8)",
            boxShadow: "0 0 35px rgba(255, 140, 50, 0.8), 0 0 70px rgba(255, 100, 30, 0.6), inset 0 0 30px rgba(255, 140, 50, 0.2)",
          }}
        >
          <section
            className="rounded-2xl px-4 py-5 text-center transition-all duration-300"
            style={{
              background: "var(--calendar-orange-gradient)",
              border: "2px solid rgba(255, 193, 7, 0.5)",
              boxShadow: "0 8px 32px rgba(255, 152, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -3px 0 rgba(139, 69, 19, 0.25), 0 0 40px rgba(255, 183, 77, 0.2)",
            }}
          >
            {/* Date and Day Row */}
            <div className="mb-4 flex flex-wrap items-start gap-2 sm:gap-3">
              {/* Day Number Circle */}
              <div
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "3px solid rgba(255, 200, 110, 0.95)",
                  boxShadow: "0 0 20px rgba(255, 140, 50, 0.6), 0 0 40px rgba(255, 100, 30, 0.4), inset 0 0 15px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span className="text-2xl sm:text-3xl font-bold" style={{ color: "#D4AF37", textShadow: "0 2px 6px rgba(0, 0, 0, 0.6)" }}>
                  {now.getDate()}
                </span>
              </div>

              {/* Weekday and Date/Time */}
              <div className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg sm:text-xl font-bold" style={{ color: "#FFF5E6", textShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>
                    {summary?.weekday ? cleanDash(summary.weekday) : "-"}
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-medium" style={{ color: "#FFE8C5" }}>
                  <span>{formattedDate}, </span><span className="whitespace-nowrap">{formattedTime}</span>
                </div>
              </div>
              {summary?.headlineTime && (
                <div
                  className="ml-auto inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                  style={{
                    background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                    border: "1.5px solid rgba(255, 140, 50, 0.65)",
                    boxShadow: "0 0 10px rgba(255, 140, 50, 0.35), inset 0 0 8px rgba(255, 200, 100, 0.15)",
                  }}
                >
                  <span style={{ color: "#FFD700" }}>Hindu Time:</span>
                  <span className="ml-1" style={{ color: "#FFF5E6" }}>{summary.headlineTime}</span>
                </div>
              )}
            </div>

            {/* Primary row: Thithi -> Nakshatra -> Yoga (always side by side) */}
            {summary?.tithi && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u25CF"} {cleanDash(summary.tithi)}</span>
                {getTimeRangeText(summary.tithiFull) && (
                  <span className="text-amber-100/80">{getTimeRangeText(summary.tithiFull)}</span>
                )}
              </div>
            )}

            {summary?.nakshatra && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u2726"} {cleanDash(summary.nakshatra)}</span>
                {getTimeRangeText(summary.nakshatraFull) && (
                  <span className="text-amber-100/80">{getTimeRangeText(summary.nakshatraFull)}</span>
                )}
              </div>
            )}

            {summary?.yoga && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u263C"} {cleanDash(summary.yoga)}</span>
                {getTimeRangeText(summary.yogaFull) && (
                  <span className="text-amber-100/80">{getTimeRangeText(summary.yogaFull)}</span>
                )}
              </div>
            )}

            {/* Secondary row: Paksha + Karana + Choghadiya (same row) */}
            {summary?.paksha && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u25D0"} {cleanDash(summary.paksha)}</span>
                {getTimeRangeText(summary.tithiFull) && (
                  <span className="text-amber-100/80">{getTimeRangeText(summary.tithiFull)}</span>
                )}
              </div>
            )}

            {summary?.karana && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u25D1"} {cleanDash(summary.karana)}</span>
                {getTimeRangeText(summary.karanaFull) && (
                  <span className="text-amber-100/80">{getTimeRangeText(summary.karanaFull)}</span>
                )}
              </div>
            )}

            {summary?.choghadiya && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u29D7"} {cleanDash(summary.choghadiya)}</span>
              </div>
            )}

            {summary?.samvatsara && (
              <div
                className="mb-1 flex min-w-0 items-center justify-between gap-1 rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: "0 0 15px rgba(255, 140, 50, 0.5), inset 0 0 10px rgba(255, 200, 100, 0.2)",
                }}
              >
                <span>{"\u2605"} {cleanDash(summary.samvatsara)}</span>
              </div>
            )}

            {error ? (
              <div
                className="mt-2 text-xs"
                style={{
                  color: "#FFCDD2",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                }}
              >
                {error}
              </div>
            ) : null}
          </section>
        </div>

        <div
          className="mt-1 rounded-xl p-2 backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(74, 33, 16, 0.98) 0%, rgba(92, 42, 21, 0.95) 50%, rgba(112, 54, 27, 0.92) 100%)",
            border: "3px solid rgba(255, 140, 50, 0.7)",
            boxShadow: "0 0 25px rgba(120, 58, 26, 0.55), inset 0 0 18px rgba(170, 94, 43, 0.2)",
          }}
        >
          <button
            type="button"
            onClick={openDailyHoroscope}
            className="relative w-full rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide transition-all hover:scale-[1.01]"
            style={{
              background: "var(--calendar-orange-gradient)",
              border: "2.5px solid rgba(212, 168, 71, 0.8)",
              color: "#ffedb3",
              boxShadow:
                "0 0 18px rgba(212, 168, 71, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 -1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <span className="block text-center">{t.dailyHoroscope || "Daily Horoscope"}</span>
            <span
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs transition-transform duration-200"
              style={{
                color: "#ffedb3",
                transform: isHoroscopeOpen ? "rotate(180deg)" : "rotate(0deg)",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              ▼
            </span>
          </button>
        </div>

        {isHoroscopeOpen && (
          <div className="mt-1 rounded-xl p-0 backdrop-blur-md overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(74, 33, 16, 0.98) 0%, rgba(92, 42, 21, 0.95) 50%, rgba(112, 54, 27, 0.92) 100%)",
              border: "3px solid rgba(255, 140, 50, 0.7)",
              boxShadow: "0 0 25px rgba(120, 58, 26, 0.55), inset 0 0 18px rgba(170, 94, 43, 0.2)",
            }}
          >
            <div className="w-full">
              <Rashiphalalu
                language={language}
                translations={t}
                selectedRashi={selectedRashi}
                setSelectedRashi={setSelectedRashi}
                isInline={true}
              />
            </div>
          </div>
        )}

        <div
          className="mt-1 rounded-xl p-2 backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(74, 33, 16, 0.98) 0%, rgba(92, 42, 21, 0.95) 50%, rgba(112, 54, 27, 0.92) 100%)",
            border: "3px solid rgba(255, 140, 50, 0.7)",
            boxShadow: "0 0 25px rgba(120, 58, 26, 0.55), inset 0 0 18px rgba(170, 94, 43, 0.2)",
          }}
        >
          <button
            type="button"
            onClick={openChantingAlarm}
            className="relative w-full rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide transition-all hover:scale-[1.01]"
            style={{
              background: "var(--calendar-orange-gradient)",
              border: "2.5px solid rgba(212, 168, 71, 0.8)",
              color: "#ffedb3",
              boxShadow:
                "0 0 18px rgba(212, 168, 71, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 -1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <span className="block text-center">{t.chantingAlarm || "Chanting Tunes"}</span>
            <span
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs transition-transform duration-200"
              style={{
                color: "#ffedb3",
                transform: isAlarmPopupOpen ? "rotate(180deg)" : "rotate(0deg)",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              ▼
            </span>
          </button>
        </div>

        {isAlarmPopupOpen ? (
          <div className="mt-1 rounded-xl p-2 backdrop-blur-md"
            style={{
              background: "linear-gradient(135deg, rgba(74, 33, 16, 0.98) 0%, rgba(92, 42, 21, 0.95) 50%, rgba(112, 54, 27, 0.92) 100%)",
              border: "3px solid rgba(255, 140, 50, 0.7)",
              boxShadow: "0 0 25px rgba(120, 58, 26, 0.55), inset 0 0 18px rgba(170, 94, 43, 0.2)",
            }}
          >
            <HomeAlarmPanel
              language={language}
              translations={translations}
              alarmSettings={alarmSettings}
              setAlarmSettings={setAlarmSettings}
              onSave={saveAlarmSettings}
              onReset={resetAlarmSettings}
              onRequestNotification={requestNotificationPermission}
              notificationStatus={notificationStatus}
            />
          </div>
        ) : null}


        <div
          className="mt-1 rounded-xl p-2 backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(74, 33, 16, 0.98) 0%, rgba(92, 42, 21, 0.95) 50%, rgba(112, 54, 27, 0.92) 100%)",
            border: "3px solid rgba(255, 140, 50, 0.7)",
            boxShadow: "0 0 25px rgba(120, 58, 26, 0.55), inset 0 0 18px rgba(170, 94, 43, 0.2)",
          }}
        >
          <button
            type="button"
            onClick={togglePanchangMenu}
            className="relative w-full rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide transition-all hover:scale-[1.01]"
            style={{
              background: "var(--calendar-orange-gradient)",
              border: "2.5px solid rgba(212, 168, 71, 0.8)",
              color: "#ffedb3",
              boxShadow:
                "0 0 18px rgba(212, 168, 71, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 -1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <span className="block text-center">{t.panchang || t.tilePanchang || "Panchang"}</span>
            <span
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs transition-transform duration-200"
              style={{
                color: "#ffedb3",
                transform: isPanchangOpen ? "rotate(180deg)" : "rotate(0deg)",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              ▼
            </span>
          </button>
        </div>

        {isPanchangOpen && (
          <div
            className="mt-1 rounded-xl p-2 backdrop-blur-md"
            style={{
              background: "var(--calendar-orange-shell)",
              border: "3px solid rgba(255, 140, 50, 0.8)",
              boxShadow: "0 0 35px rgba(255, 140, 50, 0.8), 0 0 70px rgba(255, 100, 30, 0.6), inset 0 0 30px rgba(255, 140, 50, 0.2)",
            }}
          >
            <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
              {getTiles(t).map((tile) => (
                <Tile key={tile.to} {...tile} />
              ))}
            </section>
          </div>
        )}
      </div>


      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="mx-auto w-full max-w-md px-4 pb-3 md:max-w-6xl md:px-6">
          <section
            className="grid grid-cols-4 rounded-2xl p-2 text-center transition-all duration-300"
            style={{
              background: "var(--calendar-orange-gradient)",
              border: "1.5px solid rgba(255, 183, 77, 0.4)",
              boxShadow: "0 -4px 20px rgba(255, 111, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -2px 0 rgba(139, 69, 19, 0.2)",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/compass")}
              className="rounded-xl py-2 text-[10px] font-bold transition-all duration-200 hover:bg-[rgba(255,224,130,0.15)]"
              style={{
                color: "#FFE8C5",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div className="text-lg">⌖</div>
              {t.compass || "Compass"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/sankalp-mantra")}
              className="rounded-xl py-2 text-[10px] font-bold transition-all duration-200 hover:bg-[rgba(255,224,130,0.15)]"
              style={{
                color: "#FFE8C5",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div className="text-lg">ॐ</div>
              {t.sankalp || "Sankalp"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/about")}
              className="rounded-xl py-2 text-[10px] font-bold transition-all duration-200 hover:bg-[rgba(255,224,130,0.15)]"
              style={{
                color: "#FFE8C5",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div className="text-lg">i</div>
              {t.about || "About"}
            </button>
            <button
              type="button"
              onClick={() => shareApp()}
              className="rounded-xl py-2 text-[10px] font-bold transition-all duration-200 hover:bg-[rgba(255,224,130,0.15)]"
              style={{
                color: "#FFE8C5",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div className="text-lg">↗</div>
              {t.share || "Share"}
            </button>
          </section>


          {(summary?.purnimanthaMonth || summary?.ayana || summary?.ritu) ? (
            <section
              className="mt-3 rounded-2xl px-4 py-3 text-center transition-all duration-300"
              style={{
                background: "var(--calendar-orange-gradient)",
                border: "1.5px solid rgba(255, 183, 77, 0.4)",
                boxShadow: "0 4px 16px rgba(255, 111, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -2px 0 rgba(139, 69, 19, 0.2)",
              }}
            >
              {summary?.purnimanthaMonth ? (
                <div
                  className="text-[13px] font-semibold"
                  style={{
                    color: "#FFE8C5",
                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  {summary?.purnimanthaMonth}
                </div>
              ) : null}
              {joinClean([summary?.ayana, summary?.ritu]) ? (
                <div
                  className="text-[12px] mt-1"
                  style={{
                    color: "#FFECB3",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.25), 0 0 10px rgba(255, 236, 179, 0.3)",
                  }}
                >
                  {joinClean([summary?.ayana, summary?.ritu])}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>


      {menuOpen ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0"
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(2px)",
            }}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[82%] max-w-sm p-4"
            style={{
              background: "var(--calendar-orange-gradient)",
              boxShadow: "4px 0 30px rgba(255, 111, 0, 0.45)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div
                className="text-lg font-semibold"
                style={{
                  color: "#FFF1DA",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
                }}
              >
                {t.menuLabel || "Menu"}
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-1 text-sm transition-all duration-200 hover:scale-105"
                style={{
                  background: "var(--calendar-orange-gradient)",
                  color: "#FFF1DA",
                  boxShadow: "0 2px 8px rgba(255, 111, 0, 0.35)",
                  border: "1px solid rgba(255, 183, 77, 0.45)",
                }}
              >
                {t.close || "Close"}
              </button>
            </div>
            <nav className="grid gap-2">
              {getMenuLinks(t).map(([to, label]) => (
                <Link
                  key={`menu-${to}`}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: "var(--calendar-orange-gradient)",
                    color: "#FFE8C5",
                    boxShadow: "0 2px 10px rgba(255, 152, 0, 0.3), inset 0 1px 0 rgba(255, 220, 160, 0.22)",
                    border: "1px solid rgba(255, 183, 77, 0.35)",
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      {/* ASTROLOGY NAV BUTTON */}
      <Link
        to="/astrology"
        aria-label="Open astrology pages"
        title="Astrology (Panchang / Kundali / Matchmaking / Muhurat)"
        className="fixed z-40 inline-flex items-center justify-center rounded-full h-12 w-12 sm:h-14 sm:w-14 backdrop-blur-md"
        style={{
          right: "1rem",
          bottom: "100px",  // Roughly 6.25rem to sit gracefully above the nav
          background: "linear-gradient(145deg, rgba(255, 210, 155, 0.18) 0%, rgba(255, 150, 80, 0.12) 55%, rgba(255, 120, 45, 0.16) 100%)",
          border: "2px solid rgba(255, 226, 176, 0.65)",
          boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35), 0 0 26px rgba(255, 145, 65, 0.3), inset 0 1px 8px rgba(255, 250, 240, 0.18)",
        }}
      >
        <span
          className="inline-flex items-center justify-center rounded-full h-8 w-8 sm:h-9 sm:w-9"
          style={{
            background: "linear-gradient(145deg, rgba(255, 176, 102, 0.32) 0%, rgba(255, 122, 55, 0.26) 100%)",
            border: "1px solid rgba(255, 224, 170, 0.55)",
            boxShadow: "inset 0 0 10px rgba(255, 239, 210, 0.16)",
            color: "#FFF1D6",
            fontSize: "17px",
            lineHeight: "1",
          }}
        >
          🪐
        </span>
      </Link>

      {languagePopupOpen ? (
        <div
          className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setLanguagePopupOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-4 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #4a0e0e 0%, #d8691e 50%, #4a0e0e 100%)",
              border: "2px solid rgba(255, 220, 150, 0.85)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-center text-lg font-bold text-orange-300">{t.selectLanguage || "Select Language"}</h3>
            <div className="max-h-60 overflow-y-auto rounded-lg p-2" style={{ background: "linear-gradient(180deg, rgba(255, 110, 40, 0.35) 0%, rgba(255, 90, 25, 0.25) 100%)" }}>
              {languages.map((lang) => {
                const isActive = lang.code === language;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      // saveLanguage dispatches LANGUAGE_CHANGE_EVENT so the
                      // whole app updates immediately without needing a reload.
                      saveLanguage(lang.code);
                      setLanguage(lang.code);
                      setLanguagePopupOpen(false);
                    }}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${isActive ? "bg-orange-500 text-white shadow-lg" : "bg-orange-700/95 text-orange-100 hover:bg-orange-600"
                      }`}
                  >
                    {String(lang.code || "").toUpperCase()} {lang.nativeName ? `• ${lang.nativeName}` : ""}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setLanguagePopupOpen(false)}
              className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(230, 81, 0, 0.9) 0%, rgba(255, 112, 67, 0.9) 100%)",
                border: "2px solid rgba(255, 183, 77, 0.8)",
                boxShadow: "0 2px 8px rgba(230, 81, 0, 0.4)",
              }}
            >
              {t.close || "Close"}
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function AlarmToggleRow({ label, checked, onChange }) {
  return (
    <div
      className="flex min-w-0 items-center justify-between w-full rounded-lg px-2 py-1"
      style={{
        background: "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
        border: "2px solid #d4a847",
      }}
    >
      <div className="min-w-0 flex-1 pr-3">
        <div className="text-[10px] font-semibold truncate" style={{ color: "#FFE4B5" }}>
          {label}
        </div>
      </div>
      <input
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 accent-green-500"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function HomeAlarmPanel({
  language,
  translations,
  alarmSettings,
  setAlarmSettings,
  onSave,
  onReset,
  onRequestNotification,
  notificationStatus,
}) {
  return (
    <div
      className="rounded-2xl p-3 backdrop-blur-sm"
      style={{
        background:
          "linear-gradient(180deg, #ff4d0d 0%, #ff5c1a 10%, #ff6b28 20%, #ff7935 30%, #ff8743 40%, #ff7935 50%, #ff6b28 60%, #ff5c1a 70%, #ff4d0d 80%, #d94100 90%, #c23800 100%)",
        border: "2.5px solid rgba(255, 168, 67, 0.8)",
        boxShadow:
          "0 0 18px rgba(212,168,71,0.4), inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -1px 2px rgba(0,0,0,0.2)",
      }}
    >
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-3"
        style={{
          background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
          border: "2.5px solid rgba(255, 140, 50, 0.7)",
          boxShadow:
            "0 0 20px rgba(255, 140, 50, 0.6), 0 0 40px rgba(255, 100, 30, 0.4), inset 0 0 15px rgba(255, 200, 100, 0.2)",
        }}
      >
        <span className="text-base">⏰</span>
        <h3
          className="text-xs sm:text-sm font-bold uppercase tracking-wide"
          style={{ color: "#D4AF37" }}
        >
          {translations[language]?.alarmSettings || "Chanting Tunes"}
        </h3>
      </div>

      <div className="pt-2 grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-3 overflow-hidden flex flex-col h-full" style={{ border: "1px solid rgba(212, 168, 71, 0.35)" }}>
          <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: "#FFE4B5" }}>
            {translations[language]?.weekdaysLabel || translations[language]?.weekdays || "Weekdays"}
          </div>
          <div className="mt-6 grid grid-rows-7 gap-2 flex-1">
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((dayName, index) => {
              const dayValue = dayName === "Sunday" ? 7 : index;
              const active = alarmSettings.disabledDays.includes(dayValue);
              return (
                <button
                  key={dayName}
                  type="button"
                  onClick={() =>
                    setAlarmSettings((prev) => ({
                      ...prev,
                      disabledDays: active
                        ? prev.disabledDays.filter((d) => d !== dayValue)
                        : [...prev.disabledDays, dayValue],
                    }))
                  }
                  className="w-full rounded-lg px-2 py-2 text-xs font-semibold transition"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)"
                      : "linear-gradient(135deg, rgba(42, 90, 31, 0.7) 0%, rgba(58, 110, 45, 0.7) 50%, rgba(90, 150, 69, 0.7) 100%)",
                    border: active ? "2.5px solid #d4a847" : "2px solid rgba(212, 168, 71, 0.7)",
                    color: "#ffedb3",
                    boxShadow: active
                      ? "0 0 18px rgba(212, 168, 71, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 -1px 2px rgba(0, 0, 0, 0.2)"
                      : "0 0 12px rgba(212, 168, 71, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.18)",
                  }}
                >
                  {translations[language]?.[dayName] || dayName}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl p-3 flex flex-col h-full" style={{ border: "1px solid rgba(212, 168, 71, 0.35)" }}>
          <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: "#FFE4B5" }}>
            {translations[language]?.notificationPreferences || "Notification Preferences"}
          </div>
          <div className="mt-2 grid grid-rows-7 gap-2 flex-1">
            <AlarmToggleRow
              label={translations[language]?.audioAlerts || "Audio Alerts"}
              checked={alarmSettings.audioEnabled}
              onChange={(checked) => setAlarmSettings((prev) => ({ ...prev, audioEnabled: checked }))}
            />
            <AlarmToggleRow
              label={translations[language]?.silentMode || "Silent Mode"}
              checked={alarmSettings.silentMode}
              onChange={(checked) => setAlarmSettings((prev) => ({ ...prev, silentMode: checked }))}
            />
            <div
              className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1"
              style={{
                background:
                  "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
                border: "2px solid #d4a847",
              }}
            >
              <div className="min-w-0 flex-1 truncate text-[10px] font-semibold" style={{ color: "#ffedb3" }}>
                {translations[language]?.reminderTime || "Reminder Time"}
              </div>
              <HomeReminderTimeDropdown
                value={alarmSettings.reminderTime}
                options={REMINDER_TIME_OPTIONS}
                suffix={translations[language]?.minutesBeforeStart || "minutes before start"}
                onChange={(nextValue) =>
                  setAlarmSettings((prev) => ({ ...prev, reminderTime: nextValue }))
                }
              />
            </div>
            <button
              type="button"
              onClick={onSave}
              className="w-full rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200 hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
                border: "2px solid #d4a847",
                color: "#ffedb3",
                boxShadow:
                  "0 0 12px rgba(212, 168, 71, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.18)",
              }}
            >
              {translations[language]?.saveSettings || "Save Settings"}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200 hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
                border: "2px solid #d4a847",
                color: "#ffedb3",
                boxShadow:
                  "0 0 12px rgba(212, 168, 71, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.18)",
              }}
            >
              {translations[language]?.resetDefaults || "Reset Defaults"}
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200 hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
                border: "2px solid #d4a847",
                color: "#ffedb3",
                boxShadow:
                  "0 0 12px rgba(212, 168, 71, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.18)",
              }}
            >
              {translations[language]?.scrollUp || "Scroll Up"}
            </button>
            {notificationStatus ? (
              <div
                className="w-full rounded-lg px-2 py-2 text-xs font-bold text-center animate-pulse"
                style={{
                  color: "#FFFFFF",
                  background: "linear-gradient(135deg, rgba(42, 90, 31, 0.9) 0%, rgba(90, 150, 69, 0.9) 100%)",
                  border: "2px solid #FFED70",
                  boxShadow: "0 0 15px rgba(255, 237, 112, 0.3)"
                }}
              >
                {notificationStatus}
              </div>
            ) : null}
            {!window.NativeApp && (
              <>
                <button
                  type="button"
                  onClick={onRequestNotification}
                  className="w-full rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background:
                      "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
                    border: "2px solid #d4a847",
                    color: "#ffedb3",
                    boxShadow:
                      "0 0 12px rgba(212, 168, 71, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.18)",
                  }}
                >
                  🔔 {translations[language]?.enableNotifications || "Enable Notifications"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeReminderTimeDropdown({ value, options, suffix, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedText = `${value} ${suffix}`;

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-[60%] sm:max-w-[58%]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full truncate rounded-lg px-2 py-1 text-left text-xs font-bold outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 140, 50, 0.35) 0%, rgba(255, 107, 40, 0.35) 100%)",
          border: "2px solid rgba(212, 168, 71, 0.85)",
          color: "#ffedb3",
          boxShadow:
            "0 0 10px rgba(212, 168, 71, 0.18), inset 0 1px 2px rgba(255, 255, 255, 0.08), inset 0 -1px 2px rgba(0, 0, 0, 0.18)",
        }}
      >
        {selectedText}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-56 max-w-[85vw] overflow-hidden rounded-xl"
          role="listbox"
          style={{
            background:
              "linear-gradient(180deg, rgba(255, 140, 50, 0.98) 0%, rgba(255, 107, 40, 0.98) 55%, rgba(217, 65, 0, 0.98) 100%)",
            border: "2px solid rgba(212, 168, 71, 0.9)",
            boxShadow:
              "0 12px 30px rgba(0, 0, 0, 0.35), 0 0 18px rgba(212, 168, 71, 0.18)",
          }}
        >
          <div className="max-h-64 overflow-auto">
            {options.map((optionValue) => {
              const isSelected = optionValue === value;
              return (
                <button
                  key={optionValue}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(optionValue);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(42, 90, 31, 0.95) 0%, rgba(58, 110, 45, 0.95) 40%, rgba(90, 150, 69, 0.95) 100%)"
                      : "transparent",
                    color: "#ffffff",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.18)",
                  }}
                >
                  {optionValue} {suffix}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
