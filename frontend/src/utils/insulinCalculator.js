/**
 * Insulin Tracking & Educational Calculation — Utility Module
 *
 * This is an educational prototype. It does NOT prescribe, recommend,
 * or instruct a user to inject a specific insulin dose.
 */

import { getLatestFoodCarbs, getLatestGlucoseReading } from "./shared";

/* ── Re-export shared connectors for backward compatibility ── */
export { getLatestFoodCarbs, getLatestGlucoseReading as getLatestGlucose };

/* ── Storage ── */

export const INSULIN_HISTORY_KEY = "tiva_insulin_history";
export const INSULIN_HISTORY_MAX = 50;

export function loadInsulinHistory() {
  try {
    const raw = localStorage.getItem(INSULIN_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveInsulinLog(entry) {
  const history = loadInsulinHistory();
  const newEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  const updated = [newEntry, ...history].slice(0, INSULIN_HISTORY_MAX);
  try {
    localStorage.setItem(INSULIN_HISTORY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  return updated;
}

export function deleteInsulinLog(id) {
  const history = loadInsulinHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(INSULIN_HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
  return history;
}

export function getLatestInsulinLog() {
  const history = loadInsulinHistory();
  return history.length > 0 ? history[0] : null;
}

/* ── Educational Calculation ── */

/**
 * Calculate an educational insulin estimate using the user's own
 * clinician-provided personal settings.
 *
 * This is a mathematical calculation only. It is NOT a medical recommendation.
 *
 * @param {object} params
 * @param {number} params.carbsGrams         - Carbohydrate intake in grams
 * @param {number} params.currentGlucose     - Current glucose in mg/dL
 * @param {number|null} params.carbRatio     - 1 unit per X grams carbs (ICR)
 * @param {number|null} params.correctionFactor - ISF (mg/dL per 1 unit)
 * @param {number|null} params.targetGlucose - Personal target glucose
 * @returns {object|null} Calculation result or null if settings incomplete
 */
export function educationalCalculation(params) {
  const { carbsGrams, currentGlucose, carbRatio, correctionFactor, targetGlucose } = params;

  // All personal settings must be provided by the user
  if (!carbRatio || carbRatio <= 0) return null;

  // Carb component
  const carbComponent = carbsGrams / carbRatio;

  // Correction component (only if all three are provided)
  let correctionComponent = 0;
  let hasCorrection = false;
  if (correctionFactor && correctionFactor > 0 && targetGlucose != null && currentGlucose != null) {
    correctionComponent = (currentGlucose - targetGlucose) / correctionFactor;
    hasCorrection = true;
  }

  const totalEstimate = carbComponent + correctionComponent;

  return {
    carbComponent: Math.round(carbComponent * 100) / 100,
    correctionComponent: hasCorrection ? Math.round(correctionComponent * 100) / 100 : null,
    hasCorrection,
    totalEstimate: Math.round(totalEstimate * 100) / 100,
  };
}
