import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, R, SP } from "@/src/theme";

export default function TwoFactorScreen() {
  const { verify2fa } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.length !== 6) {
      toast.show("Enter the 6-digit code", "error");
      return;
    }
    if (!token) {
      toast.show("Session expired — please sign in again", "error");
      router.replace("/auth");
      return;
    }
    setBusy(true);
    try {
      const user = await verify2fa(String(token), code);
      router.replace(user.role === "admin" ? "/admin" : "/(tabs)/home");
    } catch (e: any) {
      toast.show(e.message || "Verification failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + SP.lg }]} testID="twofa-screen">
      <Pressable testID="twofa-back" style={styles.back} onPress={() => router.replace("/auth")}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <View style={styles.badge}>
        <Ionicons name="shield-checkmark" size={26} color={C.brand} />
      </View>
      <Text style={styles.title}>Two-step verification</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code from your authenticator app to finish signing in.
      </Text>
      <TextInput
        testID="twofa-code-input"
        style={styles.codeInput}
        placeholder="000000"
        placeholderTextColor={C.textTertiary}
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      <Pressable
        testID="twofa-submit"
        style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Verify</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface, paddingHorizontal: SP.xl },
  back: {
    width: 44,
    height: 44,
    borderRadius: R.pill,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: SP.lg,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP.lg,
  },
  title: { fontFamily: F.bold, fontSize: 28, color: C.text },
  subtitle: {
    fontFamily: F.regular,
    fontSize: 14,
    color: C.textSecondary,
    marginTop: SP.xs,
    marginBottom: SP.xl,
    lineHeight: 20,
  },
  codeInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    height: 64,
    paddingHorizontal: SP.lg,
    fontFamily: F.bold,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: "center",
    color: C.text,
    marginBottom: SP.lg,
  },
  cta: {
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#FFF", fontFamily: F.semibold, fontSize: 16 },
});
