import asyncio
import base64
import io
import logging
import os
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import jwt
import pyotp
import qrcode
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")  # Google "Web client" ID for sign-in
GOOGLE_ANDROID_CLIENT_ID = os.environ.get("GOOGLE_ANDROID_CLIENT_ID", "")  # Android client ID(s), CSV
TOKEN_TTL_DAYS = 7
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

EST_MINUTES_PER_ORDER = 15
MIN_PREP_MINUTES = 120
IN_LINE_STATUSES = ["placed", "cooking"]
ACTIVE_STATUSES = ["placed", "cooking", "ready"]
TWOFA_ISSUER = "Omega's Kitchen"
TWOFA_PENDING_TTL_MINUTES = 5

app = FastAPI(title="Omega's Kitchen API")
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("omega-kitchen")


# ---------- helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return now_utc().isoformat()


def today_str() -> str:
    return now_utc().strftime("%Y-%m-%d")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "exp": now_utc() + timedelta(days=TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def mask_name(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "Guest"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": "app"}, {"_id": 0})
    return {
        "kitchen_open": (doc or {}).get("kitchen_open", True),
        "announcement": (doc or {}).get("announcement", ""),
    }


def gen_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    # A 2FA-pending token must not authenticate a full session (only /auth/2fa/verify accepts it).
    if payload.get("twofa"):
        raise HTTPException(status_code=401, detail="Complete two-step verification to continue")
    user = await db.users.find_one(
        {"id": payload.get("sub")}, {"_id": 0, "password_hash": 0, "totp_secret": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been disabled")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------- schemas ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=16)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class InterestIn(BaseModel):
    interested: bool


class MenuItemIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=300)
    price: float = Field(gt=0)
    category: str = Field(default="Curries", max_length=30)
    image_url: str = Field(default="")
    available_qty: int = Field(default=20, ge=0, le=500)
    # "daily" = today's freshly-cooked menu (expires end of day); "standing" = always-available
    # pantry goods such as pickles and namkeen that never expire.
    kind: Literal["daily", "standing"] = "daily"


class MenuItemUpdate(BaseModel):
    # Full edit support (Zomato-partner style): the admin can change any field of any item.
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=300)
    category: Optional[str] = Field(default=None, max_length=30)
    image_url: Optional[str] = Field(default=None, max_length=600)
    is_available: Optional[bool] = None
    available_qty: Optional[int] = Field(default=None, ge=0, le=500)
    price: Optional[float] = Field(default=None, gt=0)
    kind: Optional[Literal["daily", "standing"]] = None


class OrderItemIn(BaseModel):
    menu_item_id: str
    qty: int = Field(ge=1, le=10)


class OrderIn(BaseModel):
    items: List[OrderItemIn]
    note: str = Field(default="", max_length=300)


class StatusIn(BaseModel):
    status: Literal["cooking", "ready", "completed", "cancelled"]


class RequestIn(BaseModel):
    message: str = Field(min_length=3, max_length=500)


class RequestReplyIn(BaseModel):
    decision: Literal["approved", "rejected"]
    message: str = Field(default="", max_length=500)
    price: Optional[float] = Field(default=None, gt=0)


class TwoFAVerifyIn(BaseModel):
    twofa_token: str
    code: str = Field(min_length=6, max_length=6)


class TwoFACodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class UserActiveIn(BaseModel):
    is_active: bool


class SettingsIn(BaseModel):
    kitchen_open: Optional[bool] = None
    announcement: Optional[str] = Field(default=None, max_length=280)


class PushTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=255)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class UpdateProfileIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    phone: Optional[str] = Field(default=None, min_length=7, max_length=16)


# ---------- auth ----------
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    # Single generic conflict message so registration can't enumerate which emails/phones exist.
    if await db.users.find_one({"$or": [{"email": email}, {"phone": payload.phone}]}):
        raise HTTPException(status_code=400, detail="An account with those details already exists")
    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": email,
        "phone": payload.phone.strip(),
        "role": "user",
        "is_active": True,
        "twofa_enabled": False,
        "created_at": iso_now(),
    }
    await db.users.insert_one({**user, "password_hash": hash_password(payload.password)})
    return {"token": create_token(user), "user": user}


class GoogleAuthIn(BaseModel):
    id_token: str


