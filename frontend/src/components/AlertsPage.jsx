import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  LayoutDashboard,
  ShieldCheck,
  Heart,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Hospital,
  Ambulance,
  Save,
  Eye,
  EyeOff,
  MessageSquare,
  ExternalLink,
  Send,
} from "lucide-react";
import {
  getSafetyStatusLabel,
  getSafetyStatusColor,
  getUserThresholds,
  saveUserThresholds,
  getSeverityLabel,
  SAFETY_STATUS,
} from "../utils/glucoseSafety";
import {
  loadAlertHistory,
  acknowledgeAlert,
  clearAlertHistory,
  runSafetyCheckAndAlert,
  getCaregiverInfo,
  saveCaregiverInfo,
  getEmergencyContacts,
  saveEmergencyContacts,
  maskPhone,
  getCriticalAlert,
  NOTIFICATION_STATUS,
  formatWhatsAppPhone,
  formatTelPhone,
  buildCaregiverSOSMessage,
  getCaregiverWhatsAppUrl,
  triggerCaregiverCall,
} from "../utils/alertManager";
import EmergencyDispatchModal from "./EmergencyDispatchModal";

const STATUS_LABEL_CLASSES = {
  GLUCOSE_LOW: "text-amber-600",
  GLUCOSE_HIGH: "text-orange-600",
  GLUCOSE_CRITICAL_LOW: "text-red-700",
  GLUCOSE_CRITICAL_HIGH: "text-red-700",
  GLUCOSE_ALERT: "text-orange-600",
};

const NOTIFICATION_LABELS = {
  [NOTIFICATION_STATUS.NOT_REQUESTED]: { text: "Caregiver notification: Not requested", color: "text-slate-400" },
  [NOTIFICATION_STATUS.PENDING]: { text: "Caregiver notification: Sending...", color: "text-amber-600" },
  [NOTIFICATION_STATUS.ACCEPTED]: { text: "Caregiver notification: Accepted by provider", color: "text-emerald-600" },
  [NOTIFICATION_STATUS.FAILED]: { text: "Caregiver notification: Failed", color: "text-red-600" },
  [NOTIFICATION_STATUS.NOT_CONFIGURED]: { text: "Caregiver notification: Not configured", color: "text-slate-500" },
};

