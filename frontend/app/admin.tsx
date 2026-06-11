import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AdminUser,
  api,
  AppSettings,
  BroadcastResult,
  CustomRequest,
  MenuItem,
  Order,
  TwoFASetup,
} from "@/src/api/client";
import Sheet from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, FOOD_IMAGES, formatPrice, R, SP, STATUS_META } from "@/src/theme";

type Segment = "queue" | "requests" | "menu" | "users" | "settings";

const CATEGORIES = ["Curries", "Rice", "Breads", "Combos", "Snacks", "Dessert"];

const NEXT_ACTION: Record<string, { next: string; label: string; icon: string }> = {
  placed: { next: "cooking", label: "Start Cooking", icon: "flame" },
  cooking: { next: "ready", label: "Mark Ready", icon: "checkmark-circle" },
  ready: { next: "completed", label: "Complete Pickup", icon: "bag-check" },
};

interface Stats {
  in_queue: number;
  ready: number;
  pending_requests: number;
  todays_items: number;
  completed_today: number;
  total_users: number;
}

export default function AdminScreen() {
  const { user, loading: authLoading, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();

  const [segment, setSegment] = useState<Segment>("queue");
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // reply sheet
  const [replyTarget, setReplyTarget] = useState<CustomRequest | null>(null);
  const [replyPrice, setReplyPrice] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);

  // add dish sheet
  const [addOpen, setAddOpen] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDesc, setDishDesc] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishQty, setDishQty] = useState("20");
  const [dishCategory, setDishCategory] = useState("Curries");
  const [dishImage, setDishImage] = useState(FOOD_IMAGES[0]);
  const [savingDish, setSavingDish] = useState(false);

  // users segment
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // settings segment
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const announcementInitialized = useRef(false);
  const [bcastSubject, setBcastSubject] = useState("");
  const [bcastMessage, setBcastMessage] = useState("");
  const [bcastBusy, setBcastBusy] = useState(false);

  // two-step verification
  const [twofaOn, setTwofaOn] = useState(!!user?.twofa_enabled);
  const [twofaSheet, setTwofaSheet] = useState<"setup" | "disable" | null>(null);
  const [twofaSetup, setTwofaSetup] = useState<TwoFASetup | null>(null);
  const [twofaCode, setTwofaCode] = useState("");
  const [twofaBusy, setTwofaBusy] = useState(false);

  // per-user actions (reset password / delete)
  const [userMenu, setUserMenu] = useState<AdminUser | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [userActionBusy, setUserActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, r, m, s, us, st] = await Promise.all([
        api<Order[]>("/admin/orders"),
        api<CustomRequest[]>("/admin/requests"),
        api<{ items: MenuItem[] }>("/menu/today"),
        api<Stats>("/admin/stats"),
        api<{ count: number; users: AdminUser[] }>("/admin/users"),
        api<AppSettings>("/settings"),
      ]);
      setOrders(o);
      setRequests(r);
      setMenu(m.items);
      setStats(s);
      setUsers(us.users);
      setSettings(st);
      if (!announcementInitialized.current) {
        setAnnouncementDraft(st.announcement);
        announcementInitialized.current = true;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      load();
      const interval = setInterval(load, 12000);
      return () => clearInterval(interval);
    }
  }, [user, load]);

  if (authLoading) return null;
  if (!user) return <Redirect href="/" />;
  if (user.role !== "admin") return <Redirect href="/(tabs)/home" />;

  const advance = async (order: Order, status: string) => {
    try {
      await api(`/admin/orders/${order.id}/status`, { method: "PATCH", body: { status } });
      toast.show(`Order moved to ${STATUS_META[status]?.label}`);
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't update order", "error");
    }
  };

  const openReply = (req: CustomRequest) => {
    setReplyPrice("");
    setReplyMessage("");
    setReplyTarget(req);
  };

  const sendReply = async (decision: "approved" | "rejected") => {
    if (!replyTarget) return;
    if (decision === "approved" && (!replyPrice || isNaN(Number(replyPrice)))) {
      toast.show("Enter a price to approve", "error");
      return;
    }
    setReplying(true);
    try {
      await api(`/admin/requests/${replyTarget.id}/reply`, {
        method: "POST",
        body: {
          decision,
          message: replyMessage,
          price: decision === "approved" ? Number(replyPrice) : undefined,
        },
      });
      toast.show(decision === "approved" ? "Request approved ✅" : "Request declined");
      setReplyTarget(null);
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't reply", "error");
    } finally {
      setReplying(false);
    }
  };

  const saveDish = async () => {
    if (!dishName.trim() || !dishPrice || isNaN(Number(dishPrice))) {
      toast.show("Dish name and a valid price are required", "error");
      return;
    }
    setSavingDish(true);
    try {
      await api("/menu", {
        method: "POST",
        body: {
          name: dishName.trim(),
          description: dishDesc.trim(),
          price: Number(dishPrice),
          category: dishCategory,
          image_url: dishImage,
          available_qty: Number(dishQty) || 20,
        },
      });
      toast.show("Dish posted to today's menu 🍛");
      setAddOpen(false);
      setDishName("");
      setDishDesc("");
      setDishPrice("");
      setDishQty("20");
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't add dish", "error");
    } finally {
      setSavingDish(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api(`/menu/${item.id}`, { method: "PUT", body: { is_available: !item.is_available } });
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't update", "error");
    }
  };

  const deleteDish = async (item: MenuItem) => {
    try {
      await api(`/menu/${item.id}`, { method: "DELETE" });
      toast.show("Dish removed", "info");
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't delete", "error");
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/");
  };

  const toggleUserActive = async (u: AdminUser) => {
    try {
      await api(`/admin/users/${u.id}/active`, {
        method: "PATCH",
        body: { is_active: !u.is_active },
      });
      toast.show(u.is_active ? "User blocked" : "User unblocked", "info");
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't update user", "error");
    }
  };

  const openUserMenu = (u: AdminUser) => {
    setTempPw(null);
    setConfirmDelete(false);
    setUserMenu(u);
  };

  const resetUserPassword = async (u: AdminUser) => {
    setUserActionBusy(true);
    try {
      const res = await api<{ temp_password: string }>(`/admin/users/${u.id}/reset-password`, {
        method: "POST",
      });
      setTempPw(res.temp_password);
    } catch (e: any) {
      toast.show(e.message || "Couldn't reset password", "error");
    } finally {
      setUserActionBusy(false);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    setUserActionBusy(true);
    try {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      toast.show("User removed", "info");
      setUserMenu(null);
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't remove user", "error");
    } finally {
      setUserActionBusy(false);
    }
  };

  const saveSettings = async (patch: Partial<AppSettings>) => {
    try {
      const res = await api<AppSettings>("/admin/settings", { method: "PUT", body: patch });
      setSettings(res);
      if (patch.kitchen_open !== undefined) {
        toast.show(patch.kitchen_open ? "Kitchen is now open" : "Kitchen is now closed", "info");
      } else {
        toast.show("Announcement saved");
      }
    } catch (e: any) {
      toast.show(e.message || "Couldn't save settings", "error");
    }
  };

  const sendBroadcast = async () => {
    setBcastBusy(true);
    try {
      const res = await api<BroadcastResult>("/admin/broadcast", {
        method: "POST",
        body: { subject: bcastSubject.trim(), message: bcastMessage.trim() },
      });
      if (res.provider === "none") {
        toast.show("Email isn't set up yet — add RESEND_API_KEY in Render", "error");
      } else if (res.sent === 0) {
        toast.show("No subscribed customers to email yet", "info");
      } else {
        toast.show(`Sent to ${res.sent} customer${res.sent === 1 ? "" : "s"} ✅`);
        setBcastSubject("");
        setBcastMessage("");
      }
    } catch (e: any) {
      toast.show(e.message || "Couldn't send email", "error");
    } finally {
      setBcastBusy(false);
    }
  };

  const confirmBroadcast = () => {
    if (!bcastSubject.trim() || !bcastMessage.trim()) {
      toast.show("Add a subject and a message first", "error");
      return;
    }
    Alert.alert("Send offer email?", "This emails every customer who hasn't opted out of offers.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: sendBroadcast },
    ]);
  };

  const start2fa = async () => {
    try {
      const s = await api<TwoFASetup>("/admin/2fa/setup", { method: "POST" });
      setTwofaSetup(s);
      setTwofaCode("");
      setTwofaSheet("setup");
    } catch (e: any) {
      toast.show(e.message || "Couldn't start setup", "error");
    }
  };

  const enable2fa = async () => {
    if (twofaCode.length !== 6) {
      toast.show("Enter the 6-digit code", "error");
      return;
    }
    setTwofaBusy(true);
    try {
      await api("/admin/2fa/enable", { method: "POST", body: { code: twofaCode } });
      setTwofaOn(true);
      setTwofaSheet(null);
      toast.show("Two-step verification is on 🔒");
    } catch (e: any) {
      toast.show(e.message || "Couldn't enable", "error");
    } finally {
      setTwofaBusy(false);
    }
  };

  const disable2fa = async () => {
    if (twofaCode.length !== 6) {
      toast.show("Enter the 6-digit code", "error");
      return;
    }
    setTwofaBusy(true);
    try {
      await api("/admin/2fa/disable", { method: "POST", body: { code: twofaCode } });
      setTwofaOn(false);
      setTwofaSheet(null);
      toast.show("Two-step verification turned off", "info");
    } catch (e: any) {
      toast.show(e.message || "Couldn't disable", "error");
    } finally {
      setTwofaBusy(false);
    }
  };

  const activeOrders = orders.filter((o) => ["placed", "cooking", "ready"].includes(o.status));
  const pastOrders = orders
    .filter((o) => ["completed", "cancelled"].includes(o.status))
    .slice(-10)
    .reverse();
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const answeredRequests = requests.filter((r) => r.status !== "pending");
  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return [u.name, u.email, u.phone].some((f) => (f || "").toLowerCase().includes(q));
  });

  return (
    <View style={styles.container} testID="admin-screen">
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>OMEGA&apos;S KITCHEN</Text>
            <Text style={styles.title}>Kitchen Dashboard</Text>
          </View>
          <Pressable testID="admin-logout-button" style={styles.logoutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={20} color={C.error} />
          </Pressable>
        </View>

        {/* stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard} testID="stat-in-queue">
            <Text style={styles.statNum}>{stats?.in_queue ?? "—"}</Text>
            <Text style={styles.statLabel}>In queue</Text>
          </View>
          <View style={styles.statCard} testID="stat-pending-requests">
            <Text style={[styles.statNum, { color: C.warning }]}>
              {stats?.pending_requests ?? "—"}
            </Text>
            <Text style={styles.statLabel}>Asks</Text>
          </View>
          <View style={styles.statCard} testID="stat-ready">
            <Text style={[styles.statNum, { color: C.success }]}>{stats?.ready ?? "—"}</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
          <View style={styles.statCard} testID="stat-completed">
            <Text style={[styles.statNum, { color: C.textSecondary }]}>
              {stats?.completed_today ?? "—"}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        {/* segmented control */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segments}
          contentContainerStyle={{ gap: 4 }}
        >
          {(
            [
              { key: "queue", label: "Queue" },
              { key: "requests", label: "Requests" },
              { key: "menu", label: "Menu" },
              { key: "users", label: "Users" },
              { key: "settings", label: "Settings" },
            ] as { key: Segment; label: string }[]
          ).map((seg) => (
            <Pressable
              key={seg.key}
              testID={`admin-segment-${seg.key}`}
              onPress={() => setSegment(seg.key)}
              style={[styles.segmentItem, segment === seg.key && styles.segmentActive]}
            >
              <Text
                style={[styles.segmentText, segment === seg.key && styles.segmentTextActive]}
              >
                {seg.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xxl, gap: SP.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={C.brand}
            />
          }
        >
          {/* ---------- QUEUE ---------- */}
          {segment === "queue" && (
            <>
              {activeOrders.length === 0 && (
                <View style={styles.emptyCard} testID="admin-queue-empty">
                  <Ionicons name="checkmark-done-circle-outline" size={44} color={C.success} />
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptySub}>No active orders in the queue</Text>
                </View>
              )}
              {activeOrders.map((order) => {
                const action = NEXT_ACTION[order.status];
                return (
                  <View key={order.id} style={styles.orderCard} testID={`admin-order-${order.id}`}>
                    <View style={styles.orderTop}>
                      <View style={styles.posBadge}>
                        <Text style={styles.posBadgeText}>
                          {order.position ? `#${order.position}` : "✓"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderName}>{order.user_name}</Text>
                        <Text style={styles.orderPhone}>
                          <Ionicons name="call" size={11} color={C.textSecondary} />{" "}
                          {order.user_phone} · {dayjs(order.created_at).format("h:mm A")}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusChip,
                          { backgroundColor: STATUS_META[order.status]?.tint },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: STATUS_META[order.status]?.color },
                          ]}
                        >
                          {STATUS_META[order.status]?.label}
                        </Text>
                      </View>
                    </View>
                    {order.items.map((it, idx) => (
                      <Text key={idx} style={styles.orderItemText}>
                        {it.qty}× {it.name}
                      </Text>
                    ))}
                    {order.note ? (
                      <View style={styles.noteRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={13} color={C.warning} />
                        <Text style={styles.noteText}>{order.note}</Text>
                      </View>
                    ) : null}
                    <View style={styles.orderActions}>
                      <View>
                        <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
                        {order.credit_applied ? (
                          <Text style={styles.creditApplied}>
                            ₹{order.credit_applied} credit applied
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }} />
                      {order.status === "placed" && (
                        <Pressable
                          testID={`admin-cancel-${order.id}`}
                          style={styles.iconBtn}
                          onPress={() => advance(order, "cancelled")}
                        >
                          <Ionicons name="close" size={18} color={C.error} />
                        </Pressable>
                      )}
                      {action && (
                        <Pressable
                          testID={`admin-advance-${order.id}`}
                          style={styles.advanceBtn}
                          onPress={() => advance(order, action.next)}
                        >
                          <Ionicons name={action.icon as any} size={15} color="#FFF" />
                          <Text style={styles.advanceText}>{action.label}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
              {pastOrders.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Recent history</Text>
                  {pastOrders.map((order) => (
                    <View key={order.id} style={styles.historyRow}>
                      <Text style={styles.historyName} numberOfLines={1}>
                        {order.user_name} · {order.items.length} item(s)
                      </Text>
                      <Text
                        style={[styles.historyStatus, { color: STATUS_META[order.status]?.color }]}
                      >
                        {STATUS_META[order.status]?.label}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {/* ---------- REQUESTS ---------- */}
          {segment === "requests" && (
            <>
              {pendingRequests.length === 0 && (
                <View style={styles.emptyCard} testID="admin-requests-empty">
                  <Ionicons name="chatbubbles-outline" size={44} color={C.borderStrong} />
                  <Text style={styles.emptyTitle}>No pending requests</Text>
                  <Text style={styles.emptySub}>Customer food wishes will appear here</Text>
                </View>
              )}
              {pendingRequests.map((req) => (
                <View key={req.id} style={styles.reqCard} testID={`admin-request-${req.id}`}>
                  <View style={styles.reqTop}>
                    <View style={styles.reqAvatar}>
                      <Text style={styles.reqAvatarText}>
                        {req.user_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqName}>{req.user_name}</Text>
                      <Text style={styles.reqTime}>
                        {dayjs(req.created_at).format("MMM D · h:mm A")} · {req.user_phone}
                      </Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: C.warningTint }]}>
                      <Text style={[styles.statusChipText, { color: C.warning }]}>Pending</Text>
                    </View>
                  </View>
                  <Text style={styles.reqMessage}>&quot;{req.message}&quot;</Text>
                  <Pressable
                    testID={`admin-reply-${req.id}`}
                    style={styles.replyBtn}
                    onPress={() => openReply(req)}
                  >
                    <Ionicons name="arrow-undo" size={15} color="#FFF" />
                    <Text style={styles.replyBtnText}>Reply & Set Price</Text>
                  </Pressable>
                </View>
              ))}
              {answeredRequests.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Answered</Text>
                  {answeredRequests.map((req) => (
                    <View key={req.id} style={styles.historyRow}>
                      <Text style={styles.historyName} numberOfLines={1}>
                        {req.user_name}: {req.message}
                      </Text>
                      <Text
                        style={[
                          styles.historyStatus,
                          {
                            color:
                              req.status === "rejected"
                                ? C.error
                                : req.status === "converted"
                                  ? C.success
                                  : C.brand,
                          },
                        ]}
                      >
                        {req.status === "converted"
                          ? "In queue"
                          : req.status === "approved"
                            ? `OK · ${formatPrice(req.quoted_price)}`
                            : "Declined"}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {/* ---------- MENU ---------- */}
          {segment === "menu" && (
            <>
              <Pressable
                testID="admin-add-dish-button"
                style={styles.addBtn}
                onPress={() => setAddOpen(true)}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={styles.addBtnText}>Post a Dish to Today&apos;s Menu</Text>
              </Pressable>
              {menu.length === 0 && (
                <View style={styles.emptyCard} testID="admin-menu-empty">
                  <Ionicons name="restaurant-outline" size={44} color={C.borderStrong} />
                  <Text style={styles.emptyTitle}>No dishes posted today</Text>
                </View>
              )}
              {menu.map((item) => (
                <View key={item.id} style={styles.menuCard} testID={`admin-menu-${item.id}`}>
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.menuImage}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.menuMeta}>
                      {formatPrice(item.price)} · {item.available_qty} left
                    </Text>
                    <View style={styles.interestRow}>
                      <Ionicons name="thumbs-up" size={12} color={C.success} />
                      <Text style={styles.interestCount}>{item.interested_count}</Text>
                      <Ionicons name="thumbs-down" size={12} color={C.textTertiary} />
                      <Text style={styles.interestCount}>{item.not_interested_count}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "center", gap: SP.sm }}>
                    <Switch
                      testID={`admin-toggle-${item.id}`}
                      value={item.is_available}
                      onValueChange={() => toggleAvailability(item)}
                      trackColor={{ true: C.brand, false: C.borderStrong }}
                      thumbColor="#FFF"
                    />
                    <Pressable
                      testID={`admin-delete-${item.id}`}
                      style={styles.iconBtn}
                      onPress={() => deleteDish(item)}
                    >
                      <Ionicons name="trash-outline" size={17} color={C.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ---------- USERS ---------- */}
          {segment === "users" && (
            <>
              <View style={styles.usersHeaderCard}>
                <View>
                  <Text style={styles.usersCount}>{users.length}</Text>
                  <Text style={styles.usersCountLabel}>Registered users</Text>
                </View>
                <Ionicons name="people" size={34} color={C.brand} />
              </View>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={C.textTertiary} />
                <TextInput
                  testID="admin-user-search"
                  style={styles.searchInput}
                  placeholder="Search name, email or phone"
                  placeholderTextColor={C.textTertiary}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  autoCapitalize="none"
                />
              </View>
              {filteredUsers.length === 0 && (
                <View style={styles.emptyCard} testID="admin-users-empty">
                  <Ionicons name="people-outline" size={44} color={C.borderStrong} />
                  <Text style={styles.emptyTitle}>No users found</Text>
                </View>
              )}
              {filteredUsers.map((u) => (
                <View key={u.id} style={styles.userCard} testID={`admin-user-${u.id}`}>
                  <View style={styles.reqAvatar}>
                    <Text style={styles.reqAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {u.name}
                      </Text>
                      {u.role === "admin" && (
                        <View style={styles.adminTag}>
                          <Text style={styles.adminTagText}>ADMIN</Text>
                        </View>
                      )}
                      {!u.is_active && (
                        <View style={styles.blockedTag}>
                          <Text style={styles.blockedTagText}>BLOCKED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userMeta} numberOfLines={1}>
                      {u.email}
                    </Text>
                    <Text style={styles.userMeta} numberOfLines={1}>
                      {u.phone} · {u.order_count} order{u.order_count === 1 ? "" : "s"} · joined{" "}
                      {dayjs(u.created_at).format("MMM D, YYYY")}
                    </Text>
                  </View>
                  {u.role !== "admin" && (
                    <View style={styles.userActions}>
                      <Pressable
                        testID={`admin-user-toggle-${u.id}`}
                        style={[
                          styles.blockBtn,
                          { backgroundColor: u.is_active ? C.errorTint : C.successTint },
                        ]}
                        onPress={() => toggleUserActive(u)}
                      >
                        <Ionicons
                          name={u.is_active ? "ban" : "checkmark-circle"}
                          size={18}
                          color={u.is_active ? C.error : C.success}
                        />
                      </Pressable>
                      <Pressable
                        testID={`admin-user-menu-${u.id}`}
                        style={[styles.blockBtn, { backgroundColor: C.surfaceTertiary }]}
                        onPress={() => openUserMenu(u)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color={C.textSecondary} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}

          {/* ---------- SETTINGS ---------- */}
          {segment === "settings" && (
            <>
              <View style={styles.settingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Kitchen status</Text>
                  <Text style={styles.settingSub}>
                    {settings?.kitchen_open
                      ? "Open — customers can place orders"
                      : "Closed — new orders are blocked"}
                  </Text>
                </View>
                <Switch
                  testID="admin-kitchen-toggle"
                  value={!!settings?.kitchen_open}
                  onValueChange={(v) => saveSettings({ kitchen_open: v })}
                  trackColor={{ true: C.success, false: C.borderStrong }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={styles.settingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Announcement banner</Text>
                  <Text style={styles.settingSub}>Shown on the customer home screen</Text>
                  <TextInput
                    testID="admin-announcement-input"
                    style={styles.announceInput}
                    placeholder="e.g. Fresh biryani at 7pm!"
                    placeholderTextColor={C.textTertiary}
                    value={announcementDraft}
                    onChangeText={setAnnouncementDraft}
                    multiline
                  />
                  <Pressable
                    testID="admin-announcement-save"
                    style={styles.saveSmallBtn}
                    onPress={() => saveSettings({ announcement: announcementDraft.trim() })}
                  >
                    <Text style={styles.saveSmallText}>Save announcement</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.settingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Email offer / newsletter</Text>
                  <Text style={styles.settingSub}>Emails every customer subscribed to offers</Text>
                  <TextInput
                    testID="admin-broadcast-subject"
                    style={styles.announceInput}
                    placeholder="Subject — e.g. Weekend special: 20% off biryani"
                    placeholderTextColor={C.textTertiary}
                    value={bcastSubject}
                    onChangeText={setBcastSubject}
                  />
                  <TextInput
                    testID="admin-broadcast-message"
                    style={[styles.announceInput, { minHeight: 88 }]}
                    placeholder="Write your message to customers…"
                    placeholderTextColor={C.textTertiary}
                    value={bcastMessage}
                    onChangeText={setBcastMessage}
                    multiline
                  />
                  <Pressable
                    testID="admin-broadcast-send"
                    style={[styles.saveSmallBtn, bcastBusy && { opacity: 0.6 }]}
                    onPress={confirmBroadcast}
                    disabled={bcastBusy}
                  >
                    <Text style={styles.saveSmallText}>
                      {bcastBusy ? "Sending…" : "Send to all customers"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.settingCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.twofaTitleRow}>
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color={twofaOn ? C.success : C.textSecondary}
                    />
                    <Text style={styles.settingTitle}>Two-step verification</Text>
                    {twofaOn && (
                      <View style={styles.onTag}>
                        <Text style={styles.onTagText}>ON</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.settingSub}>
                    {twofaOn
                      ? "Admin sign-in is protected by an authenticator app."
                      : "Require a code from an authenticator app at admin sign-in."}
                  </Text>
                  {twofaOn ? (
                    <Pressable
                      testID="admin-2fa-disable"
                      style={[styles.saveSmallBtn, { backgroundColor: C.errorTint }]}
                      onPress={() => {
                        setTwofaCode("");
                        setTwofaSheet("disable");
                      }}
                    >
                      <Text style={[styles.saveSmallText, { color: C.error }]}>Turn off</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      testID="admin-2fa-setup"
                      style={styles.saveSmallBtn}
                      onPress={start2fa}
                    >
                      <Text style={styles.saveSmallText}>Set up now</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Pressable testID="admin-settings-logout" style={styles.signOutRow} onPress={signOut}>
                <Ionicons name="log-out-outline" size={18} color={C.error} />
                <Text style={styles.signOutText}>Sign out of admin</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {/* reply sheet */}
      <Sheet
        visible={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title="Reply to request"
        testID="admin-reply-sheet"
      >
        {replyTarget && (
          <View>
            <Text style={styles.sheetQuote}>&quot;{replyTarget.message}&quot;</Text>
            <Text style={styles.sheetLabel}>Price (required to approve)</Text>
            <TextInput
              testID="reply-price-input"
              style={styles.sheetInput}
              placeholder="e.g. 180"
              placeholderTextColor={C.textTertiary}
              value={replyPrice}
              onChangeText={setReplyPrice}
              keyboardType="numeric"
            />
            <Text style={styles.sheetLabel}>Message (optional)</Text>
            <TextInput
              testID="reply-message-input"
              style={styles.sheetInput}
              placeholder="Yes! Ready in 40 min..."
              placeholderTextColor={C.textTertiary}
              value={replyMessage}
              onChangeText={setReplyMessage}
            />
            <View style={styles.sheetActions}>
              <Pressable
                testID="reject-request-button"
                style={styles.rejectBtn}
                onPress={() => sendReply("rejected")}
                disabled={replying}
              >
                <Text style={styles.rejectText}>Can&apos;t Make It</Text>
              </Pressable>
              <Pressable
                testID="approve-request-button"
                style={styles.approveBtn}
                onPress={() => sendReply("approved")}
                disabled={replying}
              >
                {replying ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.approveText}>Approve</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </Sheet>

      {/* add dish sheet */}
      <Sheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title="Post today's dish"
        testID="admin-add-dish-sheet"
      >
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetLabel}>Dish name</Text>
          <TextInput
            testID="dish-name-input"
            style={styles.sheetInput}
            placeholder="e.g. Chicken Chettinad"
            placeholderTextColor={C.textTertiary}
            value={dishName}
            onChangeText={setDishName}
          />
          <Text style={styles.sheetLabel}>Description</Text>
          <TextInput
            testID="dish-desc-input"
            style={styles.sheetInput}
            placeholder="Short appetizing description"
            placeholderTextColor={C.textTertiary}
            value={dishDesc}
            onChangeText={setDishDesc}
          />
          <View style={{ flexDirection: "row", gap: SP.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetLabel}>Price (₹)</Text>
              <TextInput
                testID="dish-price-input"
                style={styles.sheetInput}
                placeholder="180"
                placeholderTextColor={C.textTertiary}
                value={dishPrice}
                onChangeText={setDishPrice}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetLabel}>Portions</Text>
              <TextInput
                testID="dish-qty-input"
                style={styles.sheetInput}
                placeholder="20"
                placeholderTextColor={C.textTertiary}
                value={dishQty}
                onChangeText={setDishQty}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text style={styles.sheetLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: SP.md }}
            contentContainerStyle={{ gap: SP.sm }}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                testID={`dish-category-${cat}`}
                onPress={() => setDishCategory(cat)}
                style={[styles.catChip, dishCategory === cat && styles.catChipActive]}
              >
                <Text
                  style={[styles.catChipText, dishCategory === cat && { color: "#FFF" }]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.sheetLabel}>Photo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: SP.lg }}
            contentContainerStyle={{ gap: SP.sm }}
          >
            {FOOD_IMAGES.map((img, idx) => (
              <Pressable
                key={img}
                testID={`dish-image-${idx}`}
                onPress={() => setDishImage(img)}
              >
                <Image
                  source={{ uri: img }}
                  style={[styles.imageOption, dishImage === img && styles.imageOptionActive]}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            testID="save-dish-button"
            style={styles.approveBtn}
            onPress={saveDish}
            disabled={savingDish}
          >
            {savingDish ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.approveText}>Post Dish</Text>
            )}
          </Pressable>
        </ScrollView>
      </Sheet>

      {/* 2FA setup sheet */}
      <Sheet
        visible={twofaSheet === "setup"}
        onClose={() => setTwofaSheet(null)}
        title="Set up two-step verification"
        testID="admin-2fa-sheet"
      >
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.twofaStep}>
            1. Scan this QR with Google Authenticator, Authy, or any TOTP app.
          </Text>
          {twofaSetup && (
            <Image source={{ uri: twofaSetup.qr_data_uri }} style={styles.qr} contentFit="contain" />
          )}
          <Text style={styles.twofaStep}>Or enter this key manually:</Text>
          {twofaSetup && (
            <Text style={styles.secret} selectable>
              {twofaSetup.secret}
            </Text>
          )}
          <Text style={styles.twofaStep}>2. Enter the 6-digit code it shows:</Text>
          <TextInput
            testID="admin-2fa-code"
            style={[styles.sheetInput, styles.codeField]}
            placeholder="000000"
            placeholderTextColor={C.textTertiary}
            value={twofaCode}
            onChangeText={(t) => setTwofaCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Pressable
            testID="admin-2fa-enable-btn"
            style={styles.approveBtn}
            onPress={enable2fa}
            disabled={twofaBusy}
          >
            {twofaBusy ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.approveText}>Turn on protection</Text>
            )}
          </Pressable>
        </ScrollView>
      </Sheet>

      {/* 2FA disable sheet */}
      <Sheet
        visible={twofaSheet === "disable"}
        onClose={() => setTwofaSheet(null)}
        title="Turn off two-step verification"
        testID="admin-2fa-disable-sheet"
      >
        <Text style={styles.twofaStep}>
          Enter a current code from your authenticator app to confirm.
        </Text>
        <TextInput
          testID="admin-2fa-disable-code"
          style={[styles.sheetInput, styles.codeField]}
          placeholder="000000"
          placeholderTextColor={C.textTertiary}
          value={twofaCode}
          onChangeText={(t) => setTwofaCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />
        <Pressable
          testID="admin-2fa-disable-btn"
          style={styles.rejectBtn}
          onPress={disable2fa}
          disabled={twofaBusy}
        >
          {twofaBusy ? (
            <ActivityIndicator color={C.error} size="small" />
          ) : (
            <Text style={styles.rejectText}>Turn off</Text>
          )}
        </Pressable>
      </Sheet>

      {/* per-user actions sheet */}
      <Sheet
        visible={!!userMenu}
        onClose={() => setUserMenu(null)}
        title={userMenu?.name}
        testID="admin-user-sheet"
      >
        {userMenu && (
          <View>
            <Text style={styles.sheetQuote}>
              {userMenu.email} · {userMenu.phone}
            </Text>
            {tempPw ? (
              <View style={styles.tempPwCard}>
                <Text style={styles.sheetLabel}>
                  New temporary password — share it with the user:
                </Text>
                <Text style={styles.tempPw} selectable>
                  {tempPw}
                </Text>
              </View>
            ) : (
              <Pressable
                testID="admin-user-reset-pw"
                style={styles.actionRow}
                onPress={() => resetUserPassword(userMenu)}
                disabled={userActionBusy}
              >
                <Ionicons name="key-outline" size={18} color={C.brand} />
                <Text style={styles.actionText}>Reset password</Text>
                {userActionBusy && !confirmDelete ? (
                  <ActivityIndicator color={C.brand} size="small" />
                ) : null}
              </Pressable>
            )}
            {confirmDelete ? (
              <Pressable
                testID="admin-user-delete-confirm"
                style={[styles.actionRow, { backgroundColor: C.error }]}
                onPress={() => deleteUser(userMenu)}
                disabled={userActionBusy}
              >
                {userActionBusy ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash" size={18} color="#FFF" />
                    <Text style={[styles.actionText, { color: "#FFF" }]}>
                      Tap again to permanently delete
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                testID="admin-user-delete"
                style={[styles.actionRow, { backgroundColor: C.errorTint }]}
                onPress={() => setConfirmDelete(true)}
              >
                <Ionicons name="trash-outline" size={18} color={C.error} />
                <Text style={[styles.actionText, { color: C.error }]}>Delete account</Text>
              </Pressable>
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    backgroundColor: C.surface,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.6, color: C.brand },
  title: { fontFamily: F.bold, fontSize: 22, color: C.text, marginTop: 2 },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: R.pill,
    backgroundColor: C.errorTint,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: SP.sm, marginTop: SP.md },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.md,
    paddingVertical: SP.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statNum: { fontFamily: F.bold, fontSize: 20, color: C.brand },
  statLabel: { fontFamily: F.medium, fontSize: 10.5, color: C.textSecondary, marginTop: 1 },
  segments: {
    flexDirection: "row",
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    padding: 4,
    marginTop: SP.md,
  },
  segmentItem: {
    height: 38,
    paddingHorizontal: SP.lg,
    borderRadius: R.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: C.card,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontFamily: F.medium, fontSize: 13.5, color: C.textSecondary },
  segmentTextActive: { color: C.text, fontFamily: F.semibold },
  emptyCard: {
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.card,
    borderRadius: R.lg,
    paddingVertical: SP.xxl,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  emptySub: { fontFamily: F.regular, fontSize: 13, color: C.textSecondary },
  orderCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  orderTop: { flexDirection: "row", alignItems: "center", gap: SP.md, marginBottom: SP.xs },
  posBadge: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  posBadgeText: { fontFamily: F.bold, fontSize: 13, color: C.brand },
  orderName: { fontFamily: F.semibold, fontSize: 15, color: C.text },
  orderPhone: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary, marginTop: 1 },
  statusChip: { paddingHorizontal: SP.md, paddingVertical: 5, borderRadius: R.pill },
  statusChipText: { fontFamily: F.semibold, fontSize: 11.5 },
  orderItemText: { fontFamily: F.medium, fontSize: 13.5, color: C.text },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.warningTint,
    borderRadius: R.sm,
    paddingHorizontal: SP.sm,
    paddingVertical: 5,
    marginTop: SP.xs,
    alignSelf: "flex-start",
  },
  noteText: { fontFamily: F.regular, fontSize: 12, color: C.text },
  orderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    marginTop: SP.sm,
    paddingTop: SP.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  orderTotal: { fontFamily: F.bold, fontSize: 16, color: C.text },
  creditApplied: { fontFamily: F.medium, fontSize: 11, color: C.success, marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: R.pill,
    backgroundColor: C.errorTint,
    alignItems: "center",
    justifyContent: "center",
  },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: SP.lg,
    borderRadius: R.pill,
    backgroundColor: C.brand,
  },
  advanceText: { fontFamily: F.semibold, fontSize: 13.5, color: "#FFF" },
  sectionTitle: { fontFamily: F.bold, fontSize: 16, color: C.text, marginTop: SP.sm },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyName: { flex: 1, fontFamily: F.medium, fontSize: 13, color: C.textSecondary },
  historyStatus: { fontFamily: F.semibold, fontSize: 12 },
  reqCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  reqTop: { flexDirection: "row", alignItems: "center", gap: SP.md },
  reqAvatar: {
    width: 38,
    height: 38,
    borderRadius: R.pill,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  reqAvatarText: { fontFamily: F.bold, fontSize: 15, color: C.brand },
  reqName: { fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  reqTime: { fontFamily: F.regular, fontSize: 11.5, color: C.textSecondary, marginTop: 1 },
  reqMessage: {
    fontFamily: F.medium,
    fontSize: 15,
    color: C.text,
    marginTop: SP.md,
    lineHeight: 21,
  },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    height: 46,
    borderRadius: R.md,
    backgroundColor: C.brand,
    marginTop: SP.md,
  },
  replyBtnText: { fontFamily: F.semibold, fontSize: 14, color: "#FFF" },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  menuImage: { width: 64, height: 64, borderRadius: R.md },
  menuName: { fontFamily: F.semibold, fontSize: 15, color: C.text },
  menuMeta: { fontFamily: F.regular, fontSize: 12.5, color: C.textSecondary, marginTop: 2 },
  interestRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: SP.xs },
  interestCount: { fontFamily: F.semibold, fontSize: 12, color: C.textSecondary, marginRight: SP.sm },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    height: 52,
    borderRadius: R.lg,
    backgroundColor: C.brand,
  },
  addBtnText: { fontFamily: F.semibold, fontSize: 15, color: "#FFF" },
  sheetQuote: {
    fontFamily: F.medium,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.lg,
    lineHeight: 21,
  },
  sheetLabel: { fontFamily: F.medium, fontSize: 13, color: C.textSecondary, marginBottom: SP.sm },
  sheetInput: {
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    height: 48,
    paddingHorizontal: SP.lg,
    fontFamily: F.regular,
    fontSize: 14.5,
    color: C.text,
    marginBottom: SP.md,
  },
  sheetActions: { flexDirection: "row", gap: SP.md, marginTop: SP.sm },
  rejectBtn: {
    flex: 1,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.errorTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: { fontFamily: F.semibold, fontSize: 14.5, color: C.error },
  approveBtn: {
    flex: 1,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.success,
    alignItems: "center",
    justifyContent: "center",
  },
  approveText: { fontFamily: F.semibold, fontSize: 14.5, color: "#FFF" },
  catChip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: SP.lg,
    borderRadius: R.pill,
    backgroundColor: C.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  catChipActive: { backgroundColor: C.brand },
  catChipText: { fontFamily: F.medium, fontSize: 13, color: C.textSecondary },
  imageOption: { width: 76, height: 76, borderRadius: R.md },
  imageOptionActive: { borderWidth: 3, borderColor: C.brand },
  usersHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.brandTint,
    borderRadius: R.lg,
    padding: SP.lg,
  },
  usersCount: { fontFamily: F.bold, fontSize: 30, color: C.brand },
  usersCountLabel: { fontFamily: F.medium, fontSize: 13, color: C.text },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.card,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, height: 44, fontFamily: F.regular, fontSize: 14, color: C.text },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  userName: { fontFamily: F.semibold, fontSize: 15, color: C.text, flexShrink: 1 },
  userMeta: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary, marginTop: 1 },
  adminTag: {
    backgroundColor: C.brand,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderRadius: R.sm,
  },
  adminTagText: { fontFamily: F.bold, fontSize: 8.5, color: "#FFF", letterSpacing: 0.5 },
  blockedTag: {
    backgroundColor: C.errorTint,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderRadius: R.sm,
  },
  blockedTagText: { fontFamily: F.bold, fontSize: 8.5, color: C.error, letterSpacing: 0.5 },
  blockBtn: { width: 40, height: 40, borderRadius: R.pill, alignItems: "center", justifyContent: "center" },
  settingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  settingTitle: { fontFamily: F.semibold, fontSize: 15, color: C.text },
  settingSub: { fontFamily: F.regular, fontSize: 12.5, color: C.textSecondary, marginTop: 2, lineHeight: 18 },
  announceInput: {
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    minHeight: 60,
    padding: SP.md,
    fontFamily: F.regular,
    fontSize: 14,
    color: C.text,
    marginTop: SP.md,
    textAlignVertical: "top",
  },
  saveSmallBtn: {
    alignSelf: "flex-start",
    backgroundColor: C.brandTint,
    paddingHorizontal: SP.lg,
    height: 38,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.md,
  },
  saveSmallText: { fontFamily: F.semibold, fontSize: 13, color: C.brand },
  twofaTitleRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  onTag: {
    backgroundColor: C.successTint,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderRadius: R.sm,
  },
  onTagText: { fontFamily: F.bold, fontSize: 9, color: C.success, letterSpacing: 0.5 },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.errorTint,
    marginTop: SP.sm,
  },
  signOutText: { fontFamily: F.semibold, fontSize: 14, color: C.error },
  twofaStep: {
    fontFamily: F.medium,
    fontSize: 13.5,
    color: C.text,
    marginBottom: SP.sm,
    marginTop: SP.xs,
    lineHeight: 19,
  },
  qr: {
    width: 200,
    height: 200,
    alignSelf: "center",
    marginVertical: SP.md,
    backgroundColor: "#FFF",
    borderRadius: R.md,
  },
  secret: {
    fontFamily: F.semibold,
    fontSize: 15,
    letterSpacing: 1,
    color: C.text,
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.sm,
    padding: SP.md,
    textAlign: "center",
    marginBottom: SP.md,
  },
  codeField: { textAlign: "center", letterSpacing: 6, fontFamily: F.bold, fontSize: 20 },
  userActions: { flexDirection: "row", gap: SP.sm },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    height: 50,
    paddingHorizontal: SP.lg,
    borderRadius: R.md,
    backgroundColor: C.surfaceTertiary,
    marginBottom: SP.md,
  },
  actionText: { flex: 1, fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  tempPwCard: {
    backgroundColor: C.successTint,
    borderRadius: R.md,
    padding: SP.lg,
    marginBottom: SP.md,
  },
  tempPw: {
    fontFamily: F.bold,
    fontSize: 22,
    letterSpacing: 1,
    color: C.text,
    textAlign: "center",
    marginTop: SP.sm,
  },
});