@api_router.post("/auth/google")
async def google_auth(payload: GoogleAuthIn):
    # Verify Google's signed ID token server-side, then sign the user in (creating the account
    # on first use). Enabled by the GOOGLE_CLIENT_ID env var (the Google "Web client" ID).
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    from google.auth.transport import requests as g_requests  # noqa: PLC0415
    from google.oauth2 import id_token as g_id_token  # noqa: PLC0415

    try:
        # Verify Google's signature/issuer/expiry, then accept only our own client IDs as the
        # audience (web + any Android client IDs), since the token's aud varies by platform/flow.
        info = g_id_token.verify_oauth2_token(payload.id_token, g_requests.Request())
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Could not verify Google sign-in")
    accepted = {c.strip() for c in f"{GOOGLE_CLIENT_ID},{GOOGLE_ANDROID_CLIENT_ID}".split(",") if c.strip()}
    if info.get("aud") not in accepted:
        raise HTTPException(status_code=401, detail="Google sign-in is not authorized for this app")
    email = (info.get("email") or "").lower()
    if not email or not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Your Google account email is not verified")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="This account has been disabled")
    else:
        user = {
            "id": str(uuid.uuid4()),
            "name": info.get("name") or email.split("@")[0],
            "email": email,
            "phone": "",
            "role": "user",
            "is_active": True,
            "twofa_enabled": False,
            "created_at": iso_now(),
        }
        await db.users.insert_one({**user, "password_hash": "", "google_account": True})
    user.pop("password_hash", None)
    user.pop("totp_secret", None)
    return {"token": create_token(user), "user": user}


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    doc = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not doc or not verify_password(payload.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been disabled")
    if doc.get("twofa_enabled"):
        pending = jwt.encode(
            {
                "sub": doc["id"],
                "twofa": True,
                "exp": now_utc() + timedelta(minutes=TWOFA_PENDING_TTL_MINUTES),
            },
            JWT_SECRET,
            algorithm=JWT_ALGORITHM,
        )
        return {"twofa_required": True, "twofa_token": pending}
    doc.pop("password_hash", None)
    doc.pop("totp_secret", None)
    return {"token": create_token(doc), "user": doc}


@api_router.post("/auth/2fa/verify")
async def verify_2fa(payload: TwoFAVerifyIn):
    try:
        data = jwt.decode(payload.twofa_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Verification expired — please sign in again")
    if not data.get("twofa"):
        raise HTTPException(status_code=400, detail="Invalid verification token")
    doc = await db.users.find_one({"id": data.get("sub")}, {"_id": 0})
    if not doc or not doc.get("twofa_enabled") or not doc.get("totp_secret"):
        raise HTTPException(status_code=400, detail="Two-step verification is not set up")
    if not pyotp.TOTP(doc["totp_secret"]).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Incorrect code — try again")
    doc.pop("password_hash", None)
    doc.pop("totp_secret", None)
    return {"token": create_token(doc), "user": doc}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/change-password")
async def change_password(payload: ChangePasswordIn, user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not doc or not verify_password(payload.current_password, doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}}
    )
    return {"changed": True}


@api_router.delete("/auth/me")
async def delete_my_account(user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts can't be deleted from the app")
    await _purge_user(user["id"])
    return {"deleted": True}


@api_router.patch("/auth/me")
async def update_profile(payload: UpdateProfileIn, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.phone is not None:
        phone = payload.phone.strip()
        clash = await db.users.find_one({"phone": phone, "id": {"$ne": user["id"]}})
        if clash:
            raise HTTPException(status_code=400, detail="That phone number is already in use")
        updates["phone"] = phone
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return await db.users.find_one(
        {"id": user["id"]}, {"_id": 0, "password_hash": 0, "totp_secret": 0}
    )


# ---------- menu ----------
@api_router.get("/menu/today")
async def menu_today(user: dict = Depends(get_current_user)):
    # Today's freshly-cooked dishes (date-bound) PLUS every always-available pantry item
    # (pickles, namkeen). Legacy items saved before "kind" existed are treated as daily.
    items = (
        await db.menu_items.find(
            {"$or": [{"kind": "standing"}, {"kind": {"$ne": "standing"}, "date": today_str()}]},
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(200)
    )
    ids = [i["id"] for i in items]
    my_map = {}
    async for doc in db.interests.find({"user_id": user["id"], "menu_item_id": {"$in": ids}}):
        my_map[doc["menu_item_id"]] = doc["interested"]
    counts: dict = {}
    pipeline = [
        {"$match": {"menu_item_id": {"$in": ids}}},
        {"$group": {"_id": {"item": "$menu_item_id", "i": "$interested"}, "c": {"$sum": 1}}},
    ]
    async for row in db.interests.aggregate(pipeline):
        key = row["_id"]["item"]
        counts.setdefault(key, {"yes": 0, "no": 0})
        counts[key]["yes" if row["_id"]["i"] else "no"] = row["c"]
    for item in items:
        c = counts.get(item["id"], {"yes": 0, "no": 0})
        item["interested_count"] = c["yes"]
        item["not_interested_count"] = c["no"]
        item["my_interest"] = my_map.get(item["id"])
    return {"date": today_str(), "items": items}


@api_router.post("/menu/{item_id}/interest")
async def set_interest(item_id: str, payload: InterestIn, user: dict = Depends(get_current_user)):
    item = await db.menu_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    existing = await db.interests.find_one({"menu_item_id": item_id, "user_id": user["id"]})
    my_interest: Optional[bool]
    if existing and existing["interested"] == payload.interested:
        await db.interests.delete_one({"menu_item_id": item_id, "user_id": user["id"]})
        my_interest = None
    else:
        await db.interests.update_one(
            {"menu_item_id": item_id, "user_id": user["id"]},
            {
                "$set": {"interested": payload.interested, "updated_at": iso_now()},
                "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": iso_now()},
            },
            upsert=True,
        )
        my_interest = payload.interested
    yes = await db.interests.count_documents({"menu_item_id": item_id, "interested": True})
    no = await db.interests.count_documents({"menu_item_id": item_id, "interested": False})
    return {"my_interest": my_interest, "interested_count": yes, "not_interested_count": no}


@api_router.post("/menu")
async def create_menu_item(payload: MenuItemIn, admin: dict = Depends(require_admin)):
    item = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "price": payload.price,
        "category": payload.category.strip() or "Curries",
        "image_url": payload.image_url,
        "available_qty": payload.available_qty,
        "is_available": True,
        "kind": payload.kind,
        "date": today_str(),
        "created_at": iso_now(),
    }
    await db.menu_items.insert_one({**item})
    return item


@api_router.put("/menu/{item_id}")
async def update_menu_item(item_id: str, payload: MenuItemUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    # Re-marking an item as "daily" re-posts it onto today's menu (otherwise it keeps its old date).
    if updates.get("kind") == "daily":
        updates["date"] = today_str()
    result = await db.menu_items.update_one({"id": item_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, admin: dict = Depends(require_admin)):
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"deleted": True}


# ---------- orders ----------
@api_router.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order has no items")
    if not (await get_settings())["kitchen_open"]:
        raise HTTPException(status_code=400, detail="The kitchen is closed right now — please check back soon")
    existing = await db.orders.find_one({"user_id": user["id"], "status": {"$in": ACTIVE_STATUSES}})
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active order in the queue")
    order_items = []
    total = 0.0
    for it in payload.items:
        doc = await db.menu_items.find_one({"id": it.menu_item_id})
        if not doc or not doc.get("is_available", True):
            raise HTTPException(status_code=400, detail="One of the items is unavailable today")
        # Daily dishes can only be ordered on their posted day; pantry items never expire.
        if doc.get("kind") != "standing" and doc.get("date") != today_str():
            raise HTTPException(status_code=400, detail="One of the items is no longer on today's menu")
        if doc["available_qty"] < it.qty:
            raise HTTPException(status_code=400, detail=f"Only {doc['available_qty']} left of {doc['name']}")
        order_items.append(
            {"menu_item_id": doc["id"], "name": doc["name"], "price": doc["price"], "qty": it.qty}
        )
        total += doc["price"] * it.qty
    # Atomically decrement stock, guarded so two concurrent orders can't drive it negative.
    decremented = []
    for oi in order_items:
        res = await db.menu_items.update_one(
            {"id": oi["menu_item_id"], "available_qty": {"$gte": oi["qty"]}},
            {"$inc": {"available_qty": -oi["qty"]}},
        )
        if res.matched_count == 0:
            for done in decremented:  # lost the race — roll back what we already took
                await db.menu_items.update_one(
                    {"id": done["menu_item_id"]}, {"$inc": {"available_qty": done["qty"]}}
                )
            raise HTTPException(status_code=400, detail=f"{oi['name']} just sold out")
        decremented.append(oi)
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user["phone"],
        "items": order_items,
        "total": total,
        "note": payload.note.strip(),
        "status": "placed",
        "payment_method": "cash_on_pickup",
        "source": "menu",
        "created_at": iso_now(),
        "status_history": [{"status": "placed", "at": iso_now()}],
    }
    await db.orders.insert_one({**order})
    return order


@api_router.get("/orders/my")
async def my_orders(user: dict = Depends(get_current_user)):
    return (
        await db.orders.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )


@api_router.get("/orders/queue")
async def live_queue(user: dict = Depends(get_current_user)):
    active = (
        await db.orders.find({"status": {"$in": ACTIVE_STATUSES}}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(200)
    )
    entries = []
    position = 0
    my_position = None
    my_active = None
    for o in active:
        in_line = o["status"] in IN_LINE_STATUSES
        if in_line:
            position += 1
        is_mine = o["user_id"] == user["id"]
        if is_mine:
            my_active = o
            if in_line and my_position is None:
                my_position = position
        entries.append(
            {
                "id": o["id"],
                "position": position if in_line else None,
                "status": o["status"],
                "customer": mask_name(o["user_name"]),
                "items_count": sum(i["qty"] for i in o["items"]),
                "is_mine": is_mine,
                "created_at": o["created_at"],
            }
        )
    return {
        "queue": entries,
        "queue_length": position,
        "my_position": my_position,
        # Any order takes a minimum of 2 hours to prepare
        "est_wait_minutes": max(MIN_PREP_MINUTES, my_position * EST_MINUTES_PER_ORDER)
        if my_position
        else None,
        "min_prep_minutes": MIN_PREP_MINUTES,
        "my_active_order": my_active,
    }


@api_router.patch("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "placed":
        raise HTTPException(status_code=400, detail="Order can only be cancelled while in queue")
    await _set_order_status(order, "cancelled")
    return {"cancelled": True}


async def _set_order_status(order: dict, new_status: str):
    if new_status == "cancelled" and order.get("source") == "menu":
        for it in order["items"]:
            if it.get("menu_item_id"):
                await db.menu_items.update_one(
                    {"id": it["menu_item_id"]}, {"$inc": {"available_qty": it["qty"]}}
                )
    await db.orders.update_one(
        {"id": order["id"]},
        {
            "$set": {"status": new_status},
            "$push": {"status_history": {"status": new_status, "at": iso_now()}},
        },
    )


async def _purge_user(user_id: str):
    """Hard-delete a user and their data, restocking any in-progress menu orders
    so the email is freed for re-signup and no personal data lingers."""
    active = await db.orders.find(
        {"user_id": user_id, "status": {"$in": ACTIVE_STATUSES}, "source": "menu"}
    ).to_list(100)
    for o in active:
        for it in o.get("items", []):
            if it.get("menu_item_id"):
                await db.menu_items.update_one(
                    {"id": it["menu_item_id"]}, {"$inc": {"available_qty": it["qty"]}}
                )
    await db.orders.delete_many({"user_id": user_id})
    await db.custom_requests.delete_many({"user_id": user_id})
    await db.interests.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})


# ---------- custom requests ----------
@api_router.post("/requests")
async def create_request(payload: RequestIn, user: dict = Depends(get_current_user)):
    req = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user["phone"],
        "message": payload.message.strip(),
        "status": "pending",
        "admin_reply": None,
        "quoted_price": None,
        "converted_order_id": None,
        "created_at": iso_now(),
        "replied_at": None,
    }
    await db.custom_requests.insert_one({**req})
    return req


@api_router.get("/requests/my")
async def my_requests(user: dict = Depends(get_current_user)):
    return (
        await db.custom_requests.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(100)
    )


@api_router.post("/requests/{request_id}/accept")
async def accept_request(request_id: str, user: dict = Depends(get_current_user)):
    req = await db.custom_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "approved":
        raise HTTPException(status_code=400, detail="Request is not approved yet")
    if not (await get_settings())["kitchen_open"]:
        raise HTTPException(status_code=400, detail="The kitchen is closed right now — please check back soon")
    existing = await db.orders.find_one({"user_id": user["id"], "status": {"$in": ACTIVE_STATUSES}})
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active order in the queue")
    dish = req["message"][:60]
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user["phone"],
        "items": [{"menu_item_id": None, "name": f"Custom: {dish}", "price": req["quoted_price"], "qty": 1}],
        "total": req["quoted_price"],
        "note": "Custom chef request",
        "status": "placed",
        "payment_method": "cash_on_pickup",
        "source": "custom_request",
        "created_at": iso_now(),
        "status_history": [{"status": "placed", "at": iso_now()}],
    }
    await db.orders.insert_one({**order})
    await db.custom_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "converted", "converted_order_id": order["id"]}},
    )
    return order


