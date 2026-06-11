import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, QueueResponse } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { C, F, formatPrice, R, SP, STATUS_META } from "@/src/theme";

const STEPS = ["placed", "cooking", "ready"];

const formatWait = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`;

export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await api<QueueResponse>("/orders/queue");
      setData(res);
    } catch {
      // silent poll failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 8000);
    return () => clearInterval(interval);
  }, [load]);

  const cancelOrder = async () => {
    if (!data?.my_active_order) return;
    setCancelling(true);
    try {
      await api(`/orders/${data.my_active_order.id}/cancel`, { method: "PATCH" });
      toast.show("Order cancelled", "info");
      load();
    } catch (e: any) {
      toast.show(e.message || "Couldn't cancel", "error");
    } finally {
      setCancelling(false);
    }
  };

  const myOrder = data?.my_active_order;
  const stepIndex = myOrder ? STEPS.indexOf(myOrder.status) : -1;

  return (
    <View style={styles.container} testID="queue-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Text style={styles.title}>Live Queue</Text>
        <View style={styles.fifoBadge}>
          <Ionicons name="swap-vertical" size={13} color={C.brand} />
          <Text style={styles.fifoText}>First In · First Out</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: SP.lg,
            paddingBottom: myOrder && data?.my_position ? 96 : SP.xl,
            gap: SP.md,
          }}
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
          {/* My active order — dominant card */}
          {myOrder ? (
            <Animated.View entering={FadeInDown} style={styles.myCard} testID="my-active-order-card">
              <View style={styles.myCardHeader}>
                <View>
                  <Text style={styles.myCardLabel}>YOUR ORDER</Text>
                  <Text style={styles.myCardTime}>
                    Placed {dayjs(myOrder.created_at).format("h:mm A")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: STATUS_META[myOrder.status]?.tint },
                  ]}
                  testID="my-order-status-chip"
                >
                  <Ionicons
                    name={(STATUS_META[myOrder.status]?.icon as any) || "time"}
                    size={14}
                    color={STATUS_META[myOrder.status]?.color}
                  />
                  <Text
                    style={[styles.statusChipText, { color: STATUS_META[myOrder.status]?.color }]}
                  >
                    {STATUS_META[myOrder.status]?.label}
                  </Text>
                </View>
              </View>

              {/* progress steps */}
              <View style={styles.steps}>
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    <View style={styles.stepCol}>
                      <View
                        style={[
                          styles.stepDot,
                          i <= stepIndex && { backgroundColor: C.brand, borderColor: C.brand },
                        ]}
                      >
                        {i < stepIndex || (i === stepIndex && myOrder.status === "ready") ? (
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        ) : i === stepIndex ? (
                          <View style={styles.stepInner} />
                        ) : null}
                      </View>
                      <Text style={[styles.stepLabel, i <= stepIndex && { color: C.text }]}>
                        {STATUS_META[s].label}
                      </Text>
                    </View>
                    {i < STEPS.length - 1 && (
                      <View
                        style={[styles.stepLine, i < stepIndex && { backgroundColor: C.brand }]}
                      />
                    )}
                  </React.Fragment>
                ))}
              </View>

              <View style={styles.divider} />
              {myOrder.items.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{it.qty}×</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.itemPrice}>{formatPrice(it.price * it.qty)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total · cash on pickup</Text>
                <Text style={styles.totalValue}>{formatPrice(myOrder.total)}</Text>
              </View>

              {myOrder.status !== "ready" && (
                <View style={styles.prepNote} testID="queue-prep-note">
                  <Ionicons name="notifications-outline" size={14} color={C.warning} />
                  <Text style={styles.prepNoteText}>
                    Min. 2 hrs preparation — we&apos;ll notify you the moment it&apos;s ready
                  </Text>
                </View>
              )}

              {myOrder.status === "ready" && (
                <View style={styles.readyBanner} testID="order-ready-banner">
                  <Ionicons name="bag-check" size={18} color="#FFF" />
                  <Text style={styles.readyText}>Your food is ready — come pick it up!</Text>
                </View>
              )}

              {myOrder.status === "placed" && (
                <Pressable
                  testID="cancel-order-button"
                  style={styles.cancelBtn}
                  onPress={cancelOrder}
                  disabled={cancelling}
                >
                  <Text style={styles.cancelText}>
                    {cancelling ? "Cancelling..." : "Cancel Order"}
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          ) : (
            <View style={styles.empty} testID="queue-empty-state">
              <Ionicons name="cafe-outline" size={48} color={C.borderStrong} />
              <Text style={styles.emptyTitle}>No active orders</Text>
              <Text style={styles.emptySub}>Pre-order from today&apos;s menu to join the queue</Text>
              <Pressable
                testID="browse-menu-button"
                style={styles.browseBtn}
                onPress={() => router.push("/(tabs)/home")}
              >
                <Text style={styles.browseText}>Browse Menu</Text>
              </Pressable>
            </View>
          )}

          {/* Queue list */}
          <Text style={styles.sectionTitle}>
            Kitchen line · {data?.queue_length || 0} {data?.queue_length === 1 ? "order" : "orders"}
          </Text>
          {(data?.queue || []).length === 0 ? (
            <Text style={styles.queueEmptyText}>The kitchen line is clear right now 🎉</Text>
          ) : (
            (data?.queue || []).map((entry, index) => (
              <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(Math.min(index, 6) * 50)}
                style={[styles.queueRow, entry.is_mine && styles.queueRowMine]}
              >
                <View style={[styles.posCircle, entry.is_mine && { backgroundColor: C.brand }]}>
                  {entry.position ? (
                    <Text style={[styles.posText, entry.is_mine && { color: "#FFF" }]}>
                      #{entry.position}
                    </Text>
                  ) : (
                    <Ionicons name="bag-check" size={16} color={entry.is_mine ? "#FFF" : C.success} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueName}>
                    {entry.is_mine ? "You" : entry.customer}
                  </Text>
                  <Text style={styles.queueMeta}>
                    {entry.items_count} {entry.items_count === 1 ? "item" : "items"} ·{" "}
                    {dayjs(entry.created_at).format("h:mm A")}
                  </Text>
                </View>
                <View
                  style={[styles.statusChip, { backgroundColor: STATUS_META[entry.status]?.tint }]}
                >
                  <Text
                    style={[styles.statusChipText, { color: STATUS_META[entry.status]?.color }]}
                  >
                    {STATUS_META[entry.status]?.label}
                  </Text>
                </View>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* Sticky position banner */}
      {myOrder && data?.my_position ? (
        <View style={[styles.positionBanner]} testID="queue-position-banner">
          <View style={styles.positionLeft}>
            <Text style={styles.positionNum}>#{data.my_position}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.positionTitle}>You&apos;re #{data.my_position} in line</Text>
            <Text style={styles.positionSub}>
              Ready in ~{formatWait(data.est_wait_minutes || 120)} · we&apos;ll notify you
            </Text>
          </View>
          <Ionicons name="flame" size={22} color={C.brandTint} />
        </View>
      ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: F.bold, fontSize: 24, color: C.text },
  fifoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.brandTint,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderRadius: R.pill,
  },
  fifoText: { fontFamily: F.semibold, fontSize: 11, color: C.brand },
  myCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1.5,
    borderColor: C.brandTint,
    shadowColor: C.brand,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  myCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  myCardLabel: { fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.4, color: C.brand },
  myCardTime: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderRadius: R.pill,
  },
  statusChipText: { fontFamily: F.semibold, fontSize: 12 },
  steps: { flexDirection: "row", alignItems: "flex-start", marginTop: SP.lg },
  stepCol: { alignItems: "center", width: 72 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: R.pill,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepInner: { width: 8, height: 8, borderRadius: R.pill, backgroundColor: "#FFF" },
  stepLabel: { fontFamily: F.medium, fontSize: 11, color: C.textTertiary, marginTop: SP.xs },
  stepLine: { flex: 1, height: 2, backgroundColor: C.border, marginTop: 10, marginHorizontal: -14 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: SP.md },
  itemRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, paddingVertical: 3 },
  itemQty: { fontFamily: F.bold, fontSize: 13, color: C.brand, width: 26 },
  itemName: { flex: 1, fontFamily: F.medium, fontSize: 14, color: C.text },
  itemPrice: { fontFamily: F.medium, fontSize: 13, color: C.textSecondary },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SP.sm,
    paddingTop: SP.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  totalLabel: { fontFamily: F.regular, fontSize: 12.5, color: C.textSecondary },
  totalValue: { fontFamily: F.bold, fontSize: 17, color: C.text },
  prepNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.warningTint,
    borderRadius: R.sm,
    paddingHorizontal: SP.sm,
    paddingVertical: 6,
    marginTop: SP.md,
  },
  prepNoteText: { flex: 1, fontFamily: F.medium, fontSize: 11.5, color: C.text },
  readyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.success,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.md,
  },
  readyText: { flex: 1, fontFamily: F.semibold, fontSize: 13.5, color: "#FFF" },
  cancelBtn: {
    height: 44,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.errorTint,
    backgroundColor: C.errorTint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.md,
  },
  cancelText: { fontFamily: F.semibold, fontSize: 14, color: C.error },
  empty: {
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: R.lg,
    paddingVertical: SP.xxl,
    gap: SP.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  emptySub: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.textSecondary,
    textAlign: "center",
    paddingHorizontal: SP.xl,
  },
  browseBtn: {
    marginTop: SP.sm,
    height: 44,
    paddingHorizontal: SP.xl,
    borderRadius: R.pill,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  browseText: { fontFamily: F.semibold, fontSize: 14, color: "#FFF" },
  sectionTitle: { fontFamily: F.bold, fontSize: 17, color: C.text, marginTop: SP.sm },
  queueEmptyText: { fontFamily: F.regular, fontSize: 13.5, color: C.textSecondary },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  queueRowMine: { borderColor: C.brand, backgroundColor: "#FFF9F3" },
  posCircle: {
    width: 38,
    height: 38,
    borderRadius: R.pill,
    backgroundColor: C.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  posText: { fontFamily: F.bold, fontSize: 13, color: C.text },
  queueName: { fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  queueMeta: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary, marginTop: 1 },
  positionBanner: {
    position: "absolute",
    left: SP.lg,
    right: SP.lg,
    bottom: SP.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.inverse,
    borderRadius: R.lg,
    padding: SP.md,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  positionLeft: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  positionNum: { fontFamily: F.bold, fontSize: 16, color: "#FFF" },
  positionTitle: { fontFamily: F.semibold, fontSize: 14.5, color: "#FFF" },
  positionSub: { fontFamily: F.regular, fontSize: 12, color: "rgba(255,255,255,0.7)" },
});
