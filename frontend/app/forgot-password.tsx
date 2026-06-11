import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { C, F, R, SP } from "@/src/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      toast.show("Enter your email", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      toast.show("If that email is registered, a reset code is on its way");
      router.push({ pathname: "/reset-password", params: { email: email.trim() } });
    } catch (e: any) {
      toast.show(e.message || "Couldn't send reset code", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + SP.lg }]}
      testID="forgot-password-screen"
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <View style={styles.badge}>
        <Ionicons name="lock-closed" size={26} color={C.brand} />
      </View>
      <Text style={styles.title}>Forgot password?</Text>
      <Text style={styles.subtitle}>
        Enter your account email and we&apos;ll send a 6-digit reset code.
      </Text>
      <TextInput
        testID="forgot-email-input"
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor={C.textTertiary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoFocus
      />
      <Pressable
        testID="forgot-submit"
        style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Send reset code</Text>}
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={() => router.push("/reset-password")}>
        <Text style={styles.linkText}>I already have a code</Text>
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
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    height: 54,
    paddingHorizontal: SP.lg,
    fontFamily: F.regular,
    fontSize: 15,
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
  linkBtn: { alignItems: "center", marginTop: SP.lg },
  linkText: { fontFamily: F.semibold, fontSize: 14, color: C.brand },
});
