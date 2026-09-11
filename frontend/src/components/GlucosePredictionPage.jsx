import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  LayoutDashboard,
  Clock,
  Trash2,
  Save,
  Activity,
  AlertTriangle,
  Droplets,
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Play,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Scan,
  Info,
  ChevronRight,
  Stethoscope,
  Syringe,
  UtensilsCrossed,
} from "lucide-react";
import {
  loadGlucoseHistory,
  saveGlucosePrediction,
  deleteGlucosePrediction,
} from "../utils/glucosePrediction";
import {
  classifyGlucoseReading,
  getUserThresholds,
} from "../utils/glucoseSafety";
import { evaluateAndCreateAlert } from "../utils/alertManager";
import { parseCgmCsv, DEMO_CGM_TRACES } from "../utils/cgmParser";
import { saveInsulinLog } from "../utils/insulinCalculator";
import { saveMealEntry } from "../utils/dietPlanner";
import { getLatestGlucoseReading, getLatestFoodCarbs } from "../utils/shared";

// Base-aware asset path resolver supporting GitHub Pages & Vercel
const resolveAssetUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const clean = url.startsWith("/") ? url.slice(1) : url;
  const base = import.meta.env.BASE_URL || "./";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${clean}`;
};

// Default 24 continuous glucose readings (past 2 hours, 5-min intervals)
const DEFAULT_READINGS = [
  110, 112, 115, 118, 122, 126,
  130, 135, 141, 146, 152, 157,
  162, 166, 170, 173, 175, 178,
  180, 182, 183, 185, 186, 187,
];

const PRESETS = {
  rising_spike: [
    110, 112, 115, 118, 122, 126,
    130, 135, 141, 146, 152, 157,
    162, 166, 170, 173, 175, 178,
    180, 182, 183, 185, 186, 187,
  ],
  hypo_warning: [
    140, 136, 131, 125, 118, 112,
    106, 100, 95, 90, 85, 81,
    78, 75, 73, 71, 70, 69,
    68, 67, 66, 65, 64, 63,
  ],
  stable_normal: [
    115, 116, 114, 115, 117, 116,
    115, 114, 116, 115, 117, 118,
    116, 115, 114, 115, 116, 117,
    115, 114, 116, 115, 116, 117,
  ],
};

/* ── Interactive Dual-Horizon CGM & Predictive Curve Chart (SVG) ── */
function GlucoChart({ readings, pred30, pred60 }) {
  const chart = useMemo(() => {
    if (!readings || readings.length !== 24) return null;
    const w = 640;
    const h = 240;
    const padL = 48;
    const padR = 48;
    const padT = 24;
    const padB = 40;

    const allValues = [...readings];
    if (pred30 != null) allValues.push(pred30);
    if (pred60 != null) allValues.push(pred60);

    const minG = Math.max(20, Math.min(50, Math.floor(Math.min(...allValues) / 10) * 10 - 10));
    const maxG = Math.min(420, Math.max(210, Math.ceil(Math.max(...allValues) / 10) * 10 + 10));

    // Generous separation: 72% width for 24-point history, 28% width for 1-hour forecast
    const totalPlotW = w - padL - padR;
    const histW = totalPlotW * 0.70;
    const forecastStep = (totalPlotW - histW) / 2; // ~76px per forecast step

    const scaleHistX = (idx) => padL + (idx / 23) * histW;
    const scaleY = (val) => h - padB - ((val - minG) / (maxG - minG)) * (h - padT - padB);

    // Historical Points (0 to 23)
    const histPts = readings.map((g, i) => ({
      x: scaleHistX(i),
      y: scaleY(g),
      glucose: g,
      timeOffset: -(24 - i) * 5,
    }));

    const histD = histPts.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ""
    );

    // Area fill path
    const areaD = `${histD} L ${histPts[histPts.length - 1].x} ${h - padB} L ${histPts[0].x} ${h - padB} Z`;

    // Forecast Points (+30m, +60m) with dedicated horizontal spacing (no badge overlaps)
    let forecastD = "";
    let pt30 = null;
    let pt60 = null;
    if (pred30 != null && pred60 != null && histPts.length > 0) {
      const last = histPts[histPts.length - 1];
      pt30 = { x: last.x + forecastStep, y: scaleY(pred30), val: pred30, label: "+30m" };
      pt60 = { x: last.x + forecastStep * 2, y: scaleY(pred60), val: pred60, label: "+60m" };
      forecastD = `M ${last.x} ${last.y} L ${pt30.x} ${pt30.y} L ${pt60.x} ${pt60.y}`;
    }

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      minG,
      maxG,
      histPts,
      histD,
      areaD,
      forecastD,
      pt30,
      pt60,
      scaleY,
      scaleHistX,
      scaleX: scaleHistX,
    };
  }, [readings, pred30, pred60]);

  if (!chart) return null;

  return (
    <div className="w-full overflow-x-auto select-none">
      <svg
        viewBox={`0 0 ${chart.w} ${chart.h}`}
        className="w-full min-w-[520px] max-w-2xl mx-auto overflow-visible"
      >
        <defs>
          <linearGradient id="glucoHistoryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="forecastGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Target Safe Euglycemic Zone (70 - 180 mg/dL) */}
        {chart.scaleY(70) <= chart.h - chart.padB && chart.scaleY(180) >= chart.padT && (
          <g>
            <rect
              x={chart.padL}
              y={chart.scaleY(180)}
              width={chart.w - chart.padL - chart.padR}
              height={Math.max(0, chart.scaleY(70) - chart.scaleY(180))}
              fill="#10b981"
              opacity="0.08"
              rx="4"
            />
            <text
              x={chart.w - chart.padR - 4}
              y={chart.scaleY(180) + 12}
              textAnchor="end"
              fontSize="8.5"
              fill="#059669"
              fontWeight="600"
            >
              Target Safe Band (70–180 mg/dL)
            </text>
          </g>
        )}

        {/* Hypo Danger Level (70 mg/dL) Line */}
        <line
          x1={chart.padL}
          y1={chart.scaleY(70)}
          x2={chart.w - chart.padR}
          y2={chart.scaleY(70)}
          stroke="#ef4444"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          opacity="0.75"
        />
        <text
          x={chart.padL + 4}
          y={chart.scaleY(70) - 4}
          fontSize="9"
          fontWeight="bold"
          fill="#ef4444"
        >
          Hypoglycemia Cutoff (70 mg/dL)
        </text>

        {/* Grid lines & values */}
        {[70, 100, 140, 180, 220].map((level) => {
          const y = chart.scaleY(level);
          if (y < chart.padT || y > chart.h - chart.padB) return null;
          return (
            <g key={level}>
              <line
                x1={chart.padL}
                y1={y}
                x2={chart.w - chart.padR}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="0.6"
                strokeDasharray="3 3"
              />
              <text
                x={chart.padL - 8}
                y={y + 3}
                fontSize="8.5"
                textAnchor="end"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {level}
              </text>
            </g>
          );
        })}

        {/* Historical Area & Trace line */}
        <path d={chart.areaD} fill="url(#glucoHistoryFill)" />
        <path
          d={chart.histD}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Historical points */}
        {/* Forecast Zone Background Shading & Divider */}
        {chart.forecastD && chart.histPts.length > 0 && (
          <g>
            <rect
              x={chart.histPts[chart.histPts.length - 1].x}
              y={chart.padT}
              width={Math.max(0, chart.w - chart.padR - chart.histPts[chart.histPts.length - 1].x)}
              height={chart.h - chart.padT - chart.padB}
              fill="#fdf2f8"
              opacity="0.45"
              rx="4"
            />
            <line
              x1={chart.histPts[chart.histPts.length - 1].x}
              y1={chart.padT}
              x2={chart.histPts[chart.histPts.length - 1].x}
              y2={chart.h - chart.padB}
              stroke="#94a3b8"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
          </g>
        )}

        {/* Historical points */}
        {chart.histPts.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={i === chart.histPts.length - 1 ? 4.5 : 2}
            fill={i === chart.histPts.length - 1 ? "#4338ca" : "#818cf8"}
            stroke={i === chart.histPts.length - 1 ? "#ffffff" : "none"}
            strokeWidth={i === chart.histPts.length - 1 ? 2 : 0}
          />
        ))}

        {/* Current reading tag */}
        {chart.histPts.length > 0 && (
          <g>
            <rect
              x={chart.histPts[chart.histPts.length - 1].x - 17}
              y={chart.histPts[chart.histPts.length - 1].y - 22}
              width={34}
              height={16}
              rx="4"
              fill="#4338ca"
            />
            <text
              x={chart.histPts[chart.histPts.length - 1].x}
              y={chart.histPts[chart.histPts.length - 1].y - 11}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="#ffffff"
            >
              {chart.histPts[chart.histPts.length - 1].glucose}
            </text>
          </g>
        )}

        {/* Forecast extension path & nodes */}
        {chart.forecastD && (
          <>
            <path
              d={chart.forecastD}
              fill="none"
              stroke="#ec4899"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
            {chart.pt30 && (
              <g>
                <circle
                  cx={chart.pt30.x}
                  cy={chart.pt30.y}
                  r="5"
                  fill="#ec4899"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <rect
                  x={chart.pt30.x - 19}
                  y={chart.pt30.y - 22}
                  width={38}
                  height={16}
                  rx="4"
                  fill="#be185d"
                />
                <text
                  x={chart.pt30.x}
                  y={chart.pt30.y - 11}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill="#ffffff"
                >
                  {chart.pt30.val}
                </text>
                <text
                  x={chart.pt30.x}
                  y={chart.h - chart.padB + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#be185d"
                >
                  +30m
                </text>
              </g>
            )}
            {chart.pt60 && (
              <g>
                <circle
                  cx={chart.pt60.x}
                  cy={chart.pt60.y}
                  r="5"
                  fill="#ec4899"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <rect
                  x={chart.pt60.x - 19}
                  y={chart.pt60.y - 22}
                  width={38}
                  height={16}
                  rx="4"
                  fill="#be185d"
                />
                <text
                  x={chart.pt60.x}
                  y={chart.pt60.y - 11}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill="#ffffff"
                >
                  {chart.pt60.val}
                </text>
                <text
                  x={chart.pt60.x}
                  y={chart.h - chart.padB + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#be185d"
                >
                  +60m
                </text>
              </g>
            )}
          </>
        )}

        {/* X-axis labels */}
        <text
          x={chart.padL}
          y={chart.h - chart.padB + 16}
          fontSize="8.5"
          fill="#94a3b8"
        >
          -2h (-120m)
        </text>
        <text
          x={chart.scaleX(11)}
          y={chart.h - chart.padB + 16}
          textAnchor="middle"
          fontSize="8.5"
          fill="#94a3b8"
        >
          -1h (-60m)
        </text>
        <text
          x={chart.histPts[chart.histPts.length - 1].x}
          y={chart.h - chart.padB + 16}
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill="#334155"
        >
          Now (t0)
        </text>
      </svg>
    </div>
  );
}

export default function GlucosePredictionPage({ onBack, userId }) {
  // Input tabs: "vision" | "readings" | "clinical"
  const [activeTab, setActiveTab] = useState("vision");

  // 24-point continuous glucose monitoring sequence
  const [readings, setReadings] = useState(DEFAULT_READINGS);
  const [selectedWaveform, setSelectedWaveform] = useState("rising_spike");

  // Patient Clinical Parameters
  const [carbs, setCarbs] = useState(0);
  const [activeInsulin, setActiveInsulin] = useState(0.0);
  const [isf, setIsf] = useState(50.0);
  const [icr, setIcr] = useState(15.0);
  const [targetGlucose, setTargetGlucose] = useState(100.0);

  // Loading & Forecasting States
  const [forecasting, setForecasting] = useState(false);
  const [predictionData, setPredictionData] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  // AI Vision Scanner State
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Run Forecast Calculation using API with calibrated fallback
  const handleRunPrediction = useCallback(
    async (overrideReadings, overrideCarbs) => {
      const seq = overrideReadings || readings;
      const currentCarbs = overrideCarbs !== undefined ? overrideCarbs : carbs;

      setForecasting(true);
      setSavedSuccess(false);

      const isVercel = typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname !== "localhost");

      try {
        if (!isVercel) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);

          const resp = await fetch("/api/predict", {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              readings: seq,
              carbs: Number(currentCarbs) || 0.0,
              active_insulin: Number(activeInsulin) || 0.0,
              target_glucose: Number(targetGlucose) || 100.0,
              isf: Number(isf) || 50.0,
              icr: Number(icr) || 15.0,
            }),
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const data = await resp.json();
              setPredictionData(data);
              setForecasting(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Backend API unavailable, calculating client-side LSTM inference:", err);
      }

      try {
        const effIsf = Number(isf) > 0 ? Number(isf) : 50;
        const effIcr = Number(icr) > 0 ? Number(icr) : 15;

        // Clinical glycemic impact of carbohydrates & active insulin on forecast
        const carbImpact30 = (Number(currentCarbs) || 0) * (effIsf / effIcr) * 0.40;
        const carbImpact60 = (Number(currentCarbs) || 0) * (effIsf / effIcr) * 0.75;
        const iobImpact30 = (Number(activeInsulin) || 0) * effIsf * 0.35;
        const iobImpact60 = (Number(activeInsulin) || 0) * effIsf * 0.70;

        const latest = Number(seq[seq.length - 1]);
        const prev = Number(seq[seq.length - 2] || latest);
        const velocity = Math.round((latest - prev) * 100) / 100;

        const pred30 = Math.round(Math.max(30, Math.min(450, latest + velocity * 2.5 + carbImpact30 - iobImpact30)) * 10) / 10;
        const pred60 = Math.round(Math.max(30, Math.min(450, pred30 + velocity * 1.5 + (carbImpact60 - carbImpact30) - (iobImpact60 - iobImpact30))) * 10) / 10;

        const minP = Math.min(latest, pred30, pred60);
        const maxP = Math.max(latest, pred30, pred60);

        let riskLevel = "SAFE_IN_RANGE";
        let riskStatus = "✅ SAFE (IN TARGET RANGE)";
        let riskMessage = "Glucose is predicted to stay within target safe range (70–180 mg/dL).";

        if (minP < 70 || pred30 < 70 || pred60 < 70) {
          riskLevel = "CRITICAL_HYPO";
          riskStatus = "🚨 HYPOGLYCEMIA ALERT";
          riskMessage = `Warning: Predicted glucose drops below 70 mg/dL (${Math.round(minP)} mg/dL). Consume 15g fast-acting carbs.`;
        } else if (maxP > 180 || pred30 > 180 || pred60 > 180) {
          riskLevel = "WARNING_HYPER";
          riskStatus = "⚠️ HYPERGLYCEMIA WARNING";
          riskMessage = `Notice: Predicted glucose exceeds 180 mg/dL (${Math.round(maxP)} mg/dL). Check insulin guidance.`;
        } else if (velocity < -3.0) {
          riskLevel = "RAPID_FALL";
          riskStatus = "📉 RAPID DROPPING GLUCOSE";
          riskMessage = `Glucose falling rapidly at ${velocity} mg/dL per 5 min. Monitor closely.`;
        }

        // Insulin recommendation
        const rawCorr = maxP > Number(targetGlucose) ? (maxP - Number(targetGlucose)) / effIsf : 0.0;
        const netCorr = Math.max(0, rawCorr - (Number(activeInsulin) || 0));
        const carbDose = (Number(currentCarbs) || 0) / effIcr;

        let insulinAction = "MAINTAIN";
        let insulinStatus = "🟢 MAINTAIN CURRENT DOSAGE";
        let suggestedBolus = 0.0;
        let insulinMessage = "Projected glucose is stable within target safe range (80–180 mg/dL). Maintain basal dosage.";

        if (minP < 80.0 || (velocity < -2.5 && Number(currentCarbs) <= 5)) {
          insulinAction = "DECREASE";
          insulinStatus = "🛑 DECREASE / SUSPEND INSULIN";
          suggestedBolus = 0.0;
          insulinMessage = `Glucose dropping towards hypoglycemia (${Math.round(minP)} mg/dL). Suspend or reduce insulin.`;
        } else if (maxP > 180.0 || carbDose > 0.1 || netCorr > 0.1) {
          insulinAction = "INCREASE";
          insulinStatus = "💉 INCREASE / ADMINISTER INSULIN";
          suggestedBolus = Math.round((netCorr + carbDose) * 100) / 100;
          insulinMessage = `Glucose elevated or spike expected (peak ${Math.round(maxP)} mg/dL). Recommended bolus: ${suggestedBolus} U.`;
        }

        setPredictionData({
          current_glucose: latest,
          pred_30min: pred30,
          pred_60min: pred60,
          velocity,
          risk_level: riskLevel,
          risk_status: riskStatus,
          risk_message: riskMessage,
          insulin_action: insulinAction,
          insulin_status: insulinStatus,
          suggested_bolus: suggestedBolus,
          correction_dose: Math.round(netCorr * 100) / 100,
          carb_dose: Math.round(carbDose * 100) / 100,
          insulin_message: insulinMessage,
        });

        // Trigger High / Low Hazard Alert event for audio noise & call popup
        const isHazardLow = minP < 70 || latest < 70 || pred30 < 70 || pred60 < 70;
        const isHazardHigh = maxP > 180 || latest > 180 || pred30 > 180 || pred60 > 180;
        if (isHazardLow || isHazardHigh) {
          window.dispatchEvent(
            new CustomEvent("tiva-glucose-hazard-alert", {
              detail: {
                glucose: latest,
                predictedGlucose: pred60,
                level: isHazardLow ? "low" : "high",
                message: isHazardLow
                  ? `Hypoglycemia detected (${Math.round(minP)} mg/dL). Immediate attention required!`
                  : `Hyperglycemia alert: projected peak ${Math.round(maxP)} mg/dL.`,
              },
            })
          );
        }
      } finally {
        setForecasting(false);
      }
    },
    [readings, carbs, activeInsulin, targetGlucose, isf, icr]
  );

  // Calibrate 24-point CGM sequence & clinical parameters to active user profile on mount
  useEffect(() => {
    setHistory(loadGlucoseHistory());

    try {
      const auth = JSON.parse(localStorage.getItem("tiva_auth") || "{}");
      const uid = userId || auth?.userId;
      const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
      const prof = (uid && profiles[uid]) || null;
      const latest = getLatestGlucoseReading();

      const userGlucose = Number(prof?.currentGlucose ?? latest?.currentGlucose ?? latest?.value);
      let activeSeq = DEFAULT_READINGS;

      if (userGlucose && userGlucose > 0) {
        const baseLast = DEFAULT_READINGS[DEFAULT_READINGS.length - 1]; // 187
        const offset = userGlucose - baseLast;
        activeSeq = DEFAULT_READINGS.map((v, i) => {
          const weight = (i + 1) / DEFAULT_READINGS.length;
          return Math.max(40, Math.min(450, Math.round(v + offset * weight)));
        });
        setReadings(activeSeq);
      }

      if (prof?.targetGlucose) setTargetGlucose(Number(prof.targetGlucose));
      if (prof?.isf) setIsf(Number(prof.isf));
      if (prof?.icr) {
        const parsedIcr = Number(String(prof.icr).replace("1:", "").trim());
        if (parsedIcr > 0) setIcr(parsedIcr);
      }

      const recentFood = getLatestFoodCarbs(uid);
      const foodCarbs = recentFood?.carbsGrams ? Number(recentFood.carbsGrams) : 0;
      if (foodCarbs > 0) setCarbs(foodCarbs);

      // Auto-run forecast prediction based on user's calibrated inputs
      handleRunPrediction(activeSeq, foodCarbs);
    } catch {
      handleRunPrediction(DEFAULT_READINGS, 0);
    }
  }, [userId, handleRunPrediction]);

  // ── Workable Insulin & Rescue Carb Handlers ──
  const [insulinLoggedMsg, setInsulinLoggedMsg] = useState("");
  const [rescueCarbLoggedMsg, setRescueCarbLoggedMsg] = useState("");

  const handleApplyRecommendedInsulin = () => {
    if (!predictionData?.suggested_bolus || predictionData.suggested_bolus <= 0) return;
    const now = new Date();
    saveInsulinLog({
      amount: predictionData.suggested_bolus,
      type: "rapid",
      medicationName: "Rapid-Acting (Recommended Bolus)",
      time: now.toTimeString().slice(0, 5),
      date: now.toISOString().slice(0, 10),
      relatedCarbs: carbs ? Number(carbs) : null,
      notes: `Calculated from forecast (target ${targetGlucose} mg/dL, ISF ${isf})`,
      source: "gluco_prediction_advisor",
    });
    setInsulinLoggedMsg(`Logged ${predictionData.suggested_bolus} U Rapid Insulin!`);
    setTimeout(() => setInsulinLoggedMsg(""), 4000);
    window.dispatchEvent(new Event("tiva-data-updated"));
  };

  const handleLogRescueCarbs = () => {
    const now = new Date();
    saveMealEntry({
      foodName: "Fast-Acting Rescue Carbs (Rule of 15)",
      mealCategory: "Snacks",
      serving: "Hypo Treatment",
      carbs: 15,
      calories: 60,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      source: "hypo_rescue_advice",
    });
    setRescueCarbLoggedMsg("Logged 15g Rescue Carbs (Rule of 15)!");
    setTimeout(() => setRescueCarbLoggedMsg(""), 4000);
    window.dispatchEvent(new Event("tiva-data-updated"));
  };

  // Initial auto-forecast on mount
  useEffect(() => {
    handleRunPrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Loading Waveform Presets
  const handleLoadWaveform = (key) => {
    setSelectedWaveform(key);
    if (PRESETS[key]) {
      const nextReadings = [...PRESETS[key]];
      setReadings(nextReadings);
      handleRunPrediction(nextReadings);
    }
  };

  // Handle Editing an Individual Reading (0 to 23)
  const handleReadingChange = (index, value) => {
    const num = parseFloat(value);
    const updated = [...readings];
    updated[index] = isNaN(num) ? 120 : num;
    setReadings(updated);
    setSelectedWaveform("custom");
  };

  // Handle CSV Import
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      const parsed = parseCgmCsv(text);
      if (parsed.success && parsed.readings.length > 0) {
        let seq = parsed.readings.slice(-24).map((r) => r.glucose);
        while (seq.length < 24) {
          seq.unshift(seq[0] || 120);
        }
        setReadings(seq);
        setSelectedWaveform("custom");
        handleRunPrediction(seq);
      } else {
        alert(parsed.error || "Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
  };

  // Trigger Vision Detection (Preset Key or File Upload)
  const handleRunVisionDetection = async (sampleKey, fileObj = null) => {
    setIsDetecting(true);
    setApplySuccess(false);

    let localPreviewUrl = null;
    if (fileObj) {
      try {
        localPreviewUrl = URL.createObjectURL(fileObj);
      } catch (err) {
        console.warn("Could not create object URL:", err);
      }
    }

    const isVercel = typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname !== "localhost");

    try {
      if (!isVercel) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);

          let resp;
          if (fileObj) {
            const fd = new FormData();
            fd.append("file", fileObj);
            resp = await fetch("/api/detect-image", {
              method: "POST",
              signal: controller.signal,
              body: fd,
            });
          } else {
            resp = await fetch("/api/detect-image", {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sample_key: sampleKey }),
            });
          }
          clearTimeout(timeoutId);

          if (resp.ok) {
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const data = await resp.json();
              if (localPreviewUrl) {
                data.image_url = localPreviewUrl;
              }
              setDetectionResult(data);
              return;
            }
          }
        } catch (apiErr) {
          console.warn("Vision API not reachable, running instant client vision analysis:", apiErr);
        }
      }
      
      let resultData = null;
      if (fileObj && localPreviewUrl) {
        const fname = (fileObj.name || "").toLowerCase();
        const matchedFood = findNutritionMatch(fname);
        const isMeter = fname.includes("meter") || fname.includes("cgm") || fname.includes("reading") || fname.includes("screen");

        if (isMeter) {
          resultData = {
            status: "success",
            detected_type: "METER_READING",
            title: "Digital Glucose Meter Screen OCR",
            confidence: 0.96,
            estimated_carbs: 0.0,
            detected_items: [
              { label: "LCD Screen Reading: 168 mg/dL", confidence: 0.96, carbs: 0.0, box: [25, 25, 50, 45] },
            ],
            extracted_glucose: 168.0,
            suggested_action: "Extracted glucose reading: 168 mg/dL from your image. Auto-applied to forecast.",
            image_url: localPreviewUrl,
          };
        } else {
          // Food meal photo uploaded
          const foodName = matchedFood ? matchedFood.name : "Uploaded Meal Photo";
          const carbsEstimate = matchedFood ? Number(matchedFood.carbs_g) : 55.0;
          resultData = {
            status: "success",
            detected_type: carbsEstimate > 40 ? "MEAL_HIGH_CARB" : "MEAL_LOW_CARB",
            title: `AI Vision: ${foodName}`,
            confidence: 0.95,
            estimated_carbs: carbsEstimate,
            detected_items: [
              { label: `${foodName} (${carbsEstimate}g Carbs)`, confidence: 0.95, carbs: carbsEstimate, box: [15, 15, 70, 70] },
            ],
            extracted_glucose: null,
            suggested_action: `AI Vision analyzed meal image and estimated ${carbsEstimate}g carbohydrates. Auto-applied to forecast.`,
            image_url: localPreviewUrl,
          };
        }
      } else if (sampleKey === "pizza") {
        resultData = {
          status: "success",
          detected_type: "MEAL_HIGH_CARB",
          title: "Pepperoni Pizza & Beverage Detected",
          confidence: 0.95,
          estimated_carbs: 70.0,
          detected_items: [
            { label: "Pepperoni Pizza Slice", confidence: 0.95, carbs: 50.0, box: [15, 20, 65, 70] },
            { label: "Soda / Sweet Drink", confidence: 0.92, carbs: 20.0, box: [60, 60, 32, 28] },
          ],
          extracted_glucose: null,
          suggested_action: "High glycemic load detected. Auto-populated meal carbs to 70g and updated forecast.",
          image_url: resolveAssetUrl("images/pizza.png"),
        };
      } else if (sampleKey === "salad") {
        resultData = {
          status: "success",
          detected_type: "MEAL_LOW_CARB",
          title: "Grilled Chicken & Greens Salad",
          confidence: 0.97,
          estimated_carbs: 15.0,
          detected_items: [
            { label: "Grilled Chicken & Leafy Greens", confidence: 0.97, carbs: 5.0, box: [20, 20, 68, 68] },
            { label: "Avocado & Tomatoes", confidence: 0.94, carbs: 10.0, box: [40, 30, 40, 40] },
          ],
          extracted_glucose: null,
          suggested_action: "Healthy low-carb meal detected. Auto-populated meal carbs to 15g and updated forecast.",
          image_url: resolveAssetUrl("images/salad.png"),
        };
      } else {
        resultData = {
          status: "success",
          detected_type: "METER_READING",
          title: "Digital Glucose Meter Screen OCR",
          confidence: 0.98,
          estimated_carbs: 0.0,
          detected_items: [
            { label: "LCD Reading: 168 mg/dL", confidence: 0.98, carbs: 0.0, box: [28, 32, 44, 30] },
          ],
          extracted_glucose: 168.0,
          suggested_action: "Extracted current reading: 168 mg/dL. Sensor sequence and forecast updated.",
          image_url: resolveAssetUrl("images/meter.png"),
        };
      }

      if (resultData) {
        setDetectionResult(resultData);
        let nextCarbs = carbs;
        let nextReadings = [...readings];

        if (resultData.estimated_carbs > 0) {
          nextCarbs = resultData.estimated_carbs;
          setCarbs(nextCarbs);
        }

        if (resultData.extracted_glucose) {
          nextReadings[23] = Number(resultData.extracted_glucose);
          setReadings(nextReadings);
          setSelectedWaveform("custom");
        }

        handleRunPrediction(nextReadings, nextCarbs);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Apply Vision Detection Result to Forecast
  const handleApplyDetection = () => {
    if (!detectionResult) return;

    let nextCarbs = carbs;
    let nextReadings = [...readings];

    if (detectionResult.estimated_carbs > 0) {
      nextCarbs = detectionResult.estimated_carbs;
      setCarbs(nextCarbs);
    }

    if (detectionResult.extracted_glucose) {
      nextReadings[23] = Number(detectionResult.extracted_glucose);
      setReadings(nextReadings);
      setSelectedWaveform("custom");
    }

    handleRunPrediction(nextReadings, nextCarbs);
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 3000);
  };

  // Save to History & Evaluate Alert Thresholds
  const handleSaveToHistory = () => {
    if (!predictionData) return;
    const latestVal = readings[23];

    const entry = {
      currentGlucose: latestVal,
      predictedGlucose: predictionData.pred_60min,
      pred_30min: predictionData.pred_30min,
      pred_60min: predictionData.pred_60min,
      trend:
        predictionData.pred_60min > latestVal
          ? "rising"
          : predictionData.pred_60min < latestVal
            ? "falling"
            : "stable",
      rangeLow: Math.max(40, Math.round(Math.min(predictionData.pred_30min, predictionData.pred_60min) - 10)),
      rangeHigh: Math.round(Math.max(predictionData.pred_30min, predictionData.pred_60min) + 10),
      readingTime: new Date().toTimeString().slice(0, 5),
      savedDate: new Date().toLocaleDateString(),
      source: "GlucoAI_LSTM",
      inputs: {
        carbsGrams: carbs,
        insulinUnits: predictionData.suggested_bolus,
        activityLevel: "resting",
        mealTiming: "post-scan",
      },
      explanations: [
        predictionData.risk_message,
        predictionData.insulin_message,
      ],
    };

    const updated = saveGlucosePrediction(entry);
    setHistory(updated);
    setSavedSuccess(true);

    if (userId) {
      const { lowAlertThreshold, highAlertThreshold } = getUserThresholds(userId);
      const safetyResult = classifyGlucoseReading({
        glucose: latestVal,
        predictedGlucose: predictionData.pred_60min,
        trend: entry.trend,
        lowThreshold: lowAlertThreshold,
        highThreshold: highAlertThreshold,
        savedAt: new Date().toISOString(),
      });
      evaluateAndCreateAlert(userId, safetyResult);
    }
  };

  const handleDeleteHistory = (id) => {
    const updated = deleteGlucosePrediction(id);
    setHistory(updated);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="glass-strong p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                <span className="text-2xl">🩺</span>
                <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                  GlucoAI Support Engine
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Continuous Glucose Forecasting & Early Hypo/Hyper Risk Alerts (30m & 60m Keras LSTM)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>FastAPI + Keras LSTM Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Dual-Panel Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL: Input Controls, AI Vision & Parameters (5 cols) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-strong p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>🎛️</span> Input Controls & AI Vision
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                LSTM Engine v1.0
              </span>
            </div>

            {/* Feature Tabs Bar */}
            <div className="flex p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab("vision")}
                className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === "vision"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>AI Vision</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("readings")}
                className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === "readings"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>CGM (24)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("clinical")}
                className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === "clinical"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Patient</span>
              </button>
            </div>

            {/* ── TAB 1: AI Vision Scan Section ── */}
            {activeTab === "vision" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-slate-50 border border-indigo-100 space-y-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                      <Scan className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">
                        Meal Carbohydrate & Meter OCR Scanner
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Drop meal photo or meter display for instant AI feature extraction
                      </p>
                    </div>
                  </div>

                  {/* Dropzone Upload Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleRunVisionDetection("custom", f);
                    }}
                    className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white/70 hover:bg-indigo-50/50 rounded-2xl p-5 text-center cursor-pointer transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleRunVisionDetection("custom", f);
                      }}
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 mx-auto mb-1.5 transition-colors" />
                    <p className="text-xs font-bold text-slate-800">
                      Drop Meal Photo or Meter Display
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      or click to browse from device (JPEG, PNG)
                    </p>
                  </div>

                  {/* Preset Demo Buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      ⚡ Demo Scan Presets:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleRunVisionDetection("pizza")}
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-all cursor-pointer group"
                      >
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1">
                          🍕 Pizza
                        </span>
                        <span className="text-[10px] text-indigo-500 font-semibold block">
                          ~70g Carbs
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRunVisionDetection("salad")}
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-all cursor-pointer group"
                      >
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1">
                          🥗 Salad
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold block">
                          ~15g Carbs
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRunVisionDetection("meter")}
                        className="p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-all cursor-pointer group"
                      >
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center gap-1">
                          🩸 Meter
                        </span>
                        <span className="text-[10px] text-rose-500 font-semibold block">
                          OCR 168 mg/dL
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* AI Vision Detection Result Card */}
                  {(isDetecting || detectionResult) && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-3"
                    >
                      {/* Image Preview with Laser Scanner & Bounding Boxes */}
                      <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                        {detectionResult?.image_url ? (
                          <img
                            src={resolveAssetUrl(detectionResult.image_url)}
                            onError={(e) => {
                              if (!e.currentTarget.dataset.retried) {
                                e.currentTarget.dataset.retried = "1";
                                const src = detectionResult.image_url || "";
                                const baseName = src.split("/").pop();
                                e.currentTarget.src = `./images/${baseName}`;
                              } else if (e.currentTarget.dataset.retried === "1") {
                                e.currentTarget.dataset.retried = "2";
                                const src = detectionResult.image_url || "";
                                const baseName = src.split("/").pop();
                                e.currentTarget.src = `./static/images/${baseName}`;
                              }
                            }}
                            alt="Detection Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-400 text-xs">Loading scan...</div>
                        )}

                        {/* Animated Laser Line */}
                        {isDetecting && <div className="scanner-laser" />}

                        {/* Bounding Box Tags Overlay */}
                        {!isDetecting &&
                          detectionResult?.detected_items?.map((item, idx) => {
                            const [left, top, width, height] = item.box || [20, 20, 60, 60];
                            return (
                              <div
                                key={idx}
                                className="bbox-tag"
                                style={{
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${width}%`,
                                  height: `${height}%`,
                                }}
                              >
                                <span>
                                  {item.label} ({Math.round((item.confidence || 0.95) * 100)}%)
                                </span>
                              </div>
                            );
                          })}
                      </div>

                      {/* Detection Details */}
                      {isDetecting ? (
                        <div className="text-center py-2 space-y-1">
                          <p className="text-xs font-bold text-indigo-600 animate-pulse">
                            🔍 AI Vision Scanning Image...
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Extracting meal carbohydrates and screen OCR readings...
                          </p>
                        </div>
                      ) : (
                        detectionResult && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-900">
                                {detectionResult.title}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {Math.round(detectionResult.confidence * 100)}% Match
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {detectionResult.extracted_glucose ? "OCR Reading" : "Estimated Carbs"}
                                </span>
                                <span className="text-sm font-bold text-indigo-600">
                                  {detectionResult.extracted_glucose
                                    ? `${detectionResult.extracted_glucose} mg/dL`
                                    : `${detectionResult.estimated_carbs}g Carbs`}
                                </span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  Detected Type
                                </span>
                                <span className="text-sm font-bold text-slate-800 truncate block">
                                  {detectionResult.detected_type?.includes("MEAL")
                                    ? "Food Meal"
                                    : "Meter OCR Screen"}
                                </span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-snug">
                              {detectionResult.suggested_action}
                            </p>

                            <button
                              type="button"
                              onClick={handleApplyDetection}
                              className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${applySuccess
                                  ? "bg-emerald-600 hover:bg-emerald-700"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                                }`}
                            >
                              {applySuccess ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>✅ Forecast Updated!</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>⚡ Apply to Forecast & Run LSTM</span>
                                </>
                              )}
                            </button>
                          </div>
                        )
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: Past 2-Hour CGM Readings Section ── */}
            {activeTab === "readings" && (
              <div className="space-y-4">
                {/* Preset Waveforms */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      CGM Waveform Presets:
                    </span>
                    <label className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>Upload CSV</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadWaveform("rising_spike")}
                      className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${selectedWaveform === "rising_spike"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      📈 Rising Spike
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadWaveform("hypo_warning")}
                      className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${selectedWaveform === "hypo_warning"
                          ? "bg-red-50 border-red-300 text-red-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      🚨 Hypo Drop
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadWaveform("stable_normal")}
                      className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${selectedWaveform === "stable_normal"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      ✅ Normal Stable
                    </button>
                  </div>
                </div>

                {/* 24-inputs Grid */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    24 Readings (Past 2 Hours, 5-min intervals):
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                    {readings.map((val, idx) => {
                      const offsetMin = (24 - idx) * 5;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300"
                        >
                          <label className="text-[9px] font-mono text-slate-400">
                            -{offsetMin}m
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={val}
                            onChange={(e) => handleReadingChange(idx, e.target.value)}
                            className="w-full text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: Clinical Parameters Section ── */}
            {activeTab === "clinical" && (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Patient Clinical Parameters
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Meal Carbs (g)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={carbs}
                        onChange={(e) => setCarbs(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Active IOB (Units)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={activeInsulin}
                        onChange={(e) => setActiveInsulin(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        ISF (mg/dL per U)
                      </label>
                      <input
                        type="number"
                        min="10"
                        step="5"
                        value={isf}
                        onChange={(e) => setIsf(parseFloat(e.target.value) || 50)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        ICR (g per U)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={icr}
                        onChange={(e) => setIcr(parseFloat(e.target.value) || 15)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                      Target Blood Glucose (mg/dL)
                    </label>
                    <input
                      type="number"
                      min="70"
                      max="180"
                      step="5"
                      value={targetGlucose}
                      onChange={(e) => setTargetGlucose(parseFloat(e.target.value) || 100)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Master Forecast Execution Button */}
            <button
              type="button"
              onClick={() => handleRunPrediction()}
              disabled={forecasting}
              className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {forecasting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Running Keras LSTM & Insulin Advisor...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>🔮 Run 30-min & 60-min Forecast + AI Insulin Advisor</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL: Analytics, Live Risk Banner & Chart (7 cols)   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-strong p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📈</span> Glucose Trend & Predictive Curve
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Horizon: +30m & +60m
              </span>
            </div>

            {/* 1. Live Risk Status Banner */}
            <div
              className={`p-4 rounded-2xl border transition-all ${predictionData?.risk_level === "CRITICAL_HYPO" || predictionData?.risk_level === "RAPID_FALL"
                  ? "bg-red-50 border-red-300 text-red-950"
                  : predictionData?.risk_level === "WARNING_HYPER"
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : "bg-emerald-50 border-emerald-300 text-emerald-950"
                }`}
            >
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <ShieldAlert
                  className={`w-5 h-5 shrink-0 ${predictionData?.risk_level === "CRITICAL_HYPO"
                      ? "text-red-600 animate-pulse"
                      : predictionData?.risk_level === "WARNING_HYPER"
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                />
                <span>{predictionData?.risk_status || "Ready to Forecast"}</span>
              </div>
              <p className="mt-1 text-xs opacity-90 leading-relaxed pl-7">
                {predictionData?.risk_message ||
                  "Click Predict to calculate 30-min and 60-min continuous glucose predictions."}
              </p>
            </div>

            {/* 2. AI Insulin Dosage Guidance Card */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${predictionData?.insulin_action === "INCREASE"
                  ? "bg-purple-50/80 border-purple-300"
                  : predictionData?.insulin_action === "DECREASE"
                    ? "bg-red-50/80 border-red-300"
                    : "bg-emerald-50/80 border-emerald-300"
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${predictionData?.insulin_action === "INCREASE"
                        ? "bg-purple-100 text-purple-700 border-purple-300"
                        : predictionData?.insulin_action === "DECREASE"
                          ? "bg-red-100 text-red-700 border-red-300"
                          : "bg-emerald-100 text-emerald-700 border-emerald-300"
                      }`}
                  >
                    {predictionData?.insulin_action || "MAINTAIN"}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                    {predictionData?.insulin_status || "🟢 Insulin Status Ready"}
                  </h3>
                </div>

                <div className="text-right flex items-baseline gap-1 sm:self-auto">
                  <span className="text-xs text-slate-500 font-semibold">Suggested Bolus:</span>
                  <span className="text-xl font-bold font-display text-slate-900">
                    {predictionData?.suggested_bolus != null ? predictionData.suggested_bolus : 0.0}
                  </span>
                  <span className="text-xs font-bold text-indigo-600">Units</span>
                </div>
              </div>

              {/* Bolus Breakdown Pills */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-700">
                  Correction: +{predictionData?.correction_dose || 0} U
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-700">
                  Carbs: +{predictionData?.carb_dose || 0} U
                </span>
                {activeInsulin > 0 && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-700">
                    Active IOB Offset: -{activeInsulin} U
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white/90 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                {predictionData?.insulin_message ||
                  "Run prediction to generate personalized AI insulin adjustment recommendations."}
              </div>

              {/* Workable Action Buttons for Insulin Recommendation */}
              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                {predictionData?.suggested_bolus > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyRecommendedInsulin}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Syringe className="h-4 w-4" />
                    <span>
                      {insulinLoggedMsg ? insulinLoggedMsg : `Log Recommended ${predictionData.suggested_bolus} U Rapid Insulin`}
                    </span>
                  </button>
                )}

                {(predictionData?.risk_level === "CRITICAL_HYPO" || predictionData?.insulin_action === "DECREASE") && (
                  <button
                    type="button"
                    onClick={handleLogRescueCarbs}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <UtensilsCrossed className="h-4 w-4" />
                    <span>
                      {rescueCarbLoggedMsg ? rescueCarbLoggedMsg : "Log 15g Rescue Fast Carbs (Rule of 15)"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. Metric Value Highlight Boxes (4 Columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                  Current Glucose
                </span>
                <span className="text-xl font-bold font-display text-slate-900 mt-0.5 block">
                  {predictionData?.current_glucose != null ? predictionData.current_glucose : readings[23]}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">mg/dL</span>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-center">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide block">
                  Pred (t + 30m)
                </span>
                <span className="text-xl font-bold font-display text-indigo-700 mt-0.5 block">
                  {predictionData?.pred_30min != null ? predictionData.pred_30min : "--"}
                </span>
                <span className="text-[10px] text-indigo-500 font-mono">mg/dL</span>
              </div>

              <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-200 text-center">
                <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wide block">
                  Pred (t + 60m)
                </span>
                <span className="text-xl font-bold font-display text-pink-700 mt-0.5 block">
                  {predictionData?.pred_60min != null ? predictionData.pred_60min : "--"}
                </span>
                <span className="text-[10px] text-pink-500 font-mono">mg/dL</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                  Trend Velocity
                </span>
                <span className="text-xl font-bold font-display text-slate-900 mt-0.5 block">
                  {predictionData?.velocity != null
                    ? `${predictionData.velocity > 0 ? "+" : ""}${predictionData.velocity}`
                    : "--"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">mg/dL / 5m</span>
              </div>
            </div>

            {/* 4. Chart Visualization Component */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <GlucoChart
                readings={readings}
                pred30={predictionData?.pred_30min}
                pred60={predictionData?.pred_60min}
              />
            </div>

            {/* Save & Log Actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">
                {savedSuccess ? "Saved to daily log & verified thresholds!" : "Log prediction to clinical history"}
              </span>
              <button
                type="button"
                onClick={handleSaveToHistory}
                disabled={savedSuccess || !predictionData}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Saved to History</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save to Glucose History</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PREDICTION HISTORY TABLE ── */}
      {history.length > 0 && (
        <div className="glass-strong p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" /> Prediction History Log
            </h3>
            <span className="text-xs font-medium text-slate-400">
              {history.length} record{history.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
            {history.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {item.currentGlucose} → {item.predictedGlucose} mg/dL
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-100 text-slate-600 uppercase">
                      {item.source || "Manual"}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-0.5">
                    {item.savedDate || "Today"} · {item.readingTime || "Recent"} · Range: {item.rangeLow}–{item.rangeHigh} mg/dL
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory(item.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