# ---------- admin ----------
@api_router.get("/admin/orders")
async def admin_orders(admin: dict = Depends(require_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", 1).to_list(300)
    position = 0
    for o in orders:
        if o["status"] in IN_LINE_STATUSES:
            position += 1
            o["position"] = position
        else:
            o["position"] = None
    return orders


@api_router.patch("/admin/orders/{order_id}/status")
async def admin_set_status(order_id: str, payload: StatusIn, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await _set_order_status(order, payload.status)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.get("/admin/requests")
async def admin_requests(admin: dict = Depends(require_admin)):
    return (
        await db.custom_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    )


@api_router.post("/admin/requests/{request_id}/reply")
async def admin_reply_request(
    request_id: str, payload: RequestReplyIn, admin: dict = Depends(require_admin)
):
    req = await db.custom_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] not in ["pending"]:
        raise HTTPException(status_code=400, detail="Request already answered")
    if payload.decision == "approved" and payload.price is None:
        raise HTTPException(status_code=400, detail="Price is required to approve a request")
    default_msg = (
        "Yes chef can make this! Confirm to join the queue."
        if payload.decision == "approved"
        else "Sorry, we can't make this today. Try the menu!"
    )
    await db.custom_requests.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": payload.decision,
                "admin_reply": payload.message.strip() or default_msg,
                "quoted_price": payload.price if payload.decision == "approved" else None,
                "replied_at": iso_now(),
            }
        },
    )
    # Tell the customer the kitchen answered their wish.
    await _send_push(
        await _user_push_tokens(req["user_id"]),
        "The kitchen replied to your wish 🍲",
        "Tap to see the chef's response in Omega's Kitchen.",
        {"type": "request_reply", "request_id": request_id},
    )
    return await db.custom_requests.find_one({"id": request_id}, {"_id": 0})


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    in_queue = await db.orders.count_documents({"status": {"$in": IN_LINE_STATUSES}})
    ready = await db.orders.count_documents({"status": "ready"})
    pending_requests = await db.custom_requests.count_documents({"status": "pending"})
    todays_items = await db.menu_items.count_documents({"date": today_str()})
    completed_today = await db.orders.count_documents(
        {"status": "completed", "created_at": {"$gte": today_str()}}
    )
    total_users = await db.users.count_documents({"role": "user"})
    return {
        "in_queue": in_queue,
        "ready": ready,
        "pending_requests": pending_requests,
        "todays_items": todays_items,
        "completed_today": completed_today,
        "total_users": total_users,
    }


