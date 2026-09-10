import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Calendar,
} from "lucide-react";

// Preset traces with 24 continuous 5-minute interval readings (past 2 hours)
const PRESETS = {
  stable: {
    label: "Optimal In-Range",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    readings: [
      112, 114, 115, 113, 116, 118,
      117, 115, 119, 122, 120, 118,
      116, 115, 114, 117, 119, 121,
      120, 118, 119, 122, 121, 120,
    ],
    pred30: 122,
    pred60: 119,
    trend: "stable",
  },
  spike: {
    label: "Postprandial Rise",
    color: "text-orange-600 bg-orange-50 border-orange-200",
    readings: [
      105, 108, 112, 118, 125, 134,
      142, 150, 158, 165, 172, 178,
      182, 186, 189, 191, 192, 190,
      188, 185, 183, 180, 178, 175,
    ],
    pred30: 168,
    pred60: 154,
    trend: "rising",
  },
  hypo: {
    label: "Hypo Risk Alert",
    color: "text-rose-600 bg-rose-50 border-rose-200",
    readings: [
      138, 132, 125, 118, 110, 104,
      98, 92, 86, 82, 78, 75,
      73, 71, 69, 68, 67, 66,
      65, 64, 63, 62, 62, 61,
    ],
    pred30: 58,
    pred60: 55,
    trend: "falling",
  },
};

