export function postFlutterMessage(payload) {
  if (typeof window === "undefined" || !payload) return false;

  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);

  try {
    if (window.NativeApp && typeof window.NativeApp.postMessage === "function") {
      window.NativeApp.postMessage(serialized);
      return true;
    }

    if (
      window.flutter_inappwebview &&
      typeof window.flutter_inappwebview.callHandler === "function"
    ) {
      window.flutter_inappwebview.callHandler("postMessage", payload);
      return true;
    }
  } catch (error) {
    console.error("Failed to post message to Flutter bridge:", error);
  }

  return false;
}
