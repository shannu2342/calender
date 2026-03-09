const inputBase =
  "w-full min-w-0 max-w-full box-border rounded-xl border px-3 py-2 text-amber-50 placeholder:text-amber-100/75 outline-none transition focus:ring-2 focus:ring-amber-300/20";

export function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <div className="mb-1 flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="min-w-0 text-sm font-semibold text-amber-100">{label}</span>
        {hint ? <span className="text-xs text-amber-100/65 break-words">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function TextInput(props) {
  const isDateInput = props.type === "date";
  const isTimeInput = props.type === "time";
  const themedStyle = (isDateInput || isTimeInput)
    ? {
      background:
        "linear-gradient(135deg, #ff6b28 0%, #ff7935 35%, #ff8743 65%, #ff5c1a 100%)",
      borderColor: "#5a9645",
      color: "#1f4f19",
      colorScheme: "light",
    }
    : {
      background: "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
      borderColor: "#d4a847",
    };

  return (
    <input
      {...props}
      className={`${inputBase} ${isDateInput ? "date-orange-input" : ""} ${props.className || ""}`}
      style={{
        ...themedStyle,
        ...props.style,
      }}
    />
  );
}

export function SelectInput(props) {
  return (
    <select
      {...props}
      className={`${inputBase} astro-select ${props.className || ""}`}
      style={{
        background: "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
        borderColor: "#d4a847",
      }}
    >
      {props.children}
    </select>
  );
}

export function SectionCard({ title, subtitle, children, right }) {
  return (
    <section
      className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-4 backdrop-blur-md"
      style={{
        background:
          "linear-gradient(180deg, #ff4d0d 0%, #ff5c1a 10%, #ff6b28 20%, #ff7935 30%, #ff8743 40%, #ff7935 50%, #ff6b28 60%, #ff5c1a 70%, #ff4d0d 80%, #d94100 90%, #c23800 100%)",
        border: "2.5px solid rgba(255, 168, 67, 0.8)",
        boxShadow:
          "0 0 20px rgba(255, 140, 50, 0.42), inset 0 0 14px rgba(255, 220, 140, 0.1)",
      }}
    >
      <header className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-black tracking-wide text-amber-100">{title}</div>
          {subtitle ? <div className="mt-1 break-words text-xs text-amber-100/70">{subtitle}</div> : null}
        </div>
        <div className="shrink-0">{right || null}</div>
      </header>
      {children}
    </section>
  );
}

export function JsonBlock({ value }) {
  return (
    <pre
      className="max-h-[420px] overflow-auto rounded-2xl p-4 text-xs text-amber-50"
      style={{
        border: "2px solid #d4a847",
        background: "linear-gradient(135deg, #2a5a1f 0%, #3a6e2d 30%, #4a8238 60%, #5a9645 100%)",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
