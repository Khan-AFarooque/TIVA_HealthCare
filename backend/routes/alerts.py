"""
HypoGuard AI - Alerts API route.

POST /api/alerts/caregiver
    Send a caregiver notification for a glucose safety alert.

    Request body (JSON):
        {
            "userId":              str  — authenticated user ID
            "alertId":             str  — alert ID from alertManager
            "status":              str  — safety status (LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH)
            "severity":            str  — NONE | MODERATE | SEVERE
            "glucose":             float | null
            "predictedGlucose":    float | null
            "trend":               str | null
            "message":             str
            "caregiverName":       str
            "caregiverPhone":      str
            "caregiverRelationship": str
        }

    The backend:
        1. Validates the request payload
        2. Validates that userId is non-empty
        3. Validates that alertId is non-empty
        4. Validates the caregiver phone number format
        5. Checks for duplicate notifications (same userId + alertId)
        6. Calls the notification provider
        7. Returns the actual provider result

    Response:
        { "success": true,  "providerStatus": "accepted", "alertId": "..." }
        { "success": false, "providerStatus": "...",       "alertId": "...", "error": "..." }
"""

import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from backend.notificationService import send_caregiver_alert, is_configured  # noqa: E402

logger = logging.getLogger("hypoguard.alerts")
router = APIRouter()

# ---------------------------------------------------------------------------
# Duplicate notification prevention
# In-memory cache keyed by "userId:alertId".
# Reset on server restart — acceptable for this architecture since
# alerts themselves are persisted in the frontend localStorage.
# ---------------------------------------------------------------------------
_sent_notifications: dict[str, dict] = {}


def _dup_key(user_id: str, alert_id: str) -> str:
    return f"{user_id}:{alert_id}"


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class CaregiverAlertRequest(BaseModel):
    userId: str = Field(..., min_length=1, max_length=128)
    alertId: str = Field(..., min_length=1, max_length=128)
    status: str = Field(..., min_length=1, max_length=64)
    severity: str = Field(default="NONE", max_length=32)
    glucose: float | None = Field(default=None)
    predictedGlucose: float | None = Field(default=None)
    trend: str | None = Field(default=None, max_length=16)
    message: str = Field(default="", max_length=2000)
    caregiverName: str = Field(default="", max_length=128)
    caregiverPhone: str = Field(..., min_length=1, max_length=32)
    caregiverRelationship: str = Field(default="", max_length=64)


class CaregiverAlertResponse(BaseModel):
    success: bool
    providerStatus: str
    alertId: str
    error: str | None = None
    messageId: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


def _validate_phone(phone: str) -> bool:
    """Basic E.164-ish phone validation: optional +, 7-15 digits."""
    return bool(_PHONE_RE.match(phone.replace(" ", "").replace("-", "")))


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/caregiver", response_model=CaregiverAlertResponse)
async def send_caregiver_notification(req: CaregiverAlertRequest):
    """
    Send a caregiver notification for a glucose safety alert.

    Validates the request, prevents duplicates, and calls the configured
    notification provider. Returns the actual provider result — never a
    fake success.
    """

    # 1. Validate caregiver phone
    clean_phone = req.caregiverPhone.replace(" ", "").replace("-", "")
    if not _validate_phone(clean_phone):
        raise HTTPException(
            status_code=400,
            detail="Invalid caregiver phone number format. Expected E.164 format (e.g. +91XXXXXXXXXX).",
        )

    # 2. Check for duplicate notification
    key = _dup_key(req.userId, req.alertId)
    if key in _sent_notifications:
        cached = _sent_notifications[key]
        logger.info("Duplicate notification prevented for %s — returning cached result", key)
        return CaregiverAlertResponse(
            success=cached["success"],
            providerStatus=cached["providerStatus"],
            alertId=req.alertId,
            error=cached.get("error"),
            messageId=cached.get("messageId"),
        )

    # 3. Check if provider is configured
    if not is_configured():
        result = {
            "success": False,
            "providerStatus": "not_configured",
            "error": "Caregiver notification service is not configured. Set NOTIFICATION_PROVIDER environment variable.",
        }
        _sent_notifications[key] = result
        logger.warning("Notification provider not configured — alert %s not sent", req.alertId)
        return CaregiverAlertResponse(
            success=False,
            providerStatus="not_configured",
            alertId=req.alertId,
            error=result["error"],
        )

    # 4. Send via notification provider
    logger.info(
        "Sending caregiver alert — user=%s alert=%s severity=%s",
        req.userId,
        req.alertId,
        req.severity,
    )

    provider_result = send_caregiver_alert(
        to_number=clean_phone,
        caregiver_name=req.caregiverName,
        patient_name="",  # not sent from frontend for privacy
        severity=req.severity,
        glucose=req.glucose,
        predicted_glucose=req.predictedGlucose,
        trend=req.trend,
        message=req.message,
    )

    # 5. Cache the result
    cache_entry = {
        "success": provider_result.success,
        "providerStatus": provider_result.provider_status,
    }
    if provider_result.provider_message:
        cache_entry["error"] = provider_result.provider_message
    if provider_result.message_id:
        cache_entry["messageId"] = provider_result.message_id

    _sent_notifications[key] = cache_entry

    # 6. Return the real result
    return CaregiverAlertResponse(
        success=provider_result.success,
        providerStatus=provider_result.provider_status,
        alertId=req.alertId,
        error=provider_result.provider_message if not provider_result.success else None,
        messageId=provider_result.message_id,
    )
