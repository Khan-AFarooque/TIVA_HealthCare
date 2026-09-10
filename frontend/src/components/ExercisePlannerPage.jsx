import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  LayoutDashboard,
  Trash2,
  Save,
  Clock,
  Target,
  CheckCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  ACTIVITY_TYPES,
  INTENSITY_LEVELS,
  loadActivityHistory,
  saveActivity,
  deleteActivity,
  loadActivityPlan,
  savePlannedActivity,
  deletePlannedActivity,
  completePlannedActivity,
  loadActivityGoals,
  saveActivityGoals,
  getTodayString,
  calculateDailyActivityTotals,
  getLatestGlucoseContext,
} from "../utils/exercisePlanner";

function ProgressBar({ value, max, color = "bg-brand-blue" }) {
  if (!max || max <= 0) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const TREND_ICONS = { rising: TrendingUp, stable: Minus, falling: TrendingDown };
const TREND_COLORS = { rising: "text-orange-500", stable: "text-emerald-600", falling: "text-blue-500" };

export default function ExercisePlannerPage({ onBack }) {
  const today = getTodayString();

  // Data
  const [history, setHistory] = useState([]);
  const [plan, setPlan] = useState([]);
  const [goals, setGoals] = useState({ dailyActiveMinutes: "" });
  const [glucoseCtx, setGlucoseCtx] = useState(null);

  // Log form
  const [showLogForm, setShowLogForm] = useState(false);
  const [logActivity, setLogActivity] = useState("Walking");
  const [logCustom, setLogCustom] = useState("");
  const [logDuration, setLogDuration] = useState("");
  const [logIntensity, setLogIntensity] = useState("Moderate");
  const [logDate, setLogDate] = useState(today);
  const [logTime, setLogTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [logNotes, setLogNotes] = useState("");

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planActivity, setPlanActivity] = useState("Walking");
  const [planCustom, setPlanCustom] = useState("");
  const [planDuration, setPlanDuration] = useState("");
  const [planIntensity, setPlanIntensity] = useState("Moderate");
  const [planDate, setPlanDate] = useState(today);
  const [planTime, setPlanTime] = useState("");

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);

  // Load data on mount
  useEffect(() => {
    setHistory(loadActivityHistory());
    setPlan(loadActivityPlan());
    setGoals(loadActivityGoals());
    setGlucoseCtx(getLatestGlucoseContext());
  }, []);

  const daily = calculateDailyActivityTotals(history, today);
  const hasGoal = goals.dailyActiveMinutes != null && goals.dailyActiveMinutes !== "" && Number(goals.dailyActiveMinutes) > 0;

  // ── Handlers ──
  const handleSaveLog = useCallback(() => {
    const duration = Number(logDuration);
    if (!duration || duration <= 0) return;
    const name = logActivity === "Other" && logCustom.trim() ? logCustom.trim() : logActivity;
    const entry = {
      activityName: name,
      duration,
      intensity: logIntensity,
      date: logDate,
      time: logTime,
      notes: logNotes.trim(),
      source: "manual",
    };
    const updated = saveActivity(entry);
    setHistory(updated);
    setLogDuration("");
    setLogNotes("");
    setLogCustom("");
    setShowLogForm(false);
  }, [logActivity, logCustom, logDuration, logIntensity, logDate, logTime, logNotes]);

  const handleDeleteActivity = useCallback((id) => {
    const updated = deleteActivity(id);
    setHistory(updated);
  }, []);

  const handleSavePlan = useCallback(() => {
    const duration = Number(planDuration);
    if (!duration || duration <= 0) return;
    const name = planActivity === "Other" && planCustom.trim() ? planCustom.trim() : planActivity;
    const entry = {
      activityName: name,
      duration,
      intensity: planIntensity,
      date: planDate,
      time: planTime || null,
    };
    const updated = savePlannedActivity(entry);
    setPlan(updated);
    setPlanDuration("");
    setPlanCustom("");
    setShowPlanForm(false);
  }, [planActivity, planCustom, planDuration, planIntensity, planDate, planTime]);

  const handleDeletePlan = useCallback((id) => {
    const updated = deletePlannedActivity(id);
    setPlan(updated);
  }, []);

  const handleCompletePlan = useCallback((id) => {
    const { updatedPlan, completedEntry } = completePlannedActivity(id);
    setPlan(updatedPlan);
    if (completedEntry) {
      const updated = saveActivity(completedEntry);
      setHistory(updated);
    }
  }, []);

  const handleSaveGoals = useCallback(() => {
    saveActivityGoals(goals);
    setShowGoalForm(false);
  }, [goals]);

  const selectActivities = plan.filter((a) => a.date <= today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-strong p-6 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button type="button" onClick={onBack}
                className="p-2 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back to Dashboard">
                <LayoutDashboard className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-ink flex items-center gap-2">
                <HeartPulse className="h-6 w-6 text-brand-blue" /> Exercise Planner
              </h2>
              <p className="mt-1 text-slate-500">
                Educational activity planning and personal tracking — not medical advice.
              </p>
            </div>
          </div>
        </div>
      </div>



      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* ── Today's Activity Overview + Goals ── */}
          <div className="glass-strong p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-ink">Today's Activity — {today}</h3>
              <button type="button" onClick={() => setShowGoalForm(!showGoalForm)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue text-sm font-medium hover:bg-brand-blue/20 transition-colors cursor-pointer">
                <Target className="h-4 w-4" /> Set Daily Goal
              </button>
            </div>

            {/* Goal Form */}
            <AnimatePresence>
              {showGoalForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-3">
                    <label className="block text-sm font-medium text-slate-600">Daily Active Minutes Goal</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" value={goals.dailyActiveMinutes}
                        onChange={(e) => setGoals({ dailyActiveMinutes: e.target.value })}
                        placeholder="e.g. 30"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      <span className="text-sm text-slate-500">minutes</span>
                    </div>
                    <button type="button" onClick={handleSaveGoals}
                      className="px-4 py-2 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 transition-colors cursor-pointer">
                      Save Goal
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overview Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white/60 border border-slate-200/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Activities Logged</p>
                <p className="font-display text-xl font-bold text-brand-ink">{daily.count}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 border border-slate-200/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Total Duration</p>
                <p className="font-display text-xl font-bold text-brand-ink">{daily.totalDuration} <span className="text-sm font-medium text-slate-400">min</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 border border-slate-200/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Active Minutes</p>
                <p className="font-display text-xl font-bold text-brand-ink">{daily.totalDuration} <span className="text-sm font-medium text-slate-400">min</span></p>
                {hasGoal ? (
                  <>
                    <p className="text-xs text-slate-500 mt-1">of {goals.dailyActiveMinutes} min goal</p>
                    <div className="mt-2"><ProgressBar value={daily.totalDuration} max={Number(goals.dailyActiveMinutes)} color="bg-brand-blue" /></div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">No personal activity goal set</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Activity Logging ── */}
          <div className="glass-strong p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-ink flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-blue" /> Quick Activity Log
              </h3>
              <button type="button" onClick={() => setShowLogForm(!showLogForm)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue text-sm font-medium hover:bg-brand-blue/20 transition-colors cursor-pointer">
                {showLogForm ? "Close" : "Log Activity"}
              </button>
            </div>

            <AnimatePresence>
              {showLogForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-4">
                    {/* Activity Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Activity Type</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ACTIVITY_TYPES.map((t) => (
                          <button key={t} type="button" onClick={() => setLogActivity(t)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              logActivity === t
                                ? "bg-brand-blue text-white shadow-sm"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-brand-blue/40"
                            }`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {logActivity === "Other" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Custom Activity Name</label>
                        <input type="text" value={logCustom} onChange={(e) => setLogCustom(e.target.value)}
                          placeholder="e.g. Swimming"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Duration (min) *</label>
                        <input type="number" min="1" value={logDuration} onChange={(e) => setLogDuration(e.target.value)}
                          placeholder="e.g. 30"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Intensity</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {INTENSITY_LEVELS.map((l) => (
                            <button key={l} type="button" onClick={() => setLogIntensity(l)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                logIntensity === l
                                  ? "bg-brand-blue text-white shadow-sm"
                                  : "bg-white border border-slate-200 text-slate-600 hover:border-brand-blue/40"
                              }`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                        <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Time</label>
                        <input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Notes <span className="text-slate-400">(optional)</span></label>
                      <textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2}
                        placeholder="Any notes..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 resize-none" />
                    </div>

                    <button type="button" onClick={handleSaveLog} disabled={!logDuration || Number(logDuration) <= 0}
                      className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-medium hover:bg-brand-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2">
                      <Save className="h-4 w-4" /> Save Activity
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Activity Planner ── */}
          <div className="glass-strong p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-ink">Activity Planner</h3>
              <button type="button" onClick={() => setShowPlanForm(!showPlanForm)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue text-sm font-medium hover:bg-brand-blue/20 transition-colors cursor-pointer">
                {showPlanForm ? "Close" : "Add Planned Activity"}
              </button>
            </div>

            <AnimatePresence>
              {showPlanForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Activity Type</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ACTIVITY_TYPES.map((t) => (
                          <button key={t} type="button" onClick={() => setPlanActivity(t)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              planActivity === t
                                ? "bg-brand-blue text-white shadow-sm"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-brand-blue/40"
                            }`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    {planActivity === "Other" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Custom Activity Name</label>
                        <input type="text" value={planCustom} onChange={(e) => setPlanCustom(e.target.value)}
                          placeholder="e.g. Swimming"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Duration (min) *</label>
                        <input type="number" min="1" value={planDuration} onChange={(e) => setPlanDuration(e.target.value)}
                          placeholder="e.g. 30"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Intensity</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {INTENSITY_LEVELS.map((l) => (
                            <button key={l} type="button" onClick={() => setPlanIntensity(l)}
                              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                planIntensity === l
                                  ? "bg-brand-blue text-white shadow-sm"
                                  : "bg-white border border-slate-200 text-slate-600 hover:border-brand-blue/40"
                              }`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                        <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Time <span className="text-slate-400">(optional)</span></label>
                        <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/40" />
                      </div>
                    </div>
                    <button type="button" onClick={handleSavePlan} disabled={!planDuration || Number(planDuration) <= 0}
                      className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-medium hover:bg-brand-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2">
                      <Save className="h-4 w-4" /> Add to Activity Plan
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Planned Activities List */}
            {plan.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Planned Activities</p>
                {plan.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-slate-200/60 group">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{item.activityName}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span>{item.duration} min</span>
                        <span>{item.intensity}</span>
                        <span>{item.date}</span>
                        {item.time && <span>{item.time}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button type="button" onClick={() => handleCompletePlan(item.id)}
                        className="p-1.5 rounded-md text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        aria-label="Mark as completed">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDeletePlan(item.id)}
                        className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        aria-label="Delete plan">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Activity History ── */}
          <div className="glass-strong p-6 rounded-3xl space-y-4">
            <h3 className="font-display text-lg font-bold text-brand-ink">Activity History</h3>
            {daily.todayActivities.length === 0 && history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No activity logged today</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {history.slice(0, 30).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-slate-200/60 group">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{entry.activityName}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{entry.duration} min</span>
                        <span>{entry.intensity}</span>
                        <span>{entry.date}</span>
                        {entry.time && <span>{entry.time}</span>}
                        {entry.source === "planned" && <span className="text-brand-blue font-medium">From plan</span>}
                      </div>
                      {entry.notes && <p className="text-xs text-slate-400 mt-1 truncate">{entry.notes}</p>}
                    </div>
                    <button type="button" onClick={() => handleDeleteActivity(entry.id)}
                      className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer ml-2 shrink-0"
                      aria-label="Delete activity">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Glucose Context Panel ── */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="glass-strong p-5 rounded-3xl">
            <h3 className="font-display text-base font-bold text-brand-ink mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-blue" /> Glucose Context
            </h3>
            {glucoseCtx ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/60 border border-slate-200/60">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Latest Glucose</p>
                  <p className="font-display text-lg font-bold text-brand-ink">{glucoseCtx.glucose} <span className="text-sm font-medium text-slate-400">mg/dL</span></p>
                </div>
                <div className="p-3 rounded-xl bg-white/60 border border-slate-200/60">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Predicted Trend</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = TREND_ICONS[glucoseCtx.trend] || Minus;
                      const color = TREND_COLORS[glucoseCtx.trend] || "text-slate-500";
                      return <><Icon className={`h-5 w-5 ${color}`} /><span className={`font-display text-lg font-bold ${color}`}>{glucoseCtx.trend || "Unknown"}</span></>;
                    })()}
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Recent glucose information is shown for personal tracking context.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No recent glucose data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
