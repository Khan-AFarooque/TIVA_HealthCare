import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  Salad,
  Scaling,
  Wheat,
  Flame,
  Beef,
  Droplet,
  Lightbulb,
  ScanEye,
  RotateCcw,
  Scale,
  Plus,
  Minus as MinusIcon,
  Sparkles,
} from "lucide-react";
import ConfidenceBar from "./ConfidenceBar";
import { extractReferenceWeight } from "../services/predictor";

const isUnknown = (r) => !r || r.food_name === "Unknown Food";

function Stat({ icon: Icon, label, value, unit, accent, baseValue, isScaled }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      className="glass flex flex-col items-center justify-center gap-1 rounded-2xl p-3.5 text-center transition-all"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-display text-lg font-extrabold text-brand-ink">
        {value != null && value !== "" ? value : "—"} <span className="text-xs font-medium text-slate-400">{unit}</span>
      </p>
      {isScaled && baseValue != null && (
        <span className="text-[9.5px] text-slate-400 font-medium">
          Base: {baseValue}{unit} / serv
        </span>
      )}
    </motion.div>
  );
}

export default function ResultCard({ result, onReset, onSave }) {
  // Extract reference weight per standard serving (e.g. 40g for chapati, 150g for rice)
  const referenceG = useMemo(() => {
    if (!result) return 100;
    const ref = extractReferenceWeight(result.serving_size, result.weight_g);
    return ref > 0 ? ref : (result.weight_g > 0 ? result.weight_g : 100);
  }, [result]);

  // Unified synchronized state: Servings & Grams
  const [servings, setServings] = useState(1);
  const [customGrams, setCustomGrams] = useState(referenceG || 100);
  const [quantitySaved, setQuantitySaved] = useState(false);

  // Sync state if result changes
  useEffect(() => {
    if (result) {
      setServings(1);
      setCustomGrams(referenceG || 100);
      setQuantitySaved(false);
    }
  }, [result, referenceG]);

  // When user updates servings: update grams synchronously
  const handleServingsChange = (val) => {
    const num = Math.max(0.1, Number(val) || 0.1);
    setServings(num);
    setCustomGrams(Math.round(num * referenceG));
    setQuantitySaved(false);
  };

  const handleStepServings = (delta) => {
    const current = Number(servings) || 1;
    const next = Math.max(0.25, Number((current + delta).toFixed(2)));
    handleServingsChange(next);
  };

  // When user updates grams directly: update servings synchronously
  const handleGramsChange = (e) => {
    const gVal = e.target.value;
    setCustomGrams(gVal);
    setQuantitySaved(false);
    const gNum = Number(gVal);
    if (gNum > 0 && referenceG > 0) {
      const calculatedServings = Number((gNum / referenceG).toFixed(2));
      setServings(calculatedServings);
    }
  };

  const handleResetToStandard = () => {
    setServings(1);
    setCustomGrams(referenceG);
    setQuantitySaved(false);
  };

  // Compute active multiplier
  const multiplier = useMemo(() => {
    const s = Number(servings);
    return s > 0 ? s : 1;
  }, [servings]);

  const activeGrams = useMemo(() => {
    const g = Number(customGrams);
    return g > 0 ? g : Math.round(multiplier * referenceG);
  }, [customGrams, multiplier, referenceG]);

  const servingLabel = useMemo(() => {
    return `${multiplier} serving${multiplier !== 1 ? "s" : ""} (${activeGrams}g)`;
  }, [multiplier, activeGrams]);

  // Dynamically calculate nutrition based on the user-given quantity
  const calculated = useMemo(() => {
    if (!result?.hasNutrition) return null;
    const mult = multiplier > 0 ? multiplier : 1;
    return {
      carbs_g: Number((Number(result.carbs_g || 0) * mult).toFixed(1)),
      calories_kcal: Math.round(Number(result.calories_kcal || 0) * mult),
      protein_g: Number((Number(result.protein_g || 0) * mult).toFixed(1)),
      fat_g: Number((Number(result.fat_g || 0) * mult).toFixed(1)),
      multiplier: mult,
    };
  }, [result, multiplier]);

  if (!result) return null;

  const isScaled = multiplier !== 1;

  const handleSave = () => {
    if (quantitySaved) return;
    const scaled = calculated || {
      carbs_g: result.carbs_g,
      calories_kcal: result.calories_kcal,
      protein_g: result.protein_g,
      fat_g: result.fat_g,
    };
    const entry = {
      ...result,
      carbs_g: scaled.carbs_g,
      calories_kcal: scaled.calories_kcal,
      protein_g: scaled.protein_g,
      fat_g: scaled.fat_g,
      serving_size: servingLabel,
      consumed_g: activeGrams,
      consumed_carbs_g: scaled.carbs_g,
      consumed_calories_kcal: scaled.calories_kcal,
      consumed_protein_g: scaled.protein_g,
      consumed_fat_g: scaled.fat_g,
      reference_weight_g: referenceG,
      quantity_multiplier: multiplier,
      quantity_servings: multiplier,
    };
    setQuantitySaved(true);
    if (onSave) onSave(entry);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-strong overflow-hidden rounded-3xl border border-slate-200/80 shadow-xl"
    >
      {/* Header Strip */}
      <div className="flex flex-col gap-4 border-b border-white/50 bg-gradient-to-r from-brand-blue/10 via-white/40 to-emerald-500/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-emerald-500 shadow-lg shadow-brand-blue/20">
            <UtensilsCrossed className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              Detected Food
            </p>
            <h3 className="font-display text-2xl font-extrabold text-brand-ink sm:text-3xl">
              {result.food_name}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 self-start rounded-full border border-brand-blue/30 bg-white px-4 py-2 text-sm font-semibold text-brand-blue shadow-sm transition hover:scale-105 hover:bg-brand-blue hover:text-white sm:self-center cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" /> New Scan
        </button>
      </div>

      <div className="space-y-5 p-6">
        <ConfidenceBar confidence={result.confidence} />

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue/10 px-3 py-1.5 text-xs font-bold text-brand-blue ring-1 ring-brand-blue/20">
            <ScanEye className="h-3.5 w-3.5" /> {result.category || "Indian Dish"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            <Scaling className="h-3.5 w-3.5" /> Standard: {result.serving_size || `${referenceG}g`}
          </span>
          {referenceG > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Reference: {referenceG}g / serving
            </span>
          )}
        </div>

        {/* ── FOOD QUANTITY & PORTION (PROPER UNIFIED MANNER) ── */}
        {result.hasNutrition && (
          <div className="rounded-2xl border border-brand-blue/25 bg-gradient-to-br from-blue-50/70 via-white to-emerald-50/50 p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-brand-blue shrink-0" />
                <h4 className="font-display text-sm font-bold text-brand-ink">
                  Food Quantity Consumed:
                </h4>
              </div>
              <span className="text-xs font-medium text-slate-500">
                1 serving = <strong className="text-brand-ink font-bold">{referenceG}g</strong>
              </span>
            </div>

            {/* Unified Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Servings Stepper */}
              <div className="bg-white/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5 shadow-xs">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  By Servings:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepServings(-0.5)}
                    className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                    title="Decrease by 0.5"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="25"
                      value={servings}
                      onChange={(e) => handleServingsChange(e.target.value)}
                      className="w-full h-10 px-3 text-center rounded-xl bg-white border border-slate-200 font-bold text-base text-brand-ink focus:ring-2 focus:ring-brand-blue/30 outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-semibold pointer-events-none">
                      serv
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStepServings(0.5)}
                    className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                    title="Increase by 0.5"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {[0.5, 1, 1.5, 2, 3].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleServingsChange(val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        Number(servings) === val
                          ? "bg-brand-blue text-white shadow-xs"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                      }`}
                    >
                      {val}x {val === 0.5 ? "(Half)" : val === 1 ? "(1 Serv)" : val === 2 ? "(Double)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight in Grams */}
              <div className="bg-white/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Or Weight (Grams):
                  </label>
                  <button
                    type="button"
                    onClick={handleResetToStandard}
                    className="text-[11px] font-bold text-brand-blue hover:underline cursor-pointer"
                  >
                    Reset ({referenceG}g)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="3000"
                    step="5"
                    value={customGrams}
                    onChange={handleGramsChange}
                    className="w-full h-10 px-3 pr-8 rounded-xl bg-white border border-slate-200 font-mono font-bold text-base text-brand-ink focus:ring-2 focus:ring-brand-blue/30 outline-none"
                    placeholder={`${referenceG}`}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">
                    g
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 pt-0.5">
                  Synchronized with servings ({referenceG}g per serving)
                </p>
              </div>
            </div>

            {/* Calculated Portion Notice Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs pt-1 border-t border-blue-200/50">
              <span className="text-slate-600">
                Calculated for: <strong className="text-brand-blue font-bold">{servingLabel}</strong>
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-3 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto">
                <Sparkles className="h-3.5 w-3.5" />
                {calculated?.carbs_g ?? result.carbs_g}g Carbs • {calculated?.calories_kcal ?? result.calories_kcal} kcal
              </span>
            </div>
          </div>
        )}

        {/* ── DYNAMICALLY CALCULATED NUTRITION GRID ── */}
        {result.hasNutrition ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Nutritional Breakdown {isScaled ? `(for ${servingLabel})` : "(1 Standard Serving)"}:
              </span>
              {isScaled && (
                <span className="text-[11px] font-bold text-brand-blue">
                  ✓ Recalculated dynamically
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                icon={Wheat}
                label="Carbohydrates"
                value={calculated?.carbs_g ?? result.carbs_g}
                unit="g"
                accent="bg-emerald-100 text-emerald-600"
                baseValue={result.carbs_g}
                isScaled={isScaled}
              />
              <Stat
                icon={Flame}
                label="Calories"
                value={calculated?.calories_kcal ?? result.calories_kcal}
                unit="kcal"
                accent="bg-orange-100 text-orange-600"
                baseValue={result.calories_kcal}
                isScaled={isScaled}
              />
              <Stat
                icon={Beef}
                label="Protein"
                value={calculated?.protein_g ?? result.protein_g}
                unit="g"
                accent="bg-brand-blue/10 text-brand-blue"
                baseValue={result.protein_g}
                isScaled={isScaled}
              />
              <Stat
                icon={Droplet}
                label="Fat"
                value={calculated?.fat_g ?? result.fat_g}
                unit="g"
                accent="bg-rose-100 text-rose-600"
                baseValue={result.fat_g}
                isScaled={isScaled}
              />
              <Stat
                icon={Salad}
                label="Category"
                value={result.category || "Indian Dish"}
                unit=""
                accent="bg-violet-100 text-violet-600"
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white">
              <Wheat className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                Nutrition data unavailable
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                Nutrition data unavailable for this recognized food item.
              </p>
            </div>
          </div>
        )}

        {/* Save / Use This Meal Button */}
        {result.hasNutrition && (
          <button
            type="button"
            onClick={handleSave}
            disabled={quantitySaved}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all cursor-pointer ${
              quantitySaved
                ? "bg-emerald-600 shadow-emerald-600/25 cursor-default"
                : "bg-gradient-to-r from-brand-blue to-emerald-600 shadow-brand-blue/25 hover:brightness-110 hover:scale-[1.01]"
            }`}
          >
            {quantitySaved ? `✓ Saved to History (${servingLabel})` : `Save / Use This Meal (${servingLabel})`}
          </button>
        )}

        {/* Recommendation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-500/30">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Diabetic-Safe Recommendation
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {result.recommendation}
              {isScaled && calculated?.carbs_g > 45 && (
                <span className="block mt-1 font-semibold text-amber-800">
                  Note: A larger portion ({servingLabel}) delivers {calculated.carbs_g}g of total carbs. Please adjust your insulin bolus or check postprandial glucose accordingly.
                </span>
              )}
            </p>
          </div>
        </motion.div>

        {/* Candidate List */}
        {result.candidates?.length > 1 && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200/80">
            <p className="font-bold text-slate-600">Top candidates:</p>
            {result.candidates.map((c, i) => (
              <p key={i} className="mt-0.5">
                {i + 1}. {c.name} — {(c.confidence * 100).toFixed(1)}%
              </p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
