import { useState } from "react";

export default function Accordion({ items = [], getKey, renderHeader, renderBody }) {
  const [openKey, setOpenKey] = useState(null);

  return (
    <div className="grid gap-2">
      {items.map((item, idx) => {
        const key = getKey ? getKey(item, idx) : idx;
        const isOpen = openKey === key;
        return (
          <div
            key={key}
            className="rounded-2xl border border-white/10 bg-black/15"
          >
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : key)}
              className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
            >
              <div className="min-w-0 flex-1">{renderHeader(item, { isOpen })}</div>
              <div className="mt-1 text-amber-100/70">{isOpen ? "▾" : "▸"}</div>
            </button>
            {isOpen ? (
              <div className="border-t border-white/10 px-4 py-3">
                {renderBody(item, { isOpen })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

