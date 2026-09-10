/**
 * Glucose Safety Classification Engine — TIVA Safety Monitor
 *
 * Classifies glucose readings against user-configured personal thresholds
 * and clinical safety boundaries.
 *
 * This is a safety-monitoring and alerting layer.
 * It does NOT diagnose, prescribe, or recommend treatment.
 * Thresholds are personal/clinician-provided settings, not universal medical rules.
 */

import { getLatestGlucoseReading } from "./shared";

/* ── Clinical Constants (non-user-configurable) ── */

/**
 * Clinically recognized severe hypoglycemia threshold.
 * Source: ADA consensus — glucose ≤ 54 mg/dL is serious hypoglycemia.
 * This is NOT a user-configurable value.
 */
export const CRITICAL_LOW_THRESHOLD = 54;

/**
 * Clinically recognized dangerous hyperglycemia threshold.
 * Glucose ≥ 300 mg/dL carries acute risk.
 * This is NOT a user-configurable value.
 */
export const CRITICAL_HIGH_THRESHOLD = 300;

/**
 * Trend proximity buffer in mg/dL.
 * If predicted glucose is within this distance of a threshold,
 * the trend is flagged as concerning.
 */
export const TREND_PROXIMITY_MGDL = 20;

/* ── Status Constants ── */

export const SAFETY_STATUS = {
  NORMAL: "NORMAL",
  LOW: "LOW",
  HIGH: "HIGH",
  CRITICAL_LOW: "CRITICAL_LOW",
  CRITICAL_HIGH: "CRITICAL_HIGH",
  UNKNOWN: "UNKNOWN",
  // Backward-compatible aliases — same string values as above
  POTENTIALLY_LOW: "LOW",
  POTENTIALLY_HIGH: "HIGH",
  NO_DATA: "UNKNOWN",
};

/* ── Severity Constants ── */

export const SEVERITY = {
  NONE: "NONE",
  MODERATE: "MODERATE",
  SEVERE: "SEVERE",
};

/* ── Threshold Helpers ── */

/**
 * Get the user's configured glucose alert thresholds from their profile.
 * @param {string} userId - Authenticated user's ID
 * @returns {{ lowAlertThreshold: number|null, highAlertThreshold: number|null }}
 */
export function getUserThresholds(userId) {
  if (!userId) return { lowAlertThreshold: null, highAlertThreshold: null };
  try {
    const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
    const profile = profiles[userId];
    if (!profile) return { lowAlertThreshold: null, highAlertThreshold: null };
    return {
      lowAlertThreshold: profile.lowThreshold ? Number(profile.lowThreshold) : null,
      highAlertThreshold: profile.highThreshold ? Number(profile.highThreshold) : null,
    };
  } catch {
    return { lowAlertThreshold: null, highAlertThreshold: null };
  }
}

/**
 * Update the user's glucose alert thresholds in their profile.
 * @param {string} userId
 * @param {{ lowAlertThreshold?: number, highAlertThreshold?: number }} thresholds
 */
export function saveUserThresholds(userId, thresholds) {
  if (!userId) return;
  try {
    const profiles = JSON.parse(localStorage.getItem("tiva_profiles") || "{}");
    if (!profiles[userId]) profiles[userId] = {};
    if (thresholds.lowAlertThreshold !== undefined) {
      profiles[userId].lowThreshold = String(thresholds.lowAlertThreshold);
    }
    if (thresholds.highAlertThreshold !== undefined) {
      profiles[userId].highThreshold = String(thresholds.highThreshold);
    }
    localStorage.setItem("tiva_profiles", JSON.stringify(profiles));
  } catch { /* ignore */ }
}

/* ── Core Safety Classification ── */

/**
 * Classify a glucose reading against configured thresholds.
 *
 * @param {object} params
 * @param {number|null} params.glucose - Current glucose reading in mg/dL
 * @param {number|null} params.predictedGlucose - Predicted glucose in mg/dL (optional)
 * @param {string|null} params.trend - 'rising' | 'stable' | 'falling' (optional)
 * @param {number|null} params.lowThreshold - User-configured low alert threshold
 * @param {number|null} params.highThreshold - User-configured high alert threshold
 * @param {string|null} params.savedAt - ISO timestamp of the reading (optional)
 *
 * @returns {{
 *   status: string,
 *   severity: string,
 *   glucose: number|null,
 *   predictedGlucose: number|null,
 *   trend: string|null,
 *   lowThreshold: number|null,
 *   highThreshold: number|null,
 *   message: string,
 *   shouldAlert: boolean,
 *   requiresCaregiverAlert: boolean,
 *   requiresEmergencyAttention: boolean,
 *   savedAt: string|null
 * }}
 */
