import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Referral } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { C, F, formatPrice, R, SP } from "@/src/theme";

export default function ReferralScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [data, setData] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await api<Referral>("/referral"));
    } catch (e: any) {
      toast.show(e.message || "Couldn't load referrals", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({
        message:
          `Order home-style food on Omega's Kitchen! Use my code ${data.referral_code} when you sign up ` +
          `and we both get kitchen credit on your first order. 🍛`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <View style={styles.container} testID="referral-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Pressable style={styles.back} onPress={() => router.back()} testID="referral-back">
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Refer &amp; Earn</Text>
      </View>

      {loading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SP.lg, paddingBottom: insets.bottom + SP.xxl, gap: SP.md }}
        >
          {/* credit balance */}
          <View style={styles.creditCard}>
            <Text style={styles.creditLabel}>Your kitchen credit</Text>
            <Text style={styles.creditValue} testID="referral-credit">
              {formatPrice(data.credit)}
            </Text>
            <Text style={styles.creditHint}>Use it at checkout on your next order</Text>
          </View>

          {/* referral code + share */}
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <Text style={styles.code} selectable testID="referral-code">
              {data.referral_code}
            </Text>
            <Pressable style={styles.shareBtn} onPress={share} testID="referral-share">
              <Ionicons name="share-social" size={18} color="#FFF" />
              <Text style={styles.shareText}>Share invite</Text>
            </Pressable>
          </View>

          {/* stats */}
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{data.referral_count}</Text>
              <Text style={styles.statLabel}>Friends joined</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: C.success }]}>
                {formatPrice(data.referral_count * data.reward_per_referral)}
              </Text>
              <Text style={styles.statLabel}>Earned so far</Text>
            </View>
          </View>

          {/* how it works */}
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepsCard}>
            <Step
              icon="share-social-outline"
              title="Share your code"
              body="Send your code to friends and family."
            />
            <View style={styles.stepDivider} />
            <Step
              icon="person-add-outline"
              title="They sign up & order"
              body={`Your friend enters your code at sign-up and gets ${formatPrice(
                data.referred_bonus,
              )} off their first order.`}
            />
            <View style={styles.stepDivider} />
            <Step
              icon="cash-outline"
              title="You earn credit"
              body={`When their first order is placed, you get ${formatPrice(
                data.reward_per_referral,
              )} kitchen credit.`}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Step({ icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>
        <Ionicons name={icon} size={18} color={C.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { fontFamily: F.bold, fontSize: 20, color: C.text },
  creditCard: {
    backgroundColor: C.brand,
    borderRadius: R.lg,
    padding: SP.xl,
    alignItems: "center",
  },
  creditLabel: { fontFamily: F.medium, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  creditValue: { fontFamily: F.bold, fontSize: 40, color: "#FFF", marginVertical: SP.xs },
  creditHint: { fontFamily: F.regular, fontSize: 12, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  codeCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  codeLabel: { fontFamily: F.medium, fontSize: 13, color: C.textSecondary },
  code: {
    fontFamily: F.bold,
    fontSize: 32,
    letterSpacing: 6,
    color: C.text,
    marginVertical: SP.sm,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    height: 48,
    alignSelf: "stretch",
    borderRadius: R.md,
    backgroundColor: C.brand,
    marginTop: SP.sm,
  },
  shareText: { fontFamily: F.semibold, fontSize: 15, color: "#FFF" },
  statRow: { flexDirection: "row", gap: SP.md },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statNum: { fontFamily: F.bold, fontSize: 22, color: C.brand },
  statLabel: { fontFamily: F.medium, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  sectionTitle: { fontFamily: F.bold, fontSize: 16, color: C.text, marginTop: SP.sm },
  stepsCard: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: SP.md, padding: SP.lg },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: R.pill,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  stepBody: { fontFamily: F.regular, fontSize: 12.5, color: C.textSecondary, marginTop: 1, lineHeight: 18 },
  stepDivider: { height: 1, backgroundColor: C.border, marginLeft: 66 },
});
