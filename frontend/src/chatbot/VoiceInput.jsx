import { useState, useEffect, useRef, useCallback } from "react";

const labels = {
  en: {
    unsupported: "Your browser does not support voice input",
    permissionDenied: "Microphone permission denied",
    title: "Voice Input",
  },
  te: {
    unsupported: "మీ బ్రౌజర్ వాయిస్ ఇన్పుట్ ను సపోర్ట్ చేయదు",
    permissionDenied: "మైక్ అనుమతి ఇవ్వలేదు",
    title: "వాయిస్ ఇన్పుట్",
  },
  hi: {
    unsupported: "आपका ब्राउज़र वॉइस इनपुट सपोर्ट नहीं करता",
    permissionDenied: "माइक अनुमति नहीं मिली",
    title: "वॉइस इनपुट",
  },
};

function getL(language) {
  return labels[language] || labels.en;
}

export default function VoiceInput({
  onTranscript,
  settings,
  isOpen = true,
  resetSignal = 0,
}) {
  const l = getL(settings.language);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const stopRecognition = useCallback((updateState = true) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // noop
    }
    if (updateState) {
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || "")
          .join(" ")
          .trim();
        if (transcript) {
          onTranscript(transcript);
        }
        setIsListening(false);
      };

      recognitionInstance.onerror = (event) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          alert(l.permissionDenied);
        }
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognitionInstance;
    }

    return () => {
      stopRecognition(false);
      recognitionRef.current = null;
    };
  }, [onTranscript, l.permissionDenied, stopRecognition]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      const lang = settings.language === "te" ? "te-IN" : settings.language === "hi" ? "hi-IN" : "en-IN";
      recognition.lang = lang;
    }
  }, [settings.language]);

  useEffect(() => {
    if (!isOpen) {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      try {
        recognition.stop();
      } catch {
        // noop
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // noop
    }
  }, [resetSignal]);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert(l.unsupported);
      return;
    }

    if (isListening) {
      stopRecognition();
      return;
    }

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border ${
        isListening ? "bg-red-500 border-red-500 animate-pulse" : "bg-orange-100 border-orange-200 hover:bg-orange-200"
      }`}
      title={l.title}
      aria-label={l.title}
    >
      <svg viewBox="0 0 24 24" className={`w-5 h-5 ${isListening ? "text-white" : "text-orange-700"}`} fill="currentColor" aria-hidden="true">
        <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0a7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 12a1 1 0 1 1 2 0a5 5 0 0 0 10 0Z" />
      </svg>
    </button>
  );
}
