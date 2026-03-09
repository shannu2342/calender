const TITHI_INDEX = {
  pratipada: 1,
  prathama: 1,
  padyami: 1,
  padya: 1,
  dwitiya: 2,
  dvitiiya: 2,
  dvitiya: 2,
  vidiya: 2,
  tritiya: 3,
  tadia: 3,
  chaturthi: 4,
  chavithi: 4,
  panchami: 5,
  shashthi: 6,
  shasti: 6,
  sashti: 6,
  sasthi: 6,
  saptami: 7,
  ashtami: 8,
  navami: 9,
  dashami: 10,
  ekadashi: 11,
  dwadashi: 12,
  dvadashi: 12,
  trayodashi: 13,
  chaturdashi: 14,
  purnima: 15,
  poornima: 15,
  pournami: 15,
  amavasya: 15,
  amavasi: 15,
};

function cleanWord(text) {
  return String(text || "")
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function extractTithiIndex(day) {
  const tithiName = cleanWord(day?.Tithi);
  const mapped = TITHI_INDEX[tithiName];
  if (mapped) return mapped;

  const raw = String(day?.Tithi || "");
  const match = raw.match(/(\d{1,2})(?:\s*\/\s*\d{1,2})?/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 1 && n <= 15 ? n : null;
}

function getMoonPhase(day) {
  const tithiName = cleanWord(day?.Tithi);
  const pakshaText = String(day?.Paksha || "").toLowerCase();
  const idx = extractTithiIndex(day);
  const isShukla = pakshaText.includes("shukla");
  const isKrishna = pakshaText.includes("krishna");

  if (!idx || (!isShukla && !isKrishna)) {
    if (tithiName === "purnima" || tithiName === "poornima" || tithiName === "pournami") {
      return { illumination: 1, waxing: true, size: 18 };
    }
    if (tithiName === "amavasya" || tithiName === "amavasi") {
      return { illumination: 0, waxing: false, size: 11 };
    }
    return { illumination: 0.2, waxing: false, size: 12 };
  }

  // Keep moon size fixed; only phase (illumination) changes.
  // Shukla: grows 1 -> 15. Krishna: shrinks 16 -> 30.
  const illumination = isShukla ? idx / 15 : (16 - idx) / 15;
  const size = Math.round(11 + illumination * 7); // grows toward Purnima

  if (isShukla) {
    return { illumination, waxing: true, size };
  }

  return { illumination, waxing: false, size };
}

function getLunarDayNumber(day) {
  const tithiName = cleanWord(day?.Tithi);
  const pakshaText = String(day?.Paksha || "").toLowerCase();
  const idx = TITHI_INDEX[tithiName];
  if (!idx) return "";

  const isShukla = pakshaText.includes("shukla");
  const isKrishna = pakshaText.includes("krishna");
  if (isShukla) return String(idx);
  if (isKrishna) return String(idx + 15);

  if (tithiName === "purnima" || tithiName === "poornima" || tithiName === "pournami") return "15";
  if (tithiName === "amavasya" || tithiName === "amavasi") return "30";
  return "";
}

function moonStyles(moon, px) {
  // Monotonic phase progression for consistent dark/white transition day-to-day.
  const visible = Math.max(0, Math.min(1, moon.illumination));
  const offset = visible * px * 0.92;
  // Requested orientation: dark side should appear on the left.
  const transform = moon.waxing ? `translateX(${offset}px)` : `translateX(-${offset}px)`;
  const isNearNewMoon = moon.illumination <= 0.06;
  const isLowIllumination = moon.illumination <= 0.2;
  const shellShadow = isNearNewMoon
    ? "0 1px 2px rgba(0,0,0,0.6)"
    : isLowIllumination
      ? "0 1px 2px rgba(0,0,0,0.5)"
      : "0 1px 2px rgba(0,0,0,0.45)";
  return {
    shell: {
      width: `${px}px`,
      height: `${px}px`,
      border: "none",
      boxShadow: shellShadow,
      background: isNearNewMoon
        ? "radial-gradient(circle at 45% 35%, #2b2b2b 0%, #151515 58%, #050505 100%)"
        : isLowIllumination
          ? "radial-gradient(circle at 30% 28%, #cecece 0%, #a5a5a5 48%, #686868 76%, #2c2c2c 100%)"
          : "radial-gradient(circle at 30% 28%, #efefef 0%, #d3d3d3 50%, #9f9f9f 75%, #6f6f6f 100%)",
    },
    craters: {
      backgroundImage: `
        radial-gradient(circle at 24% 35%, rgba(90, 90, 90, 0.33) 0 8%, transparent 10%),
        radial-gradient(circle at 58% 22%, rgba(80, 80, 80, 0.3) 0 7%, transparent 9%),
        radial-gradient(circle at 52% 58%, rgba(70, 70, 70, 0.26) 0 9%, transparent 11%),
        radial-gradient(circle at 74% 72%, rgba(60, 60, 60, 0.22) 0 8%, transparent 10%)
      `,
      opacity: 0.5,
    },
    dark: {
      transform,
      background: "radial-gradient(circle at 45% 35%, #2f2f2f 0%, #151515 58%, #060606 100%)",
      opacity: moon.illumination >= 0.985 ? 0 : 1,
    },
  };
}

function lunarNumberTextStyle(strokeWidth) {
  return {
    color: "#FFD54A !important",
    WebkitTextFillColor: "#FFD54A !important",
    textFillColor: "#FFD54A !important",
    fill: "#FFD54A !important",
    fontWeight: 900,
    forcedColorAdjust: "none",
    mixBlendMode: "normal",
    isolation: "isolate",
    position: "relative",
    zIndex: 3,
  };
}

export default function CalendarGrid({
  days,
  selectedDate,
  onSelect,
  onSpeak,
  translations,
  voiceEnabled = false,
}) {
  const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split("/");
    return new Date(year, month - 1, day);
  };

  const firstDay = parseDate(days[0].date).getDay();

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(
    today.getMonth() + 1
  ).padStart(2, "0")}/${today.getFullYear()}`;

  const paddedDays = [...Array(firstDay).fill(null), ...days];

  return (
    <div
      className="relative rounded-2xl p-2 sm:p-4 neon-frame inner-bevel overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #ff4d0d 0%, #ff5c1a 10%, #ff6b28 20%, #ff7935 30%, #ff8743 40%, #ff7935 50%, #ff6b28 60%, #ff5c1a 70%, #ff4d0d 80%, #d94100 90%, #c23800 100%)",
        border: "2.5px solid rgba(255, 168, 67, 0.8)",
      }}
    >
      {/* Dense sparkle layer 1 - Small sparkles */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          backgroundImage: `
            radial-gradient(circle at 5% 8%, rgba(255, 255, 220, 0.8) 0.8px, transparent 1.2px),
            radial-gradient(circle at 12% 3%, rgba(255, 255, 200, 0.75) 0.7px, transparent 1.1px),
            radial-gradient(circle at 18% 12%, rgba(255, 245, 210, 0.7) 0.9px, transparent 1.3px),
            radial-gradient(circle at 25% 6%, rgba(255, 255, 220, 0.78) 0.8px, transparent 1.2px),
            radial-gradient(circle at 32% 15%, rgba(255, 245, 200, 0.72) 0.85px, transparent 1.25px),
            radial-gradient(circle at 38% 4%, rgba(255, 255, 210, 0.76) 0.75px, transparent 1.15px),
            radial-gradient(circle at 45% 10%, rgba(255, 245, 220, 0.8) 0.9px, transparent 1.3px),
            radial-gradient(circle at 52% 7%, rgba(255, 255, 200, 0.74) 0.8px, transparent 1.2px),
            radial-gradient(circle at 58% 14%, rgba(255, 245, 210, 0.77) 0.85px, transparent 1.25px),
            radial-gradient(circle at 65% 5%, rgba(255, 255, 220, 0.79) 0.7px, transparent 1.1px),
            radial-gradient(circle at 72% 11%, rgba(255, 245, 200, 0.73) 0.9px, transparent 1.3px),
            radial-gradient(circle at 78% 8%, rgba(255, 255, 210, 0.75) 0.75px, transparent 1.15px),
            radial-gradient(circle at 85% 13%, rgba(255, 245, 220, 0.78) 0.85px, transparent 1.25px),
            radial-gradient(circle at 92% 6%, rgba(255, 255, 200, 0.76) 0.8px, transparent 1.2px),
            radial-gradient(circle at 8% 22%, rgba(255, 245, 210, 0.74) 0.7px, transparent 1.1px),
            radial-gradient(circle at 15% 28%, rgba(255, 255, 220, 0.77) 0.9px, transparent 1.3px),
            radial-gradient(circle at 22% 18%, rgba(255, 245, 200, 0.71) 0.8px, transparent 1.2px),
            radial-gradient(circle at 28% 25%, rgba(255, 255, 210, 0.79) 0.85px, transparent 1.25px),
            radial-gradient(circle at 35% 20%, rgba(255, 245, 220, 0.75) 0.75px, transparent 1.15px),
            radial-gradient(circle at 42% 30%, rgba(255, 255, 200, 0.8) 0.9px, transparent 1.3px),
            radial-gradient(circle at 48% 23%, rgba(255, 245, 210, 0.73) 0.7px, transparent 1.1px),
            radial-gradient(circle at 55% 27%, rgba(255, 255, 220, 0.76) 0.85px, transparent 1.25px),
            radial-gradient(circle at 62% 19%, rgba(255, 245, 200, 0.78) 0.8px, transparent 1.2px),
            radial-gradient(circle at 68% 29%, rgba(255, 255, 210, 0.72) 0.75px, transparent 1.15px),
            radial-gradient(circle at 75% 24%, rgba(255, 245, 220, 0.77) 0.9px, transparent 1.3px),
            radial-gradient(circle at 82% 21%, rgba(255, 255, 200, 0.74) 0.8px, transparent 1.2px),
            radial-gradient(circle at 88% 26%, rgba(255, 245, 210, 0.79) 0.85px, transparent 1.25px),
            radial-gradient(circle at 95% 18%, rgba(255, 255, 220, 0.75) 0.7px, transparent 1.1px)
          `,
          backgroundSize: "100% 100%",
          mixBlendMode: "screen",
          opacity: 1,
        }}
      />

      {/* Dense sparkle layer 2 - Medium sparkles */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          backgroundImage: `
            radial-gradient(circle at 7% 38%, rgba(255, 255, 230, 0.75) 1px, transparent 1.5px),
            radial-gradient(circle at 14% 45%, rgba(255, 250, 210, 0.7) 0.9px, transparent 1.4px),
            radial-gradient(circle at 21% 35%, rgba(255, 255, 220, 0.72) 1.1px, transparent 1.6px),
            radial-gradient(circle at 28% 42%, rgba(255, 250, 200, 0.68) 0.95px, transparent 1.45px),
            radial-gradient(circle at 35% 48%, rgba(255, 255, 215, 0.74) 1.05px, transparent 1.55px),
            radial-gradient(circle at 42% 38%, rgba(255, 250, 225, 0.71) 0.9px, transparent 1.4px),
            radial-gradient(circle at 49% 44%, rgba(255, 255, 210, 0.76) 1.15px, transparent 1.65px),
            radial-gradient(circle at 56% 36%, rgba(255, 250, 220, 0.69) 1px, transparent 1.5px),
            radial-gradient(circle at 63% 46%, rgba(255, 255, 205, 0.73) 0.95px, transparent 1.45px),
            radial-gradient(circle at 70% 40%, rgba(255, 250, 215, 0.77) 1.1px, transparent 1.6px),
            radial-gradient(circle at 77% 43%, rgba(255, 255, 225, 0.7) 0.9px, transparent 1.4px),
            radial-gradient(circle at 84% 37%, rgba(255, 250, 210, 0.75) 1.05px, transparent 1.55px),
            radial-gradient(circle at 91% 45%, rgba(255, 255, 220, 0.72) 1px, transparent 1.5px),
            radial-gradient(circle at 10% 52%, rgba(255, 250, 200, 0.74) 0.95px, transparent 1.45px),
            radial-gradient(circle at 17% 58%, rgba(255, 255, 215, 0.71) 1.1px, transparent 1.6px),
            radial-gradient(circle at 24% 55%, rgba(255, 250, 225, 0.76) 0.9px, transparent 1.4px),
            radial-gradient(circle at 31% 60%, rgba(255, 255, 210, 0.69) 1.15px, transparent 1.65px),
            radial-gradient(circle at 38% 53%, rgba(255, 250, 220, 0.73) 1px, transparent 1.5px),
            radial-gradient(circle at 45% 57%, rgba(255, 255, 205, 0.77) 0.95px, transparent 1.45px),
            radial-gradient(circle at 52% 54%, rgba(255, 250, 215, 0.7) 1.1px, transparent 1.6px),
            radial-gradient(circle at 59% 61%, rgba(255, 255, 225, 0.75) 0.9px, transparent 1.4px),
            radial-gradient(circle at 66% 56%, rgba(255, 250, 210, 0.72) 1.05px, transparent 1.55px),
            radial-gradient(circle at 73% 59%, rgba(255, 255, 220, 0.74) 1px, transparent 1.5px),
            radial-gradient(circle at 80% 54%, rgba(255, 250, 200, 0.71) 0.95px, transparent 1.45px),
            radial-gradient(circle at 87% 58%, rgba(255, 255, 215, 0.76) 1.1px, transparent 1.6px)
          `,
          backgroundSize: "100% 100%",
          mixBlendMode: "screen",
          opacity: 0.95,
        }}
      />

      {/* Dense sparkle layer 3 - Lower area concentration */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          backgroundImage: `
            radial-gradient(circle at 6% 68%, rgba(255, 255, 235, 0.8) 1.2px, transparent 1.7px),
            radial-gradient(circle at 13% 75%, rgba(255, 250, 220, 0.75) 1.1px, transparent 1.6px),
            radial-gradient(circle at 20% 70%, rgba(255, 255, 225, 0.77) 1.3px, transparent 1.8px),
            radial-gradient(circle at 27% 78%, rgba(255, 250, 215, 0.72) 1.05px, transparent 1.55px),
            radial-gradient(circle at 34% 72%, rgba(255, 255, 230, 0.79) 1.2px, transparent 1.7px),
            radial-gradient(circle at 41% 76%, rgba(255, 250, 210, 0.74) 1.15px, transparent 1.65px),
            radial-gradient(circle at 48% 69%, rgba(255, 255, 220, 0.76) 1.1px, transparent 1.6px),
            radial-gradient(circle at 55% 74%, rgba(255, 250, 225, 0.78) 1.25px, transparent 1.75px),
            radial-gradient(circle at 62% 71%, rgba(255, 255, 215, 0.73) 1.05px, transparent 1.55px),
            radial-gradient(circle at 69% 77%, rgba(255, 250, 230, 0.8) 1.2px, transparent 1.7px),
            radial-gradient(circle at 76% 73%, rgba(255, 255, 210, 0.75) 1.15px, transparent 1.65px),
            radial-gradient(circle at 83% 79%, rgba(255, 250, 220, 0.77) 1.1px, transparent 1.6px),
            radial-gradient(circle at 90% 70%, rgba(255, 255, 225, 0.74) 1.3px, transparent 1.8px),
            radial-gradient(circle at 8% 85%, rgba(255, 250, 215, 0.79) 1.2px, transparent 1.7px),
            radial-gradient(circle at 15% 88%, rgba(255, 255, 230, 0.76) 1.05px, transparent 1.55px),
            radial-gradient(circle at 22% 82%, rgba(255, 250, 210, 0.78) 1.25px, transparent 1.75px),
            radial-gradient(circle at 29% 90%, rgba(255, 255, 220, 0.73) 1.15px, transparent 1.65px),
            radial-gradient(circle at 36% 84%, rgba(255, 250, 225, 0.8) 1.1px, transparent 1.6px),
            radial-gradient(circle at 43% 87%, rgba(255, 255, 215, 0.75) 1.2px, transparent 1.7px),
            radial-gradient(circle at 50% 81%, rgba(255, 250, 230, 0.77) 1.3px, transparent 1.8px),
            radial-gradient(circle at 57% 89%, rgba(255, 255, 210, 0.74) 1.05px, transparent 1.55px),
            radial-gradient(circle at 64% 83%, rgba(255, 250, 220, 0.79) 1.2px, transparent 1.7px),
            radial-gradient(circle at 71% 86%, rgba(255, 255, 225, 0.76) 1.15px, transparent 1.65px),
            radial-gradient(circle at 78% 80%, rgba(255, 250, 215, 0.78) 1.1px, transparent 1.6px),
            radial-gradient(circle at 85% 88%, rgba(255, 255, 230, 0.73) 1.25px, transparent 1.75px),
            radial-gradient(circle at 92% 84%, rgba(255, 250, 210, 0.8) 1.2px, transparent 1.7px)
          `,
          backgroundSize: "100% 100%",
          mixBlendMode: "screen",
          opacity: 1,
        }}
      />

      {/* Bright glow spots - creates depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          background: `
            radial-gradient(circle at 20% 30%, rgba(255, 240, 180, 0.25) 0%, transparent 15%),
            radial-gradient(circle at 70% 25%, rgba(255, 235, 170, 0.2) 0%, transparent 12%),
            radial-gradient(circle at 40% 60%, rgba(255, 245, 190, 0.22) 0%, transparent 14%),
            radial-gradient(circle at 80% 70%, rgba(255, 240, 180, 0.18) 0%, transparent 13%),
            radial-gradient(circle at 15% 80%, rgba(255, 235, 170, 0.24) 0%, transparent 16%)
          `,
          mixBlendMode: "screen",
        }}
      />

      {/* Animated twinkling stars */}
      <div
        className="pointer-events-none absolute inset-0 animate-pulse"
        style={{
          borderRadius: "inherit",
          backgroundImage: `
            radial-gradient(circle at 18% 15%, rgba(255, 255, 255, 0.6) 0.6px, transparent 1.2px),
            radial-gradient(circle at 52% 25%, rgba(255, 255, 255, 0.55) 0.7px, transparent 1.3px),
            radial-gradient(circle at 75% 40%, rgba(255, 255, 255, 0.58) 0.65px, transparent 1.25px),
            radial-gradient(circle at 35% 55%, rgba(255, 255, 255, 0.62) 0.75px, transparent 1.35px),
            radial-gradient(circle at 85% 65%, rgba(255, 255, 255, 0.57) 0.6px, transparent 1.2px),
            radial-gradient(circle at 25% 75%, rgba(255, 255, 255, 0.6) 0.7px, transparent 1.3px),
            radial-gradient(circle at 60% 82%, rgba(255, 255, 255, 0.59) 0.65px, transparent 1.25px),
            radial-gradient(circle at 90% 88%, rgba(255, 255, 255, 0.56) 0.75px, transparent 1.35px)
          `,
          backgroundSize: "100% 100%",
          mixBlendMode: "screen",
          animation: "sparkle 2.5s ease-in-out infinite",
        }}
      />

      <div className="relative">
        {/* Weekdays - UPDATED WITH DULL GREEN COLOR */}
        <div className="mb-3 grid grid-cols-7 gap-1 sm:gap-2">
          {translations.weekdaysShort.map((wd, idx) => (
            <div
              key={idx}
              className="text-xs sm:text-sm font-black tracking-[0.1em] uppercase text-center py-2.5 sm:py-3 rounded-xl inner-bevel"
              style={{
                color: "#c8ddc1",
                background:
                  "linear-gradient(135deg, rgba(80, 100, 70, 0.85) 0%, rgba(90, 110, 80, 0.9) 35%, rgba(100, 120, 90, 0.88) 65%, rgba(110, 130, 100, 0.92) 100%)",
                border: "2.5px solid rgba(100, 140, 80, 0.7)",
                boxShadow:
                  "0 0 20px rgba(100, 140, 80, 0.35), inset 0 1px 2px rgba(200, 221, 193, 0.15)",
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Days - All existing code preserved */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
          {paddedDays.map((day, idx) => {
            if (!day) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square w-full rounded-xl inner-bevel"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(80, 30, 20, 0.3) 0%, rgba(90, 35, 25, 0.25) 50%, rgba(100, 40, 30, 0.2) 100%)",
                    border: "2px solid rgba(100, 40, 30, 0.2)",
                  }}
                />
              );
            }

            const dayDate = parseDate(day.date);
            const dateNum = dayDate.getDate();

            const isToday = day.date === todayStr;
            const isSelected = selectedDate && day.date === selectedDate.date;
            const moon = getMoonPhase(day);
            const lunarDay = getLunarDayNumber(day);
            const mobileMoonPx = 20;
            const desktopMoonPx = 22;

            return (
              <button
                key={day.date}
                onClick={() => {
                  onSelect(day);
                  if (voiceEnabled && onSpeak) onSpeak(day);
                }}
                className="group relative flex aspect-square w-full flex-col overflow-hidden rounded-xl border-[2px] p-1 sm:border-[2.5px] sm:p-2.5 text-left transition-all duration-200"
                style={
                  (isSelected || isToday)
                    ? {
                        background:
                          "linear-gradient(135deg, #d4a847 0%, #c89f40 25%, #bc9639 50%, #b08d32 75%, #a4842b 100%)",
                        borderColor: "#e8c866",
                        boxShadow:
                          "0 0 25px rgba(232, 200, 102, 0.5), 0 8px 20px rgba(212, 168, 71, 0.3), inset 0 1px 3px rgba(255, 255, 255, 0.2), inset 0 -1px 2px rgba(0, 0, 0, 0.15)",
                      }
                    : {
                        background:
                          "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
                        borderColor: "#d4a847",
                        boxShadow:
                          "0 0 18px rgba(212, 168, 71, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 -1px 2px rgba(0, 0, 0, 0.2)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#e8c866";
                    e.currentTarget.style.boxShadow =
                      "0 0 22px rgba(232, 200, 102, 0.4), 0 6px 16px rgba(212, 168, 71, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.15)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#d4a847";
                    e.currentTarget.style.boxShadow =
                      "0 0 18px rgba(212, 168, 71, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 -1px 2px rgba(0, 0, 0, 0.2)";
                  }
                }}
              >
                {/* soft hover glow */}
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute -inset-12 bg-gradient-to-br from-yellow-300/10 via-amber-300/10 to-orange-300/10 blur-2xl" />
                </div>

                {/* Top */}
                <div className="relative flex items-start justify-end gap-0.5 sm:gap-1 mb-auto">
                  <div className="flex flex-col items-end gap-0.5 sm:gap-1 flex-shrink-0">
                    <span
                      className="absolute left-0.5 top-0.5 block overflow-hidden rounded-full sm:hidden"
                      style={moonStyles(moon, mobileMoonPx).shell}
                      title="moon-phase"
                    >
                      <span className="pointer-events-none absolute inset-0" style={moonStyles(moon, mobileMoonPx).craters} />
                      <span className="pointer-events-none absolute inset-0 rounded-full" style={moonStyles(moon, mobileMoonPx).dark} />
                      {lunarDay ? (
                        <span
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center leading-none font-black moon-phase-number ${
                            String(lunarDay).length >= 2 ? "text-[8px]" : "text-[9px]"
                          }`}
                          style={{ letterSpacing: String(lunarDay).length >= 2 ? "-0.15px" : "0" }}
                        >
                          <span
                            className="moon-phase-number"
                            style={{
                              ...lunarNumberTextStyle(0.75),
                            }}
                          >
                            {lunarDay}
                          </span>
                        </span>
                      ) : null}
                    </span>

                    <span
                      className="absolute left-0.5 top-0.5 hidden overflow-hidden rounded-full sm:block"
                      style={moonStyles(moon, desktopMoonPx).shell}
                      title="moon-phase"
                    >
                      <span className="pointer-events-none absolute inset-0" style={moonStyles(moon, desktopMoonPx).craters} />
                      <span className="pointer-events-none absolute inset-0 rounded-full" style={moonStyles(moon, desktopMoonPx).dark} />
                      {lunarDay ? (
                        <span
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center leading-none font-black moon-phase-number ${
                            String(lunarDay).length >= 2 ? "text-[9px]" : "text-[10px]"
                          }`}
                          style={{ letterSpacing: String(lunarDay).length >= 2 ? "-0.2px" : "0" }}
                        >
                          <span
                            className="moon-phase-number"
                            style={{
                              ...lunarNumberTextStyle(0.8),
                            }}
                          >
                            {lunarDay}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>

                {/* Bottom */}
                <div className="relative mt-auto flex items-end justify-end gap-1">
                  <div
                    className="text-[12px] sm:text-sm md:text-base font-normal leading-none"
                    style={{
                      color: (isSelected || isToday) ? "#3a2508" : "#ffedb3",
                      textShadow: (isSelected || isToday)
                        ? "0 1px 2px rgba(0,0,0,0.25)"
                        : "0 1px 2px rgba(0,0,0,0.35)",
                    }}
                  >
                    {dateNum}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}