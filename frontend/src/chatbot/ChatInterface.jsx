import { useCallback, useEffect, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import VoiceInput from "./VoiceInput";
import { sendChatMessage } from "./chatService";

const translations = {
  en: {
    welcomeFriend: "I'm your Panchanga Friend. Ask me anything!",
    welcomeFormal: "Hello! I'm your Panchanga assistant. How can I help?",
    errorMessage: "Sorry, something went wrong. Please try again!",
    emptyTitle: "Welcome to Panchanga Friend!",
    emptySubtitle: "Get daily panchanga, auspicious times, Rahukalam and more",
    inputPlaceholder: "Type your question...",
  },
  te: {
    welcomeFriend: "నేను మీ పంచాంగ ఫ్రెండ్. ఏదైనా అడగండి!",
    welcomeFormal: "నమస్కారం! నేను మీ పంచాంగ సహాయకుడిని. ఎలా సహాయం చేయను?",
    errorMessage: "క్షమించండి, ఏదో తప్పు జరిగింది. మళ్లీ ప్రయత్నించండి!",
    emptyTitle: "పంచాంగ ఫ్రెండ్ కి స్వాగతం!",
    emptySubtitle: "రోజువారీ పంచాంగం, రాహుకాలం మరియు శుభ సమయాలు తెలుసుకోండి",
    inputPlaceholder: "మీ ప్రశ్న టైప్ చేయండి...",
  },
  hi: {
    welcomeFriend: "मैं तुम्हारा पंचांग फ्रेंड हूं। कुछ भी पूछो!",
    welcomeFormal: "नमस्ते! मैं आपका पंचांग सहायक हूं। कैसे मदद करूं?",
    errorMessage: "क्षमा करें, कुछ गलत हो गया। फिर से प्रयास करें!",
    emptyTitle: "पंचांग फ्रेंड में आपका स्वागत है!",
    emptySubtitle: "दैनिक पंचांग, राहुकाल और शुभ समय जानें",
    inputPlaceholder: "अपना सवाल टाइप करें...",
  },
  ml: {
    welcomeFriend: "ഞാൻ നിങ്ങളുടെ പഞ്ചാംഗ സുഹൃത്താണ്. എന്തും ചോദിക്കുക!",
    welcomeFormal: "നമസ്കാരം! ഞാൻ നിങ്ങളുടെ പഞ്ചാംഗ സഹായിയാണ്. ഞാൻ എങ്ങനെ സഹായിക്കേണ്ടു?",
    errorMessage: "ക്ഷമിക്കുക, ചില പിഴവുകളുണ്ടായി. ദയവായി വീണ്ടും ശ്രമിക്കുക!",
    emptyTitle: "പഞ്ചാംഗ സുഹൃത്തിലേക്ക് സ്വാഗതം!",
    emptySubtitle: "പഞ്ചാംഗം, രാഹുകാലം, ശുഭ സമയങ്ങൾ എന്നിവ അറിയുക",
    inputPlaceholder: "നിങ്ങളുടെ ചോദ്യം ടൈപ്പ് ചെയ്യുക...",
  },
  kn: {
    welcomeFriend: "ನಾನು ನಿಮ್ಮ ಪಂಚಾಂಗ ಮಿತ್ರ. ಏನಾದರೂ ಕೇಳಿ!",
    welcomeFormal: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಪಂಚಾಂಗ ಸಹಾಯಕಿ. ನಾನು ಹೇಗೆ ನೆರವಾಗಬಹುದು?",
    errorMessage: "ಕ್ಷಮಿಸಿ, ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ!",
    emptyTitle: "ಪಂಚಾಂಗ ಮಿತ್ರನಿಗೆ ಸ್ವಾಗತ!",
    emptySubtitle: "ದೈನಂದಿನ ಪಂಚಾಂಗ, ರಾಹುಕಾಲ ಮತ್ತು ಶುಭ ಸಮಯಗಳನ್ನು ತಿಳಿಯಿರಿ",
    inputPlaceholder: "ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ...",
  },
  ta: {
    welcomeFriend: "நான் உங்கள் பஞ்சாங்க நண்பன். எதையும் கேளுங்கள்!",
    welcomeFormal: "வணக்கம்! நான் உங்கள் பஞ்சாங்க உதவியாளர். நான் எப்படி உதவலாம்?",
    errorMessage: "மன்னிக்கவும், ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயற்சிக்கவும்!",
    emptyTitle: "பஞ்சாங்க நண்பனுக்கு நல்வரவு!",
    emptySubtitle: "தினசரி பஞ்சாங்கம், ராகுகாலம் மற்றும் நல்ல நேரங்களை அறியவும்",
    inputPlaceholder: "உங்கள் கேள்வியை தட்டச்சு செய்யவும்...",
  },
};

function getT(language) {
  return translations[language] || translations.en;
}

export default function ChatInterface({
  messages,
  setMessages,
  settings,
  selectedDay,
  mode = "panchang",
  isOpen = true,
  resetSignal = 0,
}) {
  const t = getT(settings.language);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const prevLanguageRef = useRef(settings.language);

  const stopSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMsg = {
        id: Date.now().toString(),
        text: settings.friendMode ? t.welcomeFriend : t.welcomeFormal,
        sender: "bot",
        timestamp: new Date(),
        language: settings.language,
      };
      setMessages([welcomeMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevLanguageRef.current !== settings.language) {
      const switchedText = {
        en: "Language changed to English.",
        te: "భాషను తెలుగుకి మార్చాం.",
        hi: "भाषा हिंदी में बदल दी गई है।",
        ml: "ഭാഷ മലയാളത്തിലേക്ക് മാറ്റി.",
        kn: "ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.",
        ta: "மொழி தமிழுக்கு மாற்றப்பட்டது.",
      };
      const switchedMsg = {
        id: `${Date.now()}-lang`,
        text: switchedText[settings.language] || switchedText.en,
        sender: "bot",
        timestamp: new Date(),
        language: settings.language,
      };
      setMessages((prev) => [...prev, switchedMsg]);
      prevLanguageRef.current = settings.language;
    }
  }, [settings.language, setMessages]);

  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
    }
  }, [isOpen, stopSpeech]);

  useEffect(() => {
    stopSpeech();
  }, [resetSignal, stopSpeech]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const speakText = (text, currentSettings) => {
    if ("speechSynthesis" in window) {
      stopSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = currentSettings.voiceSpeed;
      utterance.lang =
        currentSettings.language === "te" ? "te-IN" :
          currentSettings.language === "hi" ? "hi-IN" :
            currentSettings.language === "ml" ? "ml-IN" :
              currentSettings.language === "kn" ? "kn-IN" :
                currentSettings.language === "ta" ? "ta-IN" :
                  "en-IN";

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) =>
          voice.lang.startsWith(utterance.lang) &&
          (currentSettings.voiceType === "female"
            ? voice.name.includes("female") || voice.name.includes("Female")
            : true)
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (incomingText, options = {}) => {
    const { fromVoice = false } = options;
    const finalText = (incomingText ?? input).trim();
    if (!finalText || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: finalText,
      sender: "user",
      timestamp: new Date(),
      language: settings.language,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(finalText, settings, {
        selectedDay,
        mode,
      });
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "bot",
        timestamp: new Date(),
        language: settings.language,
      };

      setMessages((prev) => [...prev, botMessage]);

      if (fromVoice) {
        speakText(response, settings);
      }
    } catch {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        text: t.errorMessage,
        sender: "bot",
        timestamp: new Date(),
        language: settings.language,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = (text) => {
    setInput(text);
    handleSend(text, { fromVoice: true });
  };

  return (
    <div
      className="h-full flex flex-col rounded-t-3xl"
      style={{
        background:
          "linear-gradient(180deg, #ff4d0d 0%, #ff5c1a 10%, #ff6b28 20%, #ff7935 30%, #ff8743 40%, #ff7935 50%, #ff6b28 60%, #ff5c1a 70%, #ff4d0d 80%, #d94100 90%, #c23800 100%)",
      }}
    >
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center mb-4">
              <i className="ri-calendar-check-line text-white text-5xl"></i>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {t.emptyTitle}
            </h2>
            <p className="text-sm text-gray-500">{t.emptySubtitle}</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} settings={settings} onSpeak={speakText} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
                <path d="M10 2h4v2h-4zM7 6h10a4 4 0 0 1 4 4v5a5 5 0 0 1-5 5h-2v2h-4v-2H8a5 5 0 0 1-5-5v-5a4 4 0 0 1 4-4Zm1 4a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 0-3 0a1.5 1.5 0 0 0 3 0Z" />
              </svg>
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-orange-500">
                <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
                <span className="text-xs font-medium">Typing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 bg-white/95 border-t border-orange-100">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-orange-50/60 border border-orange-100 rounded-3xl px-4 flex items-center gap-2 min-h-[44px]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t.inputPlaceholder}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-400 py-2.5 relative z-10"
              disabled={isLoading}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <VoiceInput
              onTranscript={handleVoiceInput}
              settings={settings}
              isOpen={isOpen}
              resetSignal={resetSignal}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 flex-shrink-0 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
            aria-label="Send message"
            title="Send"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor" aria-hidden="true">
              <path d="M3.4 20.4L22 12 3.4 3.6 3 10l13 2-13 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
