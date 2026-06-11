import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IS_ADMIN_APP } from "@/src/appVariant";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, HERO_IMAGE, HERO_VIDEO, R, SP } from "@/src/theme";

const FEATURES = [
  { icon: "leaf", label: "Market-fresh produce, cooked to order" },
  { icon: "sparkles", label: "Prepared in a meticulously clean kitchen" },
  { icon: "restaurant", label: "A menu composed afresh each morning" },
];

export default function Welcome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(HERO_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const statusEvent = useEvent(player, "statusChange");
  const videoErrored = statusEvent?.status === "error";

  if (loading) {
    return (
      <View style={styles.loading} testID="welcome-loading">
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  if (user) {
    return <Redirect href={user.role === "admin" ? "/admin" : "/(tabs)/home"} />;
  }

  // The admin build skips the customer welcome and opens straight to staff sign-in.
  if (IS_ADMIN_APP) {
    return <Redirect href="/auth" />;
  }

  return (
    <View style={styles.container} testID="welcome-screen">
      <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" />
      {!videoErrored && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      )}
      <LinearGradient
        colors={["rgba(28,28,30,0.25)", "rgba(28,28,30,0.55)", "rgba(28,28,30,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + SP.xl, paddingBottom: insets.bottom + SP.xl }]}>
        <Animated.View entering={FadeInDown.delay(80)}>
          <BlurView intensity={40} tint="dark" style={styles.deliveryBadge}>
            <Ionicons name="bicycle" size={16} color={C.brandTint} />
            <Text style={styles.deliveryText}>Home Delivery — Coming Soon</Text>
          </BlurView>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeInDown.delay(160)}>
          <Text style={styles.brandTag}>WELCOME TO</Text>
          <Text style={styles.title}>Omega&apos;s{"\n"}Kitchen</Text>
          <Text style={styles.subtitle}>
            Reserve today&apos;s home-style menu, or commission our chef to prepare exactly what you
            crave — each dish made to order and served at its peak.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260)} style={styles.features}>
          {FEATURES.map((feat) => (
            <View key={feat.label} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feat.icon as any} size={15} color={C.brandTint} />
              </View>
              <Text style={styles.featureText}>{feat.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(360)}>
          <Pressable
            testID="get-started-button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.ctaText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.inverse },
  container: { flex: 1, backgroundColor: C.inverse },
  content: { flex: 1, paddingHorizontal: SP.xl },
  deliveryBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    borderRadius: R.pill,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  deliveryText: { color: C.brandTint, fontFamily: F.medium, fontSize: 12 },
  brandTag: {
    color: C.accent,
    fontFamily: F.semibold,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: SP.sm,
  },
  title: { color: "#FFF", fontFamily: F.bold, fontSize: 44, lineHeight: 48 },
  subtitle: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: F.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: SP.md,
  },
  features: { marginTop: SP.xl, gap: SP.md, marginBottom: SP.xl },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SP.md },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: R.pill,
    backgroundColor: "rgba(211,84,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { color: "rgba(255,255,255,0.9)", fontFamily: F.medium, fontSize: 14 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    backgroundColor: C.brand,
    height: 56,
    borderRadius: R.lg,
  },
  ctaText: { color: "#FFF", fontFamily: F.semibold, fontSize: 17 },
});
