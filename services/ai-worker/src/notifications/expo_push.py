"""Direct Expo Push client for the always-on worker.

Push delivery used to be handed to core-api via a Redis stream, but core-api
runs with Cloud Run CPU throttling and scale-to-zero, so its background stream
consumer could not reliably finish sending pushes. The worker has always-on CPU
(--no-cpu-throttling, min-instances 1), so it sends pushes itself.

Ported from core-api's ExpoPushService (expo-push.service.ts). Uses httpx,
which is already present via the OpenAI SDK, so no new dependency.
"""

import logging
import re
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Expo tokens look like "ExponentPushToken[xxx]" or "ExpoPushToken[xxx]".
_TOKEN_RE = re.compile(r"^Expo(nent)?PushToken\[.+\]$")


def is_valid_expo_token(token: Optional[str]) -> bool:
    """Validate Expo push token format."""
    return bool(token and isinstance(token, str) and _TOKEN_RE.match(token))


def is_device_not_registered(ticket: dict[str, Any]) -> bool:
    """True when Expo says the token is dead and should be cleared."""
    return (
        ticket.get("status") == "error"
        and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered"
    )


def _mask(token: str) -> str:
    if not token or len(token) < 20:
        return "***"
    return f"{token[:20]}...{token[-5:]}"


class ExpoPushClient:
    """Minimal synchronous Expo push sender. Never raises."""

    def __init__(self, access_token: Optional[str] = None, timeout: float = 15.0):
        self._access_token = (access_token or "").strip()
        self._timeout = timeout

    def send(
        self,
        push_token: str,
        title: str,
        body: str,
        data: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Send a single push notification.

        Returns the Expo ticket dict (status "ok"/"error"). Never raises, so a
        push failure cannot affect episode processing.
        """
        if not is_valid_expo_token(push_token):
            logger.warning(f"[PUSH] Invalid Expo token: {_mask(push_token or '')}")
            return {"status": "error", "details": {"error": "InvalidCredentials"}}

        message = {
            "to": push_token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high",
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"

        try:
            resp = httpx.post(
                EXPO_PUSH_URL, json=[message], headers=headers, timeout=self._timeout
            )
            if resp.status_code >= 400:
                logger.error(f"[PUSH] Expo API HTTP {resp.status_code}: {resp.text[:300]}")
                return {"status": "error", "details": {"error": f"HTTP {resp.status_code}"}}

            tickets = (resp.json() or {}).get("data") or []
            ticket = tickets[0] if tickets else {"status": "error", "details": {"error": "NoTicket"}}
            if ticket.get("status") == "error":
                logger.warning(
                    f"[PUSH] Ticket error for {_mask(push_token)}: "
                    f"{ticket.get('message')} ({(ticket.get('details') or {}).get('error')})"
                )
            else:
                logger.info(f"[PUSH] Sent to {_mask(push_token)}: ticket {ticket.get('id')}")
            return ticket
        except Exception as e:
            logger.error(f"[PUSH] Failed to send push: {e}")
            return {"status": "error", "details": {"error": "RequestFailed"}}
