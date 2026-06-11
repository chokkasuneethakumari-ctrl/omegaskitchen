"""Self-contained email router: password reset + offers/announcements.

Kept in its own module so it doesn't collide with concurrent edits to server.py.
server.py only needs: `from email_reset import reset_router` + `app.include_router(reset_router)`
(already wired). All mail goes through email_service (Resend -> Gmail -> dev-log).

Endpoints (all under /api):
  POST  /auth/forgot-password {email}
  POST  /auth/reset-password  {email, code, new_password}
  POST  /admin/broadcast      {subject, message}   -> emails all opted-in users (admin only)
  GET   /me/notifications                            -> {marketing_opt_in}
  PATCH /me/notifications     {opt_in}               -> set the user's offers preference
  GET   /unsubscribe?token=...                       -> one-click opt-out link used in emails
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

import email_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
RESET_CODE_TTL_MINUTES = 15
PUBLIC_BASE_URL = (
    os.environ.get("RENDER_EXTERNAL_URL")
    or os.environ.get("PUBLIC_BASE_URL")
    or "https://omega-kitchen-api.onrender.com"
).rstrip("/")

logger = logging.getLogger("omega-kitchen")
reset_router = APIRouter(prefix="/api")
_bearer = HTTPBearer(auto_error=False)


# ----------------------------- auth (mirrors server.py) -----------------------------
async def _current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = await _db.users.find_one(
        {"id": payload.get("sub")}, {"_id": 0, "password_hash": 0, "totp_secret": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


async def _require_admin(user: dict = Depends(_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ----------------------------- email templates -----------------------------
def _shell(inner: str) -> str:
    return (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;'
        'margin:0 auto;padding:8px;color:#1a1a1a">'
        '<h2 style="color:#E8590C;margin:0 0 16px">Omega\'s Kitchen</h2>'
        f"{inner}</div>"
    )


def _reset_html(code: str) -> str:
    return _shell(
        "<p>Use this code to reset your password:</p>"
        '<p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#FFF4E6;'
        f'padding:16px;border-radius:10px;text-align:center">{code}</p>'
        f"<p>It expires in {RESET_CODE_TTL_MINUTES} minutes. "
        "If you didn't request this, you can safely ignore this email.</p>"
    )


def _unsub_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "unsub": True}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _broadcast_html(user: dict, message: str) -> str:
    first = (user.get("name") or "there").split(" ")[0]
    unsub = f"{PUBLIC_BASE_URL}/api/unsubscribe?token={_unsub_token(user['id'])}"
    body = message.replace("\n", "<br>")
    return _shell(
        f"<p>Hi {first},</p>"
        f'<p style="line-height:1.6">{body}</p>'
        '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
        '<p style="font-size:12px;color:#999">You\'re receiving this because you have an '
        "Omega's Kitchen account. "
        f'<a href="{unsub}" style="color:#999">Unsubscribe from offers</a>.</p>'
    )


# ----------------------------- models -----------------------------
class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=128)


class BroadcastIn(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class MarketingIn(BaseModel):
    opt_in: bool


# ----------------------------- password reset -----------------------------
@reset_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    email = payload.email.lower()
    user = await _db.users.find_one({"email": email})
    if user:
        code = f"{secrets.randbelow(1_000_000):06d}"
        await _db.password_resets.update_one(
            {"email": email},
            {"$set": {
                "email": email,
                "code": code,
                "expires_at": (_now() + timedelta(minutes=RESET_CODE_TTL_MINUTES)).isoformat(),
            }},
            upsert=True,
        )
        await email_service.send_email(
            email,
            "Your Omega's Kitchen password reset code",
            html=_reset_html(code),
            text=f"Your Omega's Kitchen password reset code is {code} "
            f"(expires in {RESET_CODE_TTL_MINUTES} minutes).",
        )
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
        raise HTTPException(status_code=400, detail="Reset code has expired - request a new one")
    hashed = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    await _db.users.update_one({"email": email}, {"$set": {"password_hash": hashed}})
    await _db.password_resets.delete_one({"email": email})
    return {"reset": True}


# ----------------------------- offers / announcements -----------------------------
@reset_router.post("/admin/broadcast")
async def send_broadcast(payload: BroadcastIn, admin: dict = Depends(_require_admin)):
    recipients = await _db.users.find(
        {
            "role": "user",
            "is_active": {"$ne": False},
            "marketing_opt_in": {"$ne": False},  # missing field == opted in
            "email": {"$exists": True, "$ne": ""},
        },
        {"_id": 0, "id": 1, "email": 1, "name": 1},
    ).to_list(5000)
    messages = [
        {"to": u["email"], "subject": payload.subject, "html": _broadcast_html(u, payload.message)}
        for u in recipients
        if u.get("email")
    ]
    sent = await email_service.send_batch(messages)
    return {"recipients": len(messages), "sent": sent, "provider": email_service.provider()}


@reset_router.get("/me/notifications")
async def get_notifications(user: dict = Depends(_current_user)):
    doc = await _db.users.find_one({"id": user["id"]}, {"_id": 0, "marketing_opt_in": 1})
    return {"marketing_opt_in": (doc or {}).get("marketing_opt_in", True)}


@reset_router.patch("/me/notifications")
async def set_notifications(payload: MarketingIn, user: dict = Depends(_current_user)):
    await _db.users.update_one({"id": user["id"]}, {"$set": {"marketing_opt_in": payload.opt_in}})
    return {"marketing_opt_in": payload.opt_in}


@reset_router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(token: str):
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link")
    if not data.get("unsub"):
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link")
    await _db.users.update_one({"id": data.get("sub")}, {"$set": {"marketing_opt_in": False}})
    return _shell(
        "<p>You've been unsubscribed from offer emails.</p>"
        '<p style="color:#999;font-size:13px">You\'ll still get account &amp; order emails. '
        "You can re-enable offers anytime in the app under Profile.</p>"
    )
