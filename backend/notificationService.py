"""
Notification Service — TIVA Caregiver Alert Delivery

Provider abstraction for sending caregiver notifications.
Designed so a real provider (Twilio, etc.) can be configured through environment variables.

Environment variables:
    NOTIFICATION_PROVIDER   - "twilio" | "none" (default: "none")
    NOTIFICATION_API_KEY    - Provider API key / Account SID
    NOTIFICATION_API_SECRET - Provider API secret / Auth token
    NOTIFICATION_FROM_NUMBER - Sender phone number

Secrets must NEVER be:
    - placed in frontend code
    - placed in localStorage
    - committed to version control
    - exposed in public API responses
"""

import os
import logging
import urllib.request
import urllib.error
import urllib.parse
import json

logger = logging.getLogger("hypoguard.notifications")


# ---------------------------------------------------------------------------
# Provider configuration (read once at import time)
# ---------------------------------------------------------------------------

PROVIDER = os.getenv("NOTIFICATION_PROVIDER", "none").strip().lower()
API_KEY = os.getenv("NOTIFICATION_API_KEY", "").strip()
API_SECRET = os.getenv("NOTIFICATION_API_SECRET", "").strip()
FROM_NUMBER = os.getenv("NOTIFICATION_FROM_NUMBER", "").strip()


def is_configured():
    """Return True if a real notification provider is configured."""
    return PROVIDER not in ("none", "")


# ---------------------------------------------------------------------------
# Notification result type
# ---------------------------------------------------------------------------

class NotificationResult:
    """Structured result from a notification delivery attempt."""

    __slots__ = ("success", "provider_status", "provider_message", "message_id")

    def __init__(self, success, provider_status, provider_message="", message_id=None):
        self.success = success
        self.provider_status = provider_status
        self.provider_message = provider_message
        self.message_id = message_id

    def to_dict(self):
        d = {
            "success": self.success,
            "providerStatus": self.provider_status,
        }
        if self.provider_message:
            d["providerMessage"] = self.provider_message
        if self.message_id:
            d["messageId"] = self.message_id
        return d


# ---------------------------------------------------------------------------
# Twilio provider
# ---------------------------------------------------------------------------

def _send_twilio(to_number, body):
    """Send an SMS via the Twilio REST API using only stdlib (urllib)."""
    if not API_KEY or not API_SECRET or not FROM_NUMBER:
        logger.warning("Twilio credentials incomplete — cannot send SMS")
        return NotificationResult(
            success=False,
            provider_status="configuration_error",
            provider_message="Twilio credentials incomplete",
        )

    if not to_number:
        return NotificationResult(
            success=False,
            provider_status="invalid_recipient",
            provider_message="No caregiver phone number provided",
        )

    url = f"https://api.twilio.com/2010-04-01/Accounts/{API_KEY}/Messages.json"

    payload = {
        "To": to_number,
        "From": FROM_NUMBER,
        "Body": body,
    }

    encoded = urllib.parse.urlencode(payload).encode("utf-8")

    import base64
    credentials = base64.b64encode(f"{API_KEY}:{API_SECRET}".encode()).decode()

    req = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body_bytes = resp.read()
            data = json.loads(body_bytes.decode("utf-8"))
            message_id = data.get("sid")
            logger.info("Twilio SMS accepted — sid=%s", message_id)
            return NotificationResult(
                success=True,
                provider_status="accepted",
                provider_message="Message accepted by Twilio",
                message_id=message_id,
            )
    except urllib.error.HTTPError as exc:
        error_body = ""
        try:
            error_body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        logger.error("Twilio HTTP %s: %s", exc.code, error_body)
        return NotificationResult(
            success=False,
            provider_status="provider_error",
            provider_message=f"HTTP {exc.code}: {error_body[:200]}",
        )
    except Exception as exc:
        logger.error("Twilio request failed: %s", exc)
        return NotificationResult(
            success=False,
            provider_status="network_error",
            provider_message=str(exc)[:200],
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_caregiver_alert(
    to_number,
    caregiver_name,
    patient_name,
    severity,
    glucose,
    predicted_glucose,
    trend,
    message,
):
    """
    Send a caregiver alert notification.

    Args:
        to_number:       Caregiver phone number (E.164 format preferred)
        caregiver_name:  Caregiver's name (for message personalisation)
        patient_name:    Patient/user display name
        severity:        NONE | MODERATE | SEVERE
        glucose:         Current glucose reading (mg/dL) or None
        predicted_glucose: Predicted glucose (mg/dL) or None
        trend:           'rising' | 'stable' | 'falling' or None
        message:         Human-readable alert message

    Returns:
        NotificationResult
    """
    if not is_configured():
        logger.info("Notification provider not configured — skipping send")
        return NotificationResult(
            success=False,
            provider_status="not_configured",
            provider_message="No notification provider configured. Set NOTIFICATION_PROVIDER environment variable.",
        )

    # Build SMS body
    parts = []
    if severity in ("SEVERE",):
        parts.append("CRITICAL ALERT")
    elif severity == "MODERATE":
        parts.append("TIVA Safety Alert")

    if patient_name:
        parts.append(f"Patient: {patient_name}")

    if glucose is not None:
        parts.append(f"Glucose: {glucose} mg/dL")
    if predicted_glucose is not None:
        parts.append(f"Predicted: {predicted_glucose} mg/dL")
    if trend:
        parts.append(f"Trend: {trend}")

    if message:
        parts.append(message)

    parts.append(
        "Follow the patient's emergency care plan. "
        "Contact emergency medical services when appropriate."
    )

    sms_body = "\n".join(parts)

    if PROVIDER == "twilio":
        return _send_twilio(to_number, sms_body)

    logger.warning("Unknown notification provider: %s", PROVIDER)
    return NotificationResult(
        success=False,
        provider_status="unknown_provider",
        provider_message=f"Unknown provider: {PROVIDER}",
    )
