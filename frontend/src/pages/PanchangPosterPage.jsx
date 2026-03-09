import { useEffect, useMemo, useRef, useState } from "react";
import { buildIsoDatetime, findActiveByTime, safeDateFromIso, ymdToday } from "../astrology/components/formatters";
import { getProkeralaPanchang } from "../services/astrologyApi";
import { translations } from "../translations";
import { getAstroDefaults } from "../utils/appSettings";
import { useLanguage } from "../hooks/useLanguage";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return String(value?.name ?? value?.vedic_name ?? value?.title ?? value?.value ?? value?.label ?? "").trim();
  }
  return "";
}

function firstText(...values) {
  for (const value of values) {
    const text = textOf(value);
    if (text) return text;
  }
  return "";
}

export default function PanchangPosterPage() {
  const { language } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const [panchang, setPanchang] = useState(null);
  const [error, setError] = useState("");
  const languageRef = useRef(language);
  const abortRef = useRef(null);

  const defaults = useMemo(() => getAstroDefaults(), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

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

        if (languageRef.current === currentLang) {
          setPanchang(payload?.data || payload || null);
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        setPanchang(null);
        setError(e?.message || "Failed to load Panchang");
      }
    };

    const timeout = setTimeout(run, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [now.getMinutes(), language, defaults]);

  const t = translations[language] || translations.en;
  const translateTerm = (raw) => {
    if (!raw) return "--";
    const s = String(raw).trim();
    return t[s] || t[s.split(" ")[0]] || s;
  };

  const details = useMemo(() => {
    if (!panchang) {
      return {
        tithi: "--",
        nakshatra: "--",
        yoga: "--",
        karana: "--",
        paksha: "--",
        yearname: "--",
      };
    }

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
    const activeKarana = findActiveByTime(panchang?.karana, refDate);

    const pakshaRaw = firstText(activeTithi?.paksha, panchang?.paksha, panchang?.advanced?.paksha);
    const samvatsaraRaw = firstText(
      panchang?.samvatsara?.name,
      panchang?.samvatsara,
      panchang?.advanced?.samvatsara?.name,
      panchang?.advanced?.samvatsara
    );

    return {
      tithi: translateTerm(firstText(activeTithi?.name)),
      nakshatra: translateTerm(firstText(activeNakshatra?.name)),
      yoga: translateTerm(firstText(activeYoga?.name)),
      karana: translateTerm(firstText(activeKarana?.name)),
      paksha: translateTerm(pakshaRaw),
      yearname: translateTerm(String(samvatsaraRaw || "").replace(/^\d+\s*/, "")),
    };
  }, [panchang, now, defaults.tzOffset, t]);

  const dateText = useMemo(
    () => now.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" }),
    [now]
  );

  return (
    <div className="min-h-screen bg-[#120502] p-4 md:p-6 flex items-center justify-center">
      <div
        className="relative w-full max-w-[720px] aspect-[2/3] bg-center bg-cover rounded-lg overflow-hidden shadow-[0_35px_90px_rgba(0,0,0,0.65)]"
        style={{ backgroundImage: "url('/panchang-bg.jpg.png')" }}
      >
        <div className="absolute left-1/2 -translate-x-1/2 top-[24.2%] w-[63%] text-[#4b160f] [text-shadow:0_1px_0_rgba(255,232,210,0.16)]">
          <PosterRow label="Date" value={dateText} />
          <PosterRow label="Tithi" value={details.tithi} />
          <PosterRow label="Nakshatra" value={details.nakshatra} />
          <PosterRow label="Yoga" value={details.yoga} />
          <PosterRow label="Karana" value={details.karana} />
          <PosterRow label="Paksha" value={details.paksha} />
          <PosterRow label="Year Name" value={details.yearname} noBorder />

          {error ? (
            <div className="mt-3 text-center text-xs text-[#ffd1b0]">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PosterRow({ label, value, noBorder = false }) {
  return (
    <div
      className="grid grid-cols-[0.95fr_1.25fr] items-baseline py-[1.85%] text-[clamp(0.9rem,1.9vw,1.55rem)]"
      style={{ borderBottom: noBorder ? "none" : "1px solid rgba(151,79,58,0.45)" }}
    >
      <div className="text-right pr-[6.5%] font-semibold text-[#4a170f]">{label}</div>
      <div className="text-left font-bold text-[#551b11]">{value || "--"}</div>
    </div>
  );
}
