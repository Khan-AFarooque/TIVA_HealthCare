import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "hypoguard_history";
const MAX_ENTRIES = 30;

/**
 * Store food scan history in localStorage isolated per user.
 * Each entry: { id, food_name, confidence, carbs_g, calories_kcal, protein_g,
 *               fat_g, category, serving_size, weight_g, recommendation, image, createdAt }
 */
export function useHistory(userId) {
  const activeUserId = userId || (() => {
    try {
      return JSON.parse(localStorage.getItem("tiva_auth") || "{}")?.userId || null;
    } catch {
      return null;
    }
  })();

  const storageKey = activeUserId ? `hypoguard_history_${activeUserId}` : STORAGE_KEY;
  const [history, setHistory] = useState([]);

  const loadCurrentHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Strictly exclude any legacy seed demo items
          const cleaned = parsed.filter(
            (p) => p && !String(p.id || "").startsWith("seed-")
          );
          setHistory(cleaned);
          return;
        }
      }
      setHistory([]);
    } catch {
      setHistory([]);
    }
  }, [storageKey]);

  useEffect(() => {
    loadCurrentHistory();

    const handleUpdate = () => loadCurrentHistory();
    window.addEventListener("tiva-data-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("tiva-data-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadCurrentHistory]);

  const addToHistory = useCallback(
    (entry) => {
      setHistory((prev) => {
        const filtered = prev.filter(
          (p) =>
            p &&
            !String(p.id || "").startsWith("seed-") &&
            !(p.food_name === entry.food_name && Date.now() - new Date(p.createdAt || 0).getTime() < 3000)
        );
        const next = [
          {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, MAX_ENTRIES);

        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          try {
            const lightweight = next.map((item) => ({ ...item, image: null }));
            localStorage.setItem(storageKey, JSON.stringify(lightweight));
          } catch {
            /* ignore */
          }
        }
        try {
          window.dispatchEvent(new Event("tiva-data-updated"));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new Event("tiva-data-updated"));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { history, addToHistory, clearHistory };
}