import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "omega_auth_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getToken(): Promise<string | null> {
  const t = await storage.secureGet(TOKEN_KEY, "");
  return t ? String(t) : null;
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any } = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let detail = "Something went wrong";
    try {
      const j = await res.json();
      if (typeof j.detail === "string") detail = j.detail;
      else if (Array.isArray(j.detail) && j.detail[0]?.msg) detail = j.detail[0].msg;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

// ---------- types ----------
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  is_active?: boolean;
  twofa_enabled?: boolean;
  credit?: number;
  referral_code?: string;
  referral_count?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  available_qty: number;
  is_available: boolean;
  interested_count: number;
  not_interested_count: number;
  my_interest: boolean | null;
}

export interface OrderItem {
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  items: OrderItem[];
  total: number;
  credit_applied?: number;
  note: string;
  status: string;
  payment_method: string;
  source: string;
  created_at: string;
  position?: number | null;
}

export interface QueueEntry {
  id: string;
  position: number | null;
  status: string;
  customer: string;
  items_count: number;
  is_mine: boolean;
  created_at: string;
}

export interface QueueResponse {
  queue: QueueEntry[];
  queue_length: number;
  my_position: number | null;
  est_wait_minutes: number | null;
  my_active_order: Order | null;
}

export interface CustomRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  message: string;
  status: "pending" | "approved" | "rejected" | "converted";
  admin_reply: string | null;
  quoted_price: number | null;
  converted_order_id: string | null;
  created_at: string;
  replied_at: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  is_active: boolean;
  twofa_enabled: boolean;
  order_count: number;
  credit: number;
  referral_count: number;
  created_at: string;
}

export interface Referral {
  referral_code: string;
  referral_count: number;
  credit: number;
  reward_per_referral: number;
  referred_bonus: number;
}

export interface AppSettings {
  kitchen_open: boolean;
  announcement: string;
}

export interface TwoFASetup {
  secret: string;
  otpauth_uri: string;
  qr_data_uri: string;
}

export interface BroadcastResult {
  recipients: number;
  sent: number;
  provider: string;
}
