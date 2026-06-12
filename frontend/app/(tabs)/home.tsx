import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AppSettings, MenuItem } from "@/src/api/client";
import Sheet from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, formatPrice, R, SP } from "@/src/theme";

export default function HomeScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("All");

  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: MenuItem[] }>("/menu/today");
      setItems(res.items);
      // Kitchen status + announcement are set by the admin app via /settings; surface them
      // here so customers see the banner and know when ordering is paused. Best-effort — a
      // settings hiccup must never blank out the menu.
      try {
        setSettings(await api<AppSettings>("/settings"));
      } catch {}
    } catch (e: any) {
      toast.show(e.message || "Couldn't load menu", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(
    () => (category === "All" ? items : items.filter((i) => i.category === category)),
    [items, category],
  );

  // Feature a fresh daily dish (not a pantry item) in the hero.
  const featured = items.find((i) => i.kind !== "standing") || items[0];

  const toggleInterest = async (item: MenuItem, interested: boolean) => {
    try {
      const res = await api<{
        my_interest: boolean | null;
        interested_count: number;
        not_interested_count: number;
      }>(`/menu/${item.id}/interest`, { method: "POST", body: { interested } });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                my_interest: res.my_interest,
                interested_count: res.interested_count,
                not_interested_count: res.not_interested_count,
              }
            : i,
        ),
      );
    } catch (e: any) {
      toast.show(e.message || "Couldn't save your reaction", "error");
    }
  };

  const openPreOrder = (item: MenuItem) => {
    setQty(1);
    setNote("");
    setSheetItem(item);
  };

  const placeOrder = async () => {
    if (!sheetItem) return;
    setPlacing(true);
    try {
      await api("/orders", {
        method: "POST",
        body: { items: [{ menu_item_id: sheetItem.id, qty }], note },
      });
      setSheetItem(null);
      toast.show("Order placed! You're in the queue 🍳");
      load();
      router.push("/(tabs)/queue");
    } catch (e: any) {
      toast.show(e.message || "Couldn't place order", "error");
    } finally {
      setPlacing(false);
    }
  };

  const renderItem = ({ item, index }: { item: MenuItem; index: number }) => {
    const soldOut = !item.is_available || item.available_qty <= 0;
    const kitchenClosed = !!settings && !settings.kitchen_open;
    const blocked = soldOut || kitchenClosed;
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60)}>
        <View style={styles.card} testID={`menu-item-${item.id}`}>
          <View style={{ flexDirection: "row", gap: SP.md }}>
            <Image source={{ uri: item.image_url }} style={styles.cardImage} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={[styles.qtyLeft, soldOut && { color: C.error }]}>
                {soldOut ? "Sold out for today" : `${item.available_qty} portions left`}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable
              testID={`interest-yes-${item.id}`}
              onPress={() => toggleInterest(item, true)}
              style={[styles.interestChip, item.my_interest === true && styles.interestYesActive]}
            >
              <Ionicons
                name="thumbs-up"
                size={14}
                color={item.my_interest === true ? "#FFF" : C.success}
              />
              <Text
                style={[
                  styles.interestText,
                  { color: item.my_interest === true ? "#FFF" : C.success },
                ]}
              >
                {item.interested_count}
              </Text>
            </Pressable>
            <Pressable
              testID={`interest-no-${item.id}`}
              onPress={() => toggleInterest(item, false)}
              style={[styles.interestChip, item.my_interest === false && styles.interestNoActive]}
            >
              <Ionicons
                name="thumbs-down"
                size={14}
                color={item.my_interest === false ? "#FFF" : C.textSecondary}
              />
              <Text
                style={[
                  styles.interestText,
                  { color: item.my_interest === false ? "#FFF" : C.textSecondary },
                ]}
              >
                {item.not_interested_count}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              testID={`preorder-button-${item.id}`}
              onPress={() => openPreOrder(item)}
              disabled={blocked}
              style={[styles.orderBtn, blocked && { backgroundColor: C.surfaceTertiary }]}
            >
              <Text style={[styles.orderBtnText, blocked && { color: C.textTertiary }]}>
                {soldOut ? "Sold Out" : kitchenClosed ? "Offline" : "Pre-Order"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  };

  const firstName = (user?.name || "").split(" ")[0];
  const orderTotal = sheetItem ? sheetItem.price * qty : 0;

  return (
    <View style={styles.container} testID="home-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>OMEGA&apos;S KITCHEN</Text>
            <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          </View>
          <Pressable
            testID="home-profile-button"
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>
        {/* category chips — single horizontal scroller */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ height: 56 }}
          contentContainerStyle={styles.chipRow}
        >
          {categories.map((cat) => (
            <Pressable
              key={cat}
              testID={`category-chip-${cat}`}
              onPress={() => setCategory(cat)}
              style={[styles.chip, category === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                {cat}
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
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
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
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xl, gap: SP.md }}
          ListHeaderComponent={
            <View style={{ gap: SP.md, marginBottom: SP.xs }}>
              {/* Kitchen offline — reflects the admin's online/offline toggle; wish stays open */}
              {settings && !settings.kitchen_open && (
                <View style={styles.closedBanner} testID="home-kitchen-closed">
                  <Ionicons name="moon" size={18} color={C.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.closedTitle}>Kitchen is offline right now</Text>
                    <Text style={styles.closedSub}>
                      Ordering is paused — but you can still send a wish and we&apos;ll reply.
                    </Text>
                    <Pressable
                      testID="home-offline-wish"
                      style={styles.wishCta}
                      onPress={() => router.push("/(tabs)/requests")}
                    >
                      <Ionicons name="sparkles" size={14} color="#FFF" />
                      <Text style={styles.wishCtaText}>Send a wish</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {/* Announcement — written by the admin in Settings, shown here on customer home */}
              {!!settings?.announcement && (
                <View style={styles.announceBanner} testID="home-announcement">
                  <Ionicons name="megaphone" size={18} color={C.brand} />
                  <Text style={styles.announceText}>{settings.announcement}</Text>
                </View>
              )}
              {/* Delivery coming soon glass banner */}
              <BlurView intensity={30} tint="light" style={styles.deliveryBanner}>
                <View style={styles.deliveryIcon}>
                  <Ionicons name="bicycle" size={18} color={C.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryTitle}>Home Delivery</Text>
                  <Text style={styles.deliverySub}>Coming soon · pickup only for now</Text>
                </View>
                <View style={styles.soonBadge} testID="delivery-coming-soon-badge">
                  <Text style={styles.soonBadgeText}>SOON</Text>
                </View>
              </BlurView>

              {/* Featured hero — only on the unfiltered "All" view */}
              {category === "All" && featured && (
                <Pressable
                  testID="featured-dish-card"
                  style={styles.hero}
                  onPress={() => openPreOrder(featured)}
                >
                  <Image
                    source={{ uri: featured.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(28,28,30,0.85)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.heroContent}>
                    <View style={styles.heroTag}>
                      <Ionicons name="flame" size={12} color="#FFF" />
                      <Text style={styles.heroTagText}>Chef&apos;s Special Today</Text>
                    </View>
                    <Text style={styles.heroName}>{featured.name}</Text>
                    <Text style={styles.heroPrice}>{formatPrice(featured.price)}</Text>
                  </View>
                </Pressable>
              )}
              <Text style={styles.sectionTitle}>
                {category === "All" ? "Today's Menu" : category}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="menu-empty-state">
              <Ionicons name="restaurant-outline" size={48} color={C.borderStrong} />
              <Text style={styles.emptyTitle}>Kitchen is preparing today&apos;s menu</Text>
              <Text style={styles.emptySub}>Pull down to refresh in a bit</Text>
            </View>
          }
        />
      )}

      {/* Pre-order sheet */}
      <Sheet
        visible={!!sheetItem}
        onClose={() => setSheetItem(null)}
        title={sheetItem?.name}
        testID="preorder-sheet"
      >
        {sheetItem && (
          <View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Quantity</Text>
              <View style={styles.stepper}>
                <Pressable
                  testID="qty-minus-button"
                  style={styles.stepBtn}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Ionicons name="remove" size={20} color={C.brand} />
                </Pressable>
                <Text style={styles.qtyText} testID="qty-value">
                  {qty}
                </Text>
                <Pressable
                  testID="qty-plus-button"
                  style={styles.stepBtn}
                  onPress={() => setQty((q) => Math.min(Math.min(10, sheetItem.available_qty), q + 1))}
                >
                  <Ionicons name="add" size={20} color={C.brand} />
                </Pressable>
              </View>
            </View>
            <TextInput
              testID="order-note-input"
              style={styles.noteInput}
              placeholder="Note to kitchen (less spicy, no onion...)"
              placeholderTextColor={C.textTertiary}
              value={note}
              onChangeText={setNote}
            />
            <View style={styles.prepRow} testID="prep-time-note">
              <Ionicons name="time-outline" size={16} color={C.warning} />
              <Text style={styles.prepText}>
                Minimum 2 hrs preparation — we&apos;ll notify you when it&apos;s ready
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Ionicons name="cash" size={18} color={C.success} />
              <Text style={styles.paymentText}>Cash on pickup</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.paymentSoon}>Online pay coming soon</Text>
            </View>
            <Pressable
              testID="confirm-order-button"
              style={({ pressed }) => [styles.confirmBtn, (pressed || placing) && { opacity: 0.85 }]}
              onPress={placeOrder}
              disabled={placing}
            >
              {placing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmText}>Join Queue · {formatPrice(orderTotal)}</Text>
              )}
            </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP.sm,
  },
  brand: { fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.6, color: C.brand },
  greeting: { fontFamily: F.bold, fontSize: 22, color: C.text, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: R.pill,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: F.bold, fontSize: 17, color: C.brand },
  chipRow: { gap: SP.sm, alignItems: "center", paddingRight: SP.lg },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: SP.lg,
    borderRadius: R.pill,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.textSecondary },
  chipTextActive: { color: "#FFF" },
  deliveryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    marginTop: SP.md,
    padding: SP.md,
    borderRadius: R.md,
    overflow: "hidden",
    backgroundColor: "rgba(253,235,208,0.6)",
    borderWidth: 1,
    borderColor: C.brandTint,
  },
  deliveryIcon: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryTitle: { fontFamily: F.semibold, fontSize: 14, color: C.text },
  deliverySub: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary },
  soonBadge: {
    backgroundColor: C.brand,
    paddingHorizontal: SP.sm,
    paddingVertical: 3,
    borderRadius: R.sm,
  },
  soonBadgeText: { fontFamily: F.bold, fontSize: 10, color: "#FFF", letterSpacing: 1 },
  announceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    padding: SP.md,
    borderRadius: R.md,
    backgroundColor: C.brandTint,
    borderWidth: 1,
    borderColor: C.brand,
  },
  announceText: { flex: 1, fontFamily: F.medium, fontSize: 13.5, color: C.text, lineHeight: 19 },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    padding: SP.md,
    borderRadius: R.md,
    backgroundColor: C.warningTint,
    borderWidth: 1,
    borderColor: C.warning,
  },
  closedTitle: { fontFamily: F.semibold, fontSize: 14, color: C.text },
  closedSub: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary, marginTop: 1 },
  wishCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 34,
    paddingHorizontal: SP.md,
    borderRadius: R.pill,
    backgroundColor: C.warning,
    marginTop: SP.sm,
  },
  wishCtaText: { fontFamily: F.semibold, fontSize: 12.5, color: "#FFF" },
  hero: { height: 190, borderRadius: R.lg, overflow: "hidden" },
  heroContent: { flex: 1, justifyContent: "flex-end", padding: SP.lg },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: C.brand,
    paddingHorizontal: SP.sm,
    paddingVertical: 4,
    borderRadius: R.sm,
    marginBottom: SP.sm,
  },
  heroTagText: { fontFamily: F.semibold, fontSize: 11, color: "#FFF" },
  heroName: { fontFamily: F.bold, fontSize: 24, color: "#FFF" },
  heroPrice: { fontFamily: F.semibold, fontSize: 16, color: C.brandTint, marginTop: 2 },
  sectionTitle: { fontFamily: F.bold, fontSize: 18, color: C.text, marginTop: SP.xs },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardImage: { width: 84, height: 84, borderRadius: R.md },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", gap: SP.sm },
  cardName: { flex: 1, fontFamily: F.semibold, fontSize: 16, color: C.text },
  cardPrice: { fontFamily: F.bold, fontSize: 15, color: C.brand },
  cardDesc: {
    fontFamily: F.regular,
    fontSize: 12.5,
    color: C.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  qtyLeft: { fontFamily: F.medium, fontSize: 11.5, color: C.warning, marginTop: SP.xs },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    marginTop: SP.md,
  },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: SP.md,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  interestYesActive: { backgroundColor: C.success, borderColor: C.success },
  interestNoActive: { backgroundColor: C.textSecondary, borderColor: C.textSecondary },
  interestText: { fontFamily: F.semibold, fontSize: 13 },
  orderBtn: {
    height: 40,
    paddingHorizontal: SP.lg,
    borderRadius: R.pill,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBtnText: { fontFamily: F.semibold, fontSize: 14, color: "#FFF" },
  empty: { alignItems: "center", paddingVertical: SP.xxxl, gap: SP.sm },
  emptyTitle: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  emptySub: { fontFamily: F.regular, fontSize: 13, color: C.textSecondary },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP.lg,
  },
  sheetLabel: { fontFamily: F.medium, fontSize: 15, color: C.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: SP.lg },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: R.pill,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontFamily: F.bold, fontSize: 20, color: C.text, minWidth: 24, textAlign: "center" },
  noteInput: {
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    height: 48,
    paddingHorizontal: SP.lg,
    fontFamily: F.regular,
    fontSize: 14,
    color: C.text,
    marginBottom: SP.lg,
  },
  prepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.warningTint,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.sm,
  },
  prepText: { flex: 1, fontFamily: F.medium, fontSize: 12.5, color: C.text },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.successTint,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.lg,
  },
  paymentText: { fontFamily: F.semibold, fontSize: 13, color: C.success },
  paymentSoon: { fontFamily: F.regular, fontSize: 11, color: C.textSecondary },
  confirmBtn: {
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { fontFamily: F.semibold, fontSize: 16, color: "#FFF" },
});
