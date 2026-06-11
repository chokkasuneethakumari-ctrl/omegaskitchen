"""Omega's Kitchen — backend regression suite."""
import time
import uuid
import pytest
import requests

BASE = "https://omega-kitchen.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@omegaskitchen.com"
ADMIN_PASSWORD = "OmegaAdmin2026!"


def _unique():
    return uuid.uuid4().hex[:8]


# ---------- shared session helpers ----------
def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_ctx():
    """Create a fresh user for this test run."""
    suffix = _unique()
    email = f"test_user_{suffix}@test.com"
    phone = f"+9198{suffix[:8].rjust(8, '0')}"
    payload = {"name": f"Test User {suffix}", "email": email, "phone": phone, "password": "Test1234!"}
    r = requests.post(f"{BASE}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "phone": phone, "password": "Test1234!"}


@pytest.fixture(scope="module")
def user_token(user_ctx):
    return user_ctx["token"]


# ---------- AUTH ----------
class TestAuth:
    def test_register_duplicate_email(self, user_ctx):
        r = requests.post(f"{BASE}/auth/register", json={
            "name": "Dup", "email": user_ctx["email"], "phone": "+91" + _unique()[:8].rjust(8, "0"),
            "password": "Test1234!"
        })
        assert r.status_code == 400
        assert "Email" in r.json().get("detail", "")

    def test_register_duplicate_phone(self, user_ctx):
        r = requests.post(f"{BASE}/auth/register", json={
            "name": "Dup", "email": f"TEST_other_{_unique()}@t.com",
            "phone": user_ctx["phone"], "password": "Test1234!"
        })
        assert r.status_code == 400

    def test_login_success(self, user_ctx):
        r = requests.post(f"{BASE}/auth/login", json={"email": user_ctx["email"], "password": user_ctx["password"]})
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and body["user"]["email"] == user_ctx["email"]

    def test_login_bad_password(self, user_ctx):
        r = requests.post(f"{BASE}/auth/login", json={"email": user_ctx["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_bearer(self, user_token, user_ctx):
        r = requests.get(f"{BASE}/auth/me", headers=_auth_headers(user_token))
        assert r.status_code == 200
        assert r.json()["email"] == user_ctx["email"]

    def test_me_without_bearer(self):
        r = requests.get(f"{BASE}/auth/me")
        assert r.status_code == 401


# ---------- MENU ----------
class TestMenu:
    def test_menu_today(self, user_token):
        r = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token))
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        assert len(data["items"]) >= 1
        item = data["items"][0]
        for k in ("id", "name", "price", "interested_count", "not_interested_count", "my_interest"):
            assert k in item, f"missing key {k}"

    def test_interest_toggle_cycle(self, user_token):
        items = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
        target = items[0]
        # set interested True
        r = requests.post(f"{BASE}/menu/{target['id']}/interest",
                          headers=_auth_headers(user_token), json={"interested": True})
        assert r.status_code == 200
        assert r.json()["my_interest"] is True
        # toggle to False (changes vote)
        r = requests.post(f"{BASE}/menu/{target['id']}/interest",
                          headers=_auth_headers(user_token), json={"interested": False})
        assert r.json()["my_interest"] is False
        # same again → removes
        r = requests.post(f"{BASE}/menu/{target['id']}/interest",
                          headers=_auth_headers(user_token), json={"interested": False})
        assert r.json()["my_interest"] is None

    def test_non_admin_cannot_create_menu(self, user_token):
        r = requests.post(f"{BASE}/menu", headers=_auth_headers(user_token),
                          json={"name": "X", "price": 10})
        assert r.status_code == 403


# ---------- ADMIN MENU CRUD ----------
class TestAdminMenu:
    created_id = None

    def test_admin_create_menu(self, admin_token):
        r = requests.post(f"{BASE}/menu", headers=_auth_headers(admin_token), json={
            "name": "TEST_AdminDish", "description": "tmp", "price": 99,
            "category": "Curries", "image_url": "", "available_qty": 5,
        })
        assert r.status_code == 200
        item = r.json()
        assert item["name"] == "TEST_AdminDish" and item["available_qty"] == 5
        TestAdminMenu.created_id = item["id"]

    def test_admin_toggle_availability(self, admin_token):
        assert TestAdminMenu.created_id
        r = requests.put(f"{BASE}/menu/{TestAdminMenu.created_id}",
                         headers=_auth_headers(admin_token), json={"is_available": False})
        assert r.status_code == 200
        assert r.json()["is_available"] is False

    def test_admin_delete_menu(self, admin_token):
        assert TestAdminMenu.created_id
        r = requests.delete(f"{BASE}/menu/{TestAdminMenu.created_id}",
                            headers=_auth_headers(admin_token))
        assert r.status_code == 200


# ---------- ORDERS ----------
class TestOrders:
    order_id = None

    def test_create_order(self, user_token):
        items = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
        avail = [i for i in items if i.get("is_available", True) and i["available_qty"] > 0]
        target = avail[0]
        before_qty = target["available_qty"]
        r = requests.post(f"{BASE}/orders", headers=_auth_headers(user_token),
                          json={"items": [{"menu_item_id": target["id"], "qty": 1}], "note": "TEST"})
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "placed"
        assert order["total"] == target["price"]
        TestOrders.order_id = order["id"]
        # verify qty decremented
        items2 = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
        new_qty = next(i["available_qty"] for i in items2 if i["id"] == target["id"])
        assert new_qty == before_qty - 1

    def test_second_active_order_rejected(self, user_token):
        items = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
        r = requests.post(f"{BASE}/orders", headers=_auth_headers(user_token),
                          json={"items": [{"menu_item_id": items[1]["id"], "qty": 1}]})
        assert r.status_code == 400

    def test_queue_has_my_position(self, user_token):
        r = requests.get(f"{BASE}/orders/queue", headers=_auth_headers(user_token))
        assert r.status_code == 200
        data = r.json()
        assert data["my_position"] is not None
        assert data["est_wait_minutes"] is not None
        assert data["my_active_order"] is not None
        assert data["my_active_order"]["id"] == TestOrders.order_id

    def test_cancel_order_restores_qty(self, user_token):
        assert TestOrders.order_id
        # snapshot qty
        order = requests.get(f"{BASE}/orders/my", headers=_auth_headers(user_token)).json()[0]
        mid = order["items"][0]["menu_item_id"]
        qty_before_cancel = next(i["available_qty"] for i in
                                 requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
                                 if i["id"] == mid)
        r = requests.patch(f"{BASE}/orders/{TestOrders.order_id}/cancel",
                           headers=_auth_headers(user_token))
        assert r.status_code == 200
        qty_after = next(i["available_qty"] for i in
                         requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
                         if i["id"] == mid)
        assert qty_after == qty_before_cancel + 1

    def test_cancel_after_completed_fails(self, user_token, admin_token):
        # create new order, admin moves to cooking, user cancel should fail
        items = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
        avail = [i for i in items if i.get("is_available", True) and i["available_qty"] > 0][0]
        r = requests.post(f"{BASE}/orders", headers=_auth_headers(user_token),
                          json={"items": [{"menu_item_id": avail["id"], "qty": 1}]})
        assert r.status_code == 200
        oid = r.json()["id"]
        # admin → cooking
        s = requests.patch(f"{BASE}/admin/orders/{oid}/status",
                           headers=_auth_headers(admin_token), json={"status": "cooking"})
        assert s.status_code == 200
        # user cancel now should fail
        c = requests.patch(f"{BASE}/orders/{oid}/cancel", headers=_auth_headers(user_token))
        assert c.status_code == 400
        # cleanup: admin completes
        requests.patch(f"{BASE}/admin/orders/{oid}/status",
                       headers=_auth_headers(admin_token), json={"status": "ready"})
        requests.patch(f"{BASE}/admin/orders/{oid}/status",
                       headers=_auth_headers(admin_token), json={"status": "completed"})


# ---------- CUSTOM REQUESTS ----------
class TestRequests:
    req_id_approved = None
    req_id_rejected = None

    def test_create_request(self, user_token):
        r = requests.post(f"{BASE}/requests", headers=_auth_headers(user_token),
                          json={"message": "TEST_Mutton biryani family pack"})
        assert r.status_code == 200
        TestRequests.req_id_approved = r.json()["id"]
        r2 = requests.post(f"{BASE}/requests", headers=_auth_headers(user_token),
                           json={"message": "TEST_Sushi platter"})
        TestRequests.req_id_rejected = r2.json()["id"]

    def test_my_requests(self, user_token):
        r = requests.get(f"{BASE}/requests/my", headers=_auth_headers(user_token))
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert TestRequests.req_id_approved in ids

    def test_admin_reply_approve_requires_price(self, admin_token):
        r = requests.post(f"{BASE}/admin/requests/{TestRequests.req_id_approved}/reply",
                          headers=_auth_headers(admin_token),
                          json={"decision": "approved"})
        assert r.status_code == 400

    def test_admin_reply_approve_with_price(self, admin_token):
        r = requests.post(f"{BASE}/admin/requests/{TestRequests.req_id_approved}/reply",
                          headers=_auth_headers(admin_token),
                          json={"decision": "approved", "price": 350, "message": "Sure chef!"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "approved" and body["quoted_price"] == 350

    def test_admin_reply_reject(self, admin_token):
        r = requests.post(f"{BASE}/admin/requests/{TestRequests.req_id_rejected}/reply",
                          headers=_auth_headers(admin_token),
                          json={"decision": "rejected"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_user_accept_approved_request_creates_order(self, user_token):
        r = requests.post(f"{BASE}/requests/{TestRequests.req_id_approved}/accept",
                          headers=_auth_headers(user_token))
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "placed"
        assert order["total"] == 350
        assert order["source"] == "custom_request"
        # verify request marked converted
        my = requests.get(f"{BASE}/requests/my", headers=_auth_headers(user_token)).json()
        conv = next(x for x in my if x["id"] == TestRequests.req_id_approved)
        assert conv["status"] == "converted"
        # cleanup: cancel
        requests.patch(f"{BASE}/orders/{order['id']}/cancel", headers=_auth_headers(user_token))


# ---------- ADMIN ----------
class TestAdmin:
    def test_non_admin_blocked(self, user_token):
        r = requests.get(f"{BASE}/admin/orders", headers=_auth_headers(user_token))
        assert r.status_code == 403
        r2 = requests.get(f"{BASE}/admin/stats", headers=_auth_headers(user_token))
        assert r2.status_code == 403

    def test_admin_orders_list(self, admin_token):
        r = requests.get(f"{BASE}/admin/orders", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_stats(self, admin_token):
        r = requests.get(f"{BASE}/admin/stats", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        keys = {"in_queue", "ready", "pending_requests", "todays_items", "completed_today"}
        assert keys.issubset(r.json().keys())

    def test_order_status_flow(self, admin_token, user_token):
        items = requests.get(f"{BASE}/menu/today", headers=_auth_headers(user_token)).json()["items"]
        avail = [i for i in items if i.get("is_available", True) and i["available_qty"] > 0][0]
        # create new order
        r = requests.post(f"{BASE}/orders", headers=_auth_headers(user_token),
                          json={"items": [{"menu_item_id": avail["id"], "qty": 1}]})
        assert r.status_code == 200
        oid = r.json()["id"]
        for status in ["cooking", "ready", "completed"]:
            s = requests.patch(f"{BASE}/admin/orders/{oid}/status",
                               headers=_auth_headers(admin_token), json={"status": status})
            assert s.status_code == 200, f"{status}: {s.text}"
            assert s.json()["status"] == status
