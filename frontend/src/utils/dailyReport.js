/**
 * Daily Report — Data Aggregation Utility
 *
 * Collects ACTUAL data already stored in TIVA.
 * Does NOT invent missing values.
 */

import {
  getTodayString,
  getFoodAIForDate,
  getGlucoseForDate,
  getInsulinForDate,
  getActivityForDate,
  groupMealsByCategory,
} from "./shared";
import { loadAlertHistory } from "./alertManager";

/* ── Re-export shared functions for backward compatibility ── */
export { getTodayString };

/* ── Safe localStorage reader ── */
function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function safeReadArray(key) {
  const data = safeRead(key);
  return Array.isArray(data) ? data : [];
}

/* ── Date matching helper ── */
function matchesDate(entry, date) {
  if (!entry) return false;
  if (entry.date === date) return true;
  if (entry.savedAt && entry.savedAt.slice(0, 10) === date) return true;
  if (entry.createdAt && entry.createdAt.slice(0, 10) === date) return true;
  return false;
}

/* ── Auth / Profile ── */
export function getUserName() {
  try {
    const auth = safeRead("tiva_auth");
    if (auth && auth.name) return auth.name;
  } catch { /* ignore */ }
  return null;
}

export function getUserId() {
  try {
    const auth = safeRead("tiva_auth");
    if (auth && auth.userId) return auth.userId;
  } catch { /* ignore */ }
  return null;
}

/* ── Meals (tiva_meal_history) ── */
export function getMealsForDate(date) {
  const all = safeReadArray("tiva_meal_history");
  return all.filter((m) => matchesDate(m, date));
}

export function getMealTotals(meals) {
  let carbs = 0;
  let protein = 0;
  let calories = 0;
  for (const meal of meals) {
    if (meal.carbs != null) carbs += Number(meal.carbs);
    if (meal.protein != null) protein += Number(meal.protein);
    if (meal.calories != null) calories += Number(meal.calories);
  }
  return { carbs, protein, calories, count: meals.length, todayMeals: meals };
}

/* ── Re-export shared groupMealsByCategory ── */
// groupMealsByCategory is already exported from shared.js above

/* ── Food AI (hypoguard_history) ── */
export function getFoodAIEntries() {
  return safeReadArray("hypoguard_history");
}

/* ── Activity Plans (tiva_activity_plan) ── */
export function getActivityPlanForDate(date) {
  const all = safeReadArray("tiva_activity_plan");
  return all.filter((p) => p.date === date);
}

/* ── Goals ── */
export function getNutritionGoals() {
  return safeRead("tiva_nutrition_goals") || { carbsGoal: "", proteinGoal: "", calorieGoal: "" };
}

export function getActivityGoals() {
  return safeRead("tiva_activity_goals") || { dailyActiveMinutes: "" };
}

/* ── Full report aggregation for a given date ── */
export function aggregateReportData(date) {
  const userName = getUserName();
  const userId = getUserId();
  const meals = getMealsForDate(date);
  const mealTotals = getMealTotals(meals);
  const mealGroups = groupMealsByCategory(meals);

  const foodAIEntries = getFoodAIForDate(date);
  const allFoodAI = safeReadArray("hypoguard_history");
  const foodAI = { total: allFoodAI.length, filtered: foodAIEntries };
  const glucoseData = getGlucoseForDate(date);
  const insulinData = getInsulinForDate(date);
  const activityData = getActivityForDate(date);
  const activityPlanData = getActivityPlanForDate(date);
  const nutritionGoals = getNutritionGoals();
  const activityGoals = getActivityGoals();

  const totalActiveMinutes = activityData.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);

  // Alert data for this date
  let alertData = { alerts: [], totalAlerts: 0, unacknowledged: 0 };
  if (userId) {
    const allAlerts = loadAlertHistory(userId);
    const dateAlerts = allAlerts.filter((a) => {
      if (a.timestamp && a.timestamp.slice(0, 10) === date) return true;
      return false;
    });
    alertData = {
      alerts: dateAlerts.map((a) => ({
        type: a.type,
        status: a.status,
        severity: a.severity || "NONE",
        glucose: a.glucose,
        predictedGlucose: a.predictedGlucose,
        trend: a.trend,
        timestamp: a.timestamp,
        acknowledged: a.acknowledged,
        requiresEmergencyAttention: a.requiresEmergencyAttention || false,
        notificationStatus: a.notificationStatus || "NOT_REQUESTED",
      })),
      totalAlerts: dateAlerts.length,
      unacknowledged: dateAlerts.filter((a) => !a.acknowledged).length,
    };
  }

  return {
    date,
    userName,
    meals,
    mealTotals,
    mealGroups,
    foodAI,
    glucoseData,
    insulinData,
    activityData,
    activityPlanData,
    nutritionGoals,
    activityGoals,
    totalActiveMinutes,
    alertData,
  };
}
