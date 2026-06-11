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

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { C, F, R, SP } from "@/src/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ? String(params.email) : "");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || code.length !== 6 || newPw.length < 6) {
      toast.show("Enter your email, the 6-digit code, and a new password (min 6)", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { email: email.trim(), code, new_password: newPw },
      });
      toast.show("Password reset — sign in with your new password ✅");
      router.replace("/auth");
    } catch (e: any) {
      toast.show(e.message || "Couldn't reset password", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + SP.lg }]}
      testID="reset-password-screen"
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <View style={styles.badge}>
        <Ionicons name="key" size={26} color={C.brand} />
      </View>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter the code we emailed you and choose a new password.
      </Text>
      <TextInput
        testID="reset-email-input"
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor={C.textTertiary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        testID="reset-code-input"
        style={[styles.input, styles.codeInput]}
        placeholder="000000"
        placeholderTextColor={C.textTertiary}
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
      />
      <TextInput
        testID="reset-newpw-input"
        style={styles.input}
        placeholder="New password (min 6 characters)"
        placeholderTextColor={C.textTertiary}
        value={newPw}
        onChangeText={setNewPw}
        secureTextEntry
        autoCapitalize="none"
      />
      <Pressable
        testID="reset-submit"
        style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Reset password</Text>}
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
  codeInput: { fontFamily: F.bold, fontSize: 22, letterSpacing: 6, textAlign: "center" },
  cta: {
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#FFF", fontFamily: F.semibold, fontSize: 16 },
});
