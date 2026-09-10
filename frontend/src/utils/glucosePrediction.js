/**
 * Glucose Prediction - Educational Prototype
 *
 * This is an educational health decision-support visualization feature.
 * It must NOT claim to diagnose diabetes or provide medical treatment.
 * All outputs use language like "estimated", "predicted trend", "may indicate".
 */

import {
  getLatestFoodCarbs,
  getLatestGlucoseReading,
  getLatestInsulinLog,
  getTodayActivitySummary,
  getTodayMealSummary,
} from "./shared";
import { getUserThresholds } from "./glucoseSafety";

/* ── Re-export shared connectors for backward compatibility ── */
export { getLatestFoodCarbs };

/* ── Activity level mapping from shared data intensity to prediction param ── */
const INTENSITY_TO_LEVEL = {
  Light: "light",
  Moderate: "moderate",
  High: "high",
};

/**
 * Activity multiplier effects on glucose.
 * Higher activity → more glucose uptake by muscles → tends to lower glucose.
 */
const ACTIVITY_EFFECTS = {
  resting: +8,
  light: +2,
  moderate: -10,
  high: -20,
};

/**
 * Meal timing effects on glucose.
 * Just eaten → carbs being absorbed → glucose rising.
 * Older meal → absorption slowing → glucose stabilizing or falling.
 */
const MEAL_TIMING_EFFECTS = {
  "just-eaten": +15,
  "within-hour": +8,
  "more-hour": -5,
};

/**
 * Estimate insulin effect.
 * Each unit of rapid-acting insulin roughly lowers glucose by ~30-50 mg/dL.
 * We use a conservative 40 mg/dL per unit as an educational estimate.
 */
const INSULIN_SENSITIVITY = 40;

/**
 * Estimate carbohydrate impact.
 * Roughly, 15g of carbs raises glucose by ~30-40 mg/dL in a fasting state.
 * We use ~2.5 mg/dL per gram of carbs as a simplified educational estimate.
 * This effect is modulated by meal timing (absorption phase).
 */
const CARB_IMPACT_PER_GRAM = 2.5;

/**
 * Determine meal timing from a timestamp.
 * Compares the time of the latest food/meal entry to now.
 */
function inferMealTiming(savedAt) {
  if (!savedAt) return "more-hour";
  const diffMs = Date.now() - new Date(savedAt).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 15) return "just-eaten";
  if (diffMin < 60) return "within-hour";
  return "more-hour";
}

/**
 * Auto-predict glucose from stored cross-module data.
 *
 * Reads the latest glucose reading, Food AI carbs, insulin log,
 * and today's activity summary from the shared data layer,
 * then feeds them into predictGlucose().
 *
 * When autoSave is true, persists the prediction to tiva_glucose_history
 * so the safety engine (checkGlucoseSafety) can evaluate it.
 * Deduplicates: only saves if the prediction differs from the latest stored entry.
 *
 * @param {string} userId - Authenticated user's ID
 * @param {{ autoSave?: boolean }} options - Whether to persist prediction to glucose history
 * @returns {{ prediction: object, context: object } | null} Prediction result + context, or null if no glucose data
 */
export function autoPredictFromStoredData(userId, options = {}) {
  const { autoSave = false } = options;

  const latestGlucose = getLatestGlucoseReading();
  if (!latestGlucose || latestGlucose.value == null) return null;

  const latestFood = getLatestFoodCarbs();
  const latestInsulin = getLatestInsulinLog();
  const todayActivity = getTodayActivitySummary();
  const todayMeals = getTodayMealSummary();

  // Map shared data → predictGlucose params
  const carbsGrams = latestFood ? latestFood.carbsGrams : 0;
  const insulinUnits = latestInsulin && latestInsulin.amount ? Number(latestInsulin.amount) : null;

  // Map activity intensity from shared data → prediction level
  let activityLevel = "resting";
  if (todayActivity && todayActivity.highestIntensity) {
    activityLevel = INTENSITY_TO_LEVEL[todayActivity.highestIntensity] || "light";
  }

  // Infer meal timing from the latest food entry timestamp
  const mealTiming = inferMealTiming(latestFood?.savedAt);

  const prediction = predictGlucose({
    currentGlucose: Number(latestGlucose.value),
    carbsGrams,
    insulinUnits,
    activityLevel,
    mealTiming,
  });

  // Persist to glucose history so the safety engine can evaluate it.
  // Deduplication: only save if prediction differs from the latest stored entry.
  if (autoSave) {
    const history = loadGlucoseHistory();
    const latest = history.length > 0 ? history[0] : null;
    const sameGlucose = latest && latest.currentGlucose === prediction.currentGlucose;
    const samePredicted = latest && latest.predictedGlucose === prediction.predictedGlucose;
    const sameTrend = latest && latest.trend === prediction.trend;
    const isAutoSaved = latest && latest.source === "auto-prediction";

    if (!(sameGlucose && samePredicted && sameTrend && isAutoSaved)) {
      const entry = {
        ...prediction,
        readingTime: new Date().toTimeString().slice(0, 5),
        savedDate: new Date().toLocaleDateString(),
        source: "auto-prediction",
      };
      saveGlucosePrediction(entry);
    }
  }

  const context = {
    latestGlucose,
    latestFood,
    latestInsulin,
    todayActivity,
    todayMeals,
    inferredMealTiming: mealTiming,
    inferredActivityLevel: activityLevel,
  };

  return { prediction, context };
}

