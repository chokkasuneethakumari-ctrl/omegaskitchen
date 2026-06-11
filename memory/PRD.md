# Omega's Kitchen — PRD

## Original Problem Statement
Build a mobile app "Omega's Kitchen" — a first-in-first-out (FIFO) pre-order kitchen where users pre-order food or ask the kitchen to cook what they want (admin replies possible/not with price), today's menu is posted daily and users react whether they're interested, with login/signup and a "Home Delivery — Coming Soon" teaser. Make it ultimate/premium.

## User Choices
- Orders: pre-order from today's menu + custom "ask the chef" requests with admin approval; FIFO queue
- Admin login within the same app (role-based)
- Auth: JWT custom (email + phone + password); phone captured for order confirmation
- Payment: cash on pickup now; Stripe/Razorpay online payment requested (pending API keys)
- Design: "bestest possible" → design agent chose iOS-Native Clean, warm Terracotta/Ochre palette, Geist fonts

## Architecture
- Frontend: Expo (expo-router), tabs (Menu / Queue / Ask Chef / Profile), admin dashboard at /admin
- Backend: FastAPI (port 8001, /api prefix), JWT (pyjwt + bcrypt), MongoDB (motor, uuid string ids, _id excluded)
- Polling: queue (8s), requests (10s), admin (12s)
- Keyboard: react-native-keyboard-controller (KeyboardProvider, KeyboardAwareScrollView)

## Credentials
- Admin: admin@omegaskitchen.com / OmegaAdmin2026! (seeded on startup)
- Test user: ravi@test.com / Test1234!

## Implemented (2026-06-10) — MVP ✅ (tested: 27/27 backend, all frontend flows pass)
- JWT auth: register (name/email/phone/password), login, /auth/me, role-based routing (user → tabs, admin → dashboard)
- Today's Menu: seeded 5 dishes, featured hero, category chips, interested/not-interested reactions with counts
- Pre-order: bottom sheet (qty stepper, note, cash-on-pickup), one active order per user, qty decrement/restore
- Live FIFO Queue: positions, est wait (15 min/order), progress steps (In Queue→Cooking→Ready), masked customer names, sticky position banner, cancel while placed
- Ask the Chef: chat-style custom requests, quick-idea chips, admin approve (price) / reject, user confirms approved request into queue
- Admin dashboard: stats row, Queue segment (advance placed→cooking→ready→completed, cancel), Requests segment (Reply & Set Price sheet), Menu segment (post dish w/ photo presets, availability toggle, delete)
- Home Delivery "Coming Soon" badges (welcome, home banner, profile)
- Profile: identity card, phone-for-confirmation, order history, sign out

## Iteration 2 (2026-06-10) ✅
- Online payment explicitly skipped per user (cash on pickup only)
- Removed menu auto-seed — admin adds/removes dishes daily via dashboard
- "Ask Chef" rebranded to **Wish Kitchen** (tab: "Wishes", sparkles icon)
- Min 2-hr prep rule: backend `est_wait_minutes = max(120, position*15)` + `min_prep_minutes` field; prep-time notes in pre-order sheet, queue card, wish kitchen
- In-app order notifications: OrderStatusWatcher in tabs layout polls every 12s, toasts on cooking / ready / picked-up transitions

## Backlog (prioritized)
- P1: Real push notifications for order-ready (Emergent-managed; needs google-services.json + builds — only on user request)
- P1: Daily menu auto-reset / menu scheduling for future dates
- P2: Image upload (base64/object storage) for admin dishes instead of preset photos
- P2: Ratings/feedback after pickup; repeat-order shortcut
- P2: Backend hardening: atomic qty decrement, split server.py into routers

## Notes
- Online payment is NOT implemented yet — cash on pickup only (user must supply Stripe/Razorpay keys)
- Deprecated shadow* style warnings are web-preview-only; native unaffected
