import PageShell from "./PageShell";

const MANTRAS = [
  {
    title: "Sankalpa (short)",
    text: "ॐ तत्सत् अद्य ... शुभकृत्यं करिष्ये।",
  },
  {
    title: "Ganapati",
    text: "ॐ गं गणपतये नमः",
  },
  {
    title: "Saraswati",
    text: "ॐ ऐं सरस्वत्यै नमः",
  },
];

export default function SankalpMantraPage() {
  return (
    <PageShell title="Sankalp Mantra">
      <div className="grid gap-4">
        {MANTRAS.map((m) => (
          <section key={m.title} className="app-surface rounded-3xl p-5">
            <div className="text-sm font-black text-amber-100">{m.title}</div>
            <div className="mt-2 whitespace-pre-wrap text-base text-amber-50">{m.text}</div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
