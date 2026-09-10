/**
 * Exercise Planner — Utility Module
 *
 * Educational activity planning and personal tracking tool.
 * Not medical clearance or treatment advice.
 */

import { getTodayString, getLatestGlucoseReading, calculateDailyActivityTotals } from "./shared";

/* ── Re-export shared functions for backward compatibility ── */
export { getTodayString, calculateDailyActivityTotals };

/* ── Storage Keys ── */

export const ACTIVITY_HISTORY_KEY = "tiva_activity_history";
export const ACTIVITY_PLAN_KEY = "tiva_activity_plan";
export const ACTIVITY_GOALS_KEY = "tiva_activity_goals";
export const ACTIVITY_HISTORY_MAX = 100;

/* ── Activity Types ── */

export const ACTIVITY_TYPES = [
  "Walking",
  "Running",
  "Cycling",
  "Gym / Strength Training",
  "Yoga",
  "Sports",
  "Stretching",
  "Other",
];

export const INTENSITY_LEVELS = ["Light", "Moderate", "High"];

/* ── Activity History ── */

export function loadActivityHistory() {
  try {
    const raw = localStorage.getItem(ACTIVITY_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveActivity(entry) {
  const history = loadActivityHistory();
  const newEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  const updated = [newEntry, ...history].slice(0, ACTIVITY_HISTORY_MAX);
  try {
    localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  return updated;
}

export function deleteActivity(id) {
  const history = loadActivityHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
  return history;
}

/* ── Activity Plan ── */

export function loadActivityPlan() {
  try {
    const raw = localStorage.getItem(ACTIVITY_PLAN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function savePlannedActivity(entry) {
  const plan = loadActivityPlan();
  const newEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newEntry, ...plan];
  try {
    localStorage.setItem(ACTIVITY_PLAN_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  return updated;
}

export function deletePlannedActivity(id) {
  const plan = loadActivityPlan().filter((e) => e.id !== id);
  try {
    localStorage.setItem(ACTIVITY_PLAN_KEY, JSON.stringify(plan));
  } catch { /* ignore */ }
  return plan;
}

export function completePlannedActivity(id) {
  const plan = loadActivityPlan();
  const item = plan.find((e) => e.id === id);
  if (!item) return { updatedPlan: plan, completedEntry: null };
  const completedEntry = {
    activityName: item.activityName,
    duration: item.duration,
    intensity: item.intensity,
    date: item.date,
    time: item.time || new Date().toTimeString().slice(0, 5),
    notes: "",
    source: "planned",
  };
  const updatedPlan = plan.filter((e) => e.id !== id);
  try {
    localStorage.setItem(ACTIVITY_PLAN_KEY, JSON.stringify(updatedPlan));
  } catch { /* ignore */ }
  return { updatedPlan, completedEntry };
}

/* ── Activity Goals ── */

export function loadActivityGoals() {
  try {
    const raw = localStorage.getItem(ACTIVITY_GOALS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { dailyActiveMinutes: "" };
}

export function saveActivityGoals(goals) {
  try {
    localStorage.setItem(ACTIVITY_GOALS_KEY, JSON.stringify(goals));
  } catch { /* ignore */ }
  return goals;
}

/* ── Glucose Context ── */

/**
 * Get latest glucose context for the Exercise Planner page.
 * Uses shared connector for consistency.
 */
export function getLatestGlucoseContext() {
  const reading = getLatestGlucoseReading();
  if (!reading) return null;
  return {
    glucose: reading.value,
    trend: reading.trend,
    savedAt: reading.savedAt,
  };
}
