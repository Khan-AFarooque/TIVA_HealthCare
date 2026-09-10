/**
 * Alert Manager — TIVA Safety Alert System
 *
 * Manages glucose safety alert history, caregiver contact information,
 * and emergency contacts. All data is scoped to the authenticated user via userId.
 *
 * Caregiver notification delivery is handled by the backend API.
 * This module calls POST /api/alerts/caregiver when a new alert
 * requires caregiver notification.
 */

import { checkGlucoseSafety, SAFETY_STATUS } from "./glucoseSafety";

/* ── Storage Keys ── */
const ALERT_HISTORY_KEY = "tiva_alert_history";
const EMERGENCY_CONTACTS_KEY = "tiva_emergency_contacts";
const ALERT_HISTORY_MAX = 100;
const DUPLICATE_PREVENTION_MS = 5 * 60 * 1000; // 5 minutes

/* ── Safe localStorage ── */
function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function safeReadArray(key) {
  const data = safeRead(key);
  return Array.isArray(data) ? data : [];
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

function dispatchEvent(name) {
  try { window.dispatchEvent(new Event(name)); } catch { /* ignore */ }
}

/* ── Backend API ── */

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Notification status constants matching the backend.
 */
export const NOTIFICATION_STATUS = {
  NOT_REQUESTED: "NOT_REQUESTED",
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  FAILED: "FAILED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
};

/**
 * Send a caregiver notification request to the backend API.
 *
 * The backend validates the request, prevents duplicates, and calls
 * the configured notification provider. This function stores the
 * actual provider result on the alert.
 *
 * @param {string} userId
 * @param {object} alert - The alert object (must have id, status, severity, glucose, predictedGlucose, trend, message)
 * @param {{ name: string, phone: string, relationship: string }} caregiver
 * @returns {Promise<string>} The notification status from the provider
 */
async function sendCaregiverNotification(userId, alert, caregiver) {
  if (!caregiver || !caregiver.phone) return NOTIFICATION_STATUS.NOT_REQUESTED;

  try {
    const res = await fetch(`${API_BASE}/api/alerts/caregiver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        alertId: alert.id,
        status: alert.status,
        severity: alert.severity,
        glucose: alert.glucose,
        predictedGlucose: alert.predictedGlucose,
        trend: alert.trend,
        message: alert.message,
        caregiverName: caregiver.name || "",
        caregiverPhone: caregiver.phone,
        caregiverRelationship: caregiver.relationship || "",
      }),
    });

    const data = await res.json();

    if (data.success) {
      return NOTIFICATION_STATUS.ACCEPTED;
    }

    if (data.providerStatus === "not_configured") {
      return NOTIFICATION_STATUS.NOT_CONFIGURED;
    }

    return NOTIFICATION_STATUS.FAILED;
  } catch {
    return NOTIFICATION_STATUS.FAILED;
  }
}

/**
 * Update the notification status of an alert in localStorage.
 * @param {string} userId
 * @param {string} alertId
 * @param {string} notificationStatus
 */
function updateAlertNotificationStatus(userId, alertId, notificationStatus) {
  const all = safeReadArray(ALERT_HISTORY_KEY);
  const updated = all.map((a) => {
    if (a.id === alertId && a.userId === userId) {
      return { ...a, notificationStatus };
    }
    return a;
  });
  safeWrite(ALERT_HISTORY_KEY, updated);
  dispatchEvent("tiva-alert-updated");
}

/* ── Alert History ── */

/**
 * Load alert history for a specific user.
 * @param {string} userId
 * @returns {Array}
 */
export function loadAlertHistory(userId) {
  if (!userId) return [];
  return safeReadArray(ALERT_HISTORY_KEY).filter((a) => a.userId === userId);
}

/**
 * Create an alert from a safety classification result.
 *
 * Only creates an alert when safetyResult.shouldAlert === true.
 * Prevents duplicate alerts for the same glucose event within DUPLICATE_PREVENTION_MS.
 *
 * @param {string} userId - Authenticated user's ID
 * @param {object} safetyResult - Output from classifyGlucoseReading() or checkGlucoseSafety()
 * @returns {object|null} The saved alert, or null if no alert was needed or duplicate prevented
 */
export function evaluateAndCreateAlert(userId, safetyResult) {
  if (!userId || !safetyResult) return null;
  if (!safetyResult.shouldAlert) return null;

  const all = safeReadArray(ALERT_HISTORY_KEY);

  // Duplicate prevention:
  // Same user + same status + same glucose value + same predicted value + same trend within time window
  const now = Date.now();
  const duplicate = all.find((a) => {
    if (a.userId !== userId) return false;
    if (a.status !== safetyResult.status) return false;
    if (a.glucose !== safetyResult.glucose) return false;
    if (a.predictedGlucose !== safetyResult.predictedGlucose) return false;
    if (a.trend !== safetyResult.trend) return false;
    if (a.acknowledged) return false;
    if (now - new Date(a.timestamp).getTime() > DUPLICATE_PREVENTION_MS) return false;
    return true;
  });
  if (duplicate) return null;

  // Determine alert type from status
  let type = "GLUCOSE_ALERT";
  if (safetyResult.status === SAFETY_STATUS.LOW || safetyResult.status === SAFETY_STATUS.POTENTIALLY_LOW) {
    type = "GLUCOSE_LOW";
  } else if (safetyResult.status === SAFETY_STATUS.HIGH || safetyResult.status === SAFETY_STATUS.POTENTIALLY_HIGH) {
    type = "GLUCOSE_HIGH";
  } else if (safetyResult.status === SAFETY_STATUS.CRITICAL_LOW) {
    type = "GLUCOSE_CRITICAL_LOW";
  } else if (safetyResult.status === SAFETY_STATUS.CRITICAL_HIGH) {
    type = "GLUCOSE_CRITICAL_HIGH";
  }

  // Check if caregiver is configured for this user
  const caregiver = getCaregiverInfo(userId);

  const newAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    timestamp: new Date().toISOString(),
    type,
    status: safetyResult.status,
    severity: safetyResult.severity,
    glucose: safetyResult.glucose,
    predictedGlucose: safetyResult.predictedGlucose,
    trend: safetyResult.trend,
    message: safetyResult.message,
    acknowledged: false,
    caregiverAvailable: !!caregiver,
    requiresCaregiverAlert: safetyResult.requiresCaregiverAlert,
    requiresEmergencyAttention: safetyResult.requiresEmergencyAttention,
    notificationStatus: safetyResult.requiresCaregiverAlert
      ? NOTIFICATION_STATUS.PENDING
      : NOTIFICATION_STATUS.NOT_REQUESTED,
  };

  const updated = [newAlert, ...all].slice(0, ALERT_HISTORY_MAX);
  safeWrite(ALERT_HISTORY_KEY, updated);
  dispatchEvent("tiva-alert-updated");

  // Trigger backend caregiver notification (non-blocking)
  if (newAlert.requiresCaregiverAlert && caregiver && caregiver.phone) {
    sendCaregiverNotification(userId, newAlert, caregiver).then((status) => {
      updateAlertNotificationStatus(userId, newAlert.id, status);
    });
  }

  return newAlert;
}

/**
 * Acknowledge an alert.
 * Verifies the alert belongs to the given userId before modifying.
 *
 * @param {string} userId - Authenticated user's ID
 * @param {string} alertId - ID of the alert to acknowledge
 * @returns {object|null} The updated alert, or null if not found / wrong user
 */
export function acknowledgeAlert(userId, alertId) {
  if (!userId || !alertId) return null;

  const all = safeReadArray(ALERT_HISTORY_KEY);
  let found = null;

  const updated = all.map((a) => {
    if (a.id === alertId && a.userId === userId) {
      found = { ...a, acknowledged: true };
      return found;
    }
    return a;
  });

  if (found) {
    safeWrite(ALERT_HISTORY_KEY, updated);
    dispatchEvent("tiva-alert-updated");
  }
  return found;
}

/**
 * Clear all alert history for a user.
 * @param {string} userId
 */
export function clearAlertHistory(userId) {
  if (!userId) return;
  const all = safeReadArray(ALERT_HISTORY_KEY).filter((a) => a.userId !== userId);
  safeWrite(ALERT_HISTORY_KEY, all);
  dispatchEvent("tiva-alert-updated");
}

/**
 * Get the count of unread (unacknowledged) alerts for a user.
 * @param {string} userId
 * @returns {number}
 */
export function getUnreadAlertCount(userId) {
  if (!userId) return 0;
  return loadAlertHistory(userId).filter((a) => !a.acknowledged).length;
}

/**
 * Get unacknowledged alert count for a user.
 * Alias for getUnreadAlertCount — kept for backward compatibility.
 * @param {string} userId
 * @returns {number}
 */
export function getUnacknowledgedAlertCount(userId) {
  return getUnreadAlertCount(userId);
}

/**
 * Get the latest alert for a user.
 * @param {string} userId
 * @returns {object|null}
 */
export function getLatestAlert(userId) {
  if (!userId) return null;
  const history = loadAlertHistory(userId);
  return history.length > 0 ? history[0] : null;
}

/**
 * Run an automatic safety check on the latest stored glucose data
 * and create an alert if needed.
 *
 * This is the main entry point used by the Dashboard and AlertsPage
 * to evaluate the current glucose state against thresholds.
 *
 * @param {string} userId
 * @returns {{ safetyResult: object, alertCreated: object|null }}
 */
export function runSafetyCheckAndAlert(userId) {
  const safetyResult = checkGlucoseSafety(userId);
  const alertCreated = evaluateAndCreateAlert(userId, safetyResult);
  return { safetyResult, alertCreated };
}

/* ── Caregiver Information ── */

/**
 * Get the caregiver info for a specific user from their profile.
 * @param {string} userId
 * @returns {{ name: string, phone: string, relationship: string }|null}
 */
export function getCaregiverInfo(userId) {
  if (!userId) return null;
  try {
    const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
    const profile = profiles[userId];
    if (!profile || !profile.caregiver) return null;
    const { name, phone, relationship } = profile.caregiver;
    if (!name && !phone) return null;
    return { name: name || "", phone: phone || "", relationship: relationship || "" };
  } catch {
    return null;
  }
}

/**
 * Save caregiver info for a specific user.
 * @param {string} userId
 * @param {{ name: string, phone: string, relationship: string }} caregiver
 */
export function saveCaregiverInfo(userId, caregiver) {
  if (!userId) return;
  try {
    const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
    if (!profiles[userId]) profiles[userId] = {};
    profiles[userId].caregiver = {
      name: caregiver.name || "",
      phone: caregiver.phone || "",
      relationship: caregiver.relationship || "",
    };
    localStorage.setItem("tiva_profiles", JSON.stringify(profiles));
  } catch { /* ignore */ }
}

/**
 * Mask a phone number for display: show only last 4 digits.
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone) return "Not provided";
  const clean = phone.replace(/\D/g, "");
  if (clean.length <= 4) return clean;
  return "*".repeat(clean.length - 4) + clean.slice(-4);
}

/* ── Emergency Contacts ── */

/**
 * Get configured emergency contacts.
 * Stored per-user under tiva_emergency_contacts.
 * @param {string} userId
 * @returns {{ hospital: string, hospitalPhone: string, hospitalLocation: string, ambulance: string }}
 */
export function getEmergencyContacts(userId) {
  if (!userId) return { hospital: "", hospitalPhone: "", hospitalLocation: "", ambulance: "" };
  try {
    const all = JSON.parse(localStorage.getItem(EMERGENCY_CONTACTS_KEY) || "{}");
    return all[userId] || { hospital: "", hospitalPhone: "", hospitalLocation: "", ambulance: "" };
  } catch {
    return { hospital: "", hospitalPhone: "", hospitalLocation: "", ambulance: "" };
  }
}

/**
 * Save emergency contacts for a user.
 * @param {string} userId
 * @param {{ hospital: string, hospitalPhone: string, hospitalLocation: string, ambulance: string }} contacts
 */
export function saveEmergencyContacts(userId, contacts) {
  if (!userId) return;
  try {
    const all = JSON.parse(localStorage.getItem(EMERGENCY_CONTACTS_KEY) || "{}");
    all[userId] = {
      hospital: contacts.hospital || "",
      hospitalPhone: contacts.hospitalPhone || "",
      hospitalLocation: contacts.hospitalLocation || "",
      ambulance: contacts.ambulance || "",
    };
    localStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * Check if there is an unacknowledged critical alert for a user.
 * @param {string} userId
 * @returns {object|null} The latest critical alert, or null
 */
export function getCriticalAlert(userId) {
  if (!userId) return null;
  const history = loadAlertHistory(userId);
  return history.find(
    (a) => !a.acknowledged && (a.type === "GLUCOSE_CRITICAL_LOW" || a.type === "GLUCOSE_CRITICAL_HIGH")
  ) || null;
}

/* ── Caregiver Direct Call & WhatsApp SOS Helpers ── */

/**
 * Format a phone number for WhatsApp wa.me links.
 * Strips all non-digit characters. If 10 digits, prepends Indian country code 91.
 * @param {string} phone
 * @returns {string}
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // If 10 digits starting with 6, 7, 8, or 9 (standard Indian mobile), prepend 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = "91" + digits;
  }
  return digits;
}

/**
 * Clean a phone number for tel: links.
 * Preserves leading + if present, strips invalid characters.
 * @param {string} phone
 * @returns {string}
 */
export function formatTelPhone(phone) {
  if (!phone) return "";
  const hasPlus = phone.trim().startsWith("+");
  const clean = phone.replace(/[^\d]/g, "");
  return hasPlus ? `+${clean}` : clean;
}

/**
 * Build a clinical, urgent diabetic caregiver SOS message.
 * @param {object} params
 * @returns {string}
 */
export function buildCaregiverSOSMessage({
  patientName = "Patient",
  caregiverName = "",
  glucose = null,
  predictedGlucose = null,
  trend = "",
  status = "GLUCOSE_ALERT",
  severity = "SEVERE",
  time = null,
  customNote = "",
}) {
  const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isLow = status.includes("LOW");
  const greeting = caregiverName ? `Hello ${caregiverName},` : "Hello,";

  const actionLines = isLow
    ? "• Provide 15-20g of FAST-ACTING SUGAR immediately (e.g. 4 glucose tablets, 1/2 cup fruit juice, or 3-4 tsp sugar).\n• Recheck glucose in 15 minutes.\n• If patient is unconscious or unable to swallow, do NOT give oral fluids. Administer glucagon / call emergency services immediately."
    : "• Follow the patient's corrective insulin protocol with prescribed bolus.\n• Ensure adequate water hydration.\n• Recheck glucose in 30-45 minutes. Contact healthcare team if ketones or dizziness occur.";

  let msg = `🚨 *URGENT TIVA DIABETIC ALERT* 🚨\n\n${greeting}\n\n`;
  msg += `This is an urgent safety notification regarding *${patientName}*:\n\n`;
  if (glucose != null) msg += `🩸 *Current Glucose:* ${glucose} mg/dL\n`;
  if (predictedGlucose != null) msg += `🔮 *Predicted (Next 30m):* ${predictedGlucose} mg/dL\n`;
  if (trend) msg += `📈 *Glucose Trend:* ${trend}\n`;
  msg += `⚠️ *Alert Status:* ${status.replace(/_/g, " ")}\n`;
  msg += `⏰ *Timestamp:* ${timeStr}\n\n`;
  msg += `📋 *IMMEDIATE ACTION REQUIRED:*\n${actionLines}\n\n`;
  if (customNote) msg += `📝 *Note:* ${customNote}\n\n`;
  msg += `🛡️ *Automated by TIVA Clinical AI Caregiver Safety System*`;

  return msg;
}

/**
 * Generate a direct WhatsApp click-to-chat URL with pre-filled SOS text.
 * @param {string} phone
 * @param {string} messageText
 * @returns {string}
 */
export function getCaregiverWhatsAppUrl(phone, messageText) {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) return "";
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Trigger a phone call to the caregiver via device dialer.
 * @param {string} phone
 */
export function triggerCaregiverCall(phone) {
  const tel = formatTelPhone(phone);
  if (tel) {
    window.location.href = `tel:${tel}`;
  }
}