export function classifyGlucoseReading(params) {
  const {
    glucose: glucoseRaw,
    predictedGlucose: predictedRaw,
    trend: trendInput,
    lowThreshold,
    highThreshold,
    savedAt,
  } = params;

  // ── No data case ──
  if (glucoseRaw == null || isNaN(Number(glucoseRaw))) {
    return {
      status: SAFETY_STATUS.UNKNOWN,
      severity: SEVERITY.NONE,
      glucose: null,
      predictedGlucose: predictedRaw != null ? Number(predictedRaw) : null,
      trend: trendInput || null,
      lowThreshold,
      highThreshold,
      message: "No glucose data available for safety evaluation.",
      shouldAlert: false,
      requiresCaregiverAlert: false,
      requiresEmergencyAttention: false,
      savedAt: savedAt || null,
    };
  }

  const glucose = Number(glucoseRaw);
  const predictedGlucose = predictedRaw != null ? Number(predictedRaw) : null;
  const trend = trendInput || null;

  let status = SAFETY_STATUS.NORMAL;
  let severity = SEVERITY.NONE;
  let message = "Glucose is within your configured monitoring range.";
  let shouldAlert = false;
  let requiresCaregiverAlert = false;
  let requiresEmergencyAttention = false;

  // ── 1. Classify the CURRENT glucose reading ──

  if (glucose <= CRITICAL_LOW_THRESHOLD) {
    status = SAFETY_STATUS.CRITICAL_LOW;
    severity = SEVERITY.SEVERE;
    message = `Glucose reading (${glucose} mg/dL) is at or below the clinical severe hypoglycemia threshold (${CRITICAL_LOW_THRESHOLD} mg/dL). Immediate attention may be required.`;
    shouldAlert = true;
    requiresCaregiverAlert = true;
    requiresEmergencyAttention = true;
  } else if (glucose >= CRITICAL_HIGH_THRESHOLD) {
    status = SAFETY_STATUS.CRITICAL_HIGH;
    severity = SEVERITY.SEVERE;
    message = `Glucose reading (${glucose} mg/dL) is at or above the clinical dangerous hyperglycemia threshold (${CRITICAL_HIGH_THRESHOLD} mg/dL). Immediate attention may be required.`;
    shouldAlert = true;
    requiresCaregiverAlert = true;
    requiresEmergencyAttention = true;
  } else if (lowThreshold != null && glucose <= lowThreshold) {
    status = SAFETY_STATUS.LOW;
    severity = SEVERITY.MODERATE;
    message = `Glucose reading (${glucose} mg/dL) is at or below your configured low alert threshold (${lowThreshold} mg/dL).`;
    shouldAlert = true;
    requiresCaregiverAlert = true;
    requiresEmergencyAttention = false;
  } else if (highThreshold != null && glucose >= highThreshold) {
    status = SAFETY_STATUS.HIGH;
    severity = SEVERITY.MODERATE;
    message = `Glucose reading (${glucose} mg/dL) is at or above your configured high alert threshold (${highThreshold} mg/dL).`;
    shouldAlert = true;
    requiresCaregiverAlert = true;
    requiresEmergencyAttention = false;
  }

  // ── 2. If current is normal, check the PREDICTED value for emerging risk ──

  if (status === SAFETY_STATUS.NORMAL && predictedGlucose != null) {
    if (predictedGlucose <= CRITICAL_LOW_THRESHOLD) {
      status = SAFETY_STATUS.CRITICAL_LOW;
      severity = SEVERITY.SEVERE;
      message = `Predicted glucose (${predictedGlucose} mg/dL) is at or below the clinical severe hypoglycemia threshold (${CRITICAL_LOW_THRESHOLD} mg/dL).`;
      shouldAlert = true;
      requiresCaregiverAlert = true;
      requiresEmergencyAttention = true;
    } else if (predictedGlucose >= CRITICAL_HIGH_THRESHOLD) {
      status = SAFETY_STATUS.CRITICAL_HIGH;
      severity = SEVERITY.SEVERE;
      message = `Predicted glucose (${predictedGlucose} mg/dL) is at or above the clinical dangerous hyperglycemia threshold (${CRITICAL_HIGH_THRESHOLD} mg/dL).`;
      shouldAlert = true;
      requiresCaregiverAlert = true;
      requiresEmergencyAttention = true;
    } else if (lowThreshold != null && predictedGlucose <= lowThreshold) {
      status = SAFETY_STATUS.LOW;
      severity = SEVERITY.MODERATE;
      message = `Predicted glucose (${predictedGlucose} mg/dL) may drop below your configured low alert threshold (${lowThreshold} mg/dL).`;
      shouldAlert = true;
      requiresCaregiverAlert = true;
      requiresEmergencyAttention = false;
    } else if (highThreshold != null && predictedGlucose >= highThreshold) {
      status = SAFETY_STATUS.HIGH;
      severity = SEVERITY.MODERATE;
      message = `Predicted glucose (${predictedGlucose} mg/dL) may rise above your configured high alert threshold (${highThreshold} mg/dL).`;
      shouldAlert = true;
      requiresCaregiverAlert = true;
      requiresEmergencyAttention = false;
    }
  }

  // ── 3. If still normal, check for CONCERNING TREND ──
  //    Glucose is normal now, prediction is still normal,
  //    but prediction is moving toward a threshold within the proximity buffer.

  if (status === SAFETY_STATUS.NORMAL && predictedGlucose != null && trend) {
    const approachingLow =
      lowThreshold != null &&
      (trend === "falling") &&
      predictedGlucose > lowThreshold &&
      predictedGlucose <= lowThreshold + TREND_PROXIMITY_MGDL;

    const approachingHigh =
      highThreshold != null &&
      (trend === "rising") &&
      predictedGlucose < highThreshold &&
      predictedGlucose >= highThreshold - TREND_PROXIMITY_MGDL;

    if (approachingLow) {
      message = `Glucose (${glucose} mg/dL) is currently within range, but the falling trend (predicted ${predictedGlucose} mg/dL) is approaching your configured low threshold (${lowThreshold} mg/dL).`;
    } else if (approachingHigh) {
      message = `Glucose (${glucose} mg/dL) is currently within range, but the rising trend (predicted ${predictedGlucose} mg/dL) is approaching your configured high threshold (${highThreshold} mg/dL).`;
    }
  }

  return {
    status,
    severity,
    glucose,
    predictedGlucose,
    trend,
    lowThreshold,
    highThreshold,
    message,
    shouldAlert,
    requiresCaregiverAlert,
    requiresEmergencyAttention,
    savedAt: savedAt || null,
  };
}

