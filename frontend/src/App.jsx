import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import CalendarGrid from "./components/CalendarGrid";
import DayDetails from "./components/DayDetails";
import YearSelectorPopup from "./components/YearSelectorPopup";
import Rashiphalalu from "./components/Rashiphalalu";
import { Link } from "react-router-dom";
import { translations, languages } from "./translations";
import { translateText } from "./translations";
import { speakCloud } from "./utils/cloudSpeech";
import { getDateSelectionSpeech } from "./utils/speechTemplates";
import { LANGUAGE_CHANGE_EVENT, loadLanguage, saveLanguage } from "./utils/appSettings";
import { normalizeDayRecord } from "./utils/localPanchang";

const YEARS = Array.from({ length: 186 }, (_, i) => 1940 + i);
const DATE_STATE_KEY = "panchang:selected-date";
const LANGUAGE_KEY = "panchang:selected-language";
const VIEW_STATE_KEY = "panchang:current-view";
const RASHI_STATE_KEY = "panchang:rashi-selection";
const ALARM_POPUP_STATE_KEY = "panchang:open-alarm-popup";
const VOICE_KEY = "panchang:voice-enabled";

const getTodayInfo = () => {
  const today = new Date();
  return {
    day: today.getDate(),
    month: today.getMonth(), // 0-based
    year: today.getFullYear(),
  };
};

const formatDateString = (y, m, d) =>
  `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`;

const loadInitialSelection = (today) => {
  if (typeof window === "undefined") return today;

  try {
    const raw = sessionStorage.getItem(DATE_STATE_KEY);
    if (!raw) return today;
    const parsed = JSON.parse(raw);

    if (
      typeof parsed?.year === "number" &&
      typeof parsed?.month === "number" &&
      typeof parsed?.day === "number"
    ) {
      return parsed;
    }
  } catch (error) {
    console.error("Failed to read saved date:", error);
  }

  return today;
};

const loadInitialLanguage = () => {
  if (typeof window === "undefined") return "en";
  try {
    const saved = loadLanguage();
    if (saved && languages.some((l) => l.code === saved)) {
      return saved;
    }
  } catch (error) {
    console.error("Failed to read saved language:", error);
  }
  return "en";
};

const loadInitialVoiceEnabled = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VOICE_KEY) === "1";
};

const getFestivalDateKeyFromSlashDate = (dateStr) => {
  const [day, month, year] = (dateStr || "").split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
};

