import { useEffect, useRef } from "react";

const LANGUAGE_KEY = "panchang:selected-language";
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "OPTION", "CODE", "PRE"]);

function getApiRoot() {
  const rawBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";
  const base = String(rawBase).trim().replace(/\/+$/, "");
  if (!base) return "/api";
  if (base.endsWith("/api")) return base;
  return `${base}/api`;
}

function getSelectedLanguage() {
  if (typeof window === "undefined") return "en";
  return String(localStorage.getItem(LANGUAGE_KEY) || "en").trim().toLowerCase() || "en";
}

function isTranslatableText(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (t.length < 2 || t.length > 500) return false;
  if (/^[\d\s\W_]+$/u.test(t)) return false;
  return true;
}

function collectTextNodes(root, targetLang) {
  if (!root) return [];
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (!parent) {
      node = walker.nextNode();
      continue;
    }

    if (
      SKIP_TAGS.has(parent.tagName) ||
      parent.closest("[data-no-auto-translate='true']") ||
      parent.closest("[contenteditable='true']") ||
      parent.closest("svg")
    ) {
      node = walker.nextNode();
      continue;
    }

    const raw = node.nodeValue || "";
    if (!isTranslatableText(raw)) {
      node = walker.nextNode();
      continue;
    }

    if (node.__autoTranslatedLang === targetLang && node.__autoTranslatedValue === raw) {
      node = walker.nextNode();
      continue;
    }

    nodes.push(node);
    node = walker.nextNode();
  }

  return nodes;
}

async function translateBatch(target, texts) {
  try {
    const res = await fetch(`${getApiRoot()}/translate/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, texts }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!res.ok) {
      throw new Error(`Translate API failed (${res.status})`);
    }

    const payload = await res.json();
    return Array.isArray(payload?.translations) ? payload.translations : texts;
  } catch (error) {
    console.warn('Translation batch failed, using original texts:', error.message);
    return texts;
  }
}

export default function AutoTranslator() {
  const currentLangRef = useRef(getSelectedLanguage());
  const cacheRef = useRef(new Map());
  const runningRef = useRef(false);
  const queuedRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    let disposed = false;

    const applyTranslations = async () => {
      if (disposed || runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;
      try {
        const lang = currentLangRef.current || "en";
        const nodes = collectTextNodes(document.body, lang);
        if (!nodes.length) return;

        const sourceTexts = nodes.map((n) => n.nodeValue || "");
        const uniqueTexts = [...new Set(sourceTexts)];
        const misses = uniqueTexts.filter((text) => !cacheRef.current.has(`${lang}::${text}`));

        for (let i = 0; i < misses.length; i += 50) {
          const chunk = misses.slice(i, i + 50);
          const translatedChunk = await translateBatch(lang, chunk);
          for (let j = 0; j < chunk.length; j += 1) {
            const src = chunk[j];
            const out = translatedChunk[j] || src;
            cacheRef.current.set(`${lang}::${src}`, out);
          }
        }

        nodes.forEach((node) => {
          const src = node.nodeValue || "";
          const translated = cacheRef.current.get(`${lang}::${src}`) || src;
          if (translated !== src) {
            node.nodeValue = translated;
          }
          node.__autoTranslatedLang = lang;
          node.__autoTranslatedValue = node.nodeValue || "";
        });
      } catch (err) {
        console.error("Auto-translation failed:", err?.message || err);
      } finally {
        runningRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          applyTranslations();
        }
      }
    };

    const schedule = () => {
      if (disposed) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        applyTranslations();
      }, 180);
    };

    const observer = new MutationObserver(() => {
      schedule();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    const intervalId = setInterval(() => {
      const next = getSelectedLanguage();
      if (next !== currentLangRef.current) {
        currentLangRef.current = next;
        schedule();
      }
    }, 400);

    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      clearInterval(intervalId);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return null;
}
