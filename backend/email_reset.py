"""Self-contained password-reset router (Phase 2).

Kept in its own module so it doesn't collide with concurrent edits to server.py.
server.py only needs: `from email_reset import reset_router` + `app.include_router(reset_router)`.

Flow: POST /auth/forgot-password {email} emails a 6-digit code (Gmail SMTP);
POST /auth/reset-password {email, code, new_password} verifies it and sets the new password.
If GMAIL_USER / GMAIL_APP_PASSWORD aren't set, the code is logged (dev) instead of emailed.
"""

import logging
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]

GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
RESET_CODE_TTL_MINUTES = 15

logger = logging.getLogger("omega-kitchen")
reset_router = APIRouter(prefix="/api")


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=128)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _send_reset_email(to: str, code: str) -> bool:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.warning("Gmail not configured — reset code for %s is %s (dev only)", to, code)
        return False
    msg = EmailMessage()
    msg["Subject"] = "Your Omega's Kitchen password reset code"
    msg["From"] = GMAIL_USER
    msg["To"] = to
    msg.set_content(
        f"Your Omega's Kitchen password reset code is: {code}\n\n"
        f"It expires in {RESET_CODE_TTL_MINUTES} minutes. "
        f"If you didn't request this, you can safely ignore this email."
    )
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
            s.starttls()
            s.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            s.send_message(msg)
        return True
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to send reset email to %s: %s", to, e)
        return False


@reset_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    email = payload.email.lower()
    user = await _db.users.find_one({"email": email})
    if user:
        code = f"{secrets.randbelow(1_000_000):06d}"
        await _db.password_resets.update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "code": code,
                    "expires_at": (_now() + timedelta(minutes=RESET_CODE_TTL_MINUTES)).isoformat(),
                }
            },
            upsert=True,
        )
        _send_reset_email(email, code)
    # Always report success so we never reveal whether an email is registered.
    return {"sent": True}


@reset_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    email = payload.email.lower()
    rec = await _db.password_resets.find_one({"email": email})
    if not rec or rec.get("code") != payload.code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    if rec.get("expires_at", "") < _now().isoformat():
        await _db.password_resets.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="Reset code has expired — request a new one")
    hashed = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    await _db.users.update_one({"email": email}, {"$set": {"password_hash": hashed}})
    await _db.password_resets.delete_one({"email": email})
    return {"reset": True}
