export async function sendChatMessage(message, settings, options = {}) {
  const selectedDay = options.selectedDay || null;
  const mode = options.mode || "panchang";

  const response = await fetch("/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      selectedDay,
      mode,
      language: settings?.language || "en",
      friendMode: settings?.friendMode || false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chatbot request failed: ${response.status}`);
  }

  const payload = await response.json();
  const text = String(payload?.response || "").trim();
  if (!text) {
    throw new Error("Empty chatbot response");
  }

  return text;
}