# ---------- admin: users ----------
@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = (
        await db.users.find({}, {"_id": 0, "password_hash": 0, "totp_secret": 0})
        .sort("created_at", -1)
        .to_list(1000)
    )
    counts: dict = {}
    async for row in db.orders.aggregate([{"$group": {"_id": "$user_id", "c": {"$sum": 1}}}]):
        counts[row["_id"]] = row["c"]
    for u in users:
        u["order_count"] = counts.get(u["id"], 0)
        u["twofa_enabled"] = bool(u.get("twofa_enabled"))
        u["is_active"] = u.get("is_active", True)
    return {"count": len(users), "users": users}


@api_router.patch("/admin/users/{user_id}/active")
async def set_user_active(
    user_id: str, payload: UserActiveIn, admin: dict = Depends(require_admin)
):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts can't be disabled")
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": payload.is_active}})
    return {"id": user_id, "is_active": payload.is_active}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts can't be removed")
    await _purge_user(user_id)
    return {"deleted": True}


@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Use change password for admin accounts")
    temp = gen_temp_password()
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(temp)}})
    return {"temp_password": temp}


# ---------- admin: two-step verification (TOTP) ----------
@api_router.post("/admin/2fa/setup")
async def setup_2fa(admin: dict = Depends(require_admin)):
    secret = pyotp.random_base32()
    await db.users.update_one({"id": admin["id"]}, {"$set": {"totp_secret": secret}})
    uri = pyotp.TOTP(secret).provisioning_uri(name=admin["email"], issuer_name=TWOFA_ISSUER)
    buf = io.BytesIO()
    qrcode.make(uri).save(buf, format="PNG")
    qr_data_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return {"secret": secret, "otpauth_uri": uri, "qr_data_uri": qr_data_uri}