export default function AlertsPage({ onBack, userId }) {
  // Safety status
  const [safetyResult, setSafetyResult] = useState(null);
  const [alertCreated, setAlertCreated] = useState(null);

  // Derive patient name
  const patientName = (() => {
    try {
      const auth = JSON.parse(localStorage.getItem("tiva_auth") || "{}");
      if (auth?.name) return auth.name;
      const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
      if (profiles[userId]?.fullName) return profiles[userId].fullName;
    } catch { /* ignore */ }
    return "Patient";
  })();

  // Alert history
  const [alertHistory, setAlertHistory] = useState([]);

  // Critical alert escalation
  const [criticalAlert, setCriticalAlert] = useState(null);

  // Caregiver
  const [caregiver, setCaregiver] = useState({ name: "", phone: "", relationship: "" });
  const [editingCaregiver, setEditingCaregiver] = useState(false);
  const [caregiverSaved, setCaregiverSaved] = useState(false);

  // Emergency contacts
  const [emergency, setEmergency] = useState({ hospital: "", hospitalPhone: "", hospitalLocation: "", ambulance: "" });
  const [editingEmergency, setEditingEmergency] = useState(false);
  const [emergencySaved, setEmergencySaved] = useState(false);

  // Thresholds
  const [lowThreshold, setLowThreshold] = useState("");
  const [highThreshold, setHighThreshold] = useState("");
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  // Phone visibility
  const [showPhones, setShowPhones] = useState(false);

  // Emergency dispatch modal state
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchModalMode, setDispatchModalMode] = useState("call"); // "call" | "whatsapp"

  const handleTriggerCall = (e) => {
    e?.preventDefault();
    setDispatchModalMode("call");
    setDispatchModalOpen(true);
    if (caregiver?.phone) {
      triggerCaregiverCall(caregiver.phone);
    }
  };

  const handleTriggerWhatsApp = (e) => {
    e?.preventDefault();
    setDispatchModalMode("whatsapp");
    setDispatchModalOpen(true);
    if (caregiver?.phone) {
      const url = getCaregiverWhatsAppUrl(
        caregiver.phone,
        buildCaregiverSOSMessage({
          patientName,
          caregiverName: caregiver.name,
          glucose: criticalAlert?.glucose ?? safetyResult?.glucose,
          predictedGlucose: criticalAlert?.predictedGlucose ?? safetyResult?.predictedGlucose,
          trend: criticalAlert?.trend ?? safetyResult?.trend,
          status: criticalAlert?.type ?? safetyResult?.status ?? "SAFETY_ALERT",
        })
      );
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  };

  // Refresh all data
  const refreshAll = useCallback(() => {
    if (!userId) return;
    const { safetyResult: sr, alertCreated: ac } = runSafetyCheckAndAlert(userId);
    setSafetyResult(sr);
    setAlertCreated(ac);
    setAlertHistory(loadAlertHistory(userId));
    setCriticalAlert(getCriticalAlert(userId));
  }, [userId]);

  // Load data on mount and listen for real-time updates
  useEffect(() => {
    if (!userId) return;

    refreshAll();

    const cg = getCaregiverInfo(userId);
    if (cg) setCaregiver(cg);

    const em = getEmergencyContacts(userId);
    setEmergency(em);

    const th = getUserThresholds(userId);
    if (th.lowAlertThreshold != null) setLowThreshold(String(th.lowAlertThreshold));
    if (th.highAlertThreshold != null) setHighThreshold(String(th.highAlertThreshold));

    const onDataUpdated = () => { refreshAll(); };
    const onAlertUpdated = () => { refreshAll(); };
    window.addEventListener("tiva-data-updated", onDataUpdated);
    window.addEventListener("tiva-alert-updated", onAlertUpdated);
    window.addEventListener("storage", onDataUpdated);
    return () => {
      window.removeEventListener("tiva-data-updated", onDataUpdated);
      window.removeEventListener("tiva-alert-updated", onAlertUpdated);
      window.removeEventListener("storage", onDataUpdated);
    };
  }, [userId, refreshAll]);

  // Re-run safety check
  const handleRecheck = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  // Save caregiver
  const handleSaveCaregiver = useCallback(() => {
    saveCaregiverInfo(userId, caregiver);
    setEditingCaregiver(false);
    setCaregiverSaved(true);
    setTimeout(() => setCaregiverSaved(false), 2000);
  }, [userId, caregiver]);

  // Save emergency contacts
  const handleSaveEmergency = useCallback(() => {
    saveEmergencyContacts(userId, emergency);
    setEditingEmergency(false);
    setEmergencySaved(true);
    setTimeout(() => setEmergencySaved(false), 2000);
  }, [userId, emergency]);

  // Save thresholds
  const handleSaveThresholds = useCallback(() => {
    saveUserThresholds(userId, {
      lowAlertThreshold: lowThreshold ? Number(lowThreshold) : null,
      highAlertThreshold: highThreshold ? Number(highThreshold) : null,
    });
    setThresholdsSaved(true);
    setTimeout(() => setThresholdsSaved(false), 2000);
    handleRecheck();
  }, [userId, lowThreshold, highThreshold, handleRecheck]);

  // Acknowledge alert (userId-scoped)
  const handleAcknowledge = useCallback((alertId) => {
    acknowledgeAlert(userId, alertId);
    setAlertHistory(loadAlertHistory(userId));
  }, [userId]);

  // Clear history
  const handleClearHistory = useCallback(() => {
    clearAlertHistory(userId);
    setAlertHistory([]);
  }, [userId]);

  const statusLabel = safetyResult ? getSafetyStatusLabel(safetyResult.status) : "Loading...";
  const statusColor = safetyResult ? getSafetyStatusColor(safetyResult.status) : "text-slate-500 bg-slate-50 border-slate-200";

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
                <Bell className="h-6 w-6 text-brand-blue" /> Safety & Alerts
              </h2>
              <p className="mt-1 text-slate-500">
                Glucose safety monitoring, caregiver alerts, and emergency contacts.
              </p>
            </div>
          </div>
          <button type="button" onClick={handleRecheck}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 transition-colors cursor-pointer">
            <ShieldCheck className="h-4 w-4" /> Re-check Safety
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* A. Current Safety Status */}
          <div className="glass-strong p-6 rounded-3xl">
            <h3 className="font-display text-lg font-bold text-brand-ink mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-blue" /> Current Safety Status
            </h3>
            {safetyResult ? (
              <div className={`p-4 rounded-2xl border ${statusColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-lg font-bold">{statusLabel}</span>
                  {safetyResult.savedAt && (
                    <span className="text-xs text-slate-500">
                      Last reading: {new Date(safetyResult.savedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm">{safetyResult.message}</p>
                {safetyResult.glucose != null && (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span>Current: <strong>{safetyResult.glucose} mg/dL</strong></span>
                    {safetyResult.predictedGlucose != null && (
                      <span>Predicted: <strong>{safetyResult.predictedGlucose} mg/dL</strong></span>
                    )}
                    {safetyResult.trend && (
                      <span>Trend: <strong>{safetyResult.trend}</strong></span>
                    )}
                  </div>
                )}
                {safetyResult.lowThreshold != null && safetyResult.highThreshold != null && (
                  <div className="mt-2 text-xs text-slate-500">
                    {"Your thresholds: Low ≤ "}{safetyResult.lowThreshold}{" mg/dL / High ≥ "}{safetyResult.highThreshold}{" mg/dL"}
                  </div>
                )}
                {safetyResult.severity && safetyResult.severity !== "NONE" && (
                  <div className="mt-2 text-xs font-medium">
                    Severity: {getSeverityLabel(safetyResult.severity)}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400">Loading safety status...</p>
            )}

            {/* Alert created notification */}
            <AnimatePresence>
              {alertCreated && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <p className="font-bold">Alert Created</p>
                  <p className="mt-1">{alertCreated.message}</p>
                  {alertCreated.requiresEmergencyAttention && (
                    <p className="mt-1 text-xs font-medium text-red-800">
                      Emergency attention may be required.
                    </p>
                  )}
                  {alertCreated.requiresEmergencyAttention && (
                    <p className="mt-2 text-xs text-red-700 bg-red-100 rounded-lg p-2">
                      Critical glucose alert detected. Follow the patient&apos;s emergency care plan and contact emergency medical services when appropriate.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Emergency Escalation Section — only for critical alerts */}
          {criticalAlert && (
            <div className="glass-strong p-6 rounded-3xl border-2 border-red-300 bg-red-50/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-red-800">Critical Safety Alert</h3>
                  <p className="text-sm text-red-600">
                    {criticalAlert.type === "GLUCOSE_CRITICAL_LOW"
                      ? "Severe hypoglycemia detected"
                      : "Dangerous hyperglycemia detected"}
                  </p>
                </div>
              </div>

              {/* Critical alert details */}
              <div className="p-4 rounded-2xl bg-white border border-red-200 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {criticalAlert.glucose != null && (
                    <div>
                      <p className="text-xs text-slate-500">Glucose</p>
                      <p className="font-bold text-brand-ink">{criticalAlert.glucose} mg/dL</p>
                    </div>
                  )}
                  {criticalAlert.predictedGlucose != null && (
                    <div>
                      <p className="text-xs text-slate-500">Predicted</p>
                      <p className="font-bold text-brand-ink">{criticalAlert.predictedGlucose} mg/dL</p>
                    </div>
                  )}
                  {criticalAlert.trend && (
                    <div>
                      <p className="text-xs text-slate-500">Trend</p>
                      <p className="font-bold text-brand-ink">{criticalAlert.trend}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Time</p>
                    <p className="font-bold text-brand-ink">
                      {new Date(criticalAlert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full ${criticalAlert.acknowledged ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-700 font-medium"}`}>
                    {criticalAlert.acknowledged ? "Acknowledged" : "Unacknowledged"}
                  </span>
                  {criticalAlert.notificationStatus && criticalAlert.notificationStatus !== NOTIFICATION_STATUS.NOT_REQUESTED && (
                    <span className={`px-2 py-1 rounded-full ${NOTIFICATION_LABELS[criticalAlert.notificationStatus]?.color || "text-slate-500"} bg-white border border-slate-200`}>
                      {NOTIFICATION_LABELS[criticalAlert.notificationStatus]?.text || `Notification: ${criticalAlert.notificationStatus}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Safety guidance */}
              <div className="p-3 rounded-xl bg-red-100 text-xs text-red-700 mb-4">
                Critical glucose alert detected. Follow the patient&apos;s established diabetes/emergency care plan.
                Contact the caregiver or appropriate emergency medical service when needed.
                Do not adjust insulin dosage without professional guidance.
              </div>

              {/* Escalation actions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Escalation Actions</p>

                {/* 1. Call Caregiver */}
                {caregiver.phone ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleTriggerCall}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-red-200 hover:border-red-400 hover:bg-red-50 transition-colors shadow-sm cursor-pointer text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shrink-0">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-brand-ink">Call Caregiver Now</p>
                        <p className="text-xs text-slate-500 truncate">
                          {caregiver.name} ({caregiver.phone})
                        </p>
                      </div>
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg shrink-0">
                        Call &amp; Dial
                      </span>
                    </button>

                    {/* 1b. WhatsApp Urgent SOS Alert */}
                    <button
                      type="button"
                      onClick={handleTriggerWhatsApp}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100 transition-colors shadow-sm cursor-pointer text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 shadow-sm">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-950">WhatsApp Urgent SOS Alert</p>
                        <p className="text-xs text-emerald-800 truncate">
                          Sends live glucose reading &amp; hypoglycemia first-aid instructions
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-200/70 px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1">
                        Send WhatsApp <ExternalLink className="h-3 w-3" />
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 opacity-60">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Call Caregiver</p>
                      <p className="text-xs text-slate-400">No caregiver configured</p>
                    </div>
                  </div>
                )}

                {/* 2. View Emergency Contacts */}
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("emergency-contacts-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-red-200 hover:border-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shrink-0">
                    <Hospital className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-bold text-brand-ink">View Emergency Contacts</p>
                    <p className="text-xs text-slate-500 truncate">
                      {emergency.hospital || "No hospital configured"} {emergency.ambulance ? `· Emergency: ${emergency.ambulance}` : ""}
                    </p>
                  </div>
                </button>

                {/* 3. Call Emergency Services */}
                {emergency.ambulance ? (
                  <a
                    href={`tel:${emergency.ambulance}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
                      <Ambulance className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Call Emergency Services</p>
                      <p className="text-xs text-white/80">{emergency.ambulance}</p>
                    </div>
                    <span className="text-xs text-white/80 shrink-0">Opens phone</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 border border-slate-200 opacity-60">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-400 shrink-0">
                      <Ambulance className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Call Emergency Services</p>
                      <p className="text-xs text-slate-400">No emergency number configured</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Acknowledge button */}
              {!criticalAlert.acknowledged && (
                <button
                  type="button"
                  onClick={() => handleAcknowledge(criticalAlert.id)}
                  className="mt-4 w-full py-2.5 rounded-xl border border-red-300 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" /> Acknowledge Critical Alert
                </button>
              )}
            </div>
          )}

          {/* B. Caregiver Information */}
          <div className="glass-strong p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-brand-ink flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" /> Caregiver Information
              </h3>
              {!editingCaregiver && (
                <button type="button" onClick={() => setEditingCaregiver(true)}
                  className="text-sm text-brand-blue hover:underline cursor-pointer">
                  {caregiver.name ? "Edit" : "Add Caregiver"}
                </button>
              )}
            </div>

            {editingCaregiver ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Caregiver Name</label>
                  <input type="text" value={caregiver.name} onChange={(e) => setCaregiver({ ...caregiver, name: e.target.value })}
                    placeholder="Full name"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Phone Number</label>
                  <input type="tel" value={caregiver.phone} onChange={(e) => setCaregiver({ ...caregiver, phone: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Relationship <span className="text-slate-400">(optional)</span></label>
                  <input type="text" value={caregiver.relationship} onChange={(e) => setCaregiver({ ...caregiver, relationship: e.target.value })}
                    placeholder="e.g. Parent, Spouse, Guardian"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingCaregiver(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveCaregiver}
                    className="flex-1 py-2.5 rounded-xl bg-brand-blue text-white font-medium hover:bg-brand-blue/90 transition-colors cursor-pointer flex items-center justify-center gap-1">
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
              </div>
            ) : caregiver.name ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-ink">{caregiver.name}</p>
                    <p className="text-xs text-slate-500">{caregiver.relationship || "No relationship specified"}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{showPhones ? caregiver.phone : maskPhone(caregiver.phone)}</span>
                    <button type="button" onClick={() => setShowPhones(!showPhones)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPhones ? "Hide number" : "Show number"}>
                      {showPhones ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Direct Call & WhatsApp Action Bar */}
                {caregiver.phone && (
                  <div className="mt-4 pt-3 border-t border-slate-200/70 grid sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleTriggerCall}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                    >
                      <Phone className="h-4 w-4" /> Call Caregiver
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerWhatsApp}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" /> Send WhatsApp SOS
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No caregiver configured. Add a caregiver to enable alerts.</p>
            )}
          </div>

          {/* D. Alert Thresholds */}
          <div className="glass-strong p-6 rounded-3xl">
            <h3 className="font-display text-lg font-bold text-brand-ink mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Alert Thresholds
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter thresholds according to your healthcare professional's guidance.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Personal Low Alert Threshold</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="30" max="150" value={lowThreshold}
                    onChange={(e) => setLowThreshold(e.target.value)}
                    placeholder="e.g. 70"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                  <span className="text-sm text-slate-500">mg/dL</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Personal High Alert Threshold</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="100" max="500" value={highThreshold}
                    onChange={(e) => setHighThreshold(e.target.value)}
                    placeholder="e.g. 180"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                  <span className="text-sm text-slate-500">mg/dL</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={handleSaveThresholds}
              className="mt-4 w-full py-2.5 rounded-xl bg-brand-blue text-white font-medium hover:bg-brand-blue/90 transition-colors cursor-pointer flex items-center justify-center gap-1">
              <Save className="h-4 w-4" /> {thresholdsSaved ? "Saved!" : "Save Thresholds"}
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:sticky lg:top-24 space-y-4">
          {/* E. Emergency Contacts */}
          <div id="emergency-contacts-section" className="glass-strong p-5 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-brand-ink flex items-center gap-2">
                <Hospital className="h-4 w-4 text-brand-blue" /> Emergency Contacts
              </h3>
              {!editingEmergency && (
                <button type="button" onClick={() => setEditingEmergency(true)}
                  className="text-xs text-brand-blue hover:underline cursor-pointer">
                  {emergency.hospital ? "Edit" : "Configure"}
                </button>
              )}
            </div>

            {editingEmergency ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hospital / Medical Facility Name</label>
                  <input type="text" value={emergency.hospital} onChange={(e) => setEmergency({ ...emergency, hospital: e.target.value })}
                    placeholder="Hospital name"
                    className="w-full px-3 py-2 rounded-xl bg-white/60 border border-slate-200 text-slate-700 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hospital Phone</label>
                  <input type="tel" value={emergency.hospitalPhone} onChange={(e) => setEmergency({ ...emergency, hospitalPhone: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl bg-white/60 border border-slate-200 text-slate-700 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hospital Location / Address</label>
                  <input type="text" value={emergency.hospitalLocation || ""} onChange={(e) => setEmergency({ ...emergency, hospitalLocation: e.target.value })}
                    placeholder="e.g. 123 Main St, City"
                    className="w-full px-3 py-2 rounded-xl bg-white/60 border border-slate-200 text-slate-700 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Emergency Services Number</label>
                  <input type="tel" value={emergency.ambulance} onChange={(e) => setEmergency({ ...emergency, ambulance: e.target.value })}
                    placeholder="e.g. 108, 112, 911"
                    className="w-full px-3 py-2 rounded-xl bg-white/60 border border-slate-200 text-slate-700 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors" />
                </div>
                <p className="text-xs text-amber-600">
                  Emergency contacts are user-configured. Verify numbers before use.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingEmergency(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveEmergency}
                    className="flex-1 py-2 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 transition-colors cursor-pointer">
                    {emergencySaved ? "Saved!" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {emergency.hospital ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Hospital className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-medium text-brand-ink">{emergency.hospital}</p>
                        {emergency.hospitalPhone && <p className="text-xs text-slate-500">{emergency.hospitalPhone}</p>}
                        {emergency.hospitalLocation && <p className="text-xs text-slate-400 mt-0.5">{emergency.hospitalLocation}</p>}
                      </div>
                    </div>
                    {emergency.hospitalPhone && (
                      <a href={`tel:${emergency.hospitalPhone}`}
                        className="flex items-center gap-2 text-sm text-brand-blue hover:underline">
                        <Phone className="h-4 w-4" /> Call Hospital
                      </a>
                    )}
                    {emergency.ambulance && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Ambulance className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <p className="font-medium text-brand-ink">Emergency Services</p>
                            <p className="text-xs text-slate-500">{emergency.ambulance}</p>
                          </div>
                        </div>
                        <a href={`tel:${emergency.ambulance}`}
                          className="flex items-center gap-2 text-sm text-red-600 font-medium hover:underline">
                          <Phone className="h-4 w-4" /> Call Emergency Services
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400">No emergency contacts configured. Configure contacts for escalation pathways.</p>
                )}
                <p className="text-xs text-amber-600 mt-2">
                  Emergency contacts are user-configured. Verify numbers before use.
                </p>
              </div>
            )}
          </div>

          {/* C. Alert History */}
          <div className="glass-strong p-5 rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-brand-ink flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-blue" /> Alert History
              </h3>
              {alertHistory.length > 0 && (
                <button type="button" onClick={handleClearHistory}
                  className="text-xs text-slate-400 hover:text-red-500 cursor-pointer">
                  Clear
                </button>
              )}
            </div>
            {alertHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No safety alerts recorded.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {alertHistory.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-xl border text-sm ${alert.acknowledged ? "bg-slate-50 border-slate-200/60 opacity-60" : "bg-white/60 border-slate-200/60"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">
                        {new Date(alert.timestamp).toLocaleDateString()} {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`text-xs font-bold ${STATUS_LABEL_CLASSES[alert.type] || "text-orange-600"}`}>
                        {alert.type === "GLUCOSE_LOW" ? "Low" :
                         alert.type === "GLUCOSE_HIGH" ? "High" :
                         alert.type === "GLUCOSE_CRITICAL_LOW" ? "Critical Low" :
                         alert.type === "GLUCOSE_CRITICAL_HIGH" ? "Critical High" : "Alert"}
                      </span>
                    </div>
                    {alert.glucose != null && (
                      <p className="font-medium text-brand-ink">
                        {alert.glucose} mg/dL
                        {alert.predictedGlucose != null ? ` -> ${alert.predictedGlucose} predicted` : ""}
                      </p>
                    )}
                    {alert.severity && alert.severity !== "NONE" && (
                      <p className="text-xs text-slate-500 mt-0.5">Severity: {getSeverityLabel(alert.severity)}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1 truncate">{alert.message}</p>
                    {alert.requiresEmergencyAttention && (
                      <p className="text-xs text-red-600 mt-1 font-medium">Emergency attention may be required.</p>
                    )}
                    {alert.notificationStatus && alert.notificationStatus !== NOTIFICATION_STATUS.NOT_REQUESTED && (
                      <p className={`text-xs mt-1 ${NOTIFICATION_LABELS[alert.notificationStatus]?.color || "text-slate-500"}`}>
                        {NOTIFICATION_LABELS[alert.notificationStatus]?.text || `Notification: ${alert.notificationStatus}`}
                      </p>
                    )}
                    {!alert.acknowledged && (
                      <button type="button" onClick={() => handleAcknowledge(alert.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-blue hover:underline cursor-pointer">
                        <CheckCircle className="h-3 w-3" /> Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Dispatch Modal for 100% Reliable Calling & WhatsApp */}
      <EmergencyDispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        initialMode={dispatchModalMode}
        caregiver={caregiver}
        patientName={patientName}
        glucose={criticalAlert?.glucose ?? safetyResult?.glucose}
        predictedGlucose={criticalAlert?.predictedGlucose ?? safetyResult?.predictedGlucose}
        trend={criticalAlert?.trend ?? safetyResult?.trend}
        status={criticalAlert?.type ?? safetyResult?.status ?? "SAFETY_ALERT"}
        userId={userId}
        onCaregiverUpdated={(updated) => setCaregiver(updated)}
      />
    </div>
  );
}
