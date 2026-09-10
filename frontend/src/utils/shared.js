/**
 * Shared Utility Functions — Single Source of Truth
 *
 * Eliminates duplication across modules and provides
 * cross-module data connectors.
 */

/* ── Date Helpers ── */

export function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export function getDateLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ── Safe localStorage Readers ── */

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

/* ── Cross-Module Data Connectors ── */

/**
 * Get the latest Food AI carbohydrate entry from the user's isolated history.
 * Used by: Glucose Prediction, Insulin Calculator, Diet Planner
 */
function getActiveFoodAIHistory(targetUserId) {
  try {
    const auth = safeRead("tiva_auth");
    const uid = targetUserId || auth?.userId;
    if (uid) {
      const userKey = `hypoguard_history_${uid}`;
      const arr = safeReadArray(userKey);
      return arr.filter((item) => item && !String(item.id || "").startsWith("seed-"));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function getLatestFoodCarbs(targetUserId) {
  const arr = getActiveFoodAIHistory(targetUserId);
  for (const entry of arr) {
    const carbs = entry.consumed_carbs_g ?? entry.carbs_g;
    if (carbs !== undefined && carbs !== null) {
      return {
        foodName: entry.food_name || "Recent meal",
        carbsGrams: Number(carbs) || 0,
        caloriesKcal: entry.consumed_calories_kcal ?? entry.calories_kcal != null
          ? Number(entry.consumed_calories_kcal ?? entry.calories_kcal) : null,
        proteinG: entry.consumed_protein_g ?? entry.protein_g != null
          ? Number(entry.consumed_protein_g ?? entry.protein_g) : null,
        savedAt: entry.createdAt || null,
      };
    }
  }
  return null;
}

export function getRecentFoodAIEntries(targetUserId) {
  const arr = getActiveFoodAIHistory(targetUserId);
  return arr.slice(0, 10).map((entry) => ({
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    foodName: entry.food_name || "Unknown Food",
    carbs: entry.consumed_carbs_g ?? (entry.carbs_g != null ? Number(entry.carbs_g) : null),
    protein: entry.consumed_protein_g ?? (entry.protein_g != null ? Number(entry.protein_g) : null),
    calories: entry.consumed_calories_kcal ?? (entry.calories_kcal != null ? Number(entry.calories_kcal) : null),
    fat: entry.consumed_fat_g ?? (entry.fat_g != null ? Number(entry.fat_g) : null),
    category: entry.category || "",
    servingSize: entry.serving_size || "",
    createdAt: entry.createdAt || null,
  }));
}

export function getFoodAIForDate(date) {
  const all = getActiveFoodAIHistory();
  return all.filter((e) => {
    if (e.date === date) return true;
    if (e.createdAt && e.createdAt.slice(0, 10) === date) return true;
    return false;
  });
}

/**
 * Get the latest glucose reading from tiva_glucose_history.
 * Used by: Insulin Calculator, Exercise Planner, Dashboard
 */
export function getLatestGlucoseReading() {
  const arr = safeReadArray("tiva_glucose_history");
  if (arr.length > 0) {
    const latest = arr[0];
    const val = Number(latest.currentGlucose ?? latest.value) || 110;
    return {
      value: val,
      currentGlucose: val,
      trend: latest.trend || "stable",
      predicted: latest.predictedGlucose ?? val,
      savedAt: latest.savedAt || null,
    };
  }

  // Fallback to active profile if history is empty
  try {
    const auth = safeRead("tiva_auth");
    const profiles = safeRead("tiva_profiles") || {};
    const p = (auth?.userId && profiles[auth.userId]) || Object.values(profiles)[0];
    if (p?.currentGlucose) {
      const val = Number(p.currentGlucose) || 110;
      return {
        value: val,
        currentGlucose: val,
        trend: "stable",
        predicted: val,
        savedAt: null,
      };
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Get glucose readings for a specific date.
 * Used by: Daily Report
 */
export function getGlucoseForDate(date) {
  const all = safeReadArray("tiva_glucose_history");
  return all.filter((g) => {
    if (g.savedDate === date) return true;
    if (g.savedAt && g.savedAt.slice(0, 10) === date) return true;
    return false;
  });
}

/**
 * Get the latest insulin log entry.
 * Used by: Dashboard, Daily Report
 */
export function getLatestInsulinLog() {
  const arr = safeReadArray("tiva_insulin_history");
  return arr.length > 0 ? arr[0] : null;
}

/**
 * Get insulin logs for a specific date.
 * Used by: Daily Report
 */
export function getInsulinForDate(date) {
  const all = safeReadArray("tiva_insulin_history");
  return all.filter((i) => {
    if (i.date === date) return true;
    if (i.savedAt && i.savedAt.slice(0, 10) === date) return true;
    return false;
  });
}

/**
 * Get the latest completed activity.
 * Used by: Glucose Prediction context, Dashboard
 */
export function getLatestActivity() {
  const arr = safeReadArray("tiva_activity_history");
  return arr.length > 0 ? arr[0] : null;
}

/**
 * Get activity entries for a specific date.
 * Used by: Daily Report
 */
export function getActivityForDate(date) {
  const all = safeReadArray("tiva_activity_history");
  return all.filter((a) => {
    if (a.date === date) return true;
    if (a.savedAt && a.savedAt.slice(0, 10) === date) return true;
    return false;
  });
}

/**
 * Calculate daily activity totals for a given date.
 * Used by: Dashboard, Exercise Planner
 */
export function calculateDailyActivityTotals(history, date) {
  const todayActivities = history.filter((a) => a.date === date);
  let totalDuration = 0;
  for (const a of todayActivities) {
    totalDuration += Number(a.duration) || 0;
  }
  return { count: todayActivities.length, totalDuration, todayActivities };
}

/**
 * Get today's completed activities from history.
 * Used by: Glucose Prediction activity context
 */
export function getTodayActivitySummary() {
  const today = getTodayString();
  const history = safeReadArray("tiva_activity_history");
  const todayActivities = history.filter((a) => a.date === today);
  if (todayActivities.length === 0) return null;

  let totalDuration = 0;
  let highestIntensity = "Light";
  const intensityOrder = { Light: 0, Moderate: 1, High: 2 };

  for (const a of todayActivities) {
    totalDuration += Number(a.duration) || 0;
    if (intensityOrder[a.intensity] > intensityOrder[highestIntensity]) {
      highestIntensity = a.intensity;
    }
  }

  return {
    count: todayActivities.length,
    totalDuration,
    highestIntensity,
    names: todayActivities.map((a) => a.activityName).join(", "),
  };
}

/**
 * Get today's meal summary from meal history.
 * Used by: Glucose Prediction, Insulin Calculator context
 */
export function getTodayMealSummary() {
  const today = getTodayString();
  const meals = safeReadArray("tiva_meal_history");
  const todayMeals = meals.filter((m) => m.date === today);
  if (todayMeals.length === 0) return null;

  let totalCarbs = 0;
  let totalProtein = 0;
  let totalCalories = 0;

  for (const m of todayMeals) {
    if (m.carbs != null) totalCarbs += Number(m.carbs) || 0;
    if (m.protein != null) totalProtein += Number(m.protein) || 0;
    if (m.calories != null) totalCalories += Number(m.calories) || 0;
  }

  return {
    count: todayMeals.length,
    totalCarbs,
    totalProtein,
    totalCalories,
    names: todayMeals.map((m) => m.foodName).join(", "),
  };
}

/**
 * Get today's nutrition totals from meal history.
 * Used by: Dashboard, Diet Planner
 */
export function calculateDailyTotals(meals, date) {
  const todayMeals = meals.filter((m) => m.date === date);
  let carbs = 0;
  let protein = 0;
  let calories = 0;

  for (const meal of todayMeals) {
    if (meal.carbs != null) carbs += Number(meal.carbs);
    if (meal.protein != null) protein += Number(meal.protein);
    if (meal.calories != null) calories += Number(meal.calories);
  }

  return { carbs, protein, calories, count: todayMeals.length, todayMeals };
}

/**
 * Group meals by category.
 * Used by: Diet Planner, Daily Report
 */
export function groupMealsByCategory(meals) {
  const groups = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
  for (const meal of meals) {
    const cat = meal.mealCategory || "Snacks";
    if (groups[cat]) groups[cat].push(meal);
    else groups.Snacks.push(meal);
  }
  return groups;
}

/**
 * Get a complete cross-module context snapshot.
 * Used by: Dashboard to show connected overview
 */
export function getConnectedContext() {
  const today = getTodayString();

  // Food AI
  const latestFoodCarbs = getLatestFoodCarbs();
  const recentFoodAI = getRecentFoodAIEntries();

  // Glucose
  const latestGlucose = getLatestGlucoseReading();
  const allGlucoseHistory = safeReadArray("tiva_glucose_history");

  // Insulin
  const latestInsulin = getLatestInsulinLog();
  const allInsulinHistory = safeReadArray("tiva_insulin_history");

  // Meals
  const allMeals = safeReadArray("tiva_meal_history");
  const todayMeals = allMeals.filter((m) => m.date === today);
  const mealTotals = calculateDailyTotals(allMeals, today);

  // Activity
  const allActivity = safeReadArray("tiva_activity_history");
  const todayActivity = calculateDailyActivityTotals(allActivity, today);
  const todayActivitySummary = getTodayActivitySummary();

  // Goals
  const nutritionGoals = safeRead("tiva_nutrition_goals") || { carbsGoal: "", proteinGoal: "", calorieGoal: "" };
  const activityGoals = safeRead("tiva_activity_goals") || { dailyActiveMinutes: "" };

  return {
    today,
    latestFoodCarbs,
    recentFoodAI,
    latestGlucose,
    allGlucoseHistory,
    latestInsulin,
    allInsulinHistory,
    allMeals,
    todayMeals,
    mealTotals,
    allActivity,
    todayActivity,
    todayActivitySummary,
    nutritionGoals,
    activityGoals,
  };
}
