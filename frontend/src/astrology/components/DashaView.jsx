import Accordion from "./Accordion";
import { isoParts, periodEnd, periodStart } from "./formatters";

const VEDIC_SHORT = new Map([
  ["sun", "Surya"],
  ["surya", "Surya"],
  ["moon", "Chandra"],
  ["chandra", "Chandra"],
  ["mercury", "Budh"],
  ["budh", "Budh"],
  ["budha", "Budh"],
  ["venus", "Shukra"],
  ["shukra", "Shukra"],
  ["mars", "Ku"],
  ["mangal", "Ku"],
  ["kuja", "Ku"],
  ["jupiter", "Guru"],
  ["guru", "Guru"],
  ["brihaspati", "Guru"],
  ["saturn", "Shani"],
  ["shani", "Shani"],
  ["rahu", "Rahu"],
  ["ketu", "Ketu"],
]);

function normKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

function planetShort(name) {
  const key = normKey(name);
  return VEDIC_SHORT.get(key) || String(name || "-");
}

function normalizePeriod(p) {
  if (!p || typeof p !== "object") return null;
  const name = p?.name || p?.lord?.name || p?.planet?.name || p?.planet || p?.id || "-";
  const start = periodStart(p);
  const end = periodEnd(p);
  const sub =
    p?.antardasha ||
    p?.pratyantardasha ||
    p?.antara_dasha ||
    p?.sub_periods ||
    p?.subPeriods ||
    p?.children ||
    null;
  const normalizedSub =
    Array.isArray(sub)
      ? sub
      : sub && typeof sub === "object"
        ? Object.entries(sub).map(([key, value]) =>
            value && typeof value === "object" ? { ...value, name: value.name || key } : null
          )
        : null;
  const children = Array.isArray(normalizedSub)
    ? normalizedSub.map(normalizePeriod).filter(Boolean)
    : null;
  return { name, start, end, children, raw: p };
}

function findVimshottari(root) {
  const data = root?.data || root;

  // Prokerala kundli responses (like yours) provide this shape.
  if (Array.isArray(data?.dasha_periods) && data.dasha_periods.length) return data.dasha_periods;

  const direct =
    data?.vimshottari_dasha ||
    data?.vimshottari ||
    data?.dasha ||
    data?.dashas ||
    null;

  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === "object") {
    if (Array.isArray(direct.maha_dasha)) return direct.maha_dasha;
    if (Array.isArray(direct.mahadasha)) return direct.mahadasha;
    if (Array.isArray(direct.mahadasa)) return direct.mahadasa;
    if (Array.isArray(direct.periods)) return direct.periods;
    if (Array.isArray(direct.dasha_periods)) return direct.dasha_periods;
    if (Array.isArray(direct.data)) return direct.data;
  }
  return null;
}

function planetDisplay(name) {
  const key = normKey(name);
  const map = new Map([
    ["sun", "Surya"],
    ["surya", "Surya"],
    ["moon", "Chandra"],
    ["chandra", "Chandra"],
    ["mercury", "Budh"],
    ["budh", "Budh"],
    ["budha", "Budh"],
    ["venus", "Shukra"],
    ["shukra", "Shukra"],
    ["mars", "Mangal"],
    ["mangal", "Mangal"],
    ["kuja", "Mangal"],
    ["jupiter", "Guru"],
    ["guru", "Guru"],
    ["brihaspati", "Guru"],
    ["saturn", "Shani"],
    ["shani", "Shani"],
    ["rahu", "Rahu"],
    ["ketu", "Ketu"],
  ]);
  return map.get(key) || String(name || "-");
}

function DashaAccordion({ items, depth, parentShort }) {
  return (
    <Accordion
      items={items}
      getKey={(p, idx) => `${p.name}-${p.start}-${p.end}-${idx}`}
      renderHeader={(p) => {
        const selfShort = planetShort(p.name);
        const label = depth === 0 ? planetDisplay(p.name) : `${parentShort}-${selfShort}`;
        return (
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className={`${depth === 0 ? "text-base" : "text-sm"} font-black text-amber-100`}>
              {String(label)}
            </div>
            <div className="text-xs text-amber-100/70">
              {isoParts(p.start).date} - {isoParts(p.end).date}
            </div>
          </div>
        );
      }}
      renderBody={(p) => {
        const selfShort = planetShort(p.name);
        const nextParentShort = depth === 0 ? selfShort : parentShort;
        if (p.children?.length) {
          return <DashaAccordion items={p.children} depth={depth + 1} parentShort={nextParentShort} />;
        }
        return <div className="text-xs text-amber-100/70">-</div>;
      }}
    />
  );
}

export default function DashaView({ value }) {
  const list = findVimshottari(value);
  const items = Array.isArray(list) ? list.map(normalizePeriod).filter(Boolean) : [];

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
        Dasha data not found in this response. Turn on "Show Raw JSON" to see what Prokerala returned.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="text-center text-2xl font-black tracking-wide text-amber-100">
        Vimshottari Mahadasha
      </div>
      <DashaAccordion items={items} depth={0} parentShort={null} />
    </div>
  );
}
