import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  HeartPulse,
  LayoutDashboard,
  FileText,
  Bell,
  Wheat,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Phone,
  MessageSquare,
  ExternalLink,
  Plus,
  CheckCircle,
  Clock,
  Utensils,
  Droplet,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  User,
  Activity,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import LoginPage from "./components/LoginPage";
import OnboardingPage from "./components/OnboardingPage";
import ProfilePage from "./components/ProfilePage";
import FoodAIPage from "./components/FoodAIPage";
import GlucosePredictionPage from "./components/GlucosePredictionPage";
import InsulinCalculatorPage from "./components/InsulinCalculatorPage";
import DietPlannerPage from "./components/DietPlannerPage";
import ExercisePlannerPage from "./components/ExercisePlannerPage";
import DailyReportPage from "./components/DailyReportPage";
import AlertsPage from "./components/AlertsPage";
import EmergencyDispatchModal from "./components/EmergencyDispatchModal";
import UserFeedbackModal from "./components/UserFeedbackModal";
import DashboardCgmGraph from "./components/DashboardCgmGraph";
import DashboardAnalyticsHub from "./components/DashboardAnalyticsHub";
import { playEmergencyAlarm, stopEmergencyAlarm } from "./utils/audioAlert";
import { getConnectedContext } from "./utils/shared";
import {
  runSafetyCheckAndAlert,
  getUnacknowledgedAlertCount,
  getLatestAlert,
  getCaregiverInfo,
  saveCaregiverInfo,
  formatTelPhone,
  buildCaregiverSOSMessage,
  getCaregiverWhatsAppUrl,
  triggerCaregiverCall,
  maskPhone,
} from "./utils/alertManager";
import { getSafetyStatusLabel, getSafetyStatusColor } from "./utils/glucoseSafety";
import { autoPredictFromStoredData, saveGlucosePrediction } from "./utils/glucosePrediction";
import { saveMealEntry } from "./utils/dietPlanner";
import { saveInsulinLog } from "./utils/insulinCalculator";

// --- TIVA Logo Path ---
const TIVA_LOGO = `${import.meta.env.BASE_URL}assets/tiva-logo.png`;

// --- Sidebar Navigation Items ---
const SIDEBAR_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, title: "Dashboard", desc: "Clinical Intelligence Hub" },
  { id: "profile", icon: User, title: "Profile", desc: "Patient Parameters & Clinical Targets" },
  { id: "food-ai", icon: Sparkles, title: "Food AI", desc: "Food Recognition & Carb Estimator" },
  { id: "glucose-pred", icon: TrendingUp, title: "Glucose Prediction", desc: "Dual-Horizon LSTM Glycemic Forecast" },
  { id: "insulin-calc", icon: ShieldCheck, title: "Insulin Calculator", desc: "Clinical Bolus & Correction Dosing" },
  { id: "diet-planner", icon: Utensils, title: "Diet Planner", desc: "Diabetic Meal Plans & Nutrition" },
  { id: "exercise-planner", icon: HeartPulse, title: "Exercise Planner", desc: "Activity Schedules & Hypo Prevention" },
  { id: "daily-report", icon: FileText, title: "Daily Report", desc: "Diagnostic Patient Consultation Summary" },
];

// --- Authentication state ---
const AUTH_KEY = "tiva_auth";
const USERS_KEY = "tiva_users";
const PROFILES_KEY = "tiva_profiles";
const LEGACY_PROFILE_KEY = "tiva_profile";

function migrateLegacyProfile(userId) {
  try {
    const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed === "object") {
        const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
        if (!profiles[userId]) {
          profiles[userId] = parsed;
          localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
        }
      }
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    }
  } catch { /* ignore */ }
}

function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);

  const login = useCallback((name, id) => {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ isLoggedIn: true, name, userId: id, ts: Date.now() }));
      migrateLegacyProfile(id);
    } catch { /* ignore */ }
    setIsLoggedIn(true);
    setUserName(name);
    setUserId(id);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch { /* ignore */ }
    setIsLoggedIn(false);
    setUserName("");
    setUserId(null);
  }, []);

  const resetSession = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch { /* ignore */ }
    setIsLoggedIn(false);
    setUserName("");
    setUserId(null);
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      if (stored) {
        const auth = JSON.parse(stored);
        if (active && auth && auth.isLoggedIn && auth.name && auth.userId) {
          const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
          const userExists = users.some((u) => u.id === auth.userId);
          if (userExists) {
            setIsLoggedIn(true);
            setUserName(auth.name);
            setUserId(auth.userId);
            migrateLegacyProfile(auth.userId);
          } else {
            localStorage.removeItem(AUTH_KEY);
          }
        } else {
          localStorage.removeItem(AUTH_KEY);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_KEY);
    }
    return () => { active = false; };
  }, []);

  return { isLoggedIn, userName, userId, login, logout, resetSession };
}

