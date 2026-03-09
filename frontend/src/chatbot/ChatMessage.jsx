const labels = {
  en: { speak: 'Speak', copy: 'Copy' },
  te: { speak: 'వాయిస్', copy: 'కాపీ' },
  hi: { speak: 'बोलें', copy: 'कॉपी' },
};

function getL(language) {
  return labels[language] || labels.en;
}

export default function ChatMessage({ message, settings, onSpeak }) {
  const isUser = message.sender === 'user';
  const l = getL(settings.language);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
  };

  const handleSpeak = () => {
    onSpeak(message.text, settings);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`flex items-start gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
            <path d="M10 2h4v2h-4zM7 6h10a4 4 0 0 1 4 4v5a5 5 0 0 1-5 5h-2v2h-4v-2H8a5 5 0 0 1-5-5v-5a4 4 0 0 1 4-4Zm1 4a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3Zm8 1.5a1.5 1.5 0 1 0-3 0a1.5 1.5 0 0 0 3 0Z" />
          </svg>
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[84%]`}>
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white rounded-tr-sm'
              : 'bg-gradient-to-b from-orange-50 to-orange-100/70 border border-orange-200 text-gray-800 rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
        </div>

        <div className={`flex items-center gap-2 mt-1 px-1`}>
          <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>

          {!isUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleSpeak}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-orange-100 transition-colors"
                title={l.speak}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600" fill="currentColor" aria-hidden="true">
                  <path d="M5 10v4h3l4 4V6L8 10H5Zm10.5 2a3.5 3.5 0 0 0-2.5-3.35v6.7A3.5 3.5 0 0 0 15.5 12Zm-2.5-8.46v2.07a7 7 0 0 1 0 12.78v2.07A9 9 0 0 0 13 3.54Z" />
                </svg>
              </button>
              <button
                onClick={handleCopy}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-orange-100 transition-colors"
                title={l.copy}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600" fill="currentColor" aria-hidden="true">
                  <path d="M8 3h9a2 2 0 0 1 2 2v11h-2V5H8V3Zm-3 4h9a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V7Zm2 2v10h7V9H7Z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