/**
 * Perform a safety check on the latest glucose reading from tiva_glucose_history
 * against the user's configured thresholds.
 *
 * This is the primary entry point used by the Dashboard, AlertsPage, and alertManager.
 * It reads the latest stored glucose data and the user's profile thresholds automatically.
 *
 * @param {string} userId - Authenticated user's ID
 * @returns {object} Safety classification result (same shape as classifyGlucoseReading)
 */
export function checkGlucoseSafety(userId) {
  const reading = getLatestGlucoseReading();
  const { lowAlertThreshold, highAlertThreshold } = getUserThresholds(userId);

  return classifyGlucoseReading({
    glucose: reading?.value ?? null,
    predictedGlucose: reading?.predicted ?? null,
    trend: reading?.trend ?? null,
    lowThreshold: lowAlertThreshold,
    highThreshold: highAlertThreshold,
    savedAt: reading?.savedAt ?? null,
  });
}

/* ── Display Helpers ── */

/**
 * Get a human-readable label for a safety status.
 */
export function getSafetyStatusLabel(status) {
  switch (status) {
    case SAFETY_STATUS.NORMAL: return "Within Range";
    case SAFETY_STATUS.LOW: return "Low";
    case SAFETY_STATUS.HIGH: return "High";
    case SAFETY_STATUS.CRITICAL_LOW: return "Critical Low";
    case SAFETY_STATUS.CRITICAL_HIGH: return "Critical High";
    case SAFETY_STATUS.UNKNOWN: return "No Data";
    default: return "Unknown";
  }
}

/**
 * Get a human-readable label for severity.
 */
export function getSeverityLabel(severity) {
  switch (severity) {
    case SEVERITY.NONE: return "None";
    case SEVERITY.MODERATE: return "Moderate";
    case SEVERITY.SEVERE: return "Severe";
    default: return "Unknown";
  }
}

/**
 * Get a color class for a safety status.
 */
export function getSafetyStatusColor(status) {
  switch (status) {
    case SAFETY_STATUS.NORMAL: return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case SAFETY_STATUS.LOW: return "text-amber-600 bg-amber-50 border-amber-200";
    case SAFETY_STATUS.HIGH: return "text-orange-600 bg-orange-50 border-orange-200";
    case SAFETY_STATUS.CRITICAL_LOW: return "text-red-700 bg-red-50 border-red-300";
    case SAFETY_STATUS.CRITICAL_HIGH: return "text-red-700 bg-red-50 border-red-300";
    case SAFETY_STATUS.UNKNOWN: return "text-slate-500 bg-slate-50 border-slate-200";
    default: return "text-slate-500 bg-slate-50 border-slate-200";
  }
}
