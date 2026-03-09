import { useState, useEffect } from "react";
import ChatInterface from "../chatbot/ChatInterface";

const defaultSettings = {
  language: "te",
  voiceSpeed: 1,
  voiceType: "female",
  autoPlay: true,
  friendMode: true,
  city: "Hyderabad",
};

const chatbotTranslations = {
  en: {
    appTitle: "Panchanga Friend",
    newChat: "New Chat",
    confirmNewChat: "Start a new chat? Current chat will be deleted.",
    close: "Close",
  },
  te: {
    appTitle: "Panchanga Friend",
    newChat: "New Chat",
    confirmNewChat: "Start a new chat? Current chat will be deleted.",
    close: "Close",
  },
  hi: {
    appTitle: "Panchanga Friend",
    newChat: "New Chat",
    confirmNewChat: "Start a new chat? Current chat will be deleted.",
    close: "Close",
  },
};

function t(key, lang) {
  return chatbotTranslations[lang]?.[key] || chatbotTranslations.en[key] || key;
}

function loadInitialMessages() {
  try {
    const saved = localStorage.getItem("panchang_chatbot_messages");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadInitialSettings() {
  try {
    const saved = localStorage.getItem("panchang_chatbot_settings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export default function Chatbot({ isOpen, onClose, selectedDay, currentView = "calendar", language }) {
  const [messages, setMessages] = useState(loadInitialMessages);
  const [settings] = useState(loadInitialSettings);
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    localStorage.setItem("panchang_chatbot_messages", JSON.stringify(messages));
  }, [messages]);

  const stopAllSpeech = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleNewChat = () => {
    if (confirm(t("confirmNewChat", effectiveSettings.language))) {
      stopAllSpeech();
      setResetSignal((v) => v + 1);
      setMessages([]);
      localStorage.removeItem("panchang_chatbot_messages");
    }
  };

  const handleClose = () => {
    stopAllSpeech();
    setResetSignal((v) => v + 1);
    if (onClose) onClose();
  };

  const mode = currentView === "rashiphalalu" ? "rashiphalalu" : "panchang";
  const effectiveSettings = { ...settings, language: language || settings.language };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-md h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-orange-100 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, #ff4d0d 0%, #ff5c1a 10%, #ff6b28 20%, #ff7935 30%, #ff8743 40%, #ff7935 50%, #ff6b28 60%, #ff5c1a 70%, #ff4d0d 80%, #d94100 90%, #c23800 100%)",
          border: "2.5px solid rgba(255, 168, 67, 0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/85 backdrop-blur-md shadow-sm border-b border-orange-100">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center text-lg font-semibold">
                AI
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">{t("appTitle", effectiveSettings.language)}</h1>
                <p className="text-xs text-gray-500">{effectiveSettings.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-orange-50 text-gray-700 transition-colors"
                title={t("newChat", effectiveSettings.language)}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button
                onClick={handleClose}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-orange-50 text-gray-700 transition-colors"
                title={t("close", effectiveSettings.language)}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            setMessages={setMessages}
            settings={effectiveSettings}
            selectedDay={selectedDay}
            mode={mode}
            isOpen={isOpen}
            resetSignal={resetSignal}
          />
        </div>
      </div>
    </div>
  );
}
