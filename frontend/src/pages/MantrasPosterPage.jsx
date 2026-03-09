import { useEffect, useState } from "react";

const MANTRAS = [
  {
    id: "om-chanting",
    title: "Om Chanting",
    text: `Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om
Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om Om`,
  },
  {
    id: "gayatri",
    title: "Gayatri Mantra",
    text: `Om Bhur Bhuvah Svah
Tat Savitur Varenyam
Bhargo Devasya Dhimahi
Dhiyo Yo Nah Prachodayat`,
  },
  {
    id: "mahamrityunjaya",
    title: "Mahamrityunjaya Mantra",
    text: `Om Tryambakam Yajamahe
Sugandhim Pushtivardhanam
Urvarukamiva Bandhanan
Mrityor Mukshiya Maamritat`,
  },
  {
    id: "vishnu-sahasranamam",
    title: "Vishnu Sahasranamam",
    text: `Om Shuklambaradharam Vishnum
Shashivarnam Chaturbhujam
Prasanna Vadanam Dhyayet
Sarva Vighnopashantaye

Om Vishvam Vishnur Vashatkaro
Bhuta Bhavya Bhavat Prabhuh
Bhutakrid Bhutabhrid Bhavo
Bhutatma Bhutabhavanah`,
  },
  {
    id: "hanuman-chalisa",
    title: "Hanuman Chalisa",
    text: `Shri Guru Charan Saroj Raj
Nij Man Mukur Sudhari
Baranau Raghuvar Bimal Jasu
Jo Dayaku Phal Chari

Buddhiheen Tanu Janike
Sumirau Pavan Kumar
Bal Buddhi Vidya Dehu Mohi
Harahu Kalesh Vikar

Jai Hanuman Gyan Gun Sagar
Jai Kapis Tihun Lok Ujagar
Ramdoot Atulit Bal Dhama
Anjani Putra Pavan Sut Nama`,
  },
];

function MantraRow({ title, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[58px] sm:min-h-[68px] rounded-[24px] px-3 py-2 text-left transition hover:scale-[1.01]"
      style={{
        backgroundImage:
          "radial-gradient(140% 85% at 50% 50%, rgba(255,214,141,0.38) 0%, rgba(255,214,141,0) 64%), linear-gradient(180deg, #e67f1e 0%, #cf5f13 52%, #bc4d0f 100%)",
        border: "2px solid #8e2f0c",
        boxShadow:
          "0 6px 16px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,219,155,0.58), inset 0 -2px 0 rgba(120,34,9,0.55), inset 0 0 0 2px rgba(225,112,31,0.62)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-[20px] font-bold"
          style={{
            background: "linear-gradient(180deg, #7f210d 0%, #4d1208 100%)",
            color: "#ffdba2",
            border: "1px solid rgba(255,198,112,0.58)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
          }}
        >
          {badge}
        </div>
        <span className="block text-[#45130c] font-bold text-[14px] leading-tight [text-shadow:0_1px_0_rgba(255,226,180,0.45)]">
          {title}
        </span>
        <span className="ml-auto text-[#6b1a0d] text-[20px] font-bold">{">"}</span>
      </div>
    </button>
  );
}

export default function MantrasPosterPage() {
  const [selected, setSelected] = useState(null);
  const [notifyStatus, setNotifyStatus] = useState("");
  const [bgImageUrl, setBgImageUrl] = useState("/panchang-bg.jpg.png");

  const selectedMantra = selected ? MANTRAS.find((m) => m.id === selected) : null;

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      setNotifyStatus("Notifications are not supported in this browser.");
      return;
    }
    if (Notification.permission === "granted") {
      setNotifyStatus("Notifications already enabled.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifyStatus(result === "granted" ? "Notifications enabled." : "Notification permission denied.");
    } catch {
      setNotifyStatus("Could not request notification permission.");
    }
  };

  useEffect(() => {
    const preferred = "/mantras-bg.jpg.png";
    const fallback = "/panchang-bg.jpg.png";
    const img = new Image();
    img.onload = () => setBgImageUrl(preferred);
    img.onerror = () => setBgImageUrl(fallback);
    img.src = preferred;
  }, []);

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 flex items-center justify-center bg-[#4a0f1b]">
      <main
        className="relative w-full max-w-[430px] md:max-w-[900px] aspect-[9/16] md:aspect-[16/10] max-h-[92vh] rounded-xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(42,8,3,0.38), rgba(42,8,3,0.38)), url('${bgImageUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
          filter: "brightness(1.1) saturate(1.05)",
        }}
      >
        <section className="absolute inset-x-[8%] sm:inset-x-[10%] md:inset-x-[7%] top-[3.2%] bottom-[7%] flex flex-col overflow-y-auto pr-1">
          <div
            className="mx-auto w-[76%] sm:w-[72%] rounded-2xl px-3 py-1.5 text-center"
            style={{
              background: "linear-gradient(180deg, #8a2a12 0%, #5f180b 100%)",
              border: "2px solid rgba(255,190,105,0.62)",
              boxShadow: "0 8px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,219,169,0.25)",
            }}
          >
            <h1 className="text-[24px] font-bold text-[#ffe8be] [text-shadow:0_2px_4px_rgba(0,0,0,0.62)]">
              Mantras
            </h1>
          </div>

          <div className="mt-3 sm:mt-4 pb-4 sm:pb-5 flex flex-col gap-2 sm:gap-2.5">
            {MANTRAS.map((mantra, idx) => (
              <MantraRow
                key={mantra.id}
                title={mantra.title}
                badge={["ॐ", "☀", "🔱", "✶", "🐒"][idx] || "ॐ"}
                onClick={() => setSelected(mantra.id)}
              />
            ))}
          </div>

          <div className="pt-2 sm:pt-3 pb-2 sm:pb-3">
            <button
              type="button"
              onClick={requestNotifications}
              className="w-full h-[50px] sm:h-[54px] rounded-2xl px-4 py-2 text-[16px] sm:text-[18px] font-semibold text-[#ffe4be] flex items-center justify-center leading-none whitespace-nowrap"
              style={{
                background: "linear-gradient(180deg, #8a2a12 0%, #5f180b 100%)",
                border: "2px solid rgba(255,190,105,0.62)",
                boxShadow: "0 8px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,219,169,0.25)",
                textShadow: "0 2px 4px rgba(0,0,0,0.68)",
              }}
            >
              Manage Notifications
            </button>
            {notifyStatus ? (
              <div className="mt-2 text-center text-xs text-[#ffe2be] [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                {notifyStatus}
              </div>
            ) : null}
          </div>
        </section>

        {selectedMantra ? (
          <div
            className="absolute inset-0 z-10 bg-black/70 p-4 flex items-center justify-center"
            onClick={() => setSelected(null)}
          >
            <div
              className="w-full max-w-[360px] max-h-[80%] rounded-2xl p-4 overflow-auto"
              style={{
                background: "linear-gradient(180deg, #ffe0b1 0%, #f0b976 100%)",
                border: "2px solid rgba(116,44,12,0.75)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[#4d140c] text-lg font-bold">{selectedMantra.title}</h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-md px-2 py-1 text-xs font-semibold"
                  style={{ background: "#6a1d0d", color: "#ffe2c0" }}
                >
                  Close
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-[14px] leading-6 text-[#3d120a]">
                {selectedMantra.text}
              </pre>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
