import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  LayoutDashboard,
  Clock,
  Trash2,
  Save,
  AlertTriangle,
  Droplets,
  Calculator,
} from "lucide-react";
import {
  loadInsulinHistory,
  saveInsulinLog,
  deleteInsulinLog,
  getLatestGlucose,
  getLatestFoodCarbs,
  educationalCalculation,
} from "../utils/insulinCalculator";

const INSULIN_TYPES = [
  { value: "rapid", label: "Rapid / mealtime" },
  { value: "long-acting", label: "Long-acting / basal" },
  { value: "other", label: "Other" },
];

export default function InsulinCalculatorPage({ onBack }) {
  // ── Insulin Log form ──
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logTime, setLogTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [logType, setLogType] = useState("rapid");
  const [logName, setLogName] = useState("");
  const [logAmount, setLogAmount] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logCarbs, setLogCarbs] = useState("");

  // ── Educational calc form ──
  const [eduGlucose, setEduGlucose] = useState("");
  const [eduCarbs, setEduCarbs] = useState("");
  const [carbRatio, setCarbRatio] = useState("");
  const [correctionFactor, setCorrectionFactor] = useState("");
  const [targetGlucose, setTargetGlucose] = useState("");

  // ── Data connectors ──
  const [latestGlucose, setLatestGlucose] = useState(null);
  const [latestFoodCarbs, setLatestFoodCarbs] = useState(null);
  const [useFoodAiCarbs, setUseFoodAiCarbs] = useState(false);
  const [useLatestGlucose, setUseLatestGlucose] = useState(false);

  // ── History ──
  const [history, setHistory] = useState([]);

  // Load data & profile clinical parameters on mount
  useEffect(() => {
    setHistory(loadInsulinHistory());
    const g = getLatestGlucose();
    if (g) {
      setLatestGlucose(g);
      setEduGlucose(String(g.value));
      setUseLatestGlucose(true);
    }
    const fc = getLatestFoodCarbs();
    if (fc) setLatestFoodCarbs(fc);

    try {
      const auth = JSON.parse(localStorage.getItem("tiva_auth") || "{}");
      const uid = userId || auth?.userId;
      const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
      const prof = (uid && profiles[uid]) || null;
      if (prof) {
        if (prof.targetGlucose) setTargetGlucose(String(prof.targetGlucose));
        if (prof.isf) setCorrectionFactor(String(prof.isf));
        if (prof.icr) {
          const parsedIcr = String(prof.icr).replace("1:", "").trim();
          if (parsedIcr) setCarbRatio(parsedIcr);
        }
        if (!g && prof.currentGlucose) {
          setEduGlucose(String(prof.currentGlucose));
          setUseLatestGlucose(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, [userId]);

  // Sync glucose when toggling
  useEffect(() => {
    if (useLatestGlucose && latestGlucose) {
      setEduGlucose(String(latestGlucose.value));
    }
  }, [useLatestGlucose, latestGlucose]);

  // Sync carbs when toggling
  useEffect(() => {
    if (useFoodAiCarbs && latestFoodCarbs) {
      setEduCarbs(String(latestFoodCarbs.carbsGrams));
      setLogCarbs(String(latestFoodCarbs.carbsGrams));
    }
  }, [useFoodAiCarbs, latestFoodCarbs]);

  // ── Handlers ──
  const handleSaveLog = useCallback(() => {
    const amount = Number(logAmount);
    if (!amount || amount <= 0) return;
    const entry = {
      date: logDate,
      time: logTime,
      type: logType,
      medicationName: logName.trim() || (logType === "rapid" ? "Rapid-acting" : "Basal Insulin"),
      amount,
      notes: logNotes.trim(),
      relatedCarbs: logCarbs ? Number(logCarbs) : null,
    };
    const updated = saveInsulinLog(entry);
    setHistory(updated);
    setLogAmount("");
    setLogName("");
    setLogNotes("");
  }, [logDate, logTime, logType, logName, logAmount, logNotes, logCarbs]);

  const handleDeleteLog = useCallback((id) => {
    const updated = deleteInsulinLog(id);
    setHistory(updated);
  }, []);

  const calcResult = educationalCalculation({
    carbsGrams: Number(eduCarbs) || 0,
    currentGlucose: Number(eduGlucose) || null,
    carbRatio: carbRatio ? Number(carbRatio) : null,
    correctionFactor: correctionFactor ? Number(correctionFactor) : null,
    targetGlucose: targetGlucose ? Number(targetGlucose) : null,
  });

  const hasPersonalSettings =
    (carbRatio && Number(carbRatio) > 0) ||
    (correctionFactor && Number(correctionFactor) > 0 && eduGlucose);

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
                <ShieldCheck className="h-6 w-6 text-brand-blue" /> Clinical Insulin Dose Calculator &amp; Logger
              </h2>
              <p className="mt-1 text-slate-500">
                Calculate bolus dosage based on carb ratio &amp; correction factor, and record administered insulin.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-brand-blue ring-1 ring-blue-200">
            Clinical Calculator &amp; Logger
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* ── SECTION 1: INSULIN LOG ── */}
          <div className="glass-strong p-6 rounded-3xl space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="h-5 w-5 text-brand-blue" />
              <h3 className="font-display text-lg font-bold text-brand-ink">Insulin Log</h3>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Time</label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  <input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
              </div>
            </div>

            {/* Insulin Type */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Insulin Type / Category</label>
              <div className="grid grid-cols-3 gap-2">
                {INSULIN_TYPES.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setLogType(opt.value)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      logType === opt.value
                        ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20"
                        : "bg-white/60 border border-slate-200 text-slate-600 hover:border-brand-blue/40"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Insulin Name / Brand */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Medication Brand / Name <span className="text-slate-400 font-normal">(e.g. Humalog, Novolog, Lantus, Tresiba)</span>
              </label>
              <input
                type="text"
                value={logName}
                onChange={(e) => setLogName(e.target.value)}
                placeholder="e.g. Humalog (Lispro) or Lantus (Glargine)"
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors text-sm"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Amount <span className="text-slate-400 font-normal">(already taken / recorded by user)</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min="0.5" max="100" step="0.5" value={logAmount}
                  onChange={(e) => setLogAmount(e.target.value)}
                  placeholder="e.g. 5"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">units</span>
              </div>
            </div>

            {/* Related Carbs */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Related Carbohydrates <span className="text-slate-400 font-normal">(optional)</span></label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="500" value={logCarbs}
                  onChange={(e) => setLogCarbs(e.target.value)}
                  placeholder="e.g. 45"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">grams</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2}
                placeholder="Any additional notes..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors resize-none" />
            </div>

            <button type="button" onClick={handleSaveLog} disabled={!logAmount || Number(logAmount) <= 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-blue to-emerald-500 font-semibold text-white shadow-lg shadow-brand-blue/30 hover:scale-[1.01] transition-transform disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2">
              <Save className="h-5 w-5" /> Save Insulin Log
            </button>
          </div>

          {/* ── SECTION 2: EDUCATIONAL ESTIMATION ── */}
          <div className="glass-strong p-6 rounded-3xl space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-5 w-5 text-brand-blue" />
              <h3 className="font-display text-lg font-bold text-brand-ink">Educational Estimation</h3>
            </div>

            {/* Current Glucose */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Current Glucose</label>
              <div className="flex items-center gap-2">
                <input type="number" min="20" max="600" value={eduGlucose}
                  onChange={(e) => { setEduGlucose(e.target.value); setUseLatestGlucose(false); }}
                  placeholder="e.g. 145"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">mg/dL</span>
              </div>
              {latestGlucose && (
                <label className="mt-2 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useLatestGlucose}
                    onChange={(e) => setUseLatestGlucose(e.target.checked)}
                    className="rounded border-brand-blue/30 text-brand-blue focus:ring-brand-blue/40" />
                  <span className="text-sm text-slate-600">
                    Use latest glucose reading: <strong>{latestGlucose.value} mg/dL</strong>
                  </span>
                </label>
              )}
            </div>

            {/* Carbohydrate Intake */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Carbohydrate Intake</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="500" value={eduCarbs}
                  onChange={(e) => { setEduCarbs(e.target.value); setUseFoodAiCarbs(false); }}
                  placeholder="e.g. 45"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">grams</span>
              </div>
              {latestFoodCarbs && (
                <label className="mt-2 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useFoodAiCarbs}
                    onChange={(e) => setUseFoodAiCarbs(e.target.checked)}
                    className="rounded border-brand-blue/30 text-brand-blue focus:ring-brand-blue/40" />
                  <span className="text-sm text-slate-600">
                    Use latest Food AI carbs: <strong>{latestFoodCarbs.foodName}</strong> ({latestFoodCarbs.carbsGrams}g)
                  </span>
                </label>
              )}
            </div>

            {/* Personal Carb Ratio */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Personal carbohydrate ratio
              </label>
              <p className="text-xs text-slate-400 mb-2">Enter only if already provided by your healthcare professional</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 whitespace-nowrap">1 unit :</span>
                <input type="number" min="1" max="100" value={carbRatio}
                  onChange={(e) => setCarbRatio(e.target.value)}
                  placeholder="e.g. 15"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">grams carbs</span>
              </div>
            </div>

            {/* Correction Factor */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Personal correction factor
              </label>
              <p className="text-xs text-slate-400 mb-2">Enter only if already provided by your healthcare professional</p>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="200" value={correctionFactor}
                  onChange={(e) => setCorrectionFactor(e.target.value)}
                  placeholder="e.g. 50"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">mg/dL per unit</span>
              </div>
            </div>

            {/* Target Glucose */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Personal target glucose
              </label>
              <p className="text-xs text-slate-400 mb-2">Enter only if already established in your care plan</p>
              <div className="flex items-center gap-2">
                <input type="number" min="50" max="300" value={targetGlucose}
                  onChange={(e) => setTargetGlucose(e.target.value)}
                  placeholder="e.g. 120"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                <span className="text-sm font-medium text-slate-500">mg/dL</span>
              </div>
            </div>

            {/* Calculation Result */}
            <AnimatePresence mode="wait">
              {hasPersonalSettings && calcResult ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Educational calculation based on your entered personal settings
                  </p>

                  {/* Formula breakdown */}
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>Carbohydrate component</span>
                      <span className="font-mono font-bold text-brand-ink">
                        {Number(eduCarbs) || 0}g ÷ {carbRatio} = <span className="text-brand-blue">{calcResult.carbComponent}</span>
                      </span>
                    </div>
                    {calcResult.hasCorrection && (
                      <div className="flex justify-between items-center">
                        <span>Correction component</span>
                        <span className="font-mono font-bold text-brand-ink">
                          ({Number(eduGlucose) || 0} − {targetGlucose}) ÷ {correctionFactor} = <span className="text-brand-blue">{calcResult.correctionComponent}</span>
                        </span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                      <span className="font-semibold text-brand-ink">Total mathematical estimate</span>
                      <span className="font-mono text-lg font-bold text-brand-blue">{calcResult.totalEstimate}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    This is a <strong>mathematical educational calculation</strong> using values you entered.
                    It is <strong>not a medical recommendation</strong> or instruction to administer insulin.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="missing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60 text-center">
                  <p className="text-sm text-slate-500">
                    Add your own clinician-provided settings to view an educational calculation.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right: History Panel ── */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="glass-strong p-5 rounded-3xl">
            <h3 className="font-display text-base font-bold text-brand-ink mb-4 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-brand-blue" /> Recent Insulin Logs
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No insulin records yet</p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {history.map((entry) => {
                  const typeLabel = INSULIN_TYPES.find((t) => t.value === entry.type)?.label || entry.type;
                  return (
                    <div key={entry.id} className="p-3 rounded-xl bg-white/60 border border-slate-200/60 group relative">
                      <button type="button" onClick={() => handleDeleteLog(entry.id)}
                        className="absolute top-2 right-2 p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        aria-label="Delete log">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{entry.date} {entry.time}</span>
                        <span className="text-xs font-medium text-brand-blue">{typeLabel}</span>
                      </div>
                      {entry.medicationName && (
                        <p className="text-xs font-bold text-slate-800 mb-0.5">{entry.medicationName}</p>
                      )}
                      <p className="font-display text-lg font-bold text-brand-ink">{entry.amount} <span className="text-sm font-medium text-slate-400">units</span></p>
                      {entry.relatedCarbs != null && (
                        <p className="text-xs text-slate-500 mt-0.5">Carbs: {entry.relatedCarbs}g</p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{entry.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
