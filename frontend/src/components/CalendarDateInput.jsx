import { useMemo, useState } from "react";
import YearSelectorPopup from "./YearSelectorPopup";
import { translations as appTranslations } from "../translations";

function parseYmd(value) {
  const [y, m, d] = String(value || "").split("-").map((v) => Number(v));
  const now = new Date();
  const year = Number.isFinite(y) ? y : now.getFullYear();
  const month1 = Number.isFinite(m) ? m : now.getMonth() + 1;
  const day = Number.isFinite(d) ? d : now.getDate();
  return { year, month1, day };
}

export default function CalendarDateInput({
  value,
  onChange,
  language = "en",
  className = "",
  placeholder = "Select date",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const initial = useMemo(() => parseYmd(value), [value]);
  const t = appTranslations?.[language] || appTranslations?.en || {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    cancel: "Cancel",
    ok: "OK",
    selectYear: "Select Year",
    selectMonth: "Select Month",
  };

  const displayValue = useMemo(() => {
    if (!value) return placeholder;
    const [y, m, d] = String(value).split("-");
    if (!y || !m || !d) return String(value);
    return `${d}/${m}/${y}`;
  }, [value, placeholder]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full min-w-0 max-w-full box-border rounded-xl border px-3 py-2 text-left text-amber-50 outline-none transition hover:brightness-110 ${className}`}
        style={{
          background: "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
          borderColor: "#d4a847",
        }}
      >
        <span className="font-semibold">{displayValue}</span>
      </button>

      {isOpen ? (
        <YearSelectorPopup
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onConfirm={({ year, month, day }) => {
            const y = Number(year);
            const m = Number(month) + 1; // popup month is 0-based
            const d = Number(day);
            const nextValue = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            onChange?.(nextValue);
            setIsOpen(false);
          }}
          initialYear={initial.year}
          initialMonth={initial.month1 - 1}
          initialDay={initial.day}
          language={language}
          translations={t}
        />
      ) : null}
    </>
  );
}
