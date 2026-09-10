import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  X,
  FileCheck,
  ShieldAlert,
  Cpu,
  Database,
  Activity,
  Zap,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export default function Psi02TraceabilityModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const REQUIREMENTS = [
    {
      id: "REQ-01",
      name: "Glucose Reading Input",
      status: "Implemented",
      icon: Activity,
      desc: "Manual entry of current blood glucose (mg/dL) with validation and trend history persistence.",
      component: "GlucosePredictionPage.jsx & shared.js",
    },
    {
      id: "REQ-02",
      name: "CGM CSV Data Import",
      status: "Implemented",
      icon: Clock,
      desc: "Parses CSV exports from Dexcom, FreeStyle Libre, or generic formats. Validates timestamp and glucose values.",
      component: "cgmParser.js & GlucosePredictionPage.jsx",
    },
    {
      id: "REQ-03",
      name: "Insulin Dose Logging",
      status: "Implemented",
      icon: ShieldAlert,
      desc: "Historical logging for date/time, insulin type (rapid, basal), brand/name, and units. Logging only — no automated dosing.",
      component: "InsulinCalculatorPage.jsx & shared.js",
    },
    {
      id: "REQ-04",
      name: "Meal Logging",
      status: "Implemented",
      icon: Zap,
      desc: "Meal carbohydrate intake logging directly from Food AI analysis or manual meal logs.",
      component: "FoodAIPage.jsx & DailyReportPage.jsx",
    },
    {
      id: "REQ-05",
      name: "Indian Food Recognition",
      status: "Implemented",
      icon: Sparkles,
      desc: "Dual ML inference: In-browser Teachable Machine (50 classes) + MobileNetV2 Keras model (78 classes).",
      component: "model/predict.py & teachable.js",
    },
    {
      id: "REQ-06",
      name: "Carbohydrate Estimation",
      status: "Implemented",
      icon: Database,
      desc: "78-item curated Indian food nutritional database with realistic net carbs, calories, protein, fat, and serving sizes.",
      component: "nutrition/indian_foods.json",
    },
    {
      id: "REQ-07",
      name: "30 & 60-Minute Glucose Forecasting",
      status: "Implemented",
      icon: Cpu,
      desc: "Trained LSTM neural network (cgm_exp1_lstm_model.keras) using 5 time-series features over past 2 hours (24 readings).",
      component: "model/cgm/cgm_predictor.py & /api/v1/predict/cgm",
    },
    {
      id: "REQ-08",
      name: "Hypoglycemia Risk Indicator",
      status: "Implemented",
      icon: ShieldAlert,
      desc: "Predictive alert system flagging values <70 mg/dL in 30/60-min forecasts, triggering caregiver SMS alerts.",
      component: "glucoseSafety.js & alertManager.js",
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-brand-blue/10 text-brand-blue rounded-2xl">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900">
                Official PS-I02 Requirement Coverage
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Specification Compliance & Architectural Traceability Matrix
              </p>
            </div>
          </div>

          {/* Scope Note */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">Official Problem Statement: </span>
            “Build an AI-powered mobile/web tool that accepts glucose readings (manual entry or CGM import),
            insulin dose logs, and meal logs, and provides a hypoglycemia risk indicator. It should also help
            users estimate carbohydrate content for common Indian meals.”
          </div>

          {/* Table of items */}
          <div className="mt-6 divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
            {REQUIREMENTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mt-0.5 sm:mt-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{item.name}</span>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                          {item.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                      <span className="text-[11px] text-brand-blue font-mono mt-1 inline-block">
                        Mapped to: {item.component}
                      </span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100/70 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Responsible AI Notice */}
          <div className="mt-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <span className="font-bold block mb-1">Responsible AI & Clinical Scope Notice:</span>
            TIVA is an AI-assisted decision-support tool. It does not diagnose diabetes, prescribe treatment,
            or automatically determine insulin doses. Users should follow guidance from their healthcare professional.
          </div>

          {/* Footer Action */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-xl transition-colors shadow-sm"
            >
              Close Traceability Matrix
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