const fetchFestivalMap = async (year) => {
  try {
    const res = await fetch(`/data/festivals/${year}.json`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
};

const withFestivalsFromMap = (dayData, festivalMap) => {
  if (!dayData?.date) return dayData;
  const key = getFestivalDateKeyFromSlashDate(dayData.date);
  const festivals = festivalMap?.[key] || [];
  return { ...dayData, Festivals: festivals };
};

const shubhamasthuByLang = {
  en: "Shubhamasthu",
  te: "శుభమస్తు",
  hi: "शुभमस्तु",
  ml: "ശുഭമസ്തു",
  kn: "ಶುಭಮಸ್ತು",
  ta: "சுபமஸ்து",
};

function App() {
  const today = getTodayInfo();
  const initialSelection = loadInitialSelection(today);

  // Load initial view from sessionStorage
  const loadInitialView = () => {
    if (typeof window === "undefined") return "calendar";
    try {
      const saved = sessionStorage.getItem(VIEW_STATE_KEY);
      return (saved === "rashiphalalu" || saved === "calendar") ? saved : "calendar";
    } catch {
      return "calendar";
    }
  };

  // Load selected rashi from sessionStorage
  const loadSavedRashi = () => {
    if (typeof window === "undefined") return null;
    try {
      const saved = sessionStorage.getItem(RASHI_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Unified state - selectedDay is the single source of truth for date selection
  const [year, setYear] = useState(initialSelection.year);
  const [month, setMonth] = useState(initialSelection.month);
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [preferredDay, setPreferredDay] = useState(initialSelection.day);
  // todayDay: today's panchang record (always today, regardless of calendar selection)
  const [todayDay, setTodayDay] = useState(null);
  const [language, setLanguage] = useState(loadInitialLanguage);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentView, setCurrentView] = useState(loadInitialView());
  const [voiceEnabled, _setVoiceEnabled] = useState(loadInitialVoiceEnabled);
  const [selectedRashi, setSelectedRashi] = useState(loadSavedRashi());
  const [openAlarmPopupOnLoad] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const shouldOpen = sessionStorage.getItem(ALARM_POPUP_STATE_KEY) === "1";
      if (shouldOpen) sessionStorage.removeItem(ALARM_POPUP_STATE_KEY);
      return shouldOpen;
    } catch {
      return false;
    }
  });
  const [tempYear, setTempYear] = useState(initialSelection.year);
  const [tempMonth, setTempMonth] = useState(initialSelection.month);
  const [tempDay, setTempDay] = useState(initialSelection.day);
  const t = translations[language] || translations.en;


  // Keep selected date on refresh for this session only.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const dayNum = selectedDay?.date
      ? parseInt(selectedDay.date.split("/")[0], 10)
      : preferredDay;

    sessionStorage.setItem(
      DATE_STATE_KEY,
      JSON.stringify({
        year,
        month,
        day: dayNum,
      })
    );
  }, [year, month, preferredDay, selectedDay]);

  // Keep selected language on refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadLanguage() !== language) saveLanguage(language);
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncLanguage = (event) => {
      const fromEvent = event?.detail?.language;
      const saved = fromEvent || loadLanguage();
      if (saved && languages.some((l) => l.code === saved)) {
        setLanguage((prev) => (prev === saved ? prev : saved));
      }
    };
    const onStorage = (event) => {
      if (event?.key && event.key !== LANGUAGE_KEY) return;
      syncLanguage();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    };
  }, []);

  // Load calendar data for selected month/year and keep selected day in sync.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/data/${year}.json`).then((res) => res.json()),
      fetchFestivalMap(year),
    ])
      .then(([yearData, festivalMap]) => {
        if (cancelled) return;

        const allDays = Array.isArray(yearData) ? yearData : [];
        const monthDays = allDays
          .filter((item) => {
            const [d, m, y] = String(item?.date || "").split("/");
            if (!d || !m || !y) return false;
            return Number(y) === year && Number(m) === month + 1;
          })
          .map((item) => normalizeDayRecord(withFestivalsFromMap(item, festivalMap)));

        setDays(monthDays);

        const todayDate = formatDateString(today.year, today.month, today.day);
        const todayData = allDays.find((item) => item?.date === todayDate);
        setTodayDay(todayData ? normalizeDayRecord(withFestivalsFromMap(todayData, festivalMap)) : null);

        if (!monthDays.length) {
          setSelectedDay(null);
          return;
        }

        const selectedDateStr = formatDateString(year, month, preferredDay);
        const selectedFromMonth =
          monthDays.find((item) => item?.date === selectedDateStr) || monthDays[0];
        setSelectedDay(selectedFromMonth || null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load calendar data:", error);
        setDays([]);
        setSelectedDay(null);
        setTodayDay(null);
      });

    return () => {
      cancelled = true;
    };
  }, [year, month, preferredDay, today.day, today.month, today.year]);

  // Handle browser back/forward button for Rashiphalalu navigation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = (event) => {
      const nextView = event.state?.view;
      const view =
        nextView === "rashiphalalu" || nextView === "calendar"
          ? nextView
          : "calendar";

      sessionStorage.setItem(VIEW_STATE_KEY, view);
      setCurrentView(view);
    };

    // Listen for browser back/forward navigation
    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Push initial history state on mount if view is rashiphalalu
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only push state if we're on rashiphalalu and there's no state yet
    if (currentView === "rashiphalalu" && !window.history.state?.view) {
      window.history.replaceState({ view: "rashiphalalu" }, "", window.location.href);
    } else if (currentView === "calendar" && !window.history.state?.view) {
      window.history.replaceState({ view: "calendar" }, "", window.location.href);
    }
  }, [currentView]);

  // Navigate to Rashiphalalu view with history support
  const _navigateToRashiphalalu = useCallback(() => {
    if (currentView === "rashiphalalu") return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(VIEW_STATE_KEY, "rashiphalalu");
      window.history.pushState({ view: "rashiphalalu" }, "", window.location.href);
    }
    setCurrentView("rashiphalalu");
  }, [currentView]);

  // Navigate back to calendar view with history support
  const navigateToCalendar = useCallback(() => {
    if (currentView === "calendar") return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(VIEW_STATE_KEY, "calendar");
      window.history.pushState({ view: "calendar" }, "", window.location.href);
    }
    setCurrentView("calendar");
  }, [currentView]);

  const goPrevMonth = () => {
    const newMonth = month === 0 ? 11 : month - 1;
    const newYear = month === 0 ? year - 1 : year;

    setMonth(newMonth);
    setYear(newYear);

    // Update selectedDay to first day of new month if valid
    const dateStr = formatDateString(newYear, newMonth, 1);
    Promise.all([
      fetch(`/data/${newYear}.json`).then((res) => res.json()),
      fetchFestivalMap(newYear),
    ])
      .then(([data, festivalMap]) => {
        const dayData = data.find((d) => d.date === dateStr);
        if (dayData) {
          setSelectedDay(normalizeDayRecord(withFestivalsFromMap(dayData, festivalMap)));
          setPreferredDay(1);
        }
      });
  };

  const goNextMonth = () => {
    const newMonth = month === 11 ? 0 : month + 1;
    const newYear = month === 11 ? year + 1 : year;

    setMonth(newMonth);
    setYear(newYear);

    // Update selectedDay to first day of new month if valid
    const dateStr = formatDateString(newYear, newMonth, 1);
    Promise.all([
      fetch(`/data/${newYear}.json`).then((res) => res.json()),
      fetchFestivalMap(newYear),
    ])
      .then(([data, festivalMap]) => {
        const dayData = data.find((d) => d.date === dateStr);
        if (dayData) {
          setSelectedDay(normalizeDayRecord(withFestivalsFromMap(dayData, festivalMap)));
          setPreferredDay(1);
        }
      });
  };

  const monthLabel = useMemo(
    () => `${t.months[month]}`,
    [month, t]
  );

  const selectedDayWithLocalData = useMemo(
    () => normalizeDayRecord(selectedDay),
    [selectedDay]
  );

  const handleDatePickerOk = (data) => {
    const { year: newYear, month: newMonth, day: newDay, dayData } = data || {};

    const y = newYear ?? tempYear;
    const m = newMonth ?? tempMonth;
    const d = newDay ?? tempDay;

    // Always set year and month first
    setYear(y);
    setMonth(m);

    // Find or create dayData for the selected date
    const dateStr = formatDateString(y, m, d);
    setPreferredDay(d);

    Promise.all([
      fetchFestivalMap(y),
      dayData
        ? Promise.resolve(null)
        : fetch(`/data/${y}.json`).then((res) => res.json()),
    ])
      .then(([festivalMap, yearData]) => {
        if (dayData) {
          setSelectedDay(normalizeDayRecord(withFestivalsFromMap(dayData, festivalMap)));
          return;
        }

        const foundDayData = yearData?.find((item) => item.date === dateStr);
        if (foundDayData) {
          setSelectedDay(withFestivalsFromMap(foundDayData, festivalMap));
        } else {
          // Create a minimal dayData object if not found
          const minimalDayData = {
            date: dateStr,
            Tithi: "Prathama",
            Nakshatra: "Ashwini",
            Paksha: "Shukla Paksha",
            Yoga: "Vishkumbha",
            Karana: "Bava",
            "Rahu Kalam": "-",
            Sunrise: "06:00 AM",
            Sunset: "06:00 PM",
            Festivals: festivalMap?.[getFestivalDateKeyFromSlashDate(dateStr)] || [],
          };
          setSelectedDay(normalizeDayRecord(minimalDayData));
        }
      })
      .catch((err) => {
        console.error("Error fetching date data:", err);
      });

    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    setTempYear(year);
    setTempMonth(month);
    setTempDay(selectedDay ? parseInt(selectedDay.date.split("/")[0]) : today.day);
    setShowDatePicker(false);
  };

  const openDatePicker = () => {
    setTempYear(year);
    setTempMonth(month);
    setTempDay(selectedDay ? parseInt(selectedDay.date.split("/")[0]) : today.day);
    setShowDatePicker(true);
  };

  // Speech handler for date click
  const handleDateClickSpeech = async (day) => {
    if (!day || !day.date) return;

    // Parse date from day object
    const dateParts = day.date.split("/");
    if (dateParts.length < 3) return;

    const dayNum = dateParts[0];
    const monthNum = parseInt(dateParts[1], 10) - 1;
    const monthName = t?.months?.[monthNum] || "";

    const tithi = translateText(day.Tithi, t);
    const paksha = translateText(day.Paksha, t);
    const yearName = day["Shaka Samvat"] || "";

    let festivals = Array.isArray(day.Festivals)
      ? day.Festivals.map((f) => translateText(f, t))
      : [];

    // Some data files store festivals in a separate year map.
    if (festivals.length === 0) {
      try {
        const festivalYear = dateParts[2];
        const festivalRes = await fetch(`/data/festivals/${festivalYear}.json`);
        if (festivalRes.ok) {
          const festivalMap = await festivalRes.json();
          const dateKey = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
          const dayFestivals = festivalMap?.[dateKey] || [];
          festivals = dayFestivals.map((f) => translateText(f, t));
        }
      } catch (error) {
        console.error("Error loading date-click festivals:", error);
      }
    }

    const speechText = getDateSelectionSpeech({
      language,
      day: dayNum,
      month: monthName,
      tithi,
      paksha,
      yearName,
      festivals,
    });
    if (voiceEnabled) {
      speakCloud(speechText, language);
    }
  };

  const handleMainDateSelect = (day) => {
    setSelectedDay(day);
    if (day?.date) {
      const dayNum = parseInt(day.date.split("/")[0], 10);
      setPreferredDay(dayNum);
      setTempYear(year);
      setTempMonth(month);
      setTempDay(dayNum);
    }
  };

  if (!days.length)
    return (
      <div
        className="min-h-screen grid place-items-center px-4 sm:px-6"
        style={{
          background: "linear-gradient(180deg, #FF8C32 0%, #FF6347 20%, #FF4560 40%, #E63946 60%, #D32F2F 80%, #B71C1C 100%)",
          position: "relative",
        }}
      >
        {/* Particle Background */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(2px 2px at 10% 20%, rgba(255, 220, 80, 0.9), transparent),
              radial-gradient(2px 2px at 30% 40%, rgba(255, 200, 50, 0.8), transparent),
              radial-gradient(2px 2px at 50% 10%, rgba(255, 220, 80, 0.9), transparent),
              radial-gradient(2px 2px at 70% 60%, rgba(255, 180, 40, 0.8), transparent),
              radial-gradient(2px 2px at 85% 30%, rgba(255, 220, 80, 0.9), transparent),
              radial-gradient(1px 1px at 20% 70%, rgba(255, 200, 50, 0.7), transparent),
              radial-gradient(1px 1px at 60% 80%, rgba(255, 180, 40, 0.9), transparent),
              radial-gradient(2px 2px at 90% 15%, rgba(255, 220, 80, 0.8), transparent),
              radial-gradient(1px 1px at 15% 50%, rgba(255, 200, 50, 0.7), transparent),
              radial-gradient(2px 2px at 75% 85%, rgba(255, 180, 40, 0.9), transparent)
            `,
            backgroundSize: "100% 100%",
            animation: "sparkle 3s ease-in-out infinite",
          }}
        />

        <div
          className="relative w-full max-w-md rounded-3xl p-8 text-center backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(80, 20, 10, 0.9) 0%, rgba(120, 30, 15, 0.85) 100%)",
            border: "3px solid rgba(255, 140, 50, 0.8)",
            boxShadow: `
              0 0 30px rgba(255, 140, 50, 0.8),
              0 0 60px rgba(255, 100, 30, 0.6),
              inset 0 0 20px rgba(255, 140, 50, 0.2)
            `,
          }}
        >
          <div
            className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center relative"
            style={{
              background: "linear-gradient(135deg, #1a0a05 0%, #2d1208 50%, #401a0c 100%)",
              border: "4px solid #ff8c32",
              borderRadius: "24px",
              boxShadow: `
                0 0 40px rgba(255, 140, 50, 1),
                0 0 80px rgba(255, 100, 30, 0.8),
                0 0 120px rgba(255, 140, 50, 0.6),
                inset 0 0 30px rgba(255, 140, 50, 0.3),
                inset 0 4px 10px rgba(255, 200, 100, 0.4),
                inset 0 -2px 8px rgba(0, 0, 0, 0.6)
              `,
            }}
          >
            {/* Inner border layer */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                border: "2px solid rgba(255, 180, 80, 0.6)",
                margin: "4px",
                borderRadius: "18px",
              }}
            />
            <span
              className="text-4xl relative z-10"
              style={{
                background: "linear-gradient(135deg, #ffe9a0 0%, #ffd54f 25%, #ffb300 50%, #ff8f00 75%, #ff6f00 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 1)) drop-shadow(0 0 40px rgba(255, 160, 0, 0.8)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))",
                fontWeight: "900",
              }}
            >
              卐
            </span>
          </div>
          <p
            className="mt-6 font-black text-xl"
            style={{
              color: "#FFFFFF",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 140, 50, 0.4)",
            }}
          >
            {t.loading}
          </p>
          <p
            className="mt-2 text-base"
            style={{
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            {t.fetchingData} {year}.
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #FF8C32 0%, #FF6347 20%, #FF4560 40%, #E63946 60%, #D32F2F 80%, #B71C1C 100%)",
        position: "relative",
      }}
    >
      {/* ANIMATED PARTICLE BACKGROUND */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(2px 2px at 10% 20%, rgba(255, 220, 80, 0.9), transparent),
            radial-gradient(2px 2px at 30% 40%, rgba(255, 200, 50, 0.8), transparent),
            radial-gradient(2px 2px at 50% 10%, rgba(255, 220, 80, 0.9), transparent),
            radial-gradient(2px 2px at 70% 60%, rgba(255, 180, 40, 0.8), transparent),
            radial-gradient(2px 2px at 85% 30%, rgba(255, 220, 80, 0.9), transparent),
            radial-gradient(1px 1px at 20% 70%, rgba(255, 200, 50, 0.7), transparent),
            radial-gradient(1px 1px at 60% 80%, rgba(255, 180, 40, 0.9), transparent),
            radial-gradient(2px 2px at 90% 15%, rgba(255, 220, 80, 0.8), transparent),
            radial-gradient(1px 1px at 15% 50%, rgba(255, 200, 50, 0.7), transparent),
            radial-gradient(2px 2px at 75% 85%, rgba(255, 180, 40, 0.9), transparent),
            radial-gradient(1px 1px at 40% 25%, rgba(255, 200, 50, 0.7), transparent),
            radial-gradient(2px 2px at 55% 45%, rgba(255, 220, 80, 0.9), transparent),
            radial-gradient(1px 1px at 80% 75%, rgba(255, 180, 40, 0.8), transparent),
            radial-gradient(2px 2px at 25% 90%, rgba(255, 200, 50, 0.7), transparent),
            radial-gradient(1px 1px at 65% 15%, rgba(255, 220, 80, 0.8), transparent),
            radial-gradient(2px 2px at 35% 65%, rgba(255, 180, 40, 0.9), transparent)
          `,
          backgroundSize: "100% 100%",
          animation: "sparkle 3s ease-in-out infinite",
        }}
      />

      {/* ============= HEADER WITH DAY DETAILS CARD ============= */}
      <header className="relative z-40">
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0 backdrop-blur-sm"
          style={{
            background: "linear-gradient(180deg, rgba(15, 5, 5, 0.3) 0%, rgba(30, 10, 10, 0.1) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-2 sm:pt-3 pb-0.5 sm:pb-1">
          {/* HEADER: Title only (controls moved to HomePage) */}
          <div className="mb-0.5 flex items-center justify-between border-b-[2px] border-[rgba(255,140,50,0.4)] pb-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                to="/"
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base font-black transition-all duration-200 hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 224, 130, 0.3) 0%, rgba(255, 183, 77, 0.25) 100%)",
                  color: "#FFF5E1",
                  border: "1px solid rgba(255, 224, 130, 0.3)",
                }}
                aria-label="Back to home"
                title="Back to home"
              >
                {"\u2190"}
              </Link>
              <h1
                className="font-black tracking-tight"
                style={{
                  color: "#FFFFFF",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.85), 0 6px 18px rgba(255, 140, 50, 0.45)",
                  lineHeight: "1.05",
                  letterSpacing: "0.02em",
                  fontSize: "clamp(1rem, 2.6vw, 1.7rem)",
                  fontWeight: "900",
                }}
              >
                {monthLabel}
                <span
                  className="block text-[11px] sm:text-xs font-semibold tracking-[0.08em]"
                  style={{
                    color: "#FFE8C5",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  Monthly Panchang
                </span>
              </h1>
            </div>
            <Link
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all duration-200 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(255, 224, 130, 0.3) 0%, rgba(255, 183, 77, 0.25) 100%)",
                color: "#FFF5E1",
                border: "1px solid rgba(255, 224, 130, 0.3)",
              }}
              aria-label="Settings"
            >
              {"\u2699"}
            </Link>
          </div>

          {/* DayDetails Header Row with Outer Container */}
          <div className="mt-px px-1">
            <div
              className="rounded-xl sm:rounded-2xl p-2.5 sm:p-3 backdrop-blur-md"
              style={{
                background: "var(--calendar-orange-shell)",
                border: "3px solid rgba(255, 140, 50, 0.8)",
                boxShadow: `
                  0 0 35px rgba(255, 140, 50, 0.8),
                  0 0 70px rgba(255, 100, 30, 0.6),
                  inset 0 0 30px rgba(255, 140, 50, 0.2)
                `,
              }}
            >
              <DayDetails
                day={selectedDayWithLocalData}
                language={language}
                translations={t}
                isHeaderMode={true}
                voiceEnabled={voiceEnabled}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ============= MAIN CONTENT (Calendar View or Rashiphalalu) ============= */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-0.5 sm:py-1">
        {currentView === "rashiphalalu" ? (
          <Rashiphalalu
            language={language}
            translations={t}
            onBack={navigateToCalendar}
            selectedRashi={selectedRashi}
            setSelectedRashi={setSelectedRashi}
            rashiStateKey={RASHI_STATE_KEY}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-1 sm:gap-1">
            {/* CALENDAR SECTION */}
            <section
              className="rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-md"
              style={{
                background: "var(--calendar-orange-shell)",
                border: "3px solid rgba(255, 140, 50, 0.8)",
                boxShadow: `
                  0 0 35px rgba(255, 140, 50, 0.8),
                  0 0 70px rgba(255, 100, 30, 0.6),
                  inset 0 0 30px rgba(255, 140, 50, 0.2)
                `,
              }}
            >
              {/* Calendar Header: Month with Arrows + Year Button */}
              <div
                className="flex items-center justify-between gap-2 mb-2 pb-2 px-3 py-1.5"
                style={{
                  borderBottom: "2px solid rgba(255, 140, 50, 0.4)",
                  background: "linear-gradient(180deg, rgba(80, 20, 10, 0.8) 0%, rgba(60, 15, 8, 0.7) 100%)",
                  borderRadius: "12px"
                }}
              >
                {/* Month Button with Arrows Inside */}
                <button
                  className="inline-flex items-center gap-3 rounded-full px-4 py-1.5 text-sm font-bold transition-all hover:scale-105 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                    border: "2.5px solid rgba(255, 140, 50, 0.7)",
                    color: "#FFE4B5",
                    boxShadow: `
                      0 0 20px rgba(255, 140, 50, 0.6),
                      0 0 40px rgba(255, 100, 30, 0.4),
                      inset 0 0 15px rgba(255, 200, 100, 0.2)
                    `,
                  }}
                >
                  <span onClick={(e) => { e.stopPropagation(); goPrevMonth(); }} style={{ cursor: 'pointer', color: '#FFE4B5' }}>←</span>
                  <span style={{ color: "#D4AF37" }}>{monthLabel}</span>
                  <span onClick={(e) => { e.stopPropagation(); goNextMonth(); }} style={{ cursor: 'pointer', color: '#FFE4B5' }}>→</span>
                </button>

                {/* Year Button */}
                <button
                  onClick={openDatePicker}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold transition-all hover:scale-105 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                    border: "2.5px solid rgba(255, 140, 50, 0.7)",
                    color: "#FFE4B5",
                    boxShadow: `
                      0 0 20px rgba(255, 140, 50, 0.6),
                      0 0 40px rgba(255, 100, 30, 0.4),
                      inset 0 0 15px rgba(255, 200, 100, 0.2)
                    `,
                  }}
                >
                  <span style={{ color: "#D4AF37" }}>📅</span>
                  <span>{year}</span>
                </button>
              </div>

              {/* YearSelectorPopup - replaces inline date picker */}
              {showDatePicker && (
                <YearSelectorPopup
                  isOpen={showDatePicker}
                  onClose={handleDatePickerCancel}
                  onConfirm={handleDatePickerOk}
                  initialYear={tempYear}
                  initialMonth={tempMonth}
                  initialDay={tempDay}
                  language={language}
                  translations={t}
                  onSpeak={handleDateClickSpeech}
                />
              )}

              <CalendarGrid
                days={days}
                selectedDate={selectedDay}
                onSelect={handleMainDateSelect}
                onSpeak={handleDateClickSpeech}
                language={language}
                translations={t}
                voiceEnabled={voiceEnabled}
              />
            </section>

            {/* RIGHT SIDEBAR - DayDetails only */}
            <section
              className="rounded-xl sm:rounded-2xl p-3 backdrop-blur-md"
              style={{
                background: "var(--calendar-orange-shell)",
                border: "3px solid rgba(255, 140, 50, 0.8)",
                boxShadow: `
                  0 0 35px rgba(255, 140, 50, 0.8),
                  0 0 70px rgba(255, 100, 30, 0.6),
                  0 0 105px rgba(255, 80, 20, 0.4),
                  inset 0 0 30px rgba(255, 140, 50, 0.2)
                `,
              }}
            >
              {/* PANCHANG ELEMENTS AND INAUSPICIOUS TIMINGS */}
              <DayDetails
                day={selectedDayWithLocalData}
                language={language}
                translations={t}
                isSidebarMode={true}
                voiceEnabled={voiceEnabled}
                initialAlarmPopupOpen={openAlarmPopupOnLoad}
              />
            </section>
          </div>
        )}
      </main>

      {/* ASTROLOGY NAV BUTTON */}
      <Link
        to="/astrology"
        aria-label="Open astrology pages"
        title="Astrology (Panchang / Kundali / Matchmaking / Muhurat)"
        className="fixed z-40 inline-flex items-center justify-center rounded-full h-12 w-12 sm:h-14 sm:w-14 backdrop-blur-md"
        style={{
          right: "1rem",
          bottom: "5.25rem",
          background:
            "linear-gradient(145deg, rgba(255, 210, 155, 0.18) 0%, rgba(255, 150, 80, 0.12) 55%, rgba(255, 120, 45, 0.16) 100%)",
          border: "2px solid rgba(255, 226, 176, 0.65)",
          boxShadow:
            "0 12px 28px rgba(0, 0, 0, 0.35), 0 0 26px rgba(255, 145, 65, 0.3), inset 0 1px 8px rgba(255, 250, 240, 0.18)",
        }}
      >
        <span
          className="inline-flex items-center justify-center rounded-full h-8 w-8 sm:h-9 sm:w-9"
          style={{
            background:
              "linear-gradient(145deg, rgba(255, 176, 102, 0.32) 0%, rgba(255, 122, 55, 0.26) 100%)",
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

      {/* FOOTER */}
      <footer
        className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-3 sm:pb-5 text-center"
        style={{
          textShadow: "0 2px 6px rgba(0, 0, 0, 0.6)",
        }}
      >
        <span
          className="inline-block text-sm sm:text-base md:text-lg font-black tracking-[0.08em]"
          style={{
            position: "relative",
            paddingBottom: "2px",
          }}
        >
          <span
            style={{
              background:
                "linear-gradient(135deg, #fff1bf 0%, #ffd678 25%, #ffb347 50%, #ff8c2f 75%, #ffd89a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter:
                "drop-shadow(0 0 8px rgba(255, 190, 90, 0.55)) drop-shadow(0 0 14px rgba(255, 120, 35, 0.45))",
            }}
          >
            {shubhamasthuByLang[language] || "Shubhamasthu"}
          </span>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "0",
              right: "0",
              bottom: "0",
              height: "2px",
              borderRadius: "2px",
              background: "linear-gradient(90deg, rgba(255, 190, 110, 0) 0%, rgba(255, 190, 110, 0.95) 50%, rgba(255, 190, 110, 0) 100%)",
              boxShadow: "0 0 10px rgba(255, 165, 80, 0.6)",
            }}
          />
        </span>
      </footer>

      {/* GLOBAL STYLES */}
      <style>{`
        @keyframes sparkle {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }

        /* Smooth transitions for all interactive elements */
        button, select {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        button:hover, select:hover {
          filter: brightness(1.15);
        }

        button:active {
          transform: scale(0.95);
        }

        /* Hide scrollbar for date picker columns */
        div::-webkit-scrollbar {
          display: none;
        }

        /* Scrollbar styling for main content */
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(74, 21, 8, 0.3);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(255, 140, 50, 0.7) 0%, rgba(255, 100, 30, 0.9) 100%);
          border-radius: 10px;
          border: 2px solid rgba(74, 21, 8, 0.3);
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(255, 140, 50, 0.9) 0%, rgba(255, 100, 30, 1) 100%);
        }
      `}</style>
    </div>
  );
}

export default App;