@api_router.post("/admin/2fa/enable")
async def enable_2fa(payload: TwoFACodeIn, admin: dict = Depends(require_admin)):
    doc = await db.users.find_one({"id": admin["id"]}, {"_id": 0})
    secret = (doc or {}).get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Start the setup first")
    if not pyotp.TOTP(secret).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Incorrect code — try again")
    await db.users.update_one({"id": admin["id"]}, {"$set": {"twofa_enabled": True}})
    return {"twofa_enabled": True}


@api_router.post("/admin/2fa/disable")
async def disable_2fa(payload: TwoFACodeIn, admin: dict = Depends(require_admin)):
    doc = await db.users.find_one({"id": admin["id"]}, {"_id": 0})
    secret = (doc or {}).get("totp_secret")
    if not secret or not pyotp.TOTP(secret).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Incorrect code — try again")
    await db.users.update_one(
        {"id": admin["id"]}, {"$set": {"twofa_enabled": False}, "$unset": {"totp_secret": ""}}
    )
    return {"twofa_enabled": False}


# ---------- push notifications ----------
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _send_push(tokens: List[str], title: str, body: str, data: Optional[dict] = None):
    """Best-effort Expo push. Runs off the event loop and never raises into the request path."""
    valid = [t for t in (tokens or []) if isinstance(t, str) and t.startswith("ExponentPushToken")]
    if not valid:
        return
    messages = [
        {"to": t, "title": title, "body": body, "sound": "default", "data": data or {}}
        for t in valid
    ]

    def _post():
        import requests

        for i in range(0, len(messages), 100):  # Expo accepts up to 100 messages per request
            requests.post(
                EXPO_PUSH_URL,
                json=messages[i : i + 100],
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=15,
            )

    try:
        await asyncio.to_thread(_post)
    except Exception as exc:  # a notification hiccup must never break the admin action
        logging.getLogger("omega").warning("push send failed: %s", exc)