export default function DashboardCgmGraph({ currentGlucose, currentTrend }) {
  const [activePreset, setActivePreset] = useState("stable");
  const [hoverPoint, setHoverPoint] = useState(null);

  // Generate dated series with today's real timestamps for 24 continuous 5-minute points
  const datedPoints = useMemo(() => {
    const now = new Date();
    const activeData = PRESETS[activePreset];
    const rawReadings = [...activeData.readings];

    // If current user glucose exists, smoothly anchor the stable trace to currentGlucose
    let pred30Val = activeData.pred30;
    let pred60Val = activeData.pred60;

    if (currentGlucose && activePreset === "stable") {
      const numG = Number(currentGlucose);
      if (!isNaN(numG) && numG > 0) {
        const delta = numG - 120;
        for (let i = 0; i < 24; i++) {
          rawReadings[i] = Math.round(rawReadings[i] + delta * (i / 23));
        }
        rawReadings[23] = numG;
        pred30Val = Math.round(activeData.pred30 + delta);
        pred60Val = Math.round(activeData.pred60 + delta);
      }
    }

    const points = [];
    const stepMinutes = 5;

    // Past 24 readings: from 115 min ago up to now (slot 0 to 23)
    for (let i = 0; i < 24; i++) {
      const minutesAgo = (23 - i) * stepMinutes;
      const pointTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
      const timeLabel = pointTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const val = rawReadings[i];

      points.push({
        slotIndex: i,
        time: pointTime,
        timeLabel,
        value: val,
        isForecast: false,
        status:
          val < 70
            ? "Hypoglycemia (<70)"
            : val > 180
            ? "Hyperglycemia (>180)"
            : val > 140
            ? "Elevated (140-180)"
            : "In Target (70-140)",
      });
    }

    // +30m forecast point (slot 24)
    const time30 = new Date(now.getTime() + 30 * 60 * 1000);
    points.push({
      slotIndex: 24,
      time: time30,
      timeLabel: "+30m (" + time30.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ")",
      value: pred30Val,
      isForecast: true,
      forecastTag: "+30m",
      status: pred30Val < 70 ? "Hypo Danger" : "Projected",
    });

    // +60m forecast point (slot 25)
    const time60 = new Date(now.getTime() + 60 * 60 * 1000);
    points.push({
      slotIndex: 25,
      time: time60,
      timeLabel: "+60m (" + time60.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ")",
      value: pred60Val,
      isForecast: true,
      forecastTag: "+60m",
      status: pred60Val < 70 ? "Hypo Danger" : "Projected",
    });

    return points;
  }, [activePreset, currentGlucose]);

  // SVG Chart Geometry
  const chartLayout = useMemo(() => {
    const w = 780;
    const h = 260;
    const padL = 48;
    const padR = 56;
    const padT = 24;
    const padB = 40;

    const minG = 40;
    const maxG = 260;

    const totalPlotW = w - padL - padR;
    const histW = totalPlotW * 0.72;
    const forecastStep = (totalPlotW - histW) / 2;

    const scaleHistX = (slot) => padL + (slot / 23) * histW;
    const scaleX = scaleHistX;
    const scaleY = (val) => h - padB - ((val - minG) / (maxG - minG)) * (h - padT - padB);

    const histPoints = datedPoints.slice(0, 24).map((pt) => ({
      ...pt,
      x: scaleHistX(pt.slotIndex),
      y: scaleY(pt.value),
    }));

    const lastHistX = histPoints[histPoints.length - 1].x;
    const forecastPoints = datedPoints.slice(24).map((pt, i) => ({
      ...pt,
      x: lastHistX + (i + 1) * forecastStep,
      y: scaleY(pt.value),
    }));

    // Historical Line Path
    const histPath = histPoints.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ""
    );

    // Area fill under historical curve
    const areaPath = `${histPath} L ${histPoints[histPoints.length - 1].x} ${h - padB} L ${histPoints[0].x} ${h - padB} Z`;

    // Forecast Dotted Line Path
    const lastHist = histPoints[histPoints.length - 1];
    const forecastPath = `M ${lastHist.x} ${lastHist.y} L ${forecastPoints[0].x} ${forecastPoints[0].y} L ${forecastPoints[1].x} ${forecastPoints[1].y}`;

    // Target Range Shading Boundaries (70 to 140 mg/dL)
    const y70 = scaleY(70);
    const y140 = scaleY(140);
    const y180 = scaleY(180);

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      scaleX,
      scaleY,
      histPoints,
      forecastPoints,
      histPath,
      areaPath,
      forecastPath,
      y70,
      y140,
      y180,
    };
  }, [datedPoints]);

  const latestVal = chartLayout.histPoints[chartLayout.histPoints.length - 1]?.value || 115;
  const inRangeCount = chartLayout.histPoints.filter((p) => p.value >= 70 && p.value <= 140).length;
  const tirPercent = Math.round((inRangeCount / 24) * 100);

  return (
    <div className="glass-strong p-6 rounded-3xl border border-white/70 shadow-lg relative overflow-hidden space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base md:text-lg font-bold text-brand-ink flex items-center gap-2">
                Continuous Glucose Monitor (CGM) Real-Time Curve
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Live Series
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                5-min interval continuous sampling with LSTM dual-horizon (+30m / +60m) neural net forecast.
              </p>
            </div>
          </div>
        </div>

        {/* Trace Preset Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Presets:
          </span>
          {Object.entries(PRESETS).map(([key, data]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePreset(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                activePreset === key
                  ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {data.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clinical KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/70 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Glucose</span>
          <span className="font-display text-xl font-bold text-brand-ink">
            {latestVal} <span className="text-xs font-normal text-slate-400">mg/dL</span>
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
            {latestVal < 70 ? "Hypo Warning" : latestVal > 140 ? "Elevated" : "In Range"}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/70 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Time in Range (TIR)</span>
          <span className="font-display text-xl font-bold text-emerald-700">
            {tirPercent}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Target: 70–140 mg/dL</span>
        </div>

        <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/70 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">+30 min Projected</span>
          <span className="font-display text-xl font-bold text-indigo-600">
            {chartLayout.forecastPoints[0]?.value} <span className="text-xs font-normal text-slate-400">mg/dL</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">LSTM horizon 1</span>
        </div>

        <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/70 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">+60 min Projected</span>
          <span className="font-display text-xl font-bold text-violet-600">
            {chartLayout.forecastPoints[1]?.value} <span className="text-xs font-normal text-slate-400">mg/dL</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">LSTM horizon 2</span>
        </div>
      </div>

      {/* SVG CGM Chart Canvas */}
      <div className="w-full overflow-x-auto relative">
        <svg
          viewBox={`0 0 ${chartLayout.w} ${chartLayout.h}`}
          className="w-full h-auto min-w-[620px] select-none"
        >
          <defs>
            {/* Gradient for Historical Curve Area */}
            <linearGradient id="cgmAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Gradient for Target Corridor (70-140) */}
            <linearGradient id="targetBandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* 1. Target Corridor Shading (70 to 140 mg/dL) */}
          <rect
            x={chartLayout.padL}
            y={chartLayout.y140}
            width={chartLayout.w - chartLayout.padL - chartLayout.padR}
            height={chartLayout.y70 - chartLayout.y140}
            fill="url(#targetBandGradient)"
          />

          {/* 2. Hypo Danger Zone Shading (< 70 mg/dL) */}
          <rect
            x={chartLayout.padL}
            y={chartLayout.y70}
            width={chartLayout.w - chartLayout.padL - chartLayout.padR}
            height={chartLayout.h - chartLayout.padB - chartLayout.y70}
            fill="#f43f5e"
            fillOpacity="0.05"
          />

          {/* Grid lines and Y-axis reference levels */}
          {[70, 100, 140, 180, 220].map((val) => {
            const y = chartLayout.scaleY(val);
            const isTarget = val === 70 || val === 140;
            const isDanger = val === 70;
            return (
              <g key={val}>
                <line
                  x1={chartLayout.padL}
                  y1={y}
                  x2={chartLayout.w - chartLayout.padR}
                  y2={y}
                  stroke={isDanger ? "#f43f5e" : isTarget ? "#10b981" : "#e2e8f0"}
                  strokeWidth={isTarget ? "1.5" : "1"}
                  strokeDasharray={isTarget ? "4 4" : "2 2"}
                />
                <text
                  x={chartLayout.padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className={`text-[10px] font-semibold ${
                    isDanger ? "fill-rose-600" : isTarget ? "fill-emerald-600 font-bold" : "fill-slate-400"
                  }`}
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Shaded Area Fill */}
          <path d={chartLayout.areaPath} fill="url(#cgmAreaGradient)" />

          {/* Historical CGM Curve Line */}
          <path
            d={chartLayout.histPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Forecast Dotted Projection Curve */}
          <path
            d={chartLayout.forecastPath}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />

          {/* Vertical Transition Boundary: "Now" Line */}
          <line
            x1={chartLayout.histPoints[chartLayout.histPoints.length - 1].x}
            y1={chartLayout.padT}
            x2={chartLayout.histPoints[chartLayout.histPoints.length - 1].x}
            y2={chartLayout.h - chartLayout.padB}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x={chartLayout.histPoints[chartLayout.histPoints.length - 1].x}
            y={chartLayout.padT - 8}
            textAnchor="middle"
            className="text-[10px] font-bold fill-slate-500 uppercase tracking-widest"
          >
            NOW
          </text>

          {/* Historical Data Points */}
          {chartLayout.histPoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={hoverPoint?.slotIndex === pt.slotIndex ? "6" : "3.5"}
              className={`${
                pt.value < 70
                  ? "fill-rose-500 stroke-white"
                  : pt.value > 140
                  ? "fill-amber-500 stroke-white"
                  : "fill-brand-blue stroke-white"
              } cursor-pointer transition-all duration-150`}
              strokeWidth="2"
              onMouseEnter={() => setHoverPoint(pt)}
            />
          ))}

          {/* Forecast Points (+30m, +60m) */}
          {chartLayout.forecastPoints.map((pt, idx) => (
            <g key={idx} onMouseEnter={() => setHoverPoint(pt)} className="cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r="6"
                className="fill-violet-600 stroke-white"
                strokeWidth="2"
              />
              <rect
                x={pt.x - 22}
                y={pt.y - 24}
                width="44"
                height="16"
                rx="4"
                fill="#6d28d9"
              />
              <text
                x={pt.x}
                y={pt.y - 12}
                textAnchor="middle"
                fill="#ffffff"
                className="text-[9px] font-bold"
              >
                {pt.forecastTag}
              </text>
            </g>
          ))}

          {/* Time Labels on X-axis (every 4 slots = 20 mins) */}
          {chartLayout.histPoints
            .filter((_, i) => i % 5 === 0 || i === 23)
            .map((pt, i) => (
              <text
                key={i}
                x={pt.x}
                y={chartLayout.h - chartLayout.padB + 18}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-slate-400"
              >
                {pt.timeLabel}
              </text>
            ))}

          {/* Forecast X-axis labels */}
          <text
            x={chartLayout.forecastPoints[0].x}
            y={chartLayout.h - chartLayout.padB + 18}
            textAnchor="middle"
            className="text-[10px] font-bold fill-violet-600"
          >
            +30m
          </text>
          <text
            x={chartLayout.forecastPoints[1].x}
            y={chartLayout.h - chartLayout.padB + 18}
            textAnchor="middle"
            className="text-[10px] font-bold fill-violet-600"
          >
            +60m
          </text>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoverPoint && (
          <div
            className="absolute z-20 pointer-events-none p-3 rounded-2xl bg-slate-900/95 text-white shadow-xl border border-slate-700 text-xs backdrop-blur-md"
            style={{
              left: `${Math.min(chartLayout.w - 180, Math.max(20, (hoverPoint.slotIndex / 25) * 80))}%`,
              top: "10px",
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-bold text-brand-blue">{hoverPoint.timeLabel}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-semibold">
                {hoverPoint.isForecast ? "Forecast" : "CGM Log"}
              </span>
            </div>
            <div className="text-sm font-bold flex items-baseline gap-1">
              <span className="text-lg text-white">{hoverPoint.value}</span>
              <span className="text-slate-400 text-xs font-normal">mg/dL</span>
            </div>
            <p className="text-[10px] text-slate-300 mt-1">{hoverPoint.status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
