import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  LayoutDashboard,
  Trash2,
  Save,
  AlertTriangle,
  Utensils,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
  Plus,
  CheckCircle2,
  TrendingDown,
  Flame,
  Wheat,
  ShieldCheck,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  loadMealHistory,
  saveMealEntry,
  deleteMealEntry,
  loadNutritionGoals,
  saveNutritionGoals,
  getTodayString,
  getRecentFoodAIEntries,
  calculateDailyTotals,
  groupMealsByCategory,
  INDIAN_FOODS_CATALOG,
  searchFoods,
  getGlycemicRating,
  generateDiabeticMealPlan,
} from "../utils/dietPlanner";

const MEAL_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function MacroBar({ label, value, goal, unit = "g", color = "from-brand-blue to-emerald-400" }) {
  const numVal = Math.round(Number(value) || 0);
  const numGoal = Math.round(Number(goal) || 0);
  const pct = numGoal > 0 ? Math.min(100, Math.round((numVal / numGoal) * 100)) : 0;
  const isOver = numGoal > 0 && numVal > numGoal;

  return (
    <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-1.5 gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{label}</span>
        <span className="text-xs font-semibold text-slate-400 shrink-0">
          {numGoal > 0 ? `${pct}% of ${numGoal}${unit}` : "No target"}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="font-display text-2xl font-bold text-brand-ink">{numVal.toLocaleString()}</span>
        <span className="text-xs font-semibold text-slate-400">{unit}</span>
        {isOver && (
          <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
            Over budget
          </span>
        )}
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function DietPlannerPage({ onBack, userId }) {
  const today = getTodayString();
  const [activeTab, setActiveTab] = useState("planner"); // "planner" | "log" | "database"
  const [meals, setMeals] = useState([]);
  const [goals, setGoals] = useState({ carbsGoal: "150", proteinGoal: "70", calorieGoal: "1800" });
  const [foodAIEntries, setFoodAIEntries] = useState([]);

  // Smart 1-Click Generator State
  const [genDietType, setGenDietType] = useState("Vegetarian");
  const [genTargetCarbs, setGenTargetCarbs] = useState(150);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [planAppliedMessage, setPlanAppliedMessage] = useState(false);

  // Editable Meal Menu State (Allows editing Lunch, Breakfast, etc.)
  const [editingMeal, setEditingMeal] = useState(null);
  const [newDishName, setNewDishName] = useState("");
  const [newDishServing, setNewDishServing] = useState("1 portion");
  const [newDishCarbs, setNewDishCarbs] = useState("");
  const [newDishCalories, setNewDishCalories] = useState("");
  const [newDishProtein, setNewDishProtein] = useState("");

  // Quick Food Logger State (Streamlined Inputs)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [logCategory, setLogCategory] = useState("Breakfast");
  const [logPortion, setLogPortion] = useState(1); // 0.5, 1, 1.5, 2
  const [customFoodName, setCustomFoodName] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [isCustomEntry, setIsCustomEntry] = useState(false);

  // Load data on mount
  useEffect(() => {
    setMeals(loadMealHistory());
    const g = loadNutritionGoals();
    if (g && (g.carbsGoal || g.proteinGoal || g.calorieGoal)) {
      setGoals(g);
    }
    setFoodAIEntries(getRecentFoodAIEntries());

    // Generate initial clinical plan preview
    const initialPlan = generateDiabeticMealPlan({
      dietType: "Vegetarian",
      targetCarbs: 150,
      targetCalories: 1800,
    });
    setGeneratedPlan(initialPlan);
  }, []);

  const daily = calculateDailyTotals(meals, today);
  const grouped = groupMealsByCategory(daily.todayMeals);

  // Filtered food catalog for quick selector
  const searchResults = useMemo(() => {
    return searchFoods(searchQuery);
  }, [searchQuery]);

  // Compute calculated nutrition for selected food & portion
  const computedNutrition = useMemo(() => {
    if (isCustomEntry) {
      return {
        carbs: Number(customCarbs) || 0,
        protein: Number(customProtein) || 0,
        calories: Number(customCalories) || 0,
        fat: 0,
        gi: null,
      };
    }
    if (!selectedFood) return null;
    return {
      carbs: Math.round((selectedFood.carbs_g || 0) * logPortion * 10) / 10,
      protein: Math.round((selectedFood.protein_g || 0) * logPortion * 10) / 10,
      calories: Math.round((selectedFood.calories_kcal || 0) * logPortion),
      fat: Math.round((selectedFood.fat_g || 0) * logPortion * 10) / 10,
      gi: selectedFood.glycemic_index || null,
      recommendation: selectedFood.recommendation,
    };
  }, [selectedFood, logPortion, isCustomEntry, customCarbs, customProtein, customCalories]);

  // ── Handlers ──
  const handleGeneratePlan = () => {
    const plan = generateDiabeticMealPlan({
      dietType: genDietType,
      targetCarbs: genTargetCarbs,
      targetCalories: genTargetCarbs * 4 + 1000,
    });
    setGeneratedPlan(plan);
  };

  const handleApplyGeneratedPlan = () => {
    if (!generatedPlan) return;
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);

    let updatedList = [...meals];
    generatedPlan.meals.forEach((m) => {
      m.items.forEach((item) => {
        const entry = {
          foodName: item.name,
          mealCategory: m.category,
          serving: item.serving,
          carbs: item.carbs,
          protein: item.protein,
          fat: item.fat,
          calories: item.calories,
          glycemicIndex: item.gi,
          date: today,
          time: m.timing || timeStr,
          source: "smart_plan",
        };
        updatedList = saveMealEntry(entry);
      });
    });

    setMeals(updatedList);
    setPlanAppliedMessage(true);
    setTimeout(() => setPlanAppliedMessage(false), 3000);
  };

  const handleApplySingleMeal = (mealCategory, mealData) => {
    let updatedList = [...meals];
    mealData.items.forEach((item) => {
      const entry = {
        foodName: item.name,
        mealCategory: mealCategory,
        serving: item.serving,
        carbs: item.carbs,
        protein: item.protein,
        fat: item.fat,
        calories: item.calories,
        glycemicIndex: item.gi,
        date: today,
        time: mealData.timing || new Date().toTimeString().slice(0, 5),
        source: "smart_plan",
      };
      updatedList = saveMealEntry(entry);
    });
    setMeals(updatedList);
  };

  const handleClearTodayMeals = () => {
    if (!window.confirm("Are you sure you want to clear today's logged meals? This will reset today's totals to 0.")) return;
    const remaining = meals.filter((m) => m.date !== today);
    try {
      localStorage.setItem("tiva_meal_history", JSON.stringify(remaining));
      window.dispatchEvent(new Event("tiva-data-updated"));
    } catch { /* ignore */ }
    setMeals(remaining);
  };

  const handleSaveEditedMeal = (addToToday = false) => {
    if (!editingMeal || !generatedPlan) return;
    const updatedMeals = generatedPlan.meals.map((m) => {
      if (m.category === editingMeal.category) {
        return editingMeal;
      }
      return m;
    });

    const newTotals = {
      carbs: Math.round(updatedMeals.reduce((s, m) => s + m.items.reduce((si, i) => si + (i.carbs || 0), 0), 0)),
      protein: Math.round(updatedMeals.reduce((s, m) => s + m.items.reduce((si, i) => si + (i.protein || 0), 0), 0)),
      calories: Math.round(updatedMeals.reduce((s, m) => s + m.items.reduce((si, i) => si + (i.calories || 0), 0), 0)),
    };

    setGeneratedPlan({
      ...generatedPlan,
      meals: updatedMeals,
      totals: newTotals,
    });

    if (addToToday) {
      handleApplySingleMeal(editingMeal.category, editingMeal);
    }
    setEditingMeal(null);
  };

  const handleAddDishToEditingMeal = () => {
    if (!newDishName.trim()) return;
    const newItem = {
      name: newDishName.trim(),
      serving: newDishServing.trim() || "1 serving",
      carbs: Number(newDishCarbs) || 15,
      protein: Number(newDishProtein) || 3,
      fat: 2,
      calories: Number(newDishCalories) || Math.round((Number(newDishCarbs) || 15) * 4),
      gi: 45,
    };
    setEditingMeal({
      ...editingMeal,
      items: [...editingMeal.items, newItem],
    });
    setNewDishName("");
    setNewDishServing("1 portion");
    setNewDishCarbs("");
    setNewDishCalories("");
    setNewDishProtein("");
  };

  const handleRemoveDishFromEditingMeal = (idxToRemove) => {
    setEditingMeal({
      ...editingMeal,
      items: editingMeal.items.filter((_, idx) => idx !== idxToRemove),
    });
  };

  const handleAddQuickMeal = () => {
    const foodName = isCustomEntry ? customFoodName.trim() : selectedFood?.name;
    if (!foodName) return;

    const entry = {
      foodName,
      mealCategory: logCategory,
      serving: isCustomEntry ? "1 custom serving" : `${logPortion}x (${selectedFood?.serving_size || "standard"})`,
      carbs: computedNutrition?.carbs || 0,
      protein: computedNutrition?.protein || 0,
      fat: computedNutrition?.fat || 0,
      calories: computedNutrition?.calories || 0,
      glycemicIndex: computedNutrition?.gi || null,
      date: today,
      time: new Date().toTimeString().slice(0, 5),
      source: isCustomEntry ? "manual" : "catalog",
    };

    const updated = saveMealEntry(entry);
    setMeals(updated);

    // Reset inputs
    setSelectedFood(null);
    setCustomFoodName("");
    setCustomCarbs("");
    setCustomProtein("");
    setCustomCalories("");
    setSearchQuery("");
  };

  const handleDeleteMeal = useCallback((id) => {
    const updated = deleteMealEntry(id);
    setMeals(updated);
  }, []);

  const handleAddFoodAIItem = (entry) => {
    const meal = {
      foodName: entry.foodName,
      mealCategory: "Lunch",
      serving: entry.servingSize || "1 scanned serving",
      carbs: entry.carbs || 0,
      protein: entry.protein || 0,
      calories: entry.calories || 0,
      date: today,
      time: new Date().toTimeString().slice(0, 5),
      source: "food_ai",
    };
    const updated = saveMealEntry(meal);
    setMeals(updated);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header Banner ── */}
      <div className="glass-strong p-6 rounded-3xl border border-white/60 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-200/30 via-brand-blue/20 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2.5 rounded-2xl bg-white/80 border border-slate-200 text-slate-600 hover:text-brand-blue hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                aria-label="Back to Dashboard"
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl md:text-3xl font-bold text-brand-ink flex items-center gap-2.5">
                  <HeartPulse className="h-7 w-7 text-emerald-600" />
                  Clinical Diet Planner
                </h2>
                <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Diabetic Nutrition Engine
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 max-w-xl">
                Evidence-based Indian diabetic meal formulation. Pre-calculated glycemic load, macro ratios, and bolus timing.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("planner")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "planner"
                  ? "bg-white text-brand-blue shadow-sm"
                  : "text-slate-600 hover:text-brand-ink"
              }`}
            >
              <Sparkles className="h-4 w-4 text-emerald-500" />
              1-Click Smart Planner
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("log")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "log"
                  ? "bg-white text-brand-blue shadow-sm"
                  : "text-slate-600 hover:text-brand-ink"
              }`}
            >
              <Utensils className="h-4 w-4 text-brand-blue" />
              Today&apos;s Meal Log ({daily.count})
            </button>
            {daily.count > 0 && (
              <button
                type="button"
                onClick={handleClearTodayMeals}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-xs ml-1"
                title="Reset today's logged meals to 0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reset Today
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Daily Macro Radar Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MacroBar
          label="Carbohydrates"
          value={daily.carbs}
          goal={goals.carbsGoal}
          unit="g"
          color="from-emerald-500 to-teal-400"
        />
        <MacroBar
          label="Protein"
          value={daily.protein}
          goal={goals.proteinGoal}
          unit="g"
          color="from-blue-500 to-indigo-400"
        />
        <MacroBar
          label="Calories"
          value={daily.calories}
          goal={goals.calorieGoal}
          unit="kcal"
          color="from-orange-500 to-amber-400"
        />
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Glycemic Status</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-brand-ink flex items-center gap-1.5">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Low GI Focus
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {daily.carbs <= Number(goals.carbsGoal || 150)
                ? "Optimal postprandial control"
                : "Carb threshold reached"}
            </p>
          </div>
          <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-block text-center mt-2">
            Target: ≤ {goals.carbsGoal || 150}g carbs/day
          </div>
        </div>
      </div>

      {/* ── TAB 1: SMART 1-CLICK DIABETIC MEAL PLANNER ── */}
      {activeTab === "planner" && (
        <div className="space-y-6">
          {/* Formulator Controls */}
          <div className="glass-strong p-6 rounded-3xl border border-white/60 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h3 className="font-display text-lg font-bold text-brand-ink flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  Diabetic Meal Prescription Generator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your dietary preference and target carb ceiling. We formulate a customized 4-meal Indian clinical plan.
                </p>
              </div>

              {/* Simplified Inputs */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Dietary Preference Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Diet Style
                  </label>
                  <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    {["Vegetarian", "Non-Vegetarian", "Jain"].map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setGenDietType(style)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          genDietType === style
                            ? "bg-brand-blue text-white shadow-sm"
                            : "text-slate-600 hover:text-brand-ink"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Carbs Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Carb Target
                  </label>
                  <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    {[
                      { label: "Strict (120g)", val: 120 },
                      { label: "Balanced (150g)", val: 150 },
                      { label: "Active (180g)", val: 180 },
                    ].map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => setGenTargetCarbs(t.val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          genTargetCarbs === t.val
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-brand-ink"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <div className="self-end">
                  <button
                    type="button"
                    onClick={handleGeneratePlan}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:brightness-110 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Plan
                  </button>
                </div>
              </div>
            </div>

            {/* Plan Applied Notification */}
            <AnimatePresence>
              {planAppliedMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Entire day&apos;s meal plan added to today&apos;s log successfully!
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generated Plan Display */}
          {generatedPlan && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-brand-ink text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                    <Wheat className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-display text-base font-bold flex items-center gap-2">
                      {genDietType} Diabetic Formulation
                      <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                        {generatedPlan.glycemicSummary.riskLevel}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Total Planned: <strong>{generatedPlan.totals.carbs}g Carbs</strong> ·{" "}
                      <strong>{generatedPlan.totals.protein}g Protein</strong> ·{" "}
                      <strong>{generatedPlan.totals.calories} kcal</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyGeneratedPlan}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors shadow-lg cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Adopt Full Plan to Today ({today})
                  </button>
                </div>
              </div>

              {/* 4 Meal Cards Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {generatedPlan.meals.map((meal) => {
                  const mealCarbs = meal.items.reduce((s, i) => s + (i.carbs || 0), 0);
                  const mealProtein = meal.items.reduce((s, i) => s + (i.protein || 0), 0);
                  const mealCalories = meal.items.reduce((s, i) => s + (i.calories || 0), 0);

                  return (
                    <div
                      key={meal.category}
                      className="glass-strong p-5 rounded-3xl border border-white/70 shadow-md hover:border-brand-blue/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Meal Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                              {meal.category}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {meal.timing}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-brand-ink">
                              {Math.round(mealCarbs)}g Carbs
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {Math.round(mealCalories)} kcal · {Math.round(mealProtein)}g pro
                            </span>
                          </div>
                        </div>

                        {/* Meal Title */}
                        <h5 className="font-display text-base font-bold text-brand-ink mb-3">
                          {meal.name}
                        </h5>

                        {/* Itemized Foods */}
                        <div className="space-y-2 mb-4">
                          {meal.items.map((item, idx) => {
                            const giRating = getGlycemicRating(item.gi);
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 rounded-2xl bg-white/70 border border-slate-200/60 text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-700">{item.name}</span>
                                  <span className="text-slate-400 block text-[10px]">{item.serving}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${giRating.badgeBg} ${giRating.textColor} ${giRating.color}`}
                                  >
                                    GI {item.gi || "Low"}
                                  </span>
                                  <span className="font-bold text-slate-600">{item.carbs}g C</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Clinical Advice Box */}
                        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 text-[11px] text-emerald-900 space-y-1 mb-4">
                          <p className="font-semibold flex items-center gap-1.5 text-emerald-800">
                            <Info className="h-3.5 w-3.5 text-emerald-600" />
                            {meal.spikeTip}
                          </p>
                          <p className="text-slate-600 pl-5">
                            <strong>Bolus:</strong> {meal.bolusAdvice}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons for meal */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingMeal(JSON.parse(JSON.stringify(meal)))}
                          className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-brand-blue text-xs font-bold transition-all border border-blue-200/80 cursor-pointer flex items-center justify-center gap-1.5"
                          title="Edit items, portions, and carbs in this menu"
                        >
                          ✏️ Edit {meal.category}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplySingleMeal(meal.category, meal)}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add to Today
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: STREAMLINED LOG & TODAY'S MEAL MANAGEMENT ── */}
      {activeTab === "log" && (
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          {/* Quick Add Food Card (Streamlined Inputs) */}
          <div className="space-y-4">
            <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-base font-bold text-brand-ink flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-brand-blue" />
                  Quick Meal Logger
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCustomEntry(!isCustomEntry)}
                  className="text-[11px] font-bold text-brand-blue hover:underline cursor-pointer"
                >
                  {isCustomEntry ? "Pick from 78 Indian Foods" : "+ Custom Item"}
                </button>
              </div>

              {/* Meal Category Picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Meal Category
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {MEAL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLogCategory(cat)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        logCategory === cat
                          ? "bg-brand-blue text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {!isCustomEntry ? (
                <>
                  {/* Search Food from 78-item Indian Foods Catalog */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Select Indian Food
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Chapati, Paneer, Dal, Biryani..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                  </div>

                  {/* Food Suggestions Carousel / List */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-2xl p-1 bg-slate-50/50">
                    {searchResults.map((food) => {
                      const isSelected = selectedFood?.name === food.name;
                      return (
                        <button
                          key={food.name}
                          type="button"
                          onClick={() => setSelectedFood(food)}
                          className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-brand-blue text-white shadow-sm"
                              : "bg-white hover:bg-slate-100 border border-slate-100 text-slate-700"
                          }`}
                        >
                          <div>
                            <span className="font-bold block">{food.name}</span>
                            <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                              {food.serving_size}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold block">{food.carbs_g}g C</span>
                            <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                              {food.calories_kcal} kcal
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Portion Multiplier */}
                  {selectedFood && (
                    <div className="p-3.5 rounded-2xl bg-brand-blue/5 border border-brand-blue/20 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-brand-ink">{selectedFood.name}</span>
                        <span className="text-slate-500 font-medium">GI: {selectedFood.glycemic_index || "50"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Portion:</span>
                        {[0.5, 1, 1.5, 2].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setLogPortion(m)}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              logPortion === m
                                ? "bg-brand-blue text-white"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {m}x
                          </button>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-brand-blue/10 flex justify-between text-xs font-bold text-slate-700">
                        <span>Carbs: {computedNutrition?.carbs}g</span>
                        <span>Protein: {computedNutrition?.protein}g</span>
                        <span>Calories: {computedNutrition?.calories} kcal</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Custom Entry Fallback */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Food Item Name
                    </label>
                    <input
                      type="text"
                      value={customFoodName}
                      onChange={(e) => setCustomFoodName(e.target.value)}
                      placeholder="e.g. Oats with Almond Milk"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Carbs (g)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customCarbs}
                        onChange={(e) => setCustomCarbs(e.target.value)}
                        placeholder="e.g. 30"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Protein (g)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customProtein}
                        onChange={(e) => setCustomProtein(e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Calories
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customCalories}
                        onChange={(e) => setCustomCalories(e.target.value)}
                        placeholder="e.g. 200"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleAddQuickMeal}
                disabled={!isCustomEntry && !selectedFood}
                className="w-full py-3 rounded-2xl bg-brand-blue text-white font-bold text-xs hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-blue/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add to {logCategory} Log
              </button>
            </div>

            {/* Food AI Scanned Items Quick Insert */}
            {foodAIEntries.length > 0 && (
              <div className="glass-strong p-5 rounded-3xl border border-white/70 shadow-sm">
                <h4 className="font-display text-xs font-bold text-brand-ink uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Recent Scans from Food AI
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {foodAIEntries.slice(0, 4).map((scan) => (
                    <div
                      key={scan.id}
                      className="p-2 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">{scan.foodName}</span>
                        <span className="text-[10px] text-slate-400">
                          {scan.carbs != null ? `${scan.carbs}g Carbs` : "Scanned"} · {scan.calories} kcal
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddFoodAIItem(scan)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Today's Meals Timeline / Breakdown */}
          <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-brand-ink">
                  Today&apos;s Nutrition Journal
                </h3>
                <p className="text-xs text-slate-400">{today} · {daily.count} items recorded</p>
              </div>
              <div className="text-right">
                <span className="font-display text-xl font-bold text-emerald-600">
                  {daily.carbs}g
                </span>
                <span className="text-xs text-slate-400 block">Total Carbs</span>
              </div>
            </div>

            {/* Categorized Timeline */}
            <div className="space-y-6">
              {MEAL_CATEGORIES.map((cat) => {
                const catMeals = grouped[cat] || [];
                const catCarbs = catMeals.reduce((s, m) => s + (m.carbs || 0), 0);

                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-blue" />
                        {cat}
                        <span className="text-[10px] text-slate-400 font-semibold">({catMeals.length})</span>
                      </span>
                      {catCarbs > 0 && (
                        <span className="text-xs font-bold text-slate-600">{catCarbs}g Carbs</span>
                      )}
                    </div>

                    {catMeals.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 pl-4 border-l-2 border-slate-100">
                        No foods recorded for {cat.toLowerCase()}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {catMeals.map((meal) => {
                          const giRating = getGlycemicRating(meal.glycemicIndex);
                          return (
                            <div
                              key={meal.id}
                              className="p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-sm flex items-center justify-between group hover:border-brand-blue/40 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-brand-ink truncate">
                                    {meal.foodName}
                                  </span>
                                  {meal.source === "smart_plan" && (
                                    <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                      Prescribed
                                    </span>
                                  )}
                                  {meal.source === "food_ai" && (
                                    <span className="text-[9px] font-bold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                      AI Scan
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                  <span>{meal.serving}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {meal.time}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                <div className="text-right">
                                  <span className="font-bold text-sm text-slate-800 block">
                                    {meal.carbs != null ? `${meal.carbs}g` : "0g"}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {meal.calories || 0} kcal
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteMeal(meal.id)}
                                  className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  aria-label="Delete meal"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT / CUSTOMIZE MEAL MODAL ── */}
      {editingMeal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-brand-blue/10 text-brand-blue">
                    {editingMeal.category}
                  </span>
                  <h3 className="font-display text-lg font-bold text-brand-ink">
                    Customize {editingMeal.category} Menu
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMeal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  &times;
                </button>
              </div>

              {/* Current Items List */}
              <div className="space-y-2 max-h-48 overflow-y-auto mb-4 pr-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Menu Items ({editingMeal.items.length})
                </label>
                {editingMeal.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span className="text-slate-400 block text-[10px]">{item.serving}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">
                        {item.carbs}g C
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDishFromEditingMeal(idx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove this dish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {editingMeal.items.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">No dishes in this menu. Add one below!</p>
                )}
              </div>

              {/* Add Custom Dish Form */}
              <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2.5 mb-4">
                <p className="text-xs font-bold text-brand-ink flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-brand-blue" />
                  Add Custom Dish / Item to {editingMeal.category}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newDishName}
                      onChange={(e) => setNewDishName(e.target.value)}
                      placeholder="e.g. Brown Rice / Salad / Roti"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={newDishCarbs}
                      onChange={(e) => setNewDishCarbs(e.target.value)}
                      placeholder="Carbs (g)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newDishServing}
                      onChange={(e) => setNewDishServing(e.target.value)}
                      placeholder="Serving (e.g. 1 bowl)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={newDishCalories}
                      onChange={(e) => setNewDishCalories(e.target.value)}
                      placeholder="Calories (kcal)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                  <div className="self-end">
                    <button
                      type="button"
                      onClick={handleAddDishToEditingMeal}
                      disabled={!newDishName.trim()}
                      className="w-full py-2 rounded-xl bg-brand-blue text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      + Add Dish
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingMeal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedMeal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Save Menu
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedMeal(true)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-sm"
              >
                Save &amp; Add to Today
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
