import { useEffect, useState } from "react";
import { getCurrentRashi, getRashiText, RASHI_NAMES, RASHIPHALALU_DATA, RASHIS } from "../data/rashiphalalu";

// Period labels in all languages - shorter terms for one-line display
const PERIOD_LABELS = {
  daily: {
    en: "Today",
    te: "ఈరోజు",
    hi: "आज",
    ml: "ഇന്ന്",
    kn: "ಇಂದು",
    ta: "இன்று"
  },
  weekly: {
    en: "Week",
    te: "వారం",
    hi: "सप्ताह",
    ml: "ആഴ്ച",
    kn: "ವಾರ",
    ta: "வாரம்"
  },
  monthly: {
    en: "Month",
    te: "నెల",
    hi: "महीना",
    ml: "മാസം",
    kn: "ತಿಂಗಳು",
    ta: "மாதம்"
  },
  yearly: {
    en: "Year",
    te: "సంవత్సరం",
    hi: "साल",
    ml: "വർഷം",
    kn: "ವರ್ಷ",
    ta: "ஆண்டு"
  }
};

// Stat labels in all languages
const STAT_LABELS = {
  health: { en: "Health", te: "ఆరోగ్యం", hi: "स्वास्थ्य", ml: "ആരോഗ്യം", kn: "ಆರೋಗ್ಯ", ta: "ஆரோக்கியம்" },
  wealth: { en: "Wealth", te: "సంపద", hi: "संपत्ति", ml: "സമ്പത്ത്", kn: "ಸಂಪದ", ta: "செல்வம்" },
  family: { en: "Family", te: "కుటుంబం", hi: "परिवार", ml: "കുടുംബം", kn: "ಕುಟುಂಬ", ta: "குடும்பம்" },
  love: { en: "Love", te: "ప్రేమ", hi: "प्रेम", ml: "പ്രണയം", kn: "ಪ್ರೀತಿ", ta: "காதல்" },
  career: { en: "Career", te: "వృత్తి", hi: "करियर", ml: "കരിയറി", kn: "ವೃತ್ತಿ", ta: "தொழில்" }
};

// Lucky colors label in all languages
const LUCKY_COLORS_LABELS = {
  en: "Lucky Colors",
  te: "అదృష్ట రంగులు",
  hi: "भाग्यशाली रंग",
  ml: "അദൃഷ്ട നിറങ്ങൾ",
  kn: "ಅದೃಷ್ಟ ಬಣ್ಣಗಳು",
  ta: "அதிர்ஷ்ட நிறங்கள்"
};

// Rashiphalalu title in all languages
const RASHIPHALALU_TITLE = {
  en: "Daily Horoscope",
  te: "రాశిఫలాలు",
  hi: "दैनिक राशिफल",
  ml: "ദൈനംദിന രാശിഫലം",
  kn: "ದೈನಂದಿನ ರಾಶಿಫಲ",
  ta: "தின ராஶிபலம்"
};

const PERIOD_TYPES = {
  daily: { key: 'daily' },
  weekly: { key: 'weekly' },
  monthly: { key: 'monthly' },
  yearly: { key: 'yearly' },
};

