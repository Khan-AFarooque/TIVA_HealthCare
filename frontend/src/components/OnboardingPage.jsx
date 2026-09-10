import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { User, Activity, Heart, ArrowRight, SkipForward } from "lucide-react";
import { saveGlucosePrediction } from "../utils/glucosePrediction";

export default function OnboardingPage({ onComplete, onSkip, userId }) {
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "Male",
    height: "",
    currentWeight: "",
    currentGlucose: "",
    targetGlucose: "",
    carbGoal: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();

      const enteredGlucose = Number(formData.currentGlucose) || 110;
      const targetG = Number(formData.targetGlucose) || 100;

      const completeProfile = {
        fullName: formData.fullName.trim() || "User",
        age: formData.age || "28",
        gender: formData.gender || "Male",
        height: formData.height || "170",
        currentWeight: formData.currentWeight || "68",
        targetWeight: formData.currentWeight || "68",
        currentGlucose: String(enteredGlucose),
        targetGlucose: String(targetG),
        lowThreshold: "70",
        highThreshold: "180",
        insulinType: "Rapid-acting",
        usesCGM: true,
        usesPump: false,
        tdd: "30",
        icr: "1:15",
        isf: "50",
        activeInsulinTime: "3",
        activityLevel: "Moderate",
        weightGoal: formData.currentWeight || "68",
        carbGoal: formData.carbGoal || "200",
        proteinGoal: "80",
        caregiver: {
          name: "",
          phone: "",
          relationship: "",
        },
      };

      if (userId) {
        try {
          const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
          profiles[userId] = completeProfile;
          localStorage.setItem("tiva_profiles", JSON.stringify(profiles));
        } catch { /* ignore */ }
      }
      localStorage.removeItem("tiva_profile");

      // Synchronize entered glucose immediately into glucose prediction history
      saveGlucosePrediction({
        currentGlucose: enteredGlucose,
        predictedGlucose: enteredGlucose,
        pred_30min: enteredGlucose,
        pred_60min: enteredGlucose,
        trend: "stable",
        source: "onboarding",
      });
      try { window.dispatchEvent(new Event("tiva-data-updated")); } catch { /* ignore */ }

      onComplete(completeProfile);
    },
    [formData, userId, onComplete]
  );

  const handleSkipWithDefaults = useCallback(() => {
    const defaultProfile = {
      fullName: "User",
      age: "28",
      gender: "Male",
      height: "170",
      currentWeight: "68",
      targetWeight: "68",
      currentGlucose: "110",
      targetGlucose: "100",
      lowThreshold: "70",
      highThreshold: "180",
      insulinType: "Rapid-acting",
      usesCGM: true,
      usesPump: false,
      tdd: "30",
      icr: "1:15",
      isf: "50",
      activeInsulinTime: "3",
      activityLevel: "Moderate",
      weightGoal: "68",
      carbGoal: "200",
      proteinGoal: "80",
      caregiver: { name: "", phone: "", relationship: "" },
    };

    if (userId) {
      try {
        const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
        profiles[userId] = defaultProfile;
        localStorage.setItem("tiva_profiles", JSON.stringify(profiles));
      } catch { /* ignore */ }
    }

    saveGlucosePrediction({
      currentGlucose: 110,
      predictedGlucose: 110,
      pred_30min: 110,
      pred_60min: 110,
      trend: "stable",
      source: "onboarding_skip",
    });
    try { window.dispatchEvent(new Event("tiva-data-updated")); } catch { /* ignore */ }

    if (onSkip) {
      onSkip();
    } else {
      onComplete(defaultProfile);
    }
  }, [userId, onSkip, onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/30 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-200/80"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-50 text-brand-blue rounded-2xl mb-3 shadow-xs">
            <User className="w-8 h-8 text-brand-blue" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Basic Information
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Please enter your basic information. After this, your main page will open with all six features ready.
          </p>
        </div>

        {/* Single Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                placeholder="e.g. Rahul Sharma"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
                required
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Age
              </label>
              <input
                type="number"
                name="age"
                min="5"
                max="100"
                placeholder="e.g. 28"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
                required
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Height */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                name="height"
                min="50"
                max="250"
                placeholder="e.g. 170"
                value={formData.height}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
                required
              />
            </div>

            {/* Current Weight */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                name="currentWeight"
                min="20"
                max="250"
                placeholder="e.g. 68"
                value={formData.currentWeight}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
                required
              />
            </div>

            {/* Current Glucose */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Current Glucose (mg/dL)
              </label>
              <input
                type="number"
                name="currentGlucose"
                min="40"
                max="500"
                placeholder="e.g. 110"
                value={formData.currentGlucose}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
              />
            </div>

            {/* Target Glucose */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Target Glucose (mg/dL)
              </label>
              <input
                type="number"
                name="targetGlucose"
                min="70"
                max="180"
                placeholder="e.g. 100"
                value={formData.targetGlucose}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
              />
            </div>

            {/* Daily Carb Goal */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Daily Carbohydrate Goal (g)
              </label>
              <input
                type="number"
                name="carbGoal"
                min="50"
                max="500"
                placeholder="e.g. 200"
                value={formData.carbGoal}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-colors"
              />
            </div>
          </div>

          <div className="pt-3 space-y-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-blue text-white font-medium text-sm transition-all duration-200 hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Save & Open Main Page</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSkipWithDefaults}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Skip & Use Recommended Defaults</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}