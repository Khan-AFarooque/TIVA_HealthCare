import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  X,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Clock,
  Activity,
  Utensils,
  ArrowRight,
  Save,
} from "lucide-react";
import { saveGlucosePrediction } from "../utils/glucosePrediction";
import { classifyGlucoseReading, getUserThresholds } from "../utils/glucoseSafety";
import { evaluateAndCreateAlert } from "../utils/alertManager";

export default function HypoRiskAssessmentModal({ isOpen, onClose, userId, latestGlucoseVal }) {
  const [currentGlucose, setCurrentGlucose] = useState(latestGlucoseVal ? String(latestGlucoseVal) : "");
  const [insulinUnits, setInsulinUnits] = useState("");
  const [mealTiming, setMealTiming] = useState("1-2-hours");
  const [recentActivity, setRecentActivity] = useState("none");
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleAssess = (e) => {
    e.preventDefault();
    const g = parseFloat(currentGlucose);
    if (isNaN(g) || g < 20 || g > 600) return;

    const ins = parseFloat(insulinUnits) || 0;

    // Simple, transparent clinical decision-support logic:
    // Glucose drops if:
    // - Active rapid insulin is on board (-15 to -30 mg/dL per unit impact)
    // - High physical exertion (-15 to -25 mg/dL)
    // - Long time since meal (>2 hours without carbs)
    let estimatedProjected = g;

    if (ins > 0) {
      estimatedProjected -= Math.min(60, ins * 12);
    }
    if (recentActivity === "moderate") estimatedProjected -= 15;
    if (recentActivity === "high") estimatedProjected -= 30;
    if (mealTiming === "more-than-2-hours") estimatedProjected -= 10;
    if (mealTiming === "just-eaten") estimatedProjected += 25;

    estimatedProjected = Math.max(30, Math.round(estimatedProjected));

    let riskLevel = "low";
    let riskTitle = "Normal Glycemic Stability";
    let riskColor = "emerald";
    let message = "Your glucose appears stable. No impending hypoglycemia detected.";

    if (g < 70 || estimatedProjected < 70) {
      riskLevel = "high";
      riskTitle = "⚠️ High Hypoglycemia Risk";
      riskColor = "red";
      message =
        "Current or projected glucose is below 70 mg/dL. Follow the 15-15 rule: consume 15g of fast-acting carbs (e.g. 4 oz juice, 3-4 glucose tablets) and recheck in 15 minutes.";
    } else if (g < 85 || estimatedProjected < 80) {
      riskLevel = "moderate";
      riskTitle = "⚠️ Borderline Low Risk";
      riskColor = "amber";
      message =
        "Glucose is approaching lower limits. Monitor closely, especially if insulin was recently taken or you plan to exercise.";
    } else if (g > 180 || estimatedProjected > 200) {
      riskLevel = "hyper";
      riskTitle = "Elevated Blood Glucose";
      riskColor = "orange";
      message = "Glucose is elevated above 180 mg/dL. Monitor hydration and follow your diabetes management plan.";
    }

    setResult({
      current: g,
      projected: estimatedProjected,
      riskLevel,
      riskTitle,
      riskColor,
      message,
    });
    setSaved(false);
  };

  const handleSave = () => {
    if (!result) return;
    const entry = {
      currentGlucose: result.current,
      predictedGlucose: result.projected,
      trend: result.projected < result.current ? "falling" : result.projected > result.current ? "rising" : "stable",
      rangeLow: Math.max(40, result.projected - 10),
      rangeHigh: result.projected + 10,
      readingTime: new Date().toTimeString().slice(0, 5),
      savedDate: new Date().toLocaleDateString(),
      source: "hypo_risk_assessment",
      explanations: [result.message],
    };

    saveGlucosePrediction(entry);
    setSaved(true);

    if (userId) {
      const { lowAlertThreshold, highAlertThreshold } = getUserThresholds(userId);
      const safetyCheck = classifyGlucoseReading({
        glucose: result.current,
        predictedGlucose: result.projected,
        trend: entry.trend,
        lowThreshold: lowAlertThreshold,
        highThreshold: highAlertThreshold,
        savedAt: new Date().toISOString(),
      });
      evaluateAndCreateAlert(userId, safetyCheck);
    }
  };

  const resetForm = () => {
    setResult(null);
    setSaved(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-display text-slate-900">Predict Hypoglycemia Risk</h3>
              <p className="text-xs text-slate-500">Quick clinical safety check — asks only what's needed</p>
            </div>
          </div>

          {/* Responsible AI Notice */}
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200/70 text-[11px] text-amber-900 leading-relaxed">
            <strong className="font-semibold">Decision-Support Only:</strong> TIVA does not diagnose or prescribe treatment. If you experience severe hypo symptoms (dizziness, shakiness, confusion), treat immediately.
          </div>

          {!result ? (
            <form onSubmit={handleAssess} className="mt-5 space-y-4">
              {/* Question 1: Current Glucose */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Current Blood Glucose Reading *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="20"
                    max="600"
                    required
                    value={currentGlucose}
                    onChange={(e) => setCurrentGlucose(e.target.value)}
                    placeholder="e.g. 95"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <span className="text-xs font-bold text-slate-500">mg/dL</span>
                </div>
              </div>

              {/* Question 2: Recent Rapid Insulin */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Rapid Insulin Taken in Past 2 Hours (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={insulinUnits}
                    onChange={(e) => setInsulinUnits(e.target.value)}
                    placeholder="0 if none"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <span className="text-xs font-medium text-slate-500">units</span>
                </div>
              </div>

              {/* Question 3: Time Since Last Meal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. When was your last meal or carb intake?
                </label>
                <select
                  value={mealTiming}
                  onChange={(e) => setMealTiming(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                >
                  <option value="just-eaten">Just eaten (&lt; 30 mins ago)</option>
                  <option value="1-2-hours">1 to 2 hours ago</option>
                  <option value="more-than-2-hours">More than 2 hours ago / Fasting</option>
                </select>
              </div>

              {/* Question 4: Recent Activity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Physical Activity in Past Hour
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "none", label: "Resting / None" },
                    { id: "moderate", label: "Light / Walking" },
                    { id: "high", label: "Intense Workout" },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setRecentActivity(act.id)}
                      className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                        recentActivity === act.id
                          ? "bg-red-50 border-red-400 text-red-800 font-bold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Evaluate Hypoglycemia Risk</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* Results View */
            <div className="mt-5 space-y-4">
              <div
                className={`p-5 rounded-2xl border-2 ${
                  result.riskLevel === "high"
                    ? "bg-red-50 border-red-300 text-red-950"
                    : result.riskLevel === "moderate"
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : result.riskLevel === "hyper"
                    ? "bg-orange-50 border-orange-300 text-orange-950"
                    : "bg-emerald-50 border-emerald-300 text-emerald-950"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Assessment Outcome</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      result.riskLevel === "high"
                        ? "bg-red-200 text-red-800"
                        : result.riskLevel === "moderate"
                        ? "bg-amber-200 text-amber-800"
                        : result.riskLevel === "hyper"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-emerald-200 text-emerald-800"
                    }`}
                  >
                    {result.riskTitle}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-3xl font-bold font-display">{result.current}</span>
                  <span className="text-sm font-medium text-slate-500">Current mg/dL</span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="text-2xl font-bold font-display text-slate-700">~{result.projected}</span>
                  <span className="text-xs text-slate-500">Est. 1h Trend</span>
                </div>

                <p className="text-xs sm:text-sm mt-3 leading-relaxed border-t border-slate-200/60 pt-3">
                  {result.message}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  ← Test Another Reading
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saved}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {saved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Saved & Alerts Checked
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save to Glucose History
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