function Rashiphalalu({ language, translations: t, onBack, selectedRashi, setSelectedRashi, rashiStateKey, isInline }) {
  const [selectedPeriod, setSelectedPeriod] = useState('daily');
  const [currentRashi, setCurrentRashi] = useState(null);
  const [rashiphalaluData, setRashiphalaluData] = useState(null);

  // Get current rashi based on date
  useEffect(() => {
    const today = new Date();
    const rashi = getCurrentRashi(today);
    setCurrentRashi(rashi);
    // Set selected rashi to current rashi on mount if not provided
    if (!selectedRashi) {
      const foundRashi = RASHIS.find(r => r.id === rashi);
      if (foundRashi) {
        setSelectedRashi(foundRashi);
      } else {
        setSelectedRashi(RASHIS[0]);
      }
    }
  }, []);

  // Persist selected rashi to sessionStorage
  useEffect(() => {
    if (selectedRashi && rashiStateKey) {
      sessionStorage.setItem(rashiStateKey, JSON.stringify(selectedRashi));
    }
  }, [selectedRashi, rashiStateKey]);

  // Get rashiphalalu data when rashi or period changes
  useEffect(() => {
    if (!selectedRashi) return;

    const today = new Date();
    const data = RASHIPHALALU_DATA[selectedRashi.id];

    if (!data) {
      setRashiphalaluData(null);
      return;
    }

    const periodData = data[selectedPeriod];
    if (!periodData) {
      setRashiphalaluData(null);
      return;
    }

    // Get translated text
    const text = getRashiText(selectedRashi.id, selectedPeriod, today, language);

    // Get translated colors
    const colors = periodData.colors?.translations?.[language] || periodData.colors?.en || periodData.colors || [];

    setRashiphalaluData({
      text,
      colors,
      stats: periodData.stats,
      name: RASHI_NAMES[selectedRashi.id]?.[language] || RASHI_NAMES[selectedRashi.id]?.en || selectedRashi.name
    });
  }, [selectedRashi, selectedPeriod, language]);

  // Get localized stat label
  const getStatLabel = (key) => {
    return STAT_LABELS[key]?.[language] || STAT_LABELS[key]?.en || key;
  };

  // Get localized period label
  const getPeriodLabel = (key) => {
    return PERIOD_LABELS[key]?.[language] || PERIOD_LABELS[key]?.en || key;
  };

  // Get localized lucky colors label
  const getLuckyColorsLabel = () => {
    return LUCKY_COLORS_LABELS[language] || LUCKY_COLORS_LABELS.en || "Lucky Colors";
  };

  if (!selectedRashi || !rashiphalaluData) {
    return (
      <div
        className={isInline ? "flex items-center justify-center p-8" : "min-h-screen flex items-center justify-center"}
        style={{
          background: "linear-gradient(180deg, #FF8C32 0%, #FF6347 20%, #FF4560 40%, #E63946 60%, #D32F2F 80%, #B71C1C 100%)"
        }}
      >
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={isInline ? "overflow-x-hidden pb-4" : "min-h-screen overflow-x-hidden"}
      style={{
        background: "linear-gradient(180deg, #FF8C32 0%, #FF6347 20%, #FF4560 40%, #E63946 60%, #D32F2F 80%, #B71C1C 100%)",
        position: "relative",
      }}
    >
      {/* Header */}
      <header className="relative z-40 py-2 px-3">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-3">
            {/* Back Button */}
            {!isInline && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-all hover:scale-105 cursor-pointer whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                  border: "2px solid rgba(255, 140, 50, 0.7)",
                  color: "#FFE4B5",
                  boxShadow: `
                    0 0 10px rgba(255, 140, 50, 0.6),
                    inset 0 0 6px rgba(255, 200, 100, 0.2)
                  `,
                }}
              >
                ← {t?.back || "Back"}
              </button>
            )}

            {/* Title */}
            <h1
              className="font-black tracking-tight text-center flex-1"
              style={{
                color: "#FFFFFF",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.6)",
                fontSize: "clamp(1rem, 3vw, 1.4rem)",
                fontWeight: "900",
              }}
            >
              {RASHIPHALALU_TITLE[language] || RASHIPHALALU_TITLE.en || "Daily Horoscope"}
            </h1>

            {/* Selected Rashi Name */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold whitespace-nowrap"
              style={{
                background: "linear-gradient(135deg, rgba(180, 130, 50, 0.5) 0%, rgba(140, 100, 40, 0.6) 100%)",
                border: "2px solid rgba(255, 140, 50, 0.7)",
                color: "#FFE4B5",
              }}
            >
              <span>{rashiphalaluData.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-5xl px-2 py-2 space-y-3">
        {/* Rashi Selection Grid - Moved above details */}
        <div
          className="rounded-2xl sm:rounded-3xl p-5 backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(80, 20, 10, 0.98) 0%, rgba(100, 25, 12, 0.95) 50%, rgba(120, 30, 15, 0.92) 100%)",
            border: "4px solid rgba(255, 140, 50, 0.8)",
            boxShadow: `
              0 0 25px rgba(255, 140, 50, 0.8),
              0 0 50px rgba(255, 100, 30, 0.6),
              inset 0 0 20px rgba(255, 140, 50, 0.2)
            `,
          }
          }
        >
          <h3
            className="font-bold text-lg mb-3 text-center"
            style={{
              color: "#FFFFFF",
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
            }}
          >
            {t?.selectRashi || "Select Your Rashi"}
          </h3>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {RASHIS.map((rashi) => (
              <button
                key={rashi.id}
                onClick={() => setSelectedRashi(rashi)}
                className={`rounded-xl p-3 transition-all hover:scale-105 ${selectedRashi.id === rashi.id ? "ring-2 ring-offset-2 ring-offset-transparent" : ""
                  }`}
                style={{
                  background: selectedRashi.id === rashi.id
                    ? "linear-gradient(135deg, rgba(255, 140, 50, 0.7) 0%, rgba(255, 100, 30, 0.8) 100%)"
                    : "linear-gradient(135deg, rgba(80, 20, 10, 0.9) 0%, rgba(100, 25, 12, 0.85) 100%)",
                  border: selectedRashi.id === rashi.id
                    ? "2.5px solid rgba(255, 140, 50, 0.9)"
                    : "2px solid rgba(255, 140, 50, 0.4)",
                  boxShadow: selectedRashi.id === rashi.id
                    ? `
                      0 0 20px rgba(255, 140, 50, 0.8),
                      0 0 40px rgba(255, 100, 30, 0.6),
                      inset 0 0 10px rgba(255, 200, 100, 0.2)
                    `
                    : "none",
                  color: selectedRashi.id === rashi.id ? "#FFFFFF" : "#FFE4B5",
                }}
              >
                <div className="text-2xl mb-1.5">{rashi.icon}</div>
                <div className="text-sm font-bold truncate">
                  {RASHI_NAMES[rashi.id]?.[language] || rashi.name}
                </div>
              </button>
            ))}
          </div>
        </div >

        {/* Period Selector */}
        < div
          className="rounded-xl sm:rounded-2xl p-3 backdrop-blur-md"
          style={{
            background: "linear-gradient(135deg, rgba(80, 20, 10, 0.95) 0%, rgba(100, 25, 12, 0.9) 100%)",
            border: "3px solid rgba(255, 140, 50, 0.6)",
          }}
        >
          <div className="flex flex-nowrap gap-2">
            {Object.values(PERIOD_TYPES).map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-[clamp(0.72rem,2.2vw,1rem)] font-bold transition-all ${selectedPeriod === period.key ? "scale-[1.02]" : "hover:scale-[1.01]"
                  }`}
                style={{
                  background: selectedPeriod === period.key
                    ? "linear-gradient(135deg, rgba(255, 140, 50, 0.85) 0%, rgba(255, 100, 30, 0.95) 100%)"
                    : "transparent",
                  border: selectedPeriod === period.key
                    ? "2px solid rgba(255, 140, 50, 0.9)"
                    : "2px solid transparent",
                  color: selectedPeriod === period.key ? "#FFFFFF" : "#FFE4B5",
                  boxShadow: selectedPeriod === period.key
                    ? "0 0 15px rgba(255, 140, 50, 0.5)"
                    : "none",
                }}
              >
                {getPeriodLabel(period.key)}
              </button>
            ))}
          </div>
        </div >

        {/* Selected Rashi Display - Now below selector */}
        < div
          className="rounded-2xl sm:rounded-3xl p-6 backdrop-blur-md -mt-3"
          style={{
            background: "linear-gradient(135deg, rgba(80, 20, 10, 0.98) 0%, rgba(100, 25, 12, 0.95) 50%, rgba(120, 30, 15, 0.92) 100%)",
            border: "4px solid rgba(255, 140, 50, 0.8)",
            boxShadow: `
              0 0 25px rgba(255, 140, 50, 0.8),
              0 0 50px rgba(255, 100, 30, 0.6),
              inset 0 0 20px rgba(255, 140, 50, 0.2)
            `,
          }}
        >
          <div className="flex flex-col items-center">
            {/* Rashi Icon */}
            <div
              className="inline-flex items-center justify-center h-20 w-20 rounded-full mb-4"
              style={{
                background: "linear-gradient(135deg, #1a0a05 0%, #2d1208 50%, #401a0c 100%)",
                border: "4px solid #ff8c32",
                boxShadow: `
                  0 0 25px rgba(255, 140, 50, 1),
                  0 0 50px rgba(255, 100, 30, 0.8),
                  inset 0 0 15px rgba(255, 140, 50, 0.3)
                `,
              }}
            >
              <span className="text-4xl">{selectedRashi.icon}</span>
            </div>

            {/* Selected Rashi Name */}
            <h2
              className="font-black text-2xl"
              style={{
                color: "#FFFFFF",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 140, 50, 0.4)",
              }}
            >
              {rashiphalaluData.name}
            </h2>
          </div>

          {/* Rashiphalalu Details */}
          <div className="mt-5 space-y-4">
            {/* Text */}
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(80, 20, 10, 0.8)",
                border: "2px solid rgba(255, 140, 50, 0.5)",
              }}
            >
              <p
                className="text-lg sm:text-xl leading-relaxed"
                style={{ color: "#FFE4B5" }}
              >
                {rashiphalaluData.text}
              </p>
            </div>

            {/* Lucky Colors */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(80, 20, 10, 0.8)",
                border: "2px solid rgba(255, 140, 50, 0.5)",
              }}
            >
              <h3
                className="font-bold text-lg mb-2.5"
                style={{ color: "#D4AF37" }}
              >
                {getLuckyColorsLabel()}
              </h3>
              <div className="flex gap-2.5 flex-wrap">
                {rashiphalaluData.colors?.map((color, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold"
                    style={{
                      background: "rgba(255, 140, 50, 0.3)",
                      border: "1.5px solid rgba(255, 140, 50, 0.6)",
                      color: "#FFE4B5",
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{
                        background: color.toLowerCase().replace(' ', ''),
                        display: 'inline-block',
                        minWidth: '12px',
                        minHeight: '12px'
                      }}
                    ></span>
                    {color}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats - 2 columns to prevent overflow */}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(rashiphalaluData.stats || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl p-3.5 text-center"
                  style={{
                    background: "rgba(80, 20, 10, 0.8)",
                    border: "2px solid rgba(255, 140, 50, 0.5)",
                  }}
                >
                  <h4
                    className="font-bold text-sm mb-2"
                    style={{ color: "#D4AF37" }}
                  >
                    {getStatLabel(key)}
                  </h4>
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex-1 h-2.5 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${value}%`,
                          background: `linear-gradient(90deg, rgba(255, 140, 50, 0.8), rgba(255, 100, 30, 0.9))`,
                        }}
                      />
                    </div>
                    <span className="text-base font-bold" style={{ color: "#FFFFFF" }}>
                      {value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div >
      </main >

      {/* Global Styles */}
      < style > {`
        @keyframes sparkle {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style >
    </div >
  );
}

export default Rashiphalalu;