function useProfile(userId) {
  const [profile, setProfile] = useState(null);

  const updateProfile = useCallback((newData) => {
    setProfile(newData);
    if (!userId) return;
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
      profiles[userId] = newData;
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
      if (profiles[userId] && typeof profiles[userId] === "object") {
        setProfile(profiles[userId]);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, [userId]);

  return { profile, updateProfile };
}

// Dashboard content component
function DashboardContent({ userName, profile, onNavigate, userId }) {
  const [ctx, setCtx] = useState(() => getConnectedContext());
  const [safetyStatus, setSafetyStatus] = useState(null);
  const [unackAlerts, setUnackAlerts] = useState(0);
  const [latestAlert, setLatestAlert] = useState(null);
  const [autoPrediction, setAutoPrediction] = useState(null);
  const [caregiver, setCaregiver] = useState(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchModalMode, setDispatchModalMode] = useState("call"); // "call" | "whatsapp"

  // Quick Vitals Input Bar State (Streamlined essentials only)
  const [activeQuickTab, setActiveQuickTab] = useState("glucose"); // "glucose" | "carbs" | "insulin"
  const [quickGlucose, setQuickGlucose] = useState("");
  const [quickTrend, setQuickTrend] = useState("stable");
  const [quickCarbs, setQuickCarbs] = useState("");
  const [quickMealCategory, setQuickMealCategory] = useState("Lunch");
  const [quickInsulin, setQuickInsulin] = useState("");
  const [quickInsulinType, setQuickInsulinType] = useState("rapid");
  const [logSuccessMsg, setLogSuccessMsg] = useState("");

  // Refresh data when localStorage changes
  useEffect(() => {
    const refresh = () => {
      setCtx(getConnectedContext());
      if (userId) {
        const cg = getCaregiverInfo(userId);
        setCaregiver((prev) => {
          if (!prev && !cg) return prev;
          if (prev && cg && prev.name === cg.name && prev.phone === cg.phone && prev.relationship === cg.relationship) {
            return prev;
          }
          return cg;
        });

        const auto = autoPredictFromStoredData(userId, { autoSave: true });
        setAutoPrediction(auto ? auto.prediction : null);

        const { safetyResult } = runSafetyCheckAndAlert(userId);
        setSafetyStatus(safetyResult);
        setUnackAlerts(getUnacknowledgedAlertCount(userId));
        setLatestAlert(getLatestAlert(userId));
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("tiva-data-updated", refresh);
    window.addEventListener("tiva-alert-updated", refresh);
    const interval = setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tiva-data-updated", refresh);
      window.removeEventListener("tiva-alert-updated", refresh);
      clearInterval(interval);
    };
  }, [userId]);

  const { latestGlucose, latestInsulin, mealTotals, todayActivity, recentFoodAI } = ctx;

  const TREND_MAP = {
    rising: { icon: TrendingUp, color: "text-orange-500", label: "↑ Rising" },
    stable: { icon: Minus, color: "text-emerald-600", label: "→ Stable" },
    falling: { icon: TrendingDown, color: "text-blue-500", label: "↓ Falling" },
  };

  const INSULIN_TYPE_MAP = {
    rapid: "Rapid / mealtime",
    "long-acting": "Long-acting / basal",
    other: "Other",
  };

  // ── Handlers for Caregiver Dispatch ──
  const openCallModal = (e) => {
    e?.preventDefault();
    setDispatchModalMode("call");
    setDispatchModalOpen(true);
    if (caregiver?.phone) {
      triggerCaregiverCall(caregiver.phone);
    }
  };

  const openWhatsAppModal = (e) => {
    e?.preventDefault();
    setDispatchModalMode("whatsapp");
    setDispatchModalOpen(true);
    if (caregiver?.phone) {
      const url = getCaregiverWhatsAppUrl(
        caregiver.phone,
        buildCaregiverSOSMessage({
          patientName: userName,
          caregiverName: caregiver.name,
          glucose: latestGlucose?.currentGlucose,
          predictedGlucose: latestGlucose?.predictedGlucose,
          trend: latestGlucose?.trend,
          status: safetyStatus?.status || "ROUTINE_CHECK",
        })
      );
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  // ── Handlers for Quick Vitals Input Bar ──
  const handleLogGlucose = (e) => {
    e?.preventDefault();
    const val = Number(quickGlucose);
    if (!val || val < 20 || val > 600) return;
    saveGlucosePrediction({
      currentGlucose: val,
      trend: quickTrend,
      source: "dashboard_quick_log",
    });
    setQuickGlucose("");
    setLogSuccessMsg(`Logged ${val} mg/dL (${quickTrend})`);
    setTimeout(() => setLogSuccessMsg(""), 3500);
    window.dispatchEvent(new Event("tiva-data-updated"));
    window.dispatchEvent(new Event("tiva-alert-updated"));
  };

  const handleLogCarbs = (e) => {
    e?.preventDefault();
    const c = Number(quickCarbs);
    if (!c || c <= 0) return;
    const now = new Date();
    saveMealEntry({
      foodName: `${quickMealCategory} Meal`,
      mealCategory: quickMealCategory,
      serving: "Quick log",
      carbs: c,
      calories: Math.round(c * 4),
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      source: "dashboard_quick_log",
    });
    setQuickCarbs("");
    setLogSuccessMsg(`Logged ${c}g carbs for ${quickMealCategory}`);
    setTimeout(() => setLogSuccessMsg(""), 3500);
    window.dispatchEvent(new Event("tiva-data-updated"));
  };

  const handleLogInsulin = (e) => {
    e?.preventDefault();
    const u = Number(quickInsulin);
    if (!u || u <= 0) return;
    saveInsulinLog({
      amount: u,
      type: quickInsulinType,
      time: new Date().toISOString(),
      source: "dashboard_quick_log",
    });
    setQuickInsulin("");
    setLogSuccessMsg(`Logged ${u}u ${quickInsulinType} insulin`);
    setTimeout(() => setLogSuccessMsg(""), 3500);
    window.dispatchEvent(new Event("tiva-data-updated"));
  };

  const hasData =
    latestGlucose ||
    latestInsulin ||
    mealTotals.count > 0 ||
    todayActivity.count > 0 ||
    recentFoodAI.length > 0;

  const isCritical =
    safetyStatus &&
    (safetyStatus.status === "CRITICAL_LOW" || safetyStatus.status === "CRITICAL_HIGH");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* ── Executive Hero Status Header ── */}
      <div className="glass-strong p-6 rounded-3xl border border-white/60 shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-brand-ink">
                Welcome, {userName} 👋
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                CGM Live
              </span>
            </div>
            <p className="mt-1 text-xs md:text-sm text-slate-500">
              TIVA Clinical Monitoring &middot; Diabetic Management Command Center
            </p>
          </div>

          {/* ── Caregiver Quick Action Bar ── */}
          <div className="flex flex-wrap items-center gap-2.5 p-2 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm">
            <div className="px-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Caregiver Emergency
              </span>
              <span className="text-xs font-bold text-brand-ink">
                {caregiver?.name ? caregiver.name : "Not Configured"}
              </span>
            </div>

            <button
              type="button"
              onClick={openCallModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-sm cursor-pointer"
              title="Call Caregiver phone directly"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </button>
            <button
              type="button"
              onClick={openWhatsAppModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-sm cursor-pointer"
              title="Send immediate WhatsApp SOS alert"
            >
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp SOS
            </button>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE PROFESSIONAL CONTINUOUS GLUCOSE MONITOR (CGM) GRAPH ── */}
      <DashboardCgmGraph
        currentGlucose={latestGlucose?.currentGlucose || latestGlucose?.value || profile?.currentGlucose || 110}
        currentTrend={latestGlucose?.trend || "stable"}
      />

      {/* ── CLINICAL HEALTH RISK & MULTI-METRIC ANALYTICS SUITE ── */}
      <DashboardAnalyticsHub
        currentGlucose={latestGlucose?.currentGlucose || latestGlucose?.value || profile?.currentGlucose || 110}
        currentTrend={latestGlucose?.trend || "stable"}
        activeInsulin={latestInsulin?.amount || 1.2}
        carbsLogged={mealTotals.carbs || 45}
      />

      {/* ── Critical Alert Banner (When urgent) ── */}
      {isCritical && (
        <div className="p-5 rounded-3xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-display text-base font-bold text-rose-900">
                CRITICAL GLUCOSE ALERT:{" "}
                {safetyStatus.status === "CRITICAL_LOW"
                  ? "Severe Hypoglycemia Detected"
                  : "Severe Hyperglycemia Detected"}
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Current Glucose: <strong>{safetyStatus.glucose || latestGlucose?.currentGlucose} mg/dL</strong>.
                Immediate action required!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openCallModal}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Phone className="h-4 w-4" /> Call Caregiver
            </button>
            <button
              type="button"
              onClick={openWhatsAppModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <MessageSquare className="h-4 w-4" /> WhatsApp SOS
            </button>
            <button
              type="button"
              onClick={() => onNavigate("alerts")}
              className="px-3.5 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 font-bold text-xs hover:bg-rose-50 cursor-pointer"
            >
              Escalate Plan
            </button>
          </div>
        </div>
      )}

      {/* ── STREAMLINED ESSENTIAL QUICK VITALS INPUT BAR ── */}
      <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-brand-ink flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-blue" />
              Quick Vitals Logger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rapid, single-click entry for daily clinical essentials.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {[
              { id: "glucose", label: "🩸 Glucose (mg/dL)" },
              { id: "carbs", label: "🍽️ Meal Carbs (g)" },
              { id: "insulin", label: "💉 Insulin (Units)" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveQuickTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeQuickTab === tab.id
                    ? "bg-brand-blue text-white shadow-sm"
                    : "text-slate-600 hover:text-brand-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form Fields */}
        <div>
          {activeQuickTab === "glucose" && (
            <form onSubmit={handleLogGlucose} className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Blood Glucose Reading
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="20"
                    max="600"
                    value={quickGlucose}
                    onChange={(e) => setQuickGlucose(e.target.value)}
                    placeholder="e.g. 115"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    mg/dL
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Trend Arrow
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {[
                    { id: "rising", label: "↑ Rising" },
                    { id: "stable", label: "→ Stable" },
                    { id: "falling", label: "↓ Falling" },
                  ].map((tr) => (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => setQuickTrend(tr.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        quickTrend === tr.id
                          ? "bg-white text-brand-ink shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="self-end">
                <button
                  type="submit"
                  disabled={!quickGlucose}
                  className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-blue/20 cursor-pointer"
                >
                  Log Glucose
                </button>
              </div>
            </form>
          )}

          {activeQuickTab === "carbs" && (
            <form onSubmit={handleLogCarbs} className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Carbohydrates
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={quickCarbs}
                    onChange={(e) => setQuickCarbs(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    grams
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Meal Category
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {["Breakfast", "Lunch", "Dinner", "Snacks"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setQuickMealCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        quickMealCategory === cat
                          ? "bg-white text-brand-ink shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="self-end">
                <button
                  type="submit"
                  disabled={!quickCarbs}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Log Carbs
                </button>
              </div>
            </form>
          )}

          {activeQuickTab === "insulin" && (
            <form onSubmit={handleLogInsulin} className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Insulin Dose
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    value={quickInsulin}
                    onChange={(e) => setQuickInsulin(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    Units
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Insulin Type
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {[
                    { id: "rapid", label: "Rapid / Mealtime" },
                    { id: "long-acting", label: "Basal / Long-Acting" },
                  ].map((typ) => (
                    <button
                      key={typ.id}
                      type="button"
                      onClick={() => setQuickInsulinType(typ.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        quickInsulinType === typ.id
                          ? "bg-white text-brand-ink shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {typ.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="self-end">
                <button
                  type="submit"
                  disabled={!quickInsulin}
                  className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-violet-600/20 cursor-pointer"
                >
                  Log Dose
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Success Feedback Toast */}
        {logSuccessMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            {logSuccessMsg}
          </div>
        )}
      </div>

      {/* ── EXECUTIVE KPI METRIC CARDS ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Blood Glucose Status */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:border-brand-blue/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Blood Glucose
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-brand-blue border border-blue-200">
                Target: 70-140
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-brand-ink">
                {latestGlucose ? (latestGlucose.currentGlucose ?? latestGlucose.value) : (profile?.currentGlucose || "—")}
              </span>
              <span className="text-xs font-semibold text-slate-400">mg/dL</span>

              {latestGlucose?.trend && (
                <span className={`text-xs font-bold ml-auto ${TREND_MAP[latestGlucose.trend]?.color}`}>
                  {TREND_MAP[latestGlucose.trend]?.label}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Status: <strong>{safetyStatus ? getSafetyStatusLabel(safetyStatus.status) : "Normal"}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate("glucose-pred")}
              className="text-brand-blue font-bold hover:underline"
            >
              Trend &rarr;
            </button>
          </div>
        </div>

        {/* 2. Today's Net Carbs vs Goal */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Daily Carbs
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Goal: {profile?.carbGoal || "150"}g
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-brand-ink">
                {mealTotals.carbs > 0 ? Math.round(mealTotals.carbs) : "0"}
              </span>
              <span className="text-xs font-semibold text-slate-400">g consumed</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((mealTotals.carbs / Number(profile?.carbGoal || 150)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {mealTotals.count} meal{mealTotals.count === 1 ? "" : "s"} logged
            </span>
            <button
              type="button"
              onClick={() => onNavigate("diet-planner")}
              className="text-emerald-600 font-bold hover:underline"
            >
              Plan Meals &rarr;
            </button>
          </div>
        </div>

        {/* 3. Latest Insulin Log */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:border-violet-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Insulin
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                {latestInsulin ? INSULIN_TYPE_MAP[latestInsulin.type] || latestInsulin.type : "No logs"}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-brand-ink">
                {latestInsulin ? String(latestInsulin.amount) : "—"}
              </span>
              <span className="text-xs font-semibold text-slate-400">Units</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Dose tracking active</span>
            <button
              type="button"
              onClick={() => onNavigate("insulin-calc")}
              className="text-violet-600 font-bold hover:underline"
            >
              Calculate &rarr;
            </button>
          </div>
        </div>

        {/* 4. 30-min Horizon Forecast */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                +30m Forecast
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                LSTM Neural Net
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-brand-ink">
                {autoPrediction?.predictedGlucose || latestGlucose?.predictedGlucose || "—"}
              </span>
              <span className="text-xs font-semibold text-slate-400">mg/dL</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {autoPrediction?.trend ? TREND_MAP[autoPrediction.trend]?.label : "Projection ready"}
            </span>
            <button
              type="button"
              onClick={() => onNavigate("glucose-pred")}
              className="text-brand-blue font-bold hover:underline"
            >
              CGM Curve &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ── Today's Nutrition & Diet Pulse Widget ── */}
      <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Utensils className="h-5 w-5 text-emerald-600" />
            <h3 className="font-display text-base font-bold text-brand-ink">
              Today&apos;s Diet &amp; Nutrition Pulse
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("diet-planner")}
            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
          >
            Open Diet Planner <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <span className="font-bold text-emerald-900 block mb-1">Carb Allowance</span>
            <span className="text-lg font-bold text-emerald-700">
              {Math.max(0, Number(profile?.carbGoal || 150) - Math.round(mealTotals.carbs))}g
            </span>
            <span className="text-slate-500 block text-[11px] mt-0.5">Remaining today</span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80">
            <span className="font-bold text-blue-900 block mb-1">Glycemic Target</span>
            <span className="text-lg font-bold text-blue-700">Low GI (&le;55)</span>
            <span className="text-slate-500 block text-[11px] mt-0.5">Slow absorption diet</span>
          </div>

          <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-200/80">
            <span className="font-bold text-violet-900 block mb-1">Food AI Scans</span>
            <span className="text-lg font-bold text-violet-700">{recentFoodAI.length} Scanned</span>
            <span className="text-slate-500 block text-[11px] mt-0.5">Recognized via camera</span>
          </div>
        </div>
      </div>

      {/* ── Connected Modules Grid ── */}
      <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg">
        <h3 className="font-display text-base font-bold text-brand-ink mb-4">
          TIVA Clinical Modules
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={Sparkles}
            title="Food AI"
            desc="Recognize 50 Indian food classes using dual Teachable Machine models. Real-time carb estimation."
            onClick={() => onNavigate("food-ai")}
          />
          <ModuleCard
            icon={Zap}
            title="Glucose Prediction"
            desc="Dual-horizon LSTM curve (+30m &amp; +60m) with CGM CSV import &amp; hypo warning alerts."
            onClick={() => onNavigate("glucose-pred")}
          />
          <ModuleCard
            icon={ShieldCheck}
            title="Insulin Calculator"
            desc="Educational bolus calculation integrating carb counting, active insulin (IOB), and ISF."
            onClick={() => onNavigate("insulin-calc")}
          />
          <ModuleCard
            icon={HeartPulse}
            title="Diet Planner"
            desc="1-Click clinical Indian diabetic meal generator with glycemic index badges and macro balance."
            onClick={() => onNavigate("diet-planner")}
          />
          <ModuleCard
            icon={HeartPulse}
            title="Exercise Planner"
            desc="Weekly exercise schedule with intensity, duration, and pre/post glucose check reminders."
            onClick={() => onNavigate("exercise-planner")}
          />
          <ModuleCard
            icon={FileText}
            title="Daily Report"
            desc="Generate clinical summary PDF reports with nutrition, glucose logs, insulin data, and activity."
            onClick={() => onNavigate("daily-report")}
          />
        </div>
      </div>

      {/* ── Emergency Dispatch Modal (Calling & WhatsApp) ── */}
      <EmergencyDispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        initialMode={dispatchModalMode}
        caregiver={caregiver}
        patientName={userName}
        glucose={latestGlucose?.currentGlucose}
        predictedGlucose={latestGlucose?.predictedGlucose}
        trend={latestGlucose?.trend}
        status={safetyStatus?.status || "GLUCOSE_CHECK"}
        userId={userId}
        onCaregiverUpdated={(updated) => setCaregiver(updated)}
      />
    </div>
  );
}

// StatCard component
function StatCard({ icon: Icon, title, value, unit, subtitle, accent, progress }) {
  return (
    <div className="glass p-5 rounded-2xl">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        {progress !== undefined && (
          <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full ${accent.replace("bg-", "bg-")} transition-all duration-500`} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        <p className="font-display text-2xl font-bold text-brand-ink mt-1">
          {value} <span className="text-lg font-medium text-slate-400">{unit}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

// QuickActionCard component - uses button with onClick
function QuickActionCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass group p-5 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-blue/10 border border-transparent hover:border-brand-blue/20 cursor-pointer"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="mt-3 font-display font-bold text-brand-ink">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </button>
  );
}

// ModuleCard component - uses button with onClick (not <a>) for consistent SPA navigation
function ModuleCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass group p-5 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-blue/10 border border-transparent hover:border-brand-blue/20 cursor-pointer w-full text-left"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="mt-3 font-display font-bold text-brand-ink">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </button>
  );
}

// Placeholder module components
function PlaceholderModule({ icon: Icon, title, desc, onBack }) {
  return (
    <div className="glass-strong p-6 rounded-3xl text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/10 mx-auto mb-4">
        <Icon className="h-8 w-8 text-brand-blue" />
      </div>
      <h3 className="font-display text-xl font-bold text-brand-ink mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">{desc}</p>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-blue text-white font-medium transition-all duration-200 hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/30 cursor-pointer"
      >
        <LayoutDashboard className="h-4 w-4" /> Back to Dashboard
      </button>
    </div>
  );
}

export default function App() {
  const { isLoggedIn, userName, userId, login, logout } = useAuth();
  const { profile, updateProfile } = useProfile(userId);

  const [currentView, setCurrentView] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unackAlerts, setUnackAlerts] = useState(0);
  const [hazardAlertActive, setHazardAlertActive] = useState(false);
  const [globalDispatchOpen, setGlobalDispatchOpen] = useState(false);
  const [globalDispatchMode, setGlobalDispatchMode] = useState("call");
  const [globalHazardDetail, setGlobalHazardDetail] = useState(null);
  const [globalCaregiver, setGlobalCaregiver] = useState(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Track unacknowledged alerts globally & listen for emergency hazard alerts
  useEffect(() => {
    if (!isLoggedIn || !userId) { setUnackAlerts(0); return; }
    const refresh = () => {
      setUnackAlerts(getUnacknowledgedAlertCount(userId));
      const cg = getCaregiverInfo(userId);
      setGlobalCaregiver((prev) => {
        if (!prev && !cg) return prev;
        if (prev && cg && prev.name === cg.name && prev.phone === cg.phone && prev.relationship === cg.relationship) {
          return prev;
        }
        return cg;
      });
    };
    refresh();

    const handleHazard = (e) => {
      const detail = e.detail || {};
      setHazardAlertActive(true);
      setGlobalHazardDetail(detail);
    };

    window.addEventListener("tiva-alert-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("tiva-glucose-hazard-alert", handleHazard);
    const interval = setInterval(refresh, 3000);
    return () => {
      window.removeEventListener("tiva-alert-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tiva-glucose-hazard-alert", handleHazard);
      clearInterval(interval);
    };
  }, [isLoggedIn, userId]);

  useEffect(() => {
    const updateViewFromHash = () => {
      const hash = window.location.hash.slice(1) || "dashboard";
      setCurrentView(hash);
    };
    updateViewFromHash();
    window.addEventListener("hashchange", updateViewFromHash);
    return () => window.removeEventListener("hashchange", updateViewFromHash);
  }, []);

  const navigate = useCallback((view) => {
    setCurrentView(view);
    window.location.hash = `#${view}`;
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setCurrentView("dashboard");
    window.location.hash = "#dashboard";
  }, [logout]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={(name, id) => login(name, id)} />;
  }

  if (!profile) {
    return (
      <OnboardingPage
        userId={userId}
        onComplete={(profileData) => {
          updateProfile(profileData);
          navigate("dashboard");
        }}
        onSkip={() => {
          updateProfile({
            fullName: userName,
            age: "30",
            gender: "Male",
            height: "170",
            currentWeight: "70",
            targetWeight: "65",
            currentGlucose: "90",
            targetGlucose: "100",
            lowThreshold: "70",
            highThreshold: "180",
            insulinType: "Rapid-acting",
            usesCGM: false,
            usesPump: false,
            tdd: "10",
            icr: "1:15",
            isf: "50",
            activeInsulinTime: "3",
            activityLevel: "Moderate",
            weightGoal: "65",
            carbGoal: "200",
            proteinGoal: "80",
          });
          navigate("dashboard");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-800 bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <style>{`
        :root {
          --brand-blue: #3b82f6;
          --emerald-500: #10b981;
          --brand-ink: #0f172a;
        }
      `}</style>

      <div className="min-h-screen text-slate-800 bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex flex-col">
        {/* Top Medical Welcome Marquee Ticker */}
        <div className="bg-gradient-to-r from-brand-ink via-slate-900 to-brand-ink text-white py-1.5 px-4 overflow-hidden border-b border-slate-800 text-xs shadow-inner flex items-center z-50">
          <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-slate-700/80 mr-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-400">CLINICAL LIVE</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap flex-1">
            <div className="animate-clinical-marquee font-medium text-slate-200 space-x-8 text-xs">
              <span>👋 Welcome to TIVA Clinical Monitoring System</span>
              <span>&bull;</span>
              <span>🩺 Continuous Ambulatory Glucose Monitoring Active</span>
              <span>&bull;</span>
              <span>⚡ Dual-Horizon LSTM Prediction Engine Online</span>
              <span>&bull;</span>
              <span>🚨 Emergency Caregiver Dialing &amp; WhatsApp SOS Ready</span>
              <span>&bull;</span>
              <span>🥗 Indian Diabetic Nutrition &amp; Glycemic Index Analysis Online</span>
              <span>&bull;</span>
              <span>💧 Keep hydration optimal and verify bolus dosing prior to physical activity</span>
            </div>
          </div>
        </div>

        {/* Sticky Top Header Bar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="mx-auto flex w-full items-center justify-between px-4 sm:px-6 py-2.5">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-xl text-slate-600 hover:text-brand-blue hover:bg-slate-100 transition-colors md:hidden cursor-pointer"
                aria-label="Open Navigation Menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* TIVA Logo */}
              <div
                className="flex items-center cursor-pointer group"
                onClick={() => navigate("dashboard")}
                title="Go to Dashboard Overview"
              >
                <img
                  src={TIVA_LOGO}
                  onError={(e) => { e.currentTarget.src = "./assets/tiva-logo.png"; }}
                  alt="TIVA Logo"
                  className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </div>
            </div>

            {/* Right Side Header Items */}
            <div className="flex items-center gap-3 sm:gap-4">
              {isLoggedIn && userName && (
                <div
                  onClick={() => navigate("profile")}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                  title="View / Edit Profile"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Patient: <strong className="text-brand-ink">{userName}</strong></span>
                </div>
              )}

              {/* Direct Caregiver Emergency Call Button */}
              <button
                type="button"
                onClick={() => {
                  setGlobalDispatchMode("call");
                  setGlobalDispatchOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-xs shadow-sm shadow-rose-600/25 transition-all cursor-pointer"
                title="Directly call or alert designated caregiver"
              >
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Call Caregiver</span>
              </button>

              {/* User Feedback Button */}
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-all cursor-pointer shadow-xs"
                title="Share User Feedback & Review Experience"
              >
                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Feedback</span>
              </button>

              {/* Critical Hazard Alert & Bell Icon */}
              <button
                type="button"
                onClick={() => {
                  stopEmergencyAlarm();
                  setHazardAlertActive(false);
                  navigate("alerts");
                }}
                className={`relative transition-all p-2.5 rounded-xl cursor-pointer ${
                  hazardAlertActive
                    ? "bg-rose-600 text-white animate-bounce ring-4 ring-rose-400 shadow-lg shadow-rose-600/50"
                    : "text-slate-600 hover:text-brand-blue hover:bg-slate-100 border border-slate-200/80"
                }`}
                aria-label="Alerts"
                title={hazardAlertActive ? "CRITICAL GLUCOSE HAZARD! Click to view alerts & silence alarm" : "View clinical alerts"}
              >
                <Bell className={`h-5 w-5 ${hazardAlertActive ? "animate-pulse" : ""}`} />
                {hazardAlertActive ? (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-700 text-[9px] font-bold text-white items-center justify-center">!</span>
                  </span>
                ) : unackAlerts > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold px-1 ring-2 ring-white">
                    {unackAlerts > 9 ? "9+" : unackAlerts}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200/80 transition-all cursor-pointer"
                title="Logout from session"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main Body Container: Left Sidebar + Right Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* DESKTOP COLLAPSIBLE SIDEBAR */}
          <aside
            className={`hidden md:flex flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-md transition-all duration-300 z-30 shrink-0 sticky top-[57px] h-[calc(100vh-57px)] ${
              isSidebarCollapsed ? "w-20" : "w-64"
            }`}
          >
            {/* Sidebar Header & Collapse Toggle */}
            <div className={`p-3 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
              {!isSidebarCollapsed && (
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pl-2">
                  Navigation
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-xl text-slate-500 hover:text-brand-blue hover:bg-slate-100 transition-colors cursor-pointer"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto no-scrollbar" aria-label="Sidebar navigation">
              {SIDEBAR_ITEMS.map(({ id, icon: Icon, title, desc }) => {
                const isActive = currentView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(id)}
                    className={`w-full flex items-center gap-3 rounded-xl py-2.5 transition-all duration-200 cursor-pointer ${
                      isSidebarCollapsed ? "justify-center px-2" : "px-3.5"
                    } ${
                      isActive
                        ? "bg-gradient-to-r from-brand-blue to-indigo-600 text-white shadow-md shadow-brand-blue/25 font-bold"
                        : "text-slate-600 hover:text-brand-blue hover:bg-slate-100/80 font-medium"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                    title={isSidebarCollapsed ? `${title} — ${desc}` : desc}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!isSidebarCollapsed && (
                      <span className="text-sm truncate">{title}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Sidebar Footer Info */}
            {!isSidebarCollapsed && isLoggedIn && userName && (
              <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2">
                <div
                  onClick={() => navigate("profile")}
                  className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                  title="Edit Profile"
                >
                  <div className="h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate">{userName}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Active Session</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200/80 transition-colors cursor-pointer"
                  title="Share User Feedback"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Give Feedback</span>
                </button>
              </div>
            )}
          </aside>

          {/* MOBILE DRAWER OVERLAY */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-50 md:hidden flex">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
                />
                <motion.div
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="relative w-72 bg-white h-full shadow-2xl z-10 flex flex-col p-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <img
                        src={TIVA_LOGO}
                        onError={(e) => { e.currentTarget.src = "./assets/tiva-logo.png"; }}
                        alt="TIVA Logo"
                        className="h-8 w-auto"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto">
                    {SIDEBAR_ITEMS.map(({ id, icon: Icon, title }) => {
                      const isActive = currentView === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            navigate(id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all cursor-pointer ${
                            isActive
                              ? "bg-gradient-to-r from-brand-blue to-indigo-600 text-white shadow-md shadow-brand-blue/25"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span>{title}</span>
                        </button>
                      );
                    })}
                  </nav>

                  {isLoggedIn && userName && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 truncate">{userName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setIsFeedbackOpen(true);
                          }}
                          className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          Feedback
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* MAIN PAGE CONTENT */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <main className="flex-1 p-4 md:p-8">
              <section className="space-y-6" aria-live="polite">
                {currentView === "dashboard" && (
                  <DashboardContent userName={userName} profile={profile} onNavigate={navigate} userId={userId} />
                )}
                {currentView === "profile" && (
                  <ProfilePage
                    profile={profile}
                    onUpdateProfile={updateProfile}
                    userId={userId}
                    onBack={() => navigate("dashboard")}
                  />
                )}
                {currentView === "food-ai" && <FoodAIPage onBack={() => navigate("dashboard")} userId={userId} />}
                {currentView === "glucose-pred" && (
                  <GlucosePredictionPage onBack={() => navigate("dashboard")} userId={userId} />
                )}
                {currentView === "insulin-calc" && (
                  <InsulinCalculatorPage onBack={() => navigate("dashboard")} userId={userId} />
                )}
                {currentView === "diet-planner" && (
                  <DietPlannerPage onBack={() => navigate("dashboard")} userId={userId} />
                )}
                {currentView === "exercise-planner" && (
                  <ExercisePlannerPage onBack={() => navigate("dashboard")} userId={userId} />
                )}
                {currentView === "daily-report" && (
                  <DailyReportPage
                    onBack={() => navigate("dashboard")}
                    userId={userId}
                    profile={profile}
                    userName={userName}
                  />
                )}
                {currentView === "alerts" && (
                  <AlertsPage onBack={() => navigate("dashboard")} userId={userId} />
                )}
              </section>
            </main>

            {/* Corporate Copyright Footer */}
            <footer className="py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white/40">
              <p>
                &copy; {new Date().getFullYear()} TIVA Clinical Monitoring System. All rights reserved.
              </p>
            </footer>
          </div>
        </div>

        {/* Global Emergency Call & WhatsApp Dispatch Modal */}
        <EmergencyDispatchModal
          isOpen={globalDispatchOpen}
          onClose={() => {
            stopEmergencyAlarm();
            setHazardAlertActive(false);
            setGlobalDispatchOpen(false);
          }}
          initialMode={globalDispatchMode}
          caregiver={globalCaregiver}
          patientName={userName}
          glucose={globalHazardDetail?.glucose}
          predictedGlucose={globalHazardDetail?.predictedGlucose}
          trend=""
          status={globalHazardDetail?.level === "low" ? "GLUCOSE_CRITICAL_LOW" : "GLUCOSE_CRITICAL_HIGH"}
          userId={userId}
          onCaregiverUpdated={(updated) => setGlobalCaregiver(updated)}
        />

        {/* User Feedback Modal */}
        <UserFeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          userId={userId}
        />
      </div>
    </div>
  );
}