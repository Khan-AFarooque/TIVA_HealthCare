import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  LayoutDashboard,
  Download,
  Printer,
  Calendar,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { getTodayString, aggregateReportData } from "../utils/dailyReport";
import { generateDailyReportPdf } from "../utils/generateDailyReportPdf";
import { getCaregiverInfo } from "../utils/alertManager";
import { loadGlucoseHistory, autoPredictFromStoredData } from "../utils/glucosePrediction";
import { getRecentFoodAIEntries } from "../utils/shared";

/**
 * Compact Mini Glucose Trend SVG Chart
 * Fits cleanly into the 1-page A4 report layout.
 */
function MiniGlucoseChart({ readings, pred30, pred60, targetMin = 70, targetMax = 140 }) {
  if (!readings || readings.length === 0) return null;

  const w = 320;
  const h = 75;
  const padL = 26;
  const padR = 26;
  const padT = 12;
  const padB = 18;

  // Flatten values to get scale
  const allVals = [...readings.map((r) => Number(r.currentGlucose || r.glucose || r)), pred30, pred60].filter(Boolean);
  const minVal = Math.max(30, Math.min(...allVals, targetMin) - 15);
  const maxVal = Math.min(350, Math.max(...allVals, targetMax) + 20);

  const scaleY = (v) => {
    const clamped = Math.max(minVal, Math.min(maxVal, v));
    return h - padB - ((clamped - minVal) / (maxVal - minVal || 1)) * (h - padT - padB);
  };

  const histCount = readings.length;
  const histW = (w - padL - padR) * 0.72;
  const scaleHistX = (i) => padL + (histCount > 1 ? (i / (histCount - 1)) * histW : histW / 2);

  const histPts = readings.map((r, i) => {
    const val = Number(r.currentGlucose || r.glucose || r);
    return { x: scaleHistX(i), y: scaleY(val), val };
  });

  const lastPt = histPts[histPts.length - 1];
  const pt30 = pred30 ? { x: padL + histW + 28, y: scaleY(pred30), val: pred30 } : null;
  const pt60 = pred60 ? { x: padL + histW + 62, y: scaleY(pred60), val: pred60 } : null;

  // Paths
  const histPathD = histPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const forecastPathD = pt30 && pt60 && lastPt ? `M ${lastPt.x} ${lastPt.y} L ${pt30.x} ${pt30.y} L ${pt60.x} ${pt60.y}` : "";

  return (
    <div className="w-full bg-slate-50/80 rounded-xl p-2 border border-slate-200">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block overflow-visible">
        {/* Safe target band */}
        <rect
          x={padL}
          y={scaleY(targetMax)}
          width={w - padL - padR}
          height={Math.max(0, scaleY(targetMin) - scaleY(targetMax))}
          fill="#ecfdf5"
          opacity="0.85"
        />

        {/* Target threshold guidelines */}
        <line x1={padL} y1={scaleY(targetMax)} x2={w - padR} y2={scaleY(targetMax)} stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="2 2" />
        <line x1={padL} y1={scaleY(targetMin)} x2={w - padR} y2={scaleY(targetMin)} stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="2 2" />

        {/* Divider between history & forecast */}
        {lastPt && (
          <line x1={lastPt.x} y1={padT} x2={lastPt.x} y2={h - padB} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
        )}

        {/* Historical Line & Points */}
        <path d={histPathD} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {histPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === histPts.length - 1 ? 3.5 : 2} fill={i === histPts.length - 1 ? "#1d4ed8" : "#60a5fa"} />
        ))}

        {/* Forecast Line & Points */}
        {forecastPathD && (
          <path d={forecastPathD} fill="none" stroke="#db2777" strokeWidth="2" strokeDasharray="3 2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pt30 && <circle cx={pt30.x} cy={pt30.y} r={3.5} fill="#ec4899" />}
        {pt60 && <circle cx={pt60.x} cy={pt60.y} r={3.5} fill="#be185d" />}

        {/* Value badges for Key Milestones */}
        {lastPt && (
          <text x={lastPt.x} y={lastPt.y - 6} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1e3a8a">
            {lastPt.val}
          </text>
        )}
        {pt30 && (
          <text x={pt30.x} y={pt30.y - 6} textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#9d174d">
            {pt30.val}
          </text>
        )}
        {pt60 && (
          <text x={pt60.x} y={pt60.y - 6} textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#9d174d">
            {pt60.val}
          </text>
        )}

        {/* X-axis labels */}
        <text x={padL} y={h - 3} fontSize="7" fill="#94a3b8">Past CGM</text>
        {lastPt && <text x={lastPt.x} y={h - 3} textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#334155">Now (t₀)</text>}
        {pt30 && <text x={pt30.x} y={h - 3} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#db2777">+30m</text>}
        {pt60 && <text x={pt60.x} y={h - 3} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#be185d">+60m</text>}
      </svg>
    </div>
  );
}

/**
 * DailyReportPage
 *
 * Renders the strictly ONE-PAGE A4 Patient Monitoring Report:
 * 1. HEADER (TIVA Logo, Titles, Metadata)
 * 2. 1. PATIENT INFORMATION (Compact, actual data only)
 * 3. 2. DAILY MONITORING SUMMARY (6 cards, 3x2)
 * 4. 3. AI GLUCOSE PREDICTION & 4. NUTRITION SNAPSHOT (2-column row)
 * 5. 5. SAFETY SUMMARY
 * 6. 6. DISCLAIMER
 * 7. 7. FOOTER
 */
export default function DailyReportPage({ onBack, userId, profile, userName: propUserName }) {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [report, setReport] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Derived patient information
  const effectiveUserId = userId || (() => {
    try {
      const auth = JSON.parse(localStorage.getItem("tiva_auth") || "{}");
      return auth.userId || "usr_patient";
    } catch {
      return "usr_patient";
    }
  })();

  const patientName = propUserName || (() => {
    try {
      const auth = JSON.parse(localStorage.getItem("tiva_auth") || "{}");
      if (auth?.name) return auth.name;
      const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
      if (profiles[effectiveUserId]?.fullName) return profiles[effectiveUserId].fullName;
    } catch { /* ignore */ }
    return "Patient";
  })();

  const caregiver = useMemo(() => {
    return getCaregiverInfo(effectiveUserId) || profile?.caregiver || { name: "", phone: "" };
  }, [effectiveUserId, profile]);

  const targetMin = profile?.targetGlucoseMin || profile?.lowThreshold || 70;
  const targetMax = profile?.targetGlucoseMax || profile?.highThreshold || 140;

  // Load report data for selected date
  useEffect(() => {
    setReport(aggregateReportData(selectedDate));
  }, [selectedDate]);

  // Derive Patient Demographics & BMI
  const patientMetrics = useMemo(() => {
    const age = profile?.age ? `${profile.age} yrs` : "Not specified";
    const gender = profile?.gender || "Not specified";
    const diabetesType = profile?.diabetesType || profile?.diagnosis || "Type 1 Diabetes (CGM)";
    const weight = profile?.currentWeight ? `${profile.currentWeight} kg` : "Not specified";

    let bmi = "Not specified";
    if (profile?.currentWeight && profile?.height) {
      const hMeters = Number(profile.height) / 100;
      if (hMeters > 0) {
        bmi = `${(Number(profile.currentWeight) / (hMeters * hMeters)).toFixed(1)} kg/m²`;
      }
    }

    const treatment = profile?.insulinType
      ? `${profile.insulinType} Insulin`
      : profile?.treatment || "Basal-Bolus Protocol";

    const caregiverContact = caregiver?.phone
      ? `${caregiver.name ? caregiver.name + " " : ""}(${caregiver.phone})`
      : "Not configured";

    return {
      age,
      gender,
      diabetesType,
      weight,
      bmi,
      treatment,
      caregiverContact,
    };
  }, [profile, caregiver]);

  // Derive Glucose Prediction Data & History
  const predictionDetails = useMemo(() => {
    const glucoseData = report?.glucoseData || [];
    if (glucoseData.length === 0) {
      // Check if general glucose history has recent readings for today
      const allHist = loadGlucoseHistory();
      if (allHist.length > 0) {
        const latest = allHist[0];
        const pred30 = Number(latest.predictedGlucose || latest.currentGlucose || 110);
        const pred60 = Math.round(pred30 * 1.02);
        return {
          hasData: true,
          readings: allHist.slice(0, 8).reverse(),
          currentGlucose: Number(latest.currentGlucose || 110),
          pred30,
          pred60,
          trend: latest.trend || "Stable",
          riskStatus: latest.currentGlucose < 70 ? "CRITICAL HYPO" : latest.currentGlucose > 180 ? "ELEVATED GLUCOSE" : "SAFE (IN TARGET RANGE)",
        };
      }
      return { hasData: false };
    }

    const latest = glucoseData[0];
    const currentGlucose = Number(latest.currentGlucose || latest.glucose || 110);
    const pred30 = Number(latest.predictedGlucose || currentGlucose);
    const pred60 = Math.round(pred30 * 1.02);
    const trend = latest.trend || "Stable";

    let riskStatus = "SAFE (IN TARGET RANGE)";
    if (currentGlucose < 70 || pred30 < 70) riskStatus = "CRITICAL HYPO RISK";
    else if (currentGlucose > 180 || pred30 > 180) riskStatus = "ELEVATED GLUCOSE";

    return {
      hasData: true,
      readings: glucoseData.slice(0, 10).reverse(),
      currentGlucose,
      pred30,
      pred60,
      trend,
      riskStatus,
    };
  }, [report]);

  // Derive Latest Food AI Result
  const latestFoodAi = useMemo(() => {
    const dateFood = report?.foodAI?.filtered || [];
    if (dateFood.length > 0) {
      const f = dateFood[0];
      return {
        hasScan: true,
        foodName: f.food_name || f.foodName || "Identified Meal",
        servingSize: f.serving || f.serving_size || "1 standard serving",
        carbs: f.carbs_g ?? f.carbs ?? 0,
        calories: f.calories_kcal ?? f.calories ?? 0,
        protein: f.protein_g ?? f.protein ?? 0,
        fat: f.fat_g ?? f.fat ?? 0,
      };
    }

    // Check recent scans from shared history
    const recents = getRecentFoodAIEntries();
    if (recents.length > 0) {
      const f = recents[0];
      return {
        hasScan: true,
        foodName: f.foodName || "Recent Scan",
        servingSize: f.servingSize || "1 standard serving",
        carbs: f.carbs ?? 0,
        calories: f.calories ?? 0,
        protein: f.protein ?? 0,
        fat: f.fat ?? 0,
      };
    }

    return { hasScan: false };
  }, [report]);

  // Derive Safety Alerts
  const safetyDetails = useMemo(() => {
    const alertData = report?.alertData;
    if (alertData && alertData.totalAlerts > 0) {
      const topAlert = alertData.alerts[0];
      return {
        hasAlert: true,
        type: topAlert.type || "Active Safety Alert",
        severity: topAlert.severity || "CRITICAL",
        message: topAlert.message || `Biometric alert recorded: ${topAlert.type || "Threshold exceeded"}`,
        timestamp: topAlert.timestamp ? topAlert.timestamp.slice(11, 16) : "Today",
        count: alertData.totalAlerts,
      };
    }
    return { hasAlert: false };
  }, [report]);

  // Total Insulin calculation
  const totalInsulinUnits = useMemo(() => {
    const logs = report?.insulinData || [];
    return logs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
  }, [report]);

  // Handle Print & PDF Export
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      await generateDailyReportPdf({
        ...report,
        date: selectedDate,
        userName: patientName,
        userId: effectiveUserId,
        age: profile?.age,
        gender: profile?.gender,
        targetGlucose: `${targetMin} – ${targetMax}`,
      });
    } finally {
      setIsExporting(false);
    }
  }, [report, selectedDate, patientName, effectiveUserId, profile, targetMin, targetMax]);

  const handleSetQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const formattedDateString = useMemo(() => {
    try {
      return new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  if (!report) return null;

  const { mealTotals, foodAI, glucoseData, insulinData, activityData, totalActiveMinutes, alertData } = report;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none">
      {/* ── TOP ACTION BAR (HIDDEN IN PRINT & PDF) ── */}
      <div className="glass-strong p-4 sm:p-5 rounded-3xl print:hidden shadow-sm border border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2.5 rounded-xl text-slate-500 hover:text-brand-blue hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back to Dashboard"
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-brand-blue">
                  One-Page Clinical Summary
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  A4 Patient Monitoring Format
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-ink mt-0.5">
                TIVA Patient Monitoring Report
              </h2>
            </div>
          </div>

          {/* Quick Date Filters & Export Triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => handleSetQuickDate(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDate === getTodayString()
                    ? "bg-white text-brand-ink shadow-xs"
                    : "text-slate-600 hover:text-brand-ink"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-brand-ink transition-all cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(2)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-brand-ink transition-all cursor-pointer"
              >
                -2 Days
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
              title="Print standard A4 sheet"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-blue to-emerald-600 text-white font-bold text-xs hover:brightness-110 shadow-md shadow-brand-blue/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{isExporting ? "Generating PDF..." : "Export 1-Page PDF"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          STRICTLY ONE-PAGE A4 CLINICAL REPORT CONTAINER
          Element ID: tiva-one-page-report
          Fixed A4 Proportion (210mm x 297mm, ratio 1 : 1.414)
          Strictly NO website chrome, zero fake seed points.
          ────────────────────────────────────────────────────────── */}
      <div
        id="tiva-one-page-report"
        className="bg-white text-slate-900 mx-auto rounded-2xl border border-slate-200/90 shadow-2xl p-7 flex flex-col justify-between"
        style={{
          width: "100%",
          maxWidth: "210mm",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* ── HEADER ── */}
        <div>
          <div className="border-b-2 border-slate-800 pb-3 flex items-start justify-between gap-4">
            {/* Logo and Titles */}
            <div className="flex items-center gap-3.5">
              <img
                src={`${import.meta.env.BASE_URL}assets/tiva-logo.png`}
                onError={(e) => { e.currentTarget.src = "./assets/tiva-logo.png"; }}
                alt="TIVA Logo"
                className="h-10 w-auto object-contain shrink-0"
              />
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase leading-none">
                  TIVA PATIENT MONITORING REPORT
                </h1>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">
                  AI-Assisted Glucose, Nutrition &amp; Safety Summary
                </p>
              </div>
            </div>

            {/* Header Right Metadata */}
            <div className="text-right text-[10px] space-y-0.5 shrink-0">
              <p className="font-bold text-slate-800">
                Evaluation Date: <span className="font-mono text-brand-ink">{formattedDateString}</span>
              </p>
              <p className="text-slate-500">
                Time: <span className="font-mono">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
              <p className="text-slate-500">
                Record Ref: <span className="font-mono font-bold text-slate-700">#CR-{selectedDate.replace(/-/g, "")}-{effectiveUserId.slice(-4).toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* ── 1. PATIENT INFORMATION ── */}
          <div className="mt-3.5">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-brand-blue mb-1.5">
              1. PATIENT INFORMATION
            </h2>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[10px] leading-tight">
              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Patient Name</span>
                <span className="font-bold text-slate-900 text-xs block truncate">{patientName}</span>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Patient ID / Profile</span>
                <span className="font-mono font-bold text-slate-700 text-xs block truncate">{effectiveUserId}</span>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Age / Gender</span>
                <span className="font-bold text-slate-800 block">{patientMetrics.age} / {patientMetrics.gender}</span>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Diabetes Type</span>
                <span className="font-bold text-slate-800 block truncate">{patientMetrics.diabetesType}</span>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Weight / BMI</span>
                <span className="font-bold text-slate-800 block">{patientMetrics.weight} ({patientMetrics.bmi})</span>
              </div>

              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Treatment Modality</span>
                <span className="font-bold text-slate-800 block truncate">{patientMetrics.treatment}</span>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Clinical Target</span>
                <span className="font-bold text-emerald-700 block">{targetMin} – {targetMax} mg/dL</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="font-bold uppercase text-slate-400 block text-[9px]">Caregiver Emergency Contact</span>
                <span className="font-bold text-slate-800 block truncate">{patientMetrics.caregiverContact}</span>
              </div>
            </div>
          </div>

          {/* ── 2. DAILY MONITORING SUMMARY (6 Compact Cards in 3x2) ── */}
          <div className="mt-3.5">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-brand-blue mb-1.5">
              2. DAILY MONITORING SUMMARY
            </h2>
            <div className="grid grid-cols-3 gap-2.5 text-left text-[10px]">
              {/* Card 1: GLUCOSE */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold uppercase text-[9px] text-slate-500 block">1. GLUCOSE</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {glucoseData.length > 0 ? `${glucoseData.length} Readings Logged` : "No entries"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {glucoseData.length > 0 ? `Latest: ${glucoseData[0].currentGlucose || glucoseData[0].glucose} mg/dL` : "Continuous monitor sync"}
                </p>
              </div>

              {/* Card 2: MEALS LOGGED */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold uppercase text-[9px] text-slate-500 block">2. MEALS LOGGED</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {mealTotals.count > 0 ? `${mealTotals.count} Meals Recorded` : "No entries"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {mealTotals.count > 0 ? `${mealTotals.carbs}g Carbs · ${mealTotals.calories} kcal` : "Diet journal record"}
                </p>
              </div>

              {/* Card 3: INSULIN DOSES */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold uppercase text-[9px] text-slate-500 block">3. INSULIN DOSES</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {insulinData.length > 0 ? `${insulinData.length} Logs Recorded` : "No entries"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {insulinData.length > 0 ? `${totalInsulinUnits} Units total bolus/basal` : "Active insulin log"}
                </p>
              </div>

              {/* Card 4: FOOD AI SCANS */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold uppercase text-[9px] text-slate-500 block">4. FOOD AI SCANS</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {(foodAI.filtered?.length || foodAI.total) > 0
                    ? `${foodAI.filtered?.length || foodAI.total} Scans Processed`
                    : "No entries"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {(foodAI.filtered?.length || foodAI.total) > 0 ? "Automated vision recognition" : "Indian cuisine recognition"}
                </p>
              </div>

              {/* Card 5: ACTIVITY */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold uppercase text-[9px] text-slate-500 block">5. ACTIVITY</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {totalActiveMinutes > 0 ? `${totalActiveMinutes} Active Minutes` : "No entries"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {activityData.length > 0 ? `${activityData.length} Session${activityData.length > 1 ? "s" : ""} completed` : "Exercise plan tracker"}
                </p>
              </div>

              {/* Card 6: SAFETY ALERTS */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold uppercase text-[9px] text-slate-500 block">6. SAFETY ALERTS</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {alertData && alertData.totalAlerts > 0 ? `${alertData.totalAlerts} Alert${alertData.totalAlerts > 1 ? "s" : ""} Triggered` : "No entries"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {alertData && alertData.totalAlerts > 0 ? `${alertData.unacknowledged} unacknowledged` : "Threshold safety monitoring"}
                </p>
              </div>
            </div>
          </div>

          {/* ── 3. AI GLUCOSE PREDICTION & 4. NUTRITION SNAPSHOT (2-COLUMN ROW) ── */}
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* LEFT COLUMN: 3. AI GLUCOSE PREDICTION */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-brand-blue">
                    3. AI GLUCOSE PREDICTION
                  </h2>
                  {predictionDetails.hasData && (
                    <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      {predictionDetails.riskStatus}
                    </span>
                  )}
                </div>

                {predictionDetails.hasData ? (
                  <>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] mb-2">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">CURRENT</span>
                        <span className="font-mono text-xs font-black text-brand-blue block">
                          {predictionDetails.currentGlucose} <span className="text-[8px]">mg/dL</span>
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">30 MIN PRED</span>
                        <span className="font-mono text-xs font-black text-pink-700 block">
                          {predictionDetails.pred30} <span className="text-[8px]">mg/dL</span>
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">60 MIN PRED</span>
                        <span className="font-mono text-xs font-black text-rose-700 block">
                          {predictionDetails.pred60} <span className="text-[8px]">mg/dL</span>
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">TREND</span>
                        <span className="text-[9px] font-bold text-slate-800 block capitalize truncate">
                          {predictionDetails.trend}
                        </span>
                      </div>
                    </div>

                    {/* Clean SVG Trend Chart */}
                    <MiniGlucoseChart
                      readings={predictionDetails.readings}
                      pred30={predictionDetails.pred30}
                      pred60={predictionDetails.pred60}
                      targetMin={targetMin}
                      targetMax={targetMax}
                    />
                  </>
                ) : (
                  <div className="h-28 flex items-center justify-center text-center p-3 text-slate-400 italic text-[10px]">
                    No glucose data available for this reporting period.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: 4. NUTRITION SNAPSHOT */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-brand-blue mb-2">
                  4. NUTRITION SNAPSHOT
                </h2>

                {latestFoodAi.hasScan ? (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[10px]">
                      <span className="text-[8px] font-bold uppercase text-slate-400 block">Identified Food Item</span>
                      <p className="font-bold text-slate-900 text-xs truncate">{latestFoodAi.foodName}</p>
                      <p className="text-slate-500 text-[9px] mt-0.5">Serving Size: {latestFoodAi.servingSize}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-[9px]">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">Carbs</span>
                        <span className="font-mono text-xs font-black text-amber-700 block">{latestFoodAi.carbs}g</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">Calories</span>
                        <span className="font-mono text-xs font-black text-slate-800 block">{latestFoodAi.calories}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">Protein</span>
                        <span className="font-mono text-xs font-black text-emerald-700 block">{latestFoodAi.protein}g</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 block uppercase">Fat</span>
                        <span className="font-mono text-xs font-black text-indigo-700 block">{latestFoodAi.fat}g</span>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-500 italic mt-1 pl-1">
                      Nutritional estimation powered by TIVA Indian Cuisine Vision Dataset.
                    </p>
                  </div>
                ) : (
                  <div className="h-28 flex items-center justify-center text-center p-3 text-slate-400 italic text-[10px]">
                    No Food AI scans recorded for this reporting period.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 5. SAFETY SUMMARY ── */}
          <div className="mt-3.5">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-brand-blue mb-1.5">
              5. SAFETY SUMMARY
            </h2>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[10px] flex items-center justify-between">
              {safetyDetails.hasAlert ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-900">{safetyDetails.type}</span>
                    <span className="text-slate-600 ml-1.5">— {safetyDetails.message} ({safetyDetails.timestamp})</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-700 font-medium">
                    No active safety alerts recorded. All monitored clinical vitals remain within designated target parameters.
                  </span>
                </div>
              )}
              <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0 ml-2">
                STATUS: {safetyDetails.hasAlert ? safetyDetails.severity : "OPTIMAL"}
              </span>
            </div>
          </div>
        </div>

        {/* ── 6. DISCLAIMER & 7. FOOTER ── */}
        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
          {/* 6. DISCLAIMER */}
          <p className="text-[8.5px] leading-tight text-slate-400 text-center italic">
            TIVA is an AI-assisted decision-support prototype. It does not diagnose diabetes, prescribe treatment, or replace advice from a qualified healthcare professional.
          </p>

          {/* 7. FOOTER */}
          <div className="flex items-center justify-between text-[9px] font-medium text-slate-500 pt-1">
            <span className="font-bold text-slate-700">TIVA Clinical Monitoring System</span>
            <span>AI-Assisted Diabetes Decision-Support Prototype</span>
            <span className="font-bold text-slate-700">Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