/**
 * Calculate a glucose prediction based on user-entered factors.
 *
 * @param {object} params
 * @param {number} params.currentGlucose - Current glucose reading in mg/dL
 * @param {number} params.carbsGrams - Recent carbohydrate intake in grams
 * @param {number|null} params.insulinUnits - Recent insulin dose (optional)
 * @param {string} params.activityLevel - 'resting' | 'light' | 'moderate' | 'high'
 * @param {string} params.mealTiming - 'just-eaten' | 'within-hour' | 'more-hour'
 *
 * @returns {object} Prediction result
 */
export function predictGlucose(params) {
  const {
    currentGlucose,
    carbsGrams = 0,
    insulinUnits = null,
    activityLevel = "resting",
    mealTiming = "within-hour",
  } = params;

  // --- Individual factor contributions (educational estimates) ---

  // Carb effect: carbs raise glucose, modulated by meal timing
  const mealTimingFactor = MEAL_TIMING_EFFECTS[mealTiming] ?? 0;
  const carbEffect = carbsGrams * CARB_IMPACT_PER_GRAM * (mealTimingFactor >= 0 ? 1 : 0.5);

  // Activity effect
  const activityEffect = ACTIVITY_EFFECTS[activityLevel] ?? 0;

  // Insulin effect: insulin lowers glucose
  const insulinEffect = insulinUnits ? -(insulinUnits * INSULIN_SENSITIVITY) : 0;

  // --- Total estimated change over next 30-60 minutes ---
  const totalChange = carbEffect + activityEffect + insulinEffect;

  // Clamp: glucose cannot drop below 40 or rise above 400 in our estimate
  const predictedGlucose = Math.max(40, Math.min(400, currentGlucose + totalChange));

  // --- Determine trend ---
  let trend;
  if (totalChange > 10) {
    trend = "rising";
  } else if (totalChange < -10) {
    trend = "falling";
  } else {
    trend = "stable";
  }

  // --- Estimated range (±15 mg/dL uncertainty band) ---
  const rangeLow = Math.max(40, Math.round(predictedGlucose - 15));
  const rangeHigh = Math.min(400, Math.round(predictedGlucose + 15));

  // --- Generate human-readable explanation ---
  const explanations = [];
  if (carbsGrams > 0) {
    if (mealTiming === "just-eaten") {
      explanations.push("Recent carbohydrate intake is likely still being absorbed, which may contribute to an upward glucose trend.");
    } else if (mealTiming === "within-hour") {
      explanations.push("Carbohydrate intake within the last hour may still be affecting glucose levels.");
    } else {
      explanations.push("Carbohydrates from more than an hour ago may have largely been absorbed.");
    }
  }
  if (insulinUnits && insulinUnits > 0) {
    explanations.push(`Recent insulin of ${insulinUnits} units may help counteract rising glucose levels.`);
  }
  if (activityLevel === "moderate" || activityLevel === "high") {
    explanations.push("Physical activity increases glucose uptake by muscles, which may contribute to a downward trend.");
  } else if (activityLevel === "resting") {
    explanations.push("Resting state means minimal additional glucose consumption through physical activity.");
  }
  if (explanations.length === 0) {
    explanations.push("Based on current glucose alone, the trend is estimated as relatively stable.");
  }

  return {
    currentGlucose,
    predictedGlucose: Math.round(predictedGlucose),
    trend,
    rangeLow,
    rangeHigh,
    totalChange: Math.round(totalChange),
    explanations,
    inputs: {
      carbsGrams,
      insulinUnits,
      activityLevel,
      mealTiming,
    },
  };
}

/**
 * Storage key for glucose prediction history.
 */
export const GLUCOSE_HISTORY_KEY = "tiva_glucose_history";
export const GLUCOSE_HISTORY_MAX = 50;

/**
 * Load glucose prediction history from localStorage.
 */
export function loadGlucoseHistory() {
  try {
    const raw = localStorage.getItem(GLUCOSE_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

/**
 * Save a glucose prediction entry to history.
 */
export function saveGlucosePrediction(entry) {
  const history = loadGlucoseHistory();
  const newEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  const updated = [newEntry, ...history].slice(0, GLUCOSE_HISTORY_MAX);
  try {
    localStorage.setItem(GLUCOSE_HISTORY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("tiva-data-updated")); } catch { /* ignore */ }
  return updated;
}

/**
 * Delete a single glucose prediction by id.
 */
export function deleteGlucosePrediction(id) {
  const history = loadGlucoseHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(GLUCOSE_HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
  return history;
}

/**
 * Get the latest glucose prediction (for dashboard display).
 */
export function getLatestGlucosePrediction() {
  const history = loadGlucoseHistory();
  return history.length > 0 ? history[0] : null;
}

/**
 * Get a cross-module context snapshot for the Glucose Prediction page.
 * Provides connected data from Food AI, Insulin, Activity, and Meal History.
 */
export function getGlucoseContext() {
  const latestFoodCarbs = getLatestFoodCarbs();
  const latestGlucose = getLatestGlucoseReading();
  const todayActivity = getTodayActivitySummary();
  const todayMeals = getTodayMealSummary();

  return {
    latestFoodCarbs,
    latestGlucose,
    todayActivity,
    todayMeals,
  };
}