async def _customer_push_tokens() -> List[str]:
    tokens: List[str] = []
    async for u in db.users.find(
        {"role": "user", "is_active": {"$ne": False}}, {"_id": 0, "push_tokens": 1}
    ):
        tokens.extend(u.get("push_tokens") or [])
    return list(set(tokens))


async def _user_push_tokens(user_id: str) -> List[str]:
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "push_tokens": 1})
    return (doc or {}).get("push_tokens") or []


@api_router.post("/me/push-token")
async def register_push_token(payload: PushTokenIn, user: dict = Depends(get_current_user)):
    # One account can have several devices; $addToSet keeps the token set deduplicated.
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"push_tokens": payload.token}})
    return {"ok": True}


# ---------- settings ----------
@api_router.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    return await get_settings()


@api_router.put("/admin/settings")
async def update_settings(payload: SettingsIn, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    was_open = (await get_settings())["kitchen_open"]
    if updates:
        await db.settings.update_one({"id": "app"}, {"$set": updates}, upsert=True)
    # Kitchen just flipped offline → online: let every customer know they can order again.
    if payload.kitchen_open is True and not was_open:
        await _send_push(
            await _customer_push_tokens(),
            "Omega's Kitchen is now online 🍳",
            "We're taking orders again — open the app to see today's menu and pre-order.",
            {"type": "kitchen_online"},
        )
    return await get_settings()


@api_router.get("/health")
async def health():
    # Cheap, DB-free liveness check used by the keep-alive pinger to avoid free-tier cold starts.
    return {"status": "ok"}


# ---------- seed ----------
@app.on_event("startup")
async def seed():
    await db.users.create_index("email", unique=True)
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "name": "Omega Kitchen",
                "email": ADMIN_EMAIL,
                "phone": "+910000000000",
                "role": "admin",
                "password_hash": hash_password(ADMIN_PASSWORD),
                "is_active": True,
                "created_at": iso_now(),
            }
        )
        logger.info("Seeded admin account")
    else:
        # Keep the admin password in sync with ADMIN_PASSWORD so it can be reset from the
        # Render dashboard at any time (Render is the source of truth for the admin login).
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {
                "password_hash": hash_password(ADMIN_PASSWORD),
                "role": "admin",
                "is_active": True,
            }},
        )
        logger.info("Re-synced admin account from environment")


app.include_router(api_router)

# Phase 2: password-reset endpoints live in their own module (avoids edit collisions).
from email_reset import reset_router  # noqa: E402

app.include_router(reset_router)

app.add_middleware(
    CORSMiddleware,
    # Bearer-token auth only (no cookies), so credentials aren't needed — and pairing
    # allow_credentials=True with a "*" origin is invalid per the CORS spec.
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
