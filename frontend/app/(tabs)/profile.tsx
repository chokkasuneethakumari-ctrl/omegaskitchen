import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { api, Order } from "@/src/api/client";
import Sheet from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, formatPrice, R, SP, STATUS_META } from "@/src/theme";

export default function ProfileScreen() {
  const { user, logout, changePassword, deleteAccount } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<boolean | null>(null);

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const submitChangePw = async () => {
    if (newPw.length < 6) {
      toast.show("New password must be at least 6 characters", "error");
      return;
    }
    if (newPw !== confirmPw) {
      toast.show("New passwords don't match", "error");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(currentPw, newPw);
      toast.show("Password updated ✅");
      setChangePwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e: any) {
      toast.show(e.message || "Couldn't change password", "error");
    } finally {
      setPwBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteAccount();
      router.replace("/");
    } catch (e: any) {
      toast.show(e.message || "Couldn't delete account", "error");
      setDeleteBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await api<Order[]>("/orders/my");
      setOrders(res);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ marketing_opt_in: boolean }>("/me/notifications")
      .then((r) => setOffers(r.marketing_opt_in))
      .catch(() => setOffers(true));
  }, []);

  const toggleOffers = async (v: boolean) => {
    setOffers(v);
    try {
      await api("/me/notifications", { method: "PATCH", body: { opt_in: v } });
    } catch (e: any) {
      setOffers(!v);
      toast.show(e.message || "Couldn't update preference", "error");
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/");
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.container} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xl, gap: SP.md }}
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
        {/* identity card */}
        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="profile-name">
                {user?.name}
              </Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="call" size={16} color={C.brand} />
            <Text style={styles.infoText} testID="profile-phone">
              {user?.phone}
            </Text>
            <View style={styles.verifiedChip}>
              <Text style={styles.verifiedText}>Order confirmation number</Text>
            </View>
          </View>
        </View>

        {/* delivery coming soon */}
        <View style={styles.deliveryCard} testID="profile-delivery-row">
          <Ionicons name="bicycle" size={20} color={C.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.deliveryTitle}>Home Delivery</Text>
            <Text style={styles.deliverySub}>We&apos;re working on it — pickup only for now</Text>
          </View>
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>COMING SOON</Text>
          </View>
        </View>

        {/* refer & earn */}
        <Pressable
          testID="profile-referral"
          style={styles.deliveryCard}
          onPress={() => router.push("/referral")}
        >
          <Ionicons name="gift" size={20} color={C.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.deliveryTitle}>Refer &amp; Earn</Text>
            <Text style={styles.deliverySub}>Invite friends — you both get kitchen credit</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.brand} />
        </Pressable>

        {/* order history */}
        <Text style={styles.sectionTitle}>Order History</Text>
        {orders.length === 0 ? (
          <View style={styles.emptyCard} testID="history-empty-state">
            <Ionicons name="receipt-outline" size={36} color={C.borderStrong} />
            <Text style={styles.emptyText}>No orders yet — today&apos;s menu is waiting!</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard} testID={`history-order-${order.id}`}>
              <View style={styles.orderTop}>
                <Text style={styles.orderDate}>
                  {dayjs(order.created_at).format("MMM D, YYYY · h:mm A")}
                </Text>
                <View
                  style={[styles.statusChip, { backgroundColor: STATUS_META[order.status]?.tint }]}
                >
                  <Text
                    style={[styles.statusText, { color: STATUS_META[order.status]?.color }]}
                  >
                    {STATUS_META[order.status]?.label}
                  </Text>
                </View>
              </View>
              {order.items.map((it, idx) => (
                <Text key={idx} style={styles.orderItem} numberOfLines={1}>
                  {it.qty}× {it.name}
                </Text>
              ))}
              <View style={styles.orderBottom}>
                <Text style={styles.orderSource}>
                  {order.source === "custom_request" ? "Chef request" : "Menu pre-order"} · cash
                </Text>
                <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.linkCard}>
          <Pressable
            testID="profile-change-password"
            style={styles.linkRow}
            onPress={() => setChangePwOpen(true)}
          >
            <Ionicons name="key-outline" size={18} color={C.brand} />
            <Text style={styles.linkText}>Change password</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
          <View style={styles.linkDivider} />
          <Pressable
            testID="profile-delete-account"
            style={styles.linkRow}
            onPress={() => setDeleteOpen(true)}
          >
            <Ionicons name="trash-outline" size={18} color={C.error} />
            <Text style={[styles.linkText, { color: C.error }]}>Delete account</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.linkCard}>
          <View style={styles.linkRow}>
            <Ionicons name="mail-outline" size={18} color={C.brand} />
            <Text style={styles.linkText}>Email me offers &amp; news</Text>
            <Switch
              testID="offers-toggle"
              value={!!offers}
              onValueChange={toggleOffers}
              disabled={offers === null}
              trackColor={{ true: C.brand, false: C.borderStrong }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.linkCard}>
          <Pressable
            testID="profile-terms"
            style={styles.linkRow}
            onPress={() => router.push("/legal/terms")}
          >
            <Ionicons name="document-text-outline" size={18} color={C.brand} />
            <Text style={styles.linkText}>Terms &amp; Conditions</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
          <View style={styles.linkDivider} />
          <Pressable
            testID="profile-privacy"
            style={styles.linkRow}
            onPress={() => router.push("/legal/privacy")}
          >
            <Ionicons name="lock-closed-outline" size={18} color={C.brand} />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        </View>

        <Pressable testID="logout-button" style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={C.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
        <Text style={styles.version}>Omega&apos;s Kitchen · v1.0</Text>
      </ScrollView>

      <Sheet
        visible={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        title="Change password"
        testID="change-password-sheet"
      >
        <TextInput
          testID="current-password-input"
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor={C.textTertiary}
          value={currentPw}
          onChangeText={setCurrentPw}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          testID="new-password-input"
          style={styles.input}
          placeholder="New password (min 6 characters)"
          placeholderTextColor={C.textTertiary}
          value={newPw}
          onChangeText={setNewPw}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          testID="confirm-password-input"
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={C.textTertiary}
          value={confirmPw}
          onChangeText={setConfirmPw}
          secureTextEntry
          autoCapitalize="none"
        />
        <Pressable
          testID="submit-change-password"
          style={styles.primaryBtn}
          onPress={submitChangePw}
          disabled={pwBusy}
        >
          {pwBusy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Update password</Text>
          )}
        </Pressable>
      </Sheet>

      <Sheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account"
        testID="delete-account-sheet"
      >
        <Text style={styles.deleteWarn}>
          This permanently deletes your account, orders, and requests — it can&apos;t be undone. You
          can sign up again later with the same email.
        </Text>
        <Pressable
          testID="confirm-delete-account"
          style={styles.deleteBtn}
          onPress={confirmDelete}
          disabled={deleteBusy}
        >
          {deleteBusy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.deleteBtnText}>Delete my account</Text>
          )}
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={() => setDeleteOpen(false)}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    backgroundColor: C.surface,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { fontFamily: F.bold, fontSize: 24, color: C.text },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: SP.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: R.pill,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: F.bold, fontSize: 19, color: C.brand },
  name: { fontFamily: F.bold, fontSize: 18, color: C.text },
  email: { fontFamily: F.regular, fontSize: 13, color: C.textSecondary, marginTop: 1 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: SP.md },
  infoRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  infoText: { fontFamily: F.medium, fontSize: 14, color: C.text },
  verifiedChip: {
    marginLeft: "auto",
    backgroundColor: C.surfaceTertiary,
    paddingHorizontal: SP.sm,
    paddingVertical: 3,
    borderRadius: R.sm,
  },
  verifiedText: { fontFamily: F.regular, fontSize: 10, color: C.textSecondary },
  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.brandTint,
    borderRadius: R.lg,
    padding: SP.lg,
  },
  deliveryTitle: { fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  deliverySub: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary, marginTop: 1 },
  soonBadge: {
    backgroundColor: C.brand,
    paddingHorizontal: SP.sm,
    paddingVertical: 4,
    borderRadius: R.sm,
  },
  soonText: { fontFamily: F.bold, fontSize: 9, color: "#FFF", letterSpacing: 0.8 },
  sectionTitle: { fontFamily: F.bold, fontSize: 17, color: C.text, marginTop: SP.sm },
  emptyCard: {
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.card,
    borderRadius: R.lg,
    paddingVertical: SP.xl,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: { fontFamily: F.regular, fontSize: 13, color: C.textSecondary },
  orderCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: 3,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SP.xs,
  },
  orderDate: { fontFamily: F.medium, fontSize: 12, color: C.textSecondary },
  statusChip: { paddingHorizontal: SP.sm, paddingVertical: 4, borderRadius: R.pill },
  statusText: { fontFamily: F.semibold, fontSize: 11 },
  orderItem: { fontFamily: F.medium, fontSize: 13.5, color: C.text },
  orderBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SP.xs,
    paddingTop: SP.xs,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  orderSource: { fontFamily: F.regular, fontSize: 11.5, color: C.textTertiary },
  orderTotal: { fontFamily: F.bold, fontSize: 14.5, color: C.text },
  linkCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
  },
  linkText: { flex: 1, fontFamily: F.medium, fontSize: 14.5, color: C.text },
  linkDivider: { height: 1, backgroundColor: C.border, marginLeft: 46 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.errorTint,
    marginTop: SP.sm,
  },
  logoutText: { fontFamily: F.semibold, fontSize: 14.5, color: C.error },
  version: {
    fontFamily: F.regular,
    fontSize: 11,
    color: C.textTertiary,
    textAlign: "center",
    marginTop: SP.xs,
  },
  input: {
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    height: 50,
    paddingHorizontal: SP.lg,
    fontFamily: F.regular,
    fontSize: 15,
    color: C.text,
    marginBottom: SP.md,
  },
  primaryBtn: {
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.xs,
  },
  primaryBtnText: { fontFamily: F.semibold, fontSize: 15, color: "#FFF" },
  deleteWarn: {
    fontFamily: F.regular,
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 21,
    marginBottom: SP.lg,
  },
  deleteBtn: {
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { fontFamily: F.semibold, fontSize: 15, color: "#FFF" },
  cancelBtn: { height: 48, alignItems: "center", justifyContent: "center", marginTop: SP.sm },
  cancelText: { fontFamily: F.medium, fontSize: 14, color: C.textSecondary },
});
