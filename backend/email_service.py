"""Email delivery for Omega's Kitchen.

Provider priority: Resend (RESEND_API_KEY) -> Gmail SMTP (GMAIL_USER/GMAIL_APP_PASSWORD) -> log (dev).
Sync network calls are wrapped in asyncio.to_thread so they never block the event loop.
Used by password reset (email_reset.py) and admin broadcasts. Standalone to avoid server.py edits.
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

import requests

logger = logging.getLogger("omega-kitchen")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
# For production set RESEND_FROM to an address on a domain you've verified in Resend,
# e.g. "Omega's Kitchen <noreply@omegaskitchen.com>". The default test sender can only
# deliver to the Resend account owner's own email.
RESEND_FROM = os.environ.get("RESEND_FROM", "Omega's Kitchen <onboarding@resend.dev>")
GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")

_RESEND_URL = "https://api.resend.com/emails"
_RESEND_BATCH_URL = "https://api.resend.com/emails/batch"


def provider() -> str:
    if RESEND_API_KEY:
        return "resend"
    if GMAIL_USER and GMAIL_APP_PASSWORD:
        return "gmail"
    return "none"


def _resend_one(to: str, subject: str, html: Optional[str], text: Optional[str]) -> bool:
    payload = {"from": RESEND_FROM, "to": [to], "subject": subject}
    if html:
        payload["html"] = html
    if text:
        payload["text"] = text
    r = requests.post(
        _RESEND_URL, json=payload, headers={"Authorization": f"Bearer {RESEND_API_KEY}"}, timeout=20
    )
    if not r.ok:
        logger.error("Resend send to %s failed: %s %s", to, r.status_code, r.text[:200])
    return r.ok


def _gmail_one(to: str, subject: str, html: Optional[str], text: Optional[str]) -> bool:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = to
    msg.set_content(text or "Please view this email in an HTML-capable client.")
    if html:
        msg.add_alternative(html, subtype="html")
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
        s.starttls()
        s.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        s.send_message(msg)
    return True


def _send_one_sync(to: str, subject: str, html: Optional[str], text: Optional[str]) -> bool:
    p = provider()
    try:
        if p == "resend":
            return _resend_one(to, subject, html, text)
        if p == "gmail":
            return _gmail_one(to, subject, html, text)
    except Exception as e:  # noqa: BLE001
        logger.error("Email send to %s failed: %s", to, e)
        return False
    logger.warning("No email provider configured - '%s' to %s was not sent (dev).", subject, to)
    return False


async def send_email(
    to: str, subject: str, html: Optional[str] = None, text: Optional[str] = None
) -> bool:
    """Send one email off the event loop. Returns True if the provider accepted it."""
    return await asyncio.to_thread(_send_one_sync, to, subject, html, text)


def _send_batch_sync(messages: list) -> int:
    """messages: [{to, subject, html?, text?}]. Returns count accepted by the provider."""
    if not messages:
        return 0
    if provider() != "resend":
        # Gmail / dev fallback: send one at a time.
        return sum(
            _send_one_sync(m["to"], m["subject"], m.get("html"), m.get("text")) for m in messages
        )
    sent = 0
    for i in range(0, len(messages), 100):  # Resend accepts up to 100 per batch call
        chunk = [
            {
                k: v
                for k, v in {
                    "from": RESEND_FROM,
                    "to": [m["to"]],
                    "subject": m["subject"],
                    "html": m.get("html"),
                    "text": m.get("text"),
                }.items()
                if v is not None
            }
            for m in messages[i : i + 100]
        ]
        try:
            r = requests.post(
                _RESEND_BATCH_URL,
                json=chunk,
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                timeout=30,
            )
            if r.ok:
                # Count what Resend actually accepted (its 200 returns a data[] array);
                # fall back to the chunk size only if the body can't be parsed.
                try:
                    accepted = len((r.json() or {}).get("data") or [])
                except Exception:  # noqa: BLE001
                    accepted = 0
                sent += accepted or len(chunk)
            else:
                logger.error("Resend batch failed: %s %s", r.status_code, r.text[:200])
        except Exception as e:  # noqa: BLE001
            logger.error("Resend batch error: %s", e)
    return sent


async def send_batch(messages: list) -> int:
    """Send many emails (chunked to Resend's 100/batch limit). Returns count accepted."""
    return await asyncio.to_thread(_send_batch_sync, messages)
