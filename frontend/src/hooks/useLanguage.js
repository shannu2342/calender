import { useEffect, useState } from "react";
import { LANGUAGE_CHANGE_EVENT, loadLanguage } from "../utils/appSettings";

export function useLanguage() {
    const [language, setLanguage] = useState(() => loadLanguage());

    useEffect(() => {
        const syncLanguage = (event) => {
            const next = event?.detail?.language || loadLanguage();
            if (next) setLanguage((prev) => (prev === next ? prev : next));
        };

        const handleStorage = (event) => {
            if (event?.key && event.key !== "panchang:selected-language") return;
            syncLanguage();
        };

        window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
        window.addEventListener("storage", handleStorage);

        return () => {
            window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    return { language };
}
