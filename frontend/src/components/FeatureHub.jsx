import React from "react";
import {
  ShieldAlert,
  Zap,
  Sparkles,
  Utensils,
  Droplets,
  Activity,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

export default function FeatureHub({ onSelectFeature }) {
  const FEATURES = [
    {
      id: "hypo-risk",
      title: "Predict Hypoglycemia Risk",
      badge: "Safety Check",
      badgeColor: "bg-red-50 text-red-700 border-red-200",
      desc: "Fast clinical check for impending low blood sugar (<70 mg/dL). Asks only current glucose, recent insulin & meal timing.",
      icon: ShieldAlert,
      iconColor: "text-red-600 bg-red-100",
      actionText: "Start Risk Check",
    },
    {
      id: "glucose-pred",
      title: "Predict Future Glucose",
      badge: "30 & 60-Min AI",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      desc: "Forecast 30-min and 60-min glucose trends using CGM time-series or manual pre-meal glucose reading.",
      icon: Zap,
      iconColor: "text-blue-600 bg-blue-100",
      actionText: "Open Forecast",
    },
    {
      id: "food-ai",
      title: "Scan Indian Food & Carbs",
      badge: "Food AI Model",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      desc: "Upload or photograph any of 78 Indian foods to estimate net carbs, calories, proteins, and diabetic advice.",
      icon: Sparkles,
      iconColor: "text-emerald-600 bg-emerald-100",
      actionText: "Open Food Scanner",
    },
    {
      id: "log-meal",
      title: "Log Meal",
      badge: "Nutrition Tracking",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      desc: "Record meal carbohydrates and track daily intake toward your personal nutrition goals.",
      icon: Utensils,
      iconColor: "text-amber-600 bg-amber-100",
      actionText: "Log Food Intake",
    },
    {
      id: "insulin-calc",
      title: "Log Insulin Dose",
      badge: "Dose Logging Only",
      badgeColor: "bg-violet-50 text-violet-700 border-violet-200",
      desc: "Keep a historical record of administered insulin doses (units, brand, timestamp). Does not prescribe doses.",
      icon: Droplets,
      iconColor: "text-violet-600 bg-violet-100",
      actionText: "Log Insulin Dose",
    },
    {
      id: "exercise-planner",
      title: "Log Physical Activity",
      badge: "Contextual Activity",
      badgeColor: "bg-pink-50 text-pink-700 border-pink-200",
      desc: "Record walking, cardio, or workouts (minutes & intensity) to track your daily lifestyle habits.",
      icon: Activity,
      iconColor: "text-pink-600 bg-pink-100",
      actionText: "Log Exercise",
    },
  ];

  return (
    <div className="glass-strong p-6 sm:p-7 rounded-3xl space-y-4 border border-slate-200/80 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
            What would you like to do?
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Select a single task below. TIVA will ask only for the specific information needed for that action.
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 self-start sm:self-auto">
          Simplified Flow
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        {FEATURES.map((feat) => {
          const Icon = feat.icon;
          return (
            <button
              key={feat.id}
              type="button"
              onClick={() => onSelectFeature(feat.id)}
              className="glass group p-5 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-blue/10 border border-slate-200/70 hover:border-brand-blue/30 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`p-2.5 rounded-xl ${feat.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${feat.badgeColor}`}>
                    {feat.badge}
                  </span>
                </div>
                <h4 className="font-bold font-display text-slate-900 group-hover:text-brand-blue transition-colors text-base">
                  {feat.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{feat.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-blue">
                <span>{feat.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
