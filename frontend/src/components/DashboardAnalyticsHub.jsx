import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Activity,
  HeartPulse,
  TrendingDown,
  TrendingUp,
  Minus,
  PieChart,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Droplets,
  Flame,
} from "lucide-react";

/**
 * DashboardAnalyticsHub
 *
 * Professional Endocrinology Analytics Suite:
 * 1. Health Risk & Hypo Danger Matrix (Threat Score, Stability Index, Hyper Risk, Nocturnal Exposure)
 * 2. Time in Range (TIR) Consensus Distribution Chart
 * 3. Metabolic Pharmacodynamics: Carb Ingestion vs. Insulin Bio-Activity Curve
 */
export default function DashboardAnalyticsHub({
  currentGlucose = 110,
  currentTrend = "stable",
  activeInsulin = 1.2,
  carbsLogged = 45,
}) {
  const [selectedTab, setSelectedTab] = useState("risk"); // "risk" | "tir" | "metabolic"

  // 1. Dynamic Health Risk Computations
  const riskAnalysis = useMemo(() => {
    const g = Number(currentGlucose) || 110;
    let hypoScore = 8;
    let hyperScore = 15;
    let stabilityPct = 88;
    let statusLabel = "Optimal Glycemic Stability";
    let statusColor = "text-emerald-700 bg-emerald-50 border-emerald-200";

    if (g < 54) {
      hypoScore = 96;
      hyperScore = 2;
      stabilityPct = 28;
      statusLabel = "CRITICAL SEVERE HYPOGLYCEMIA";
      statusColor = "text-red-700 bg-red-50 border-red-300 animate-pulse";
    } else if (g < 70) {
      hypoScore = 82;
      hyperScore = 4;
      stabilityPct = 45;
      statusLabel = "ELEVATED HYPO RISK";
      statusColor = "text-rose-700 bg-rose-50 border-rose-200";
    } else if (g > 220) {
      hypoScore = 5;
      hyperScore = 92;
      stabilityPct = 35;
      statusLabel = "SEVERE HYPERGLYCEMIA";
      statusColor = "text-red-700 bg-red-50 border-red-300";
    } else if (g > 140) {
      hypoScore = 8;
      hyperScore = 68;
      stabilityPct = 65;
      statusLabel = "ELEVATED POSTPRANDIAL GLUCOSE";
      statusColor = "text-amber-700 bg-amber-50 border-amber-200";
    }

    if (currentTrend === "falling") {
      hypoScore = Math.min(100, hypoScore + 22);
      stabilityPct = Math.max(10, stabilityPct - 18);
    } else if (currentTrend === "rising") {
      hyperScore = Math.min(100, hyperScore + 25);
      stabilityPct = Math.max(10, stabilityPct - 15);
    }

    // Nocturnal Hypo Vulnerability
    const nocturnalRisk = g < 95 && activeInsulin > 1.5 ? "High (Bedtime Snack Needed)" : "Low / Protected";

    return {
      hypoScore,
      hyperScore,
      stabilityPct,
      statusLabel,
      statusColor,
      nocturnalRisk,
    };
  }, [currentGlucose, currentTrend, activeInsulin]);

  // 2. Time in Range (TIR) Breakdown Values
  const tirData = useMemo(() => {
    const g = Number(currentGlucose) || 110;
    let target = 78;
    let high = 16;
    let low = 5;
    let vLow = 1;

    if (g < 70) {
      target = 55;
      low = 28;
      vLow = 8;
      high = 9;
    } else if (g > 180) {
      target = 48;
      high = 46;
      low = 4;
      vLow = 2;
    }

    return { target, high, low, vLow };
  }, [currentGlucose]);

  // 3. Metabolic Pharmacodynamics SVG Points (Carb curve vs Insulin curve over 4 hours)
  const pharmacodynamics = useMemo(() => {
    // 0h to 4h at 15-min intervals (16 points)
    const points = [];
    const carbPeak = Math.max(30, Number(carbsLogged) || 45);
    const insulinPeak = Math.max(1.5, Number(activeInsulin) * 2.2 || 3.0);

    for (let i = 0; i <= 16; i++) {
      const hours = i * 0.25; // 0, 0.25, 0.5, ... 4.0
      // Carb curve: peaks around 45 min (0.75h)
      const carbVal = Math.round(carbPeak * Math.sin(Math.min(Math.PI, (hours / 2.5) * Math.PI)) * 10) / 10;
      // Insulin curve: peaks around 75 min (1.25h) and decays over 4 hours
      const insulinVal = Math.round(insulinPeak * (hours / 1.25) * Math.exp(1 - hours / 1.25) * 10) / 10;

      points.push({
        hours: `${hours}h`,
        timeMin: i * 15,
        carb: Math.max(0, carbVal),
        insulin: Math.max(0, insulinVal),
      });
    }

    return points;
  }, [carbsLogged, activeInsulin]);

  return (
    <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg space-y-5">
      {/* Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-brand-blue" />
            <h3 className="font-display text-lg font-bold text-brand-ink">
              Clinical Glycemic &amp; Health Risk Intelligence Suite
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Real-time multivariate risk stratification, Time-in-Range consensus, and pharmacodynamics
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center rounded-2xl bg-slate-100 p-1 border border-slate-200">
          {[
            { id: "risk", label: "🛡️ Health Risk Matrix" },
            { id: "tir", label: "🎯 Time In Range (TIR)" },
            { id: "metabolic", label: "⚡ Insulin vs. Carbs" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTab === tab.id
                  ? "bg-white text-brand-blue shadow-sm"
                  : "text-slate-600 hover:text-brand-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PANEL 1: HEALTH RISK & HYPO DANGER MATRIX ── */}
      {selectedTab === "risk" && (
        <div className="space-y-4">
          {/* Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${riskAnalysis.statusColor}`}>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-70 block">
                  Current Safety Assessment
                </span>
                <p className="font-bold text-sm sm:text-base">{riskAnalysis.statusLabel}</p>
              </div>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-white/80 border border-current shadow-xs">
              Glucose: {currentGlucose} mg/dL ({currentTrend})
            </span>
          </div>

          {/* Risk Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Hypo Danger Index */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Hypo Danger Index
                </span>
                <span className={`text-xs font-black ${riskAnalysis.hypoScore > 50 ? "text-red-600" : "text-emerald-700"}`}>
                  {riskAnalysis.hypoScore}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  style={{ width: `${riskAnalysis.hypoScore}%` }}
                  className={`h-full transition-all ${
                    riskAnalysis.hypoScore > 60
                      ? "bg-red-600"
                      : riskAnalysis.hypoScore > 30
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                {riskAnalysis.hypoScore > 50
                  ? "High risk of acute hypoglycemia (<70 mg/dL). Have fast carbs ready."
                  : "Optimal safety corridor maintained."}
              </p>
            </div>

            {/* 2. Hyperglycemia Spike Risk */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Hyperglycemia Spike
                </span>
                <span className={`text-xs font-black ${riskAnalysis.hyperScore > 50 ? "text-orange-600" : "text-slate-700"}`}>
                  {riskAnalysis.hyperScore}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  style={{ width: `${riskAnalysis.hyperScore}%` }}
                  className={`h-full transition-all ${
                    riskAnalysis.hyperScore > 60
                      ? "bg-orange-600"
                      : "bg-blue-500"
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                {riskAnalysis.hyperScore > 50
                  ? "Elevated postprandial rise projected (>140 mg/dL)."
                  : "Controlled post-meal excursion."}
              </p>
            </div>

            {/* 3. Glycemic Stability Index */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Glycemic Stability
                </span>
                <span className="text-xs font-black text-brand-blue">
                  {riskAnalysis.stabilityPct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  style={{ width: `${riskAnalysis.stabilityPct}%` }}
                  className="h-full bg-brand-blue transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                Calculated from glucose velocity and Coefficient of Variation.
              </p>
            </div>

            {/* 4. Nocturnal Vulnerability */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nocturnal Safety
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  Night Protocol
                </span>
              </div>
              <p className="font-bold text-xs text-slate-800">
                {riskAnalysis.nocturnalRisk}
              </p>
              <p className="text-[10px] text-slate-500">
                Active IOB: {activeInsulin} U &middot; Overnight target: 90–120 mg/dL.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL 2: TIME IN RANGE (TIR) CONSENSUS DISTRIBUTION ── */}
      {selectedTab === "tir" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Consensus Standard (70–140 mg/dL)
                </span>
                <p className="font-display text-2xl font-black text-brand-ink">
                  {tirData.target}% Time In Range
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-xl">
                  {tirData.target >= 70 ? "✅ Consensus Goal Met (>70%)" : "⚠️ Review Basal/Bolus Settings"}
                </span>
              </div>
            </div>

            {/* Multi-Tier Stacked Bar */}
            <div className="h-5 w-full rounded-xl bg-slate-200 flex overflow-hidden shadow-inner">
              <div
                style={{ width: `${tirData.vLow}%` }}
                className="bg-red-600 h-full flex items-center justify-center text-[9px] text-white font-bold"
                title={`Very Low (<54 mg/dL): ${tirData.vLow}%`}
              >
                {tirData.vLow > 3 ? `${tirData.vLow}%` : ""}
              </div>
              <div
                style={{ width: `${tirData.low}%` }}
                className="bg-amber-400 h-full flex items-center justify-center text-[9px] text-slate-900 font-bold"
                title={`Low (54-69 mg/dL): ${tirData.low}%`}
              >
                {tirData.low > 3 ? `${tirData.low}%` : ""}
              </div>
              <div
                style={{ width: `${tirData.target}%` }}
                className="bg-emerald-500 h-full flex items-center justify-center text-xs text-white font-bold"
                title={`In Target (70-140 mg/dL): ${tirData.target}%`}
              >
                {tirData.target}% In Target
              </div>
              <div
                style={{ width: `${tirData.high}%` }}
                className="bg-orange-500 h-full flex items-center justify-center text-[9px] text-white font-bold"
                title={`High (>140 mg/dL): ${tirData.high}%`}
              >
                {tirData.high > 3 ? `${tirData.high}%` : ""}
              </div>
            </div>

            {/* Legend & Standards Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] text-red-600 font-bold block">Very Low (&lt;54)</span>
                <span className="font-display font-black text-slate-800 text-sm">{tirData.vLow}%</span>
                <span className="text-[10px] text-slate-400 block">Goal: &lt;1%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] text-amber-600 font-bold block">Low (54–69)</span>
                <span className="font-display font-black text-slate-800 text-sm">{tirData.low}%</span>
                <span className="text-[10px] text-slate-400 block">Goal: &lt;4%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-emerald-300 bg-emerald-50/30">
                <span className="text-[10px] text-emerald-700 font-bold block">In Range (70–140)</span>
                <span className="font-display font-black text-emerald-800 text-sm">{tirData.target}%</span>
                <span className="text-[10px] text-emerald-600 font-bold block">Goal: &gt;70%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] text-orange-600 font-bold block">High (&gt;140)</span>
                <span className="font-display font-black text-slate-800 text-sm">{tirData.high}%</span>
                <span className="text-[10px] text-slate-400 block">Goal: &lt;25%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL 3: METABOLIC PHARMACODYNAMICS (CARBS VS. INSULIN) ── */}
      {selectedTab === "metabolic" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  4-Hour Pharmacodynamic Overlay
                </span>
                <p className="font-display text-base font-bold text-brand-ink">
                  Carbohydrate Absorption vs. Rapid Insulin Action Curve
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                  Carb Glycemic Release ({carbsLogged}g)
                </span>
                <span className="flex items-center gap-1.5 text-indigo-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" />
                  Active Insulin IOB ({activeInsulin} U)
                </span>
              </div>
            </div>

            {/* SVG Pharmacodynamic Curve */}
            <div className="relative w-full">
              {(() => {
                const w = 680;
                const h = 180;
                const padL = 35;
                const padR = 20;
                const padT = 15;
                const padB = 25;
                const plotW = w - padL - padR;
                const plotH = h - padT - padB;

                const maxVal = Math.max(50, carbsLogged, activeInsulin * 10);
                const getY = (val) => padT + plotH - (val / maxVal) * plotH;
                const getX = (min) => padL + (min / 240) * plotW;

                const carbPoints = pharmacodynamics
                  .map((p) => `${getX(p.timeMin)},${getY(p.carb)}`)
                  .join(" ");

                const insulinPoints = pharmacodynamics
                  .map((p) => `${getX(p.timeMin)},${getY((p.insulin / 3) * (carbsLogged || 40))}`)
                  .join(" ");

                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 select-none">
                    {/* Background */}
                    <rect x={padL} y={padT} width={plotW} height={plotH} fill="#ffffff" rx="8" stroke="#e2e8f0" />

                    {/* Horizontal Guide Lines */}
                    {[0.25, 0.5, 0.75].map((pct, idx) => (
                      <line
                        key={idx}
                        x1={padL}
                        y1={padT + plotH * pct}
                        x2={padL + plotW}
                        y2={padT + plotH * pct}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Time Vertical Gridlines */}
                    {[0, 60, 120, 180, 240].map((tMin) => (
                      <g key={tMin}>
                        <line
                          x1={getX(tMin)}
                          y1={padT}
                          x2={getX(tMin)}
                          y2={padT + plotH}
                          stroke="#e2e8f0"
                          strokeDasharray="2 3"
                        />
                        <text
                          x={getX(tMin)}
                          y={padT + plotH + 15}
                          textAnchor="middle"
                          className="text-[9px] font-bold fill-slate-400 font-mono"
                        >
                          +{tMin}m
                        </text>
                      </g>
                    ))}

                    {/* Carb Absorption Curve */}
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={carbPoints}
                    />

                    {/* Insulin Activity Curve */}
                    <polyline
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4 2"
                      points={insulinPoints}
                    />
                  </svg>
                );
              })()}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Clinical Insight:</strong> The dashed purple line represents active subcutaneous insulin action (onset 15m, peak 75m, duration 4h). The solid amber line tracks food carbohydrate glucose appearance. Alignment between the peaks indicates optimal meal-bolus synchronization.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
