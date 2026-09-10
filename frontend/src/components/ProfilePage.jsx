import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  HeartPulse,
  ShieldCheck,
  Phone,
  Save,
  CheckCircle,
  Activity,
  ArrowLeft,
  Sparkles,
  Droplet,
  Target,
  Clock,
  Scale,
} from "lucide-react";
import { getCaregiverInfo, saveCaregiverInfo } from "../utils/alertManager";

export default function ProfilePage({ profile, onUpdateProfile, userId, onBack }) {
  const [formData, setFormData] = useState({
    fullName: "",
    age: "28",
    gender: "Male",
    height: "170",
    currentWeight: "68",
    targetWeight: "68",
    currentGlucose: "110",
    targetGlucose: "100",
    lowThreshold: "70",
    highThreshold: "180",
    carbGoal: "150",
    proteinGoal: "80",
    insulinType: "Rapid-acting",
    tdd: "30",
    icr: "1:15",
    isf: "50",
    activeInsulinTime: "3",
    activityLevel: "Moderate",
    caregiverName: "",
    caregiverPhone: "",
    caregiverRel: "Emergency Contact",
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync with existing profile and caregiver on load
  useEffect(() => {
    if (!initialized && profile) {
      const cg = userId ? getCaregiverInfo(userId) : null;
      setFormData({
        fullName: profile.fullName || "",
        age: profile.age || "28",
        gender: profile.gender || "Male",
        height: profile.height || "170",
        currentWeight: profile.currentWeight || "68",
        targetWeight: profile.targetWeight || profile.currentWeight || "68",
        currentGlucose: profile.currentGlucose || "110",
        targetGlucose: profile.targetGlucose || "100",
        lowThreshold: profile.lowThreshold || "70",
        highThreshold: profile.highThreshold || "180",
        carbGoal: profile.carbGoal || "150",
        proteinGoal: profile.proteinGoal || "80",
        insulinType: profile.insulinType || "Rapid-acting",
        tdd: profile.tdd || "30",
        icr: profile.icr || "1:15",
        isf: profile.isf || "50",
        activeInsulinTime: profile.activeInsulinTime || "3",
        activityLevel: profile.activityLevel || "Moderate",
        caregiverName: cg?.name || profile.caregiver?.name || "",
        caregiverPhone: cg?.phone || profile.caregiver?.phone || "",
        caregiverRel: cg?.relationship || profile.caregiver?.relationship || "Emergency Contact",
      });
      setInitialized(true);
    }
  }, [profile, userId, initialized]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    if (e) e.preventDefault();

    const caregiverData = {
      name: formData.caregiverName.trim() || "Caregiver",
      phone: formData.caregiverPhone.trim(),
      relationship: formData.caregiverRel.trim() || "Emergency Contact",
    };

    const updatedProfile = {
      ...(profile || {}),
      fullName: formData.fullName.trim() || "Patient",
      age: formData.age,
      gender: formData.gender,
      height: formData.height,
      currentWeight: formData.currentWeight,
      targetWeight: formData.targetWeight,
      currentGlucose: formData.currentGlucose,
      targetGlucose: formData.targetGlucose,
      lowThreshold: formData.lowThreshold,
      highThreshold: formData.highThreshold,
      carbGoal: formData.carbGoal,
      proteinGoal: formData.proteinGoal,
      insulinType: formData.insulinType,
      tdd: formData.tdd,
      icr: formData.icr,
      isf: formData.isf,
      activeInsulinTime: formData.activeInsulinTime,
      activityLevel: formData.activityLevel,
      caregiver: caregiverData,
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedProfile);
    }

    if (userId) {
      saveCaregiverInfo(userId, caregiverData);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="glass-strong p-6 rounded-3xl border border-white/80 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-blue to-indigo-500 text-white shadow-lg shadow-brand-blue/30">
              <User className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-brand-ink">
                  Patient Health Profile
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-brand-blue border border-blue-200">
                  Verified Data
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Personal demographics, glycemic targets, insulin sensitivity ratios, and emergency caregiver contacts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-brand-blue/25 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" /> Save Profile
            </button>
          </div>
        </div>

        {savedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Profile changes saved successfully! All clinical modules and alert dispatch systems are synchronized.
          </motion.div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2">
        {/* 1. Demographics & Biometrics */}
        <div className="glass p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <User className="h-5 w-5 text-brand-blue" />
            <h3 className="font-display text-base font-bold text-brand-ink">
              Demographics &amp; Biometrics
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  name="age"
                  min="1"
                  max="120"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Biological Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  name="currentWeight"
                  value={formData.currentWeight}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Physical Activity Level
              </label>
              <select
                name="activityLevel"
                value={formData.activityLevel}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              >
                <option value="Sedentary">Sedentary (Little or no exercise)</option>
                <option value="Light">Light (1-3 days per week)</option>
                <option value="Moderate">Moderate (3-5 days per week)</option>
                <option value="Active">Active (6-7 days per week)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Glycemic Goals & Nutrition */}
        <div className="glass p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Target className="h-5 w-5 text-emerald-600" />
            <h3 className="font-display text-base font-bold text-brand-ink">
              Glycemic Targets &amp; Nutrition
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Target Blood Glucose (mg/dL)
                </label>
                <input
                  type="number"
                  name="targetGlucose"
                  value={formData.targetGlucose}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Daily Carb Goal (g)
                </label>
                <input
                  type="number"
                  name="carbGoal"
                  value={formData.carbGoal}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Hypo Threshold (mg/dL)
                </label>
                <input
                  type="number"
                  name="lowThreshold"
                  value={formData.lowThreshold}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-rose-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Hyper Threshold (mg/dL)
                </label>
                <input
                  type="number"
                  name="highThreshold"
                  value={formData.highThreshold}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-orange-700 font-bold focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Daily Protein Goal (g)
              </label>
              <input
                type="number"
                name="proteinGoal"
                value={formData.proteinGoal}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>
        </div>

        {/* 3. Clinical Insulin Therapy Parameters */}
        <div className="glass p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Droplet className="h-5 w-5 text-violet-600" />
            <h3 className="font-display text-base font-bold text-brand-ink">
              Insulin Therapy Parameters
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Bolus Insulin Formulation
              </label>
              <input
                type="text"
                name="insulinType"
                value={formData.insulinType}
                onChange={handleChange}
                placeholder="e.g. Humalog, Novolog, Fiasp"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Insulin-to-Carb (ICR)
                </label>
                <input
                  type="text"
                  name="icr"
                  value={formData.icr}
                  onChange={handleChange}
                  placeholder="1:15"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Sensitivity Factor (ISF)
                </label>
                <input
                  type="number"
                  name="isf"
                  value={formData.isf}
                  onChange={handleChange}
                  placeholder="50"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Total Daily Dose (TDD, U)
                </label>
                <input
                  type="number"
                  name="tdd"
                  value={formData.tdd}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Active Insulin Duration (h)
                </label>
                <input
                  type="number"
                  name="activeInsulinTime"
                  value={formData.activeInsulinTime}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Emergency Caregiver Contact */}
        <div className="glass p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Phone className="h-5 w-5 text-rose-600" />
            <h3 className="font-display text-base font-bold text-brand-ink">
              Emergency Caregiver Dispatch
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Caregiver Full Name
              </label>
              <input
                type="text"
                name="caregiverName"
                value={formData.caregiverName}
                onChange={handleChange}
                placeholder="e.g. Dr. A. Sharma / Mother"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Caregiver Phone Number (with Country Code)
              </label>
              <input
                type="tel"
                name="caregiverPhone"
                value={formData.caregiverPhone}
                onChange={handleChange}
                placeholder="+919876543210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Used for instant 1-click telephony dialer and emergency WhatsApp telemetry SOS messages.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Relationship
              </label>
              <input
                type="text"
                name="caregiverRel"
                value={formData.caregiverRel}
                onChange={handleChange}
                placeholder="e.g. Primary Physician, Spouse, Parent"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="md:col-span-2 pt-2">
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-brand-blue/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="h-4 w-4" /> Save Profile &amp; Clinical Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
