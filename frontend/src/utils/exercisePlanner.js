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

/* ── Glucose Context & Dynamic Exercise Prescription ── */

/**
 * Get latest glucose context for the Exercise Planner page.
 * Uses shared connector with fallback to profile and active session.
 */
export function getLatestGlucoseContext() {
  const reading = getLatestGlucoseReading();
  if (reading) {
    const val = Number(reading.currentGlucose ?? reading.value) || 110;
    return {
      glucose: val,
      trend: reading.trend || "stable",
      predicted: reading.predicted ?? val,
      savedAt: reading.savedAt || null,
    };
  }

  // Fallback to active profile if available
  try {
    const auth = JSON.parse(localStorage.getItem("tiva_auth") || "{}");
    const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
    const p = (auth?.userId && profiles[auth.userId]) || Object.values(profiles)[0];
    if (p?.currentGlucose) {
      const val = Number(p.currentGlucose) || 110;
      return {
        glucose: val,
        trend: "stable",
        predicted: val,
        savedAt: null,
      };
    }
  } catch { /* ignore */ }

  return {
    glucose: 110,
    trend: "stable",
    predicted: 110,
    savedAt: null,
  };
}

/**
 * Clinical exercise guideline based on current & predicted glucose levels.
 * Categorizes safe exercise window and provides dynamic prescription.
 */
export function getExerciseSafetyPrescription(glucose, trend = "stable") {
  const g = Number(glucose) || 110;

  if (g < 70) {
    return {
      category: "HYPO_CRITICAL",
      badgeText: "🚨 Severe Hypoglycemia (< 70 mg/dL)",
      badgeBg: "bg-rose-100 text-rose-800 border-rose-300",
      statusTitle: "Exercise Contraindicated — Take Fast Carbs",
      advice: "Do not exercise. Consume 15–20g fast-acting carbohydrates (fruit juice, glucose tabs). Rest and recheck in 15 minutes. Resume only after glucose is steadily above 100 mg/dL.",
      recommendedActivity: {
        name: "Rest & Post-Recovery Light Stretch",
        duration: 10,
        intensity: "Light",
      },
      allowedTypes: ["Stretching"],
      hydrationAdvice: "Sip water after hypoglycemia treatment.",
    };
  }

  if (g < 90) {
    return {
      category: "HYPO_RISK",
      badgeText: "⚠️ Hypo Vulnerability (70–90 mg/dL)",
      badgeBg: "bg-amber-100 text-amber-800 border-amber-300",
      statusTitle: "Pre-Workout Snack Recommended",
      advice: "Your glucose is on the lower edge. Eat 15g complex carbohydrates (banana, toast, or nuts) before working out. Avoid vigorous anaerobic training.",
      recommendedActivity: {
        name: "Gentle Post-Snack Walk",
        duration: 20,
        intensity: "Light",
      },
      allowedTypes: ["Walking", "Yoga", "Stretching"],
      hydrationAdvice: "Keep fast-acting glucose tablets accessible.",
    };
  }

  if (g <= 180) {
    return {
      category: "OPTIMAL",
      badgeText: "✅ Optimal Glycemic Range (90–180 mg/dL)",
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-300",
      statusTitle: "Ideal Conditioning Window for All Activities",
      advice: "Your current glucose is in the optimal target corridor. All aerobic, resistance, and sporting activities are safe. 30 minutes of moderate exercise boosts insulin sensitivity for 24–48 hours.",
      recommendedActivity: {
        name: "Cardio & Metabolic Conditioning Walk",
        duration: 30,
        intensity: "Moderate",
      },
      allowedTypes: ["Walking", "Running", "Cycling", "Gym / Strength Training", "Yoga", "Sports"],
      hydrationAdvice: "Drink 250ml water every 20 minutes of workout.",
    };
  }

  if (g <= 250) {
    return {
      category: "ELEVATED",
      badgeText: "⚡ Elevated Glucose (180–250 mg/dL)",
      badgeBg: "bg-blue-100 text-blue-800 border-blue-300",
      statusTitle: "Aerobic Exercise Recommended to Lower Blood Sugar",
      advice: "Moderate aerobic activity (brisk walking or cycling) activates GLUT4 glucose uptake without needing extra insulin, effectively reducing glucose. Avoid heavy weightlifting.",
      recommendedActivity: {
        name: "Brisk Aerobic Glucose-Clearing Walk",
        duration: 25,
        intensity: "Moderate",
      },
      allowedTypes: ["Walking", "Cycling", "Yoga"],
      hydrationAdvice: "Hydrate generously to support renal glucose clearance.",
    };
  }

  return {
    category: "SEVERE_HYPER",
    badgeText: "🛑 Severe Hyperglycemia (> 250 mg/dL)",
    badgeBg: "bg-rose-100 text-rose-800 border-rose-300",
    statusTitle: "Exercise Restricted — Check Ketones",
    advice: "Do not perform strenuous exercise when blood sugar is over 250 mg/dL. Vigorous activity can trigger stress hormones and worsen hyperglycemia. Hydrate and check ketones.",
    recommendedActivity: {
      name: "Light Breathing & Restorative Posture",
      duration: 10,
      intensity: "Light",
    },
    allowedTypes: ["Stretching", "Yoga"],
    hydrationAdvice: "Drink generous water; avoid vigorous exertion until glucose decreases.",
  };
}
