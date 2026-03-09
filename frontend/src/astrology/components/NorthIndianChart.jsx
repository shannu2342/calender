const SIGN_ABBR = {
  1: "Ari",
  2: "Tau",
  3: "Gem",
  4: "Can",
  5: "Leo",
  6: "Vir",
  7: "Lib",
  8: "Sco",
  9: "Sag",
  10: "Cap",
  11: "Aqu",
  12: "Pis",
};

const RASHI_TO_INDEX = new Map([
  ["mesha", 1],
  ["aries", 1],
  ["vrishabha", 2],
  ["taurus", 2],
  ["mithuna", 3],
  ["gemini", 3],
  ["karka", 4],
  ["cancer", 4],
  ["simha", 5],
  ["leo", 5],
  ["kanya", 6],
  ["virgo", 6],
  ["tula", 7],
  ["libra", 7],
  ["vrischika", 8],
  ["scorpio", 8],
  ["dhanus", 9],
  ["sagittarius", 9],
  ["makara", 10],
  ["capricorn", 10],
  ["kumbha", 11],
  ["aquarius", 11],
  ["meena", 12],
  ["pisces", 12],
]);

const PLANET_ABBR = new Map([
  ["surya", "Su"],
  ["sun", "Su"],
  ["chandra", "Mo"],
  ["moon", "Mo"],
  ["budh", "Me"],
  ["budha", "Me"],
  ["mercury", "Me"],
  ["shukra", "Ve"],
  ["venus", "Ve"],
  ["mangal", "Ma"],
  ["mars", "Ma"],
  ["brihaspati", "Ju"],
  ["guru", "Ju"],
  ["jupiter", "Ju"],
  ["shani", "Sa"],
  ["saturn", "Sa"],
  ["rahu", "Ra"],
  ["ketu", "Ke"],
  ["lagna", "La"],
  ["ascendant", "La"],
]);

function normKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

function rashiIndex(name) {
  const k = normKey(name);
  return RASHI_TO_INDEX.get(k) || null;
}

function planetAbbr(name) {
  const k = normKey(name);
  return PLANET_ABBR.get(k) || String(name || "-").slice(0, 2);
}

function buildHouses({ lagnaSignIndex, planets }) {
  const houses = Array.from({ length: 12 }, (_, i) => ({
    house: i + 1,
    signIndex: ((lagnaSignIndex + i - 1) % 12) + 1,
    planets: [],
  }));

  for (const p of planets || []) {
    const pName = p?.name;
    if (!pName) continue;
    if (/lagna|ascendant/i.test(String(pName))) continue;
    const signIdx = rashiIndex(p?.rashi);
    if (!signIdx) continue;
    const houseNo = ((signIdx - lagnaSignIndex + 12) % 12) + 1;
    houses[houseNo - 1].planets.push(planetAbbr(pName));
  }

  houses.forEach((h) => {
    h.planets = Array.from(new Set(h.planets));
  });

  return houses;
}

// Simple North-Indian chart layout (SVG) with house sign labels and planet abbreviations.
// This is a best-effort renderer derived from Lagna + planet rashi positions.
export default function NorthIndianChart({ lagnaRashi, planets = [] }) {
  const lagnaIdx = rashiIndex(lagnaRashi);
  if (!lagnaIdx) return null;

  const houses = buildHouses({ lagnaSignIndex: lagnaIdx, planets });

  const labelPos = {
    1: { x: 200, y: 200 },
    2: { x: 200, y: 45 },
    3: { x: 110, y: 70 },
    4: { x: 45, y: 140 },
    5: { x: 70, y: 250 },
    6: { x: 45, y: 355 },
    7: { x: 200, y: 372 },
    8: { x: 355, y: 355 },
    9: { x: 330, y: 250 },
    10: { x: 355, y: 140 },
    11: { x: 290, y: 70 },
    12: { x: 200, y: 325 },
  };

  const houseToSignLabel = (houseNo) => {
    const signIndex = ((lagnaIdx + houseNo - 2) % 12) + 1;
    return `${signIndex} ${SIGN_ABBR[signIndex] || ""}`.trim();
  };

  const textColor = "rgba(255, 226, 176, 0.95)";
  const lineColor = "rgba(255, 226, 176, 0.35)";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-1 sm:p-2">
      <div className="mx-auto w-full" style={{ maxWidth: "100%" }}>
        <svg viewBox="0 0 400 400" className="block w-full h-auto">
        {/* Outer square */}
        <rect x="20" y="20" width="360" height="360" fill="none" stroke={lineColor} strokeWidth="2" />

        {/* Diamond + diagonals */}
        <path
          d="M200 20 L380 200 L200 380 L20 200 Z M20 20 L380 380 M380 20 L20 380"
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
        />

        {/* Inner lines to make the classic 12-house grid */}
        <path
          d="M200 20 L200 380 M20 200 L380 200 M110 110 L290 290 M290 110 L110 290"
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
        />

        {/* Center label */}
        <text x="200" y="205" textAnchor="middle" fontSize="16" fill={textColor} fontWeight="700">
          Lagna
        </text>

        {/* House labels + planet abbreviations */}
        {houses.map((h) => {
          const houseNo = h.house;
          const lp = labelPos[houseNo] || { x: 200, y: 200 };
          const body = h.planets.join(" ");
          return (
            <g key={houseNo}>
              <text x={lp.x} y={lp.y} textAnchor="middle" fontSize="10" fill="rgba(255,226,176,0.7)">
                {houseToSignLabel(houseNo)}
              </text>
              {body ? (
                <text
                  x={lp.x}
                  y={lp.y + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={textColor}
                  fontWeight="700"
                >
                  {body}
                </text>
              ) : null}
            </g>
          );
        })}
        </svg>
      </div>
    </div>
  );
}
