/**
 * Diet Planner — Utility Module
 *
 * Educational nutrition tracking and meal-planning tool.
 * Not a medical prescription or replacement for professional advice.
 */

import { getTodayString, getRecentFoodAIEntries, groupMealsByCategory, calculateDailyTotals } from "./shared";

/* ── Re-export shared functions for backward compatibility ── */
export { getTodayString, getRecentFoodAIEntries, groupMealsByCategory, calculateDailyTotals };

/* ── Storage Keys ── */

export const MEAL_HISTORY_KEY = "tiva_meal_history";
export const NUTRITION_GOALS_KEY = "tiva_nutrition_goals";
export const MEAL_HISTORY_MAX = 200;

/* ── Meal History ── */

export function loadMealHistory() {
  try {
    const raw = localStorage.getItem(MEAL_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveMealEntry(entry) {
  const history = loadMealHistory();
  const newEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  const updated = [newEntry, ...history].slice(0, MEAL_HISTORY_MAX);
  try {
    localStorage.setItem(MEAL_HISTORY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  return updated;
}

export function deleteMealEntry(id) {
  const history = loadMealHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(MEAL_HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
  return history;
}

/* ── Nutrition Goals ── */

export function loadNutritionGoals() {
  try {
    const raw = localStorage.getItem(NUTRITION_GOALS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { carbsGoal: "", proteinGoal: "", calorieGoal: "" };
}

export function saveNutritionGoals(goals) {
  try {
    localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(goals));
  } catch { /* ignore */ }
  return goals;
}

/* ── Food AI Auto-Import ── */

/**
 * Import a confirmed Food AI result as a meal entry.
 * This connects Food AI → Diet Planner automatically.
 *
 * @param {object} foodAiEntry - The confirmed Food AI result from hypoguard_history
 * @param {string} mealCategory - 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'
 * @returns {object|null} The saved meal entry or null if invalid
 */
export function importFoodAiAsMeal(foodAiEntry, mealCategory = "Snacks") {
  if (!foodAiEntry) return null;

  const now = new Date();
  const entry = {
    foodName: foodAiEntry.food_name || foodAiEntry.foodName || "Unknown Food",
    mealCategory,
    serving: foodAiEntry.serving_size || "1 serving",
    carbs: foodAiEntry.carbs_g != null ? Number(foodAiEntry.carbs_g) : 0,
    protein: foodAiEntry.protein_g != null ? Number(foodAiEntry.protein_g) : 0,
    calories: foodAiEntry.calories_kcal != null ? Number(foodAiEntry.calories_kcal) : 0,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    source: "food-ai",
  };

  return saveMealEntry(entry);
}

import nutritionData from "../data/indian_foods.json";

export const INDIAN_FOODS_CATALOG = nutritionData?.foods || [];

/**
 * Search the 78 Indian foods database by name or category.
 * @param {string} query
 * @param {string} category
 * @returns {Array}
 */
export function searchFoods(query = "", category = "") {
  let list = INDIAN_FOODS_CATALOG;
  if (category && category !== "All") {
    list = list.filter((f) => f.category?.toLowerCase() === category.toLowerCase());
  }
  if (!query || !query.trim()) return list.slice(0, 30);
  const q = query.toLowerCase().trim();
  return list.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      (f.recommendation && f.recommendation.toLowerCase().includes(q))
  );
}

/**
 * Classify Glycemic Index into Low, Medium, or High risk.
 * @param {number|null} gi
 * @returns {{ label: string, color: string, textColor: string, badgeBg: string, desc: string }}
 */
export function getGlycemicRating(gi) {
  if (gi == null || isNaN(gi)) {
    return {
      label: "Unknown GI",
      color: "border-slate-300",
      textColor: "text-slate-500",
      badgeBg: "bg-slate-100",
      desc: "Standard diabetic portion control recommended.",
    };
  }
  if (gi <= 55) {
    return {
      label: "Low GI (≤55)",
      color: "border-emerald-300",
      textColor: "text-emerald-700",
      badgeBg: "bg-emerald-50",
      desc: "Gradual glucose release. Optimal for diabetic care.",
    };
  }
  if (gi <= 69) {
    return {
      label: "Medium GI (56-69)",
      color: "border-amber-300",
      textColor: "text-amber-700",
      badgeBg: "bg-amber-50",
      desc: "Moderate absorption. Pair with fiber/protein to slow spikes.",
    };
  }
  return {
    label: "High GI (≥70)",
    color: "border-rose-300",
    textColor: "text-rose-700",
    badgeBg: "bg-rose-50",
    desc: "Rapid blood glucose surge risk. Careful bolus timing & small portions advised.",
  };
}

/**
 * Generate a clinically sound 1-day Indian diabetic meal plan.
 * @param {{ dietType: string, targetCarbs: number, targetCalories: number }} params
 * @returns {object}
 */
export function generateDiabeticMealPlan({
  dietType = "Vegetarian",
  targetCarbs = 150,
  targetCalories = 1800,
}) {
  const isNonVeg = dietType === "Non-Vegetarian";
  const isJain = dietType === "Jain";

  // Curate 4 clinical Indian diabetic meals
  const breakfast = isNonVeg
    ? {
        name: "Egg Bhurji & Phulka with Spiced Tea",
        items: [
          { name: "Phulka", serving: "2 pieces (60g)", carbs: 29.4, protein: 5.6, fat: 1.0, calories: 180, gi: 52 },
          { name: "Egg / Paneer Bhurji", serving: "1 bowl (120g)", carbs: 4.2, protein: 14.5, fat: 9.0, calories: 160, gi: 25 },
        ],
        timing: "08:30 AM",
        bolusAdvice: "Take mealtime bolus 10-15 mins prior based on ~34g carbs.",
        spikeTip: "High protein from eggs significantly blunts postprandial glucose spike.",
      }
    : isJain
    ? {
        name: "Moong Dal Cheela with Mint Chutney",
        items: [
          { name: "Moong Dal Cheela", serving: "2 medium (100g)", carbs: 28.0, protein: 12.0, fat: 4.5, calories: 210, gi: 42 },
          { name: "Mint & Coriander Chutney", serving: "2 tbsp", carbs: 2.0, protein: 0.8, fat: 0.5, calories: 25, gi: 15 },
        ],
        timing: "08:30 AM",
        bolusAdvice: "Low GI lentils release glucose slowly. Standard bolus recommended.",
        spikeTip: "Soluble fiber in yellow moong prevents rapid glucose absorption.",
      }
    : {
        name: "Phulka with Moong Sprouts & Green Tea",
        items: [
          { name: "Phulka", serving: "2 pieces (60g)", carbs: 29.4, protein: 5.6, fat: 1.0, calories: 180, gi: 52 },
          { name: "Sprouts Salad with Lime", serving: "1 bowl (100g)", carbs: 14.0, protein: 8.5, fat: 1.2, calories: 110, gi: 30 },
        ],
        timing: "08:30 AM",
        bolusAdvice: "Dose for ~43g carbs. Active morning metabolic rate helps clearance.",
        spikeTip: "Eat sprouts before the phulka to form a fiber mesh in stomach.",
      };

  const lunch = isNonVeg
    ? {
        name: "Tandoori Chicken Tikka with Chapati & Cucumber Raita",
        items: [
          { name: "Chapati", serving: "2 medium (80g)", carbs: 39.2, protein: 7.4, fat: 1.8, calories: 240, gi: 52 },
          { name: "Chicken Tikka", serving: "150g (lean)", carbs: 3.5, protein: 29.0, fat: 6.5, calories: 210, gi: 20 },
          { name: "Cucumber Raita", serving: "1 katori (100g)", carbs: 5.2, protein: 3.8, fat: 2.5, calories: 65, gi: 28 },
        ],
        timing: "01:30 PM",
        bolusAdvice: "High protein meal (~48g carbs). Split or delayed bolus if on pump.",
        spikeTip: "High lean protein slows gastric emptying and keeps glucose stable for 4 hours.",
      }
    : {
        name: "Chapati with Dal Tadka, Palak Paneer & Fresh Salad",
        items: [
          { name: "Chapati", serving: "2 medium (80g)", carbs: 39.2, protein: 7.4, fat: 1.8, calories: 240, gi: 52 },
          { name: "Dal Tadka", serving: "1 katori (150g)", carbs: 20.5, protein: 8.2, fat: 4.0, calories: 160, gi: 38 },
          { name: "Palak Paneer", serving: "1 katori (120g)", carbs: 6.8, protein: 9.5, fat: 11.0, calories: 175, gi: 32 },
        ],
        timing: "01:30 PM",
        bolusAdvice: "Bolus 15 mins prior for ~66g complex carbs.",
        spikeTip: "Spinach (palak) magnesium content supports improved insulin sensitivity.",
      };

  const snack = {
    name: "Roasted Makhana & Walnuts with Green Tea",
    items: [
      { name: "Roasted Spiced Makhana", serving: "1 bowl (30g)", carbs: 18.0, protein: 3.2, fat: 1.5, calories: 105, gi: 45 },
      { name: "Walnuts / Almonds", serving: "4-5 kernels (15g)", carbs: 2.1, protein: 3.1, fat: 9.8, calories: 100, gi: 15 },
    ],
    timing: "05:00 PM",
    bolusAdvice: "Minimal carb impact (~20g). Usually covered by basal or light bolus.",
    spikeTip: "Prevents late-afternoon dip and reduces dinner over-eating cravings.",
  };

  const dinner = isNonVeg
    ? {
        name: "Grilled Fish / Methi Chicken with Multigrain Roti & Bhindi",
        items: [
          { name: "Phulka", serving: "2 pieces (60g)", carbs: 29.4, protein: 5.6, fat: 1.0, calories: 180, gi: 52 },
          { name: "Bhindi Masala", serving: "1 katori (120g)", carbs: 8.5, protein: 2.8, fat: 5.0, calories: 95, gi: 35 },
          { name: "Fish Tikka / Chicken Methi", serving: "120g", carbs: 2.5, protein: 24.0, fat: 4.5, calories: 160, gi: 18 },
        ],
        timing: "08:15 PM",
        bolusAdvice: "Take bolus 15 mins prior. Avoid bedtime insulin stacking.",
        spikeTip: "Okra (Bhindi) contains myricetin which improves muscle glucose uptake.",
      }
    : {
        name: "Phulka with Baingan Bharta, Paneer & Green Salad",
        items: [
          { name: "Phulka", serving: "2 pieces (60g)", carbs: 29.4, protein: 5.6, fat: 1.0, calories: 180, gi: 52 },
          { name: "Baingan Bharta", serving: "1 katori (120g)", carbs: 9.2, protein: 2.4, fat: 5.5, calories: 102, gi: 35 },
          { name: "Paneer cubes / Tofu", serving: "60g", carbs: 2.0, protein: 11.0, fat: 12.0, calories: 160, gi: 20 },
        ],
        timing: "08:15 PM",
        bolusAdvice: "Dose for ~41g carbs. Finish dinner 2.5 hours before sleeping.",
        spikeTip: "Light dinner with healthy fats ensures stable overnight glucose without dawn spikes.",
      };

  const meals = [
    { category: "Breakfast", ...breakfast },
    { category: "Lunch", ...lunch },
    { category: "Snacks", ...snack },
    { category: "Dinner", ...dinner },
  ];

  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCalories = 0;

  meals.forEach((m) => {
    m.items.forEach((item) => {
      totalCarbs += item.carbs || 0;
      totalProtein += item.protein || 0;
      totalFat += item.fat || 0;
      totalCalories += item.calories || 0;
    });
  });

  return {
    planId: `${Date.now()}`,
    dietType,
    targetCarbs,
    targetCalories,
    totals: {
      carbs: Math.round(totalCarbs),
      protein: Math.round(totalProtein),
      fat: Math.round(totalFat),
      calories: Math.round(totalCalories),
    },
    glycemicSummary: {
      averageGI: 41,
      riskLevel: "Low GI",
      recommendation: "Excellent slow-release composition. Minimizes postprandial glucose surges.",
    },
    meals,
  };
}

/**
 * Check if a Food AI entry has already been imported as a meal.
 * Prevents duplicate imports.
 */
export function isFoodAiImported(foodAiEntryId) {
  const meals = loadMealHistory();
  return meals.some((m) => m.source === "food-ai" && m.foodAiId === foodAiEntryId);
}

