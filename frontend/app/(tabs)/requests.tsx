import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CustomRequest } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { C, F, formatPrice, R, SP } from "@/src/theme";

const QUICK_IDEAS = [
  "Chicken Biryani 🍗",
  "Paneer Tikka",
  "Less spicy please",
  "Egg curry for 2",
  "Millet khichdi",
];

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    try {
      const res = await api<CustomRequest[]>("/requests/my");
      setRequests(res);
      setError(false);
    } catch {
      // surface only on the first load; keep the background poll silent
      if (initial) setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(), 10000);
    return () => clearInterval(interval);
  }, [load]);

  const send = async () => {
    const text = message.trim();
    if (text.length < 3) {
      toast.show("Tell the chef what you'd like to eat", "error");
      return;
    }
    setSending(true);
    try {
      const req = await api<CustomRequest>("/requests", { method: "POST", body: { message: text } });
      setRequests((prev) => [...prev, req]);
      setMessage("");
      toast.show("Wish sent — the kitchen will reply soon 🍲");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      toast.show(e.message || "Couldn't send request", "error");
    } finally {
      setSending(false);
    }
  };

  const accept = async (req: CustomRequest) => {
    setAccepting(req.id);
    try {
      await api(`/requests/${req.id}/accept`, { method: "POST" });
      toast.show("Added to the queue! 🍳");
      load();
      router.push("/(tabs)/queue");
    } catch (e: any) {
      toast.show(e.message || "Couldn't confirm", "error");
    } finally {
      setAccepting(null);
    }
  };

  return (
    <View style={styles.container} testID="requests-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Text style={styles.title}>Wish Kitchen</Text>
        <Text style={styles.subtitle}>
          Wish for any dish — we reply if we can cook it · min 2 hrs prep
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.brand} />
          </View>
        ) : error ? (
          <Pressable style={[styles.center, { gap: SP.sm }]} onPress={() => load(true)} testID="requests-error-state">
            <Ionicons name="cloud-offline-outline" size={44} color={C.borderStrong} />
            <Text style={styles.emptyTitle}>Couldn&apos;t load — tap to retry</Text>
            <Text style={styles.emptySub}>
              We couldn&apos;t reach the kitchen. Check your connection and tap to try again.
            </Text>
          </Pressable>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: SP.lg, gap: SP.md, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {requests.length === 0 && (
              <View style={styles.empty} testID="requests-empty-state">
                <Ionicons name="sparkles-outline" size={44} color={C.borderStrong} />
                <Text style={styles.emptyTitle}>Make a wish, the kitchen is listening</Text>
                <Text style={styles.emptySub}>
                  Craving something off-menu? Type your wish below. The kitchen will reply with a
                  yes (and a price) or suggest an alternative. Every order needs a minimum of 2
                  hours to prepare — we&apos;ll notify you the moment it&apos;s ready.
                </Text>
              </View>
            )}

            {requests.map((req) => (
              <View key={req.id} style={{ gap: SP.sm }}>
                {/* my bubble */}
                <Animated.View entering={FadeInUp} style={styles.myBubble} testID={`request-bubble-${req.id}`}>
                  <Text style={styles.myBubbleText}>{req.message}</Text>
                  <Text style={styles.myBubbleTime}>
                    {dayjs(req.created_at).format("MMM D · h:mm A")}
                  </Text>
                </Animated.View>

                {/* kitchen reply or pending */}
                {req.status === "pending" ? (
                  <View style={styles.pendingRow}>
                    <Ionicons name="hourglass-outline" size={13} color={C.warning} />
                    <Text style={styles.pendingText}>Waiting for the kitchen to reply…</Text>
                  </View>
                ) : (
                  <Animated.View entering={FadeInUp} style={styles.chefBubble}>
                    <View style={styles.chefRow}>
                      <View style={styles.chefAvatar}>
                        <Ionicons name="restaurant" size={12} color="#FFF" />
                      </View>
                      <Text style={styles.chefName}>Omega&apos;s Kitchen</Text>
                    </View>
                    <Text style={styles.chefText}>{req.admin_reply}</Text>
                    {req.status === "rejected" ? (
                      <View style={[styles.decisionChip, { backgroundColor: C.errorTint }]}>
                        <Ionicons name="close-circle" size={14} color={C.error} />
                        <Text style={[styles.decisionText, { color: C.error }]}>
                          Not possible today
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.decisionChip, { backgroundColor: C.successTint }]}>
                        <Ionicons name="checkmark-circle" size={14} color={C.success} />
                        <Text style={[styles.decisionText, { color: C.success }]}>
                          Approved · {formatPrice(req.quoted_price)}
                        </Text>
                      </View>
                    )}
                    {req.status === "approved" && (
                      <Pressable
                        testID={`confirm-request-${req.id}`}
                        style={styles.confirmBtn}
                        onPress={() => accept(req)}
                        disabled={accepting === req.id}
                      >
                        {accepting === req.id ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.confirmText}>Confirm & Join Queue</Text>
                        )}
                      </Pressable>
                    )}
                    {req.status === "converted" && (
                      <View style={styles.convertedRow}>
                        <Ionicons name="checkmark-done" size={14} color={C.success} />
                        <Text style={styles.convertedText}>Added to queue</Text>
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* composer */}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, SP.sm) }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ height: 44, flexGrow: 0 }}
            contentContainerStyle={styles.ideasRow}
          >
            {QUICK_IDEAS.map((idea) => (
              <Pressable
                key={idea}
                testID={`quick-idea-chip-${idea}`}
                style={styles.ideaChip}
                onPress={() => setMessage(idea)}
              >
                <Text style={styles.ideaText}>{idea}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              testID="request-message-input"
              style={styles.input}
              placeholder="What do you wish we cooked for you?"
              placeholderTextColor={C.textTertiary}
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <Pressable
              testID="send-request-button"
              style={[styles.sendBtn, sending && { opacity: 0.7 }]}
              onPress={send}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#FFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  title: { fontFamily: F.bold, fontSize: 24, color: C.text },
  subtitle: { fontFamily: F.regular, fontSize: 12.5, color: C.textSecondary, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: SP.xxl, gap: SP.sm, flex: 1, justifyContent: "center" },
  emptyTitle: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  emptySub: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: SP.xl,
  },
  myBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: C.brand,
    borderRadius: R.lg,
    borderBottomRightRadius: R.sm,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
  },
  myBubbleText: { fontFamily: F.medium, fontSize: 14.5, color: "#FFF", lineHeight: 20 },
  myBubbleTime: {
    fontFamily: F.regular,
    fontSize: 10.5,
    color: "rgba(255,255,255,0.7)",
    marginTop: SP.xs,
    alignSelf: "flex-end",
  },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end" },
  pendingText: { fontFamily: F.regular, fontSize: 11.5, color: C.warning },
  chefBubble: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderBottomLeftRadius: R.sm,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  chefRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm },
  chefAvatar: {
    width: 22,
    height: 22,
    borderRadius: R.pill,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  chefName: { fontFamily: F.semibold, fontSize: 12, color: C.brand },
  chefText: { fontFamily: F.regular, fontSize: 14, color: C.text, lineHeight: 20 },
  decisionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    borderRadius: R.pill,
    marginTop: SP.sm,
  },
  decisionText: { fontFamily: F.semibold, fontSize: 12.5 },
  confirmBtn: {
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.success,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.md,
  },
  confirmText: { fontFamily: F.semibold, fontSize: 14, color: "#FFF" },
  convertedRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: SP.sm },
  convertedText: { fontFamily: F.medium, fontSize: 12.5, color: C.success },
  composer: {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: SP.lg,
    paddingTop: SP.sm,
  },
  ideasRow: { gap: SP.sm, alignItems: "center", paddingRight: SP.lg },
  ideaChip: {
    flexShrink: 0,
    height: 32,
    paddingHorizontal: SP.md,
    borderRadius: R.pill,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  ideaText: { fontFamily: F.medium, fontSize: 12.5, color: C.brand },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: SP.sm, paddingTop: SP.xs },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.lg,
    paddingHorizontal: SP.lg,
    paddingTop: SP.md,
    paddingBottom: SP.md,
    fontFamily: F.regular,
    fontSize: 14.5,
    color: C.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: R.pill,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
