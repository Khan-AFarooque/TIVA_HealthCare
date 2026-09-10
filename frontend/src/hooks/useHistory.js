import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "hypoguard_history";
const MAX_ENTRIES = 20;

const SEED_HISTORY = [
  {
    id: "seed-1",
    food_name: "Aloo Gobi",
    confidence: 0.90,
    carbs_g: 9.0,
    calories_kcal: 85,
    protein_g: 2.0,
    fat_g: 4.5,
    category: "Sabzi",
    serving_size: "1 serving (100g)",
    weight_g: 100,
    recommendation: "Cauliflower is great; potato raises carbs. Pair with more sabzi than rice.",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    hasNutrition: true,
  },
  {
    id: "seed-2",
    food_name: "Dal Makhani",
    confidence: 0.88,
    carbs_g: 17.0,
    calories_kcal: 180,
    protein_g: 6.5,
    fat_g: 8.0,
    category: "Lentils",
    serving_size: "1 bowl (150g)",
    weight_g: 150,
    recommendation: "High fiber and steady protein. Excellent choice for sustained blood sugar stability.",
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    hasNutrition: true,
  },
];

/**
 * Store prediction history in localStorage and expose helpers.
 * Each entry: { id, food_name, confidence, carbs_g, calories_kcal, protein_g,
 *               fat_g, category, serving_size, recommendation, image, createdAt }
 */
export function useHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed);
          return;
        }
      }
      setHistory(SEED_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_HISTORY));
    } catch {
      setHistory(SEED_HISTORY);
    }
  }, []);

  const addToHistory = useCallback((entry) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (p) => !(p.food_name === entry.food_name && Date.now() - new Date(p.createdAt).getTime() < 3000)
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        try {
          const lightweight = next.map((item) => ({ ...item, image: null }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
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
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { history, addToHistory, clearHistory };
}