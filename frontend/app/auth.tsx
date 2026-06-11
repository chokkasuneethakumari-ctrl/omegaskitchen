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
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, R, SP } from "@/src/theme";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.show("Please fill in all fields", "error");
      return;
    }
    if (mode === "signup" && (!name.trim() || phone.trim().length < 7)) {
      toast.show("Name and a valid phone number are required", "error");
      return;
    }
    if (mode === "signup" && !agreed) {
      toast.show("Please accept the Terms and Privacy Policy", "error");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const res = await login(email.trim(), password);
        if (res.kind === "2fa") {
          router.push({ pathname: "/twofa", params: { token: res.twofaToken } });
          return;
        }
        router.replace(res.user.role === "admin" ? "/admin" : "/(tabs)/home");
      } else {
        const user = await register({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        });
        router.replace(user.role === "admin" ? "/admin" : "/(tabs)/home");
      }
    } catch (e: any) {
      toast.show(e.message || "Authentication failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="auth-screen">
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SP.lg,
          paddingHorizontal: SP.xl,
          paddingBottom: insets.bottom + SP.xxl,
        }}
        bottomOffset={32}
        showsVerticalScrollIndicator={false}
      >
        <Pressable testID="auth-back-button" style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>

        <View style={styles.logoBadge}>
          <Ionicons name="restaurant" size={26} color={C.brand} />
        </View>
        <Text style={styles.title}>
          {mode === "login" ? "Welcome back" : "Join the kitchen"}
        </Text>
        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Sign in to pre-order and track your queue spot."
            : "We'll confirm your orders on your phone number."}
        </Text>

        <View style={styles.toggle}>
          {(["login", "signup"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              testID={`auth-mode-${m}`}
              onPress={() => setMode(m)}
              style={[styles.toggleItem, mode === m && styles.toggleActive]}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "signup" && (
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              testID="auth-name-input"
              style={styles.input}
              placeholder="e.g. Ravi Kumar"
              placeholderTextColor={C.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="auth-email-input"
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={C.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {mode === "signup" && (
          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              testID="auth-phone-input"
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor={C.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>Used to confirm your order at pickup</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="auth-password-input"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={C.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable
              testID="auth-toggle-password"
              style={styles.eye}
              onPress={() => setShowPassword((s) => !s)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={C.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {mode === "login" && (
          <Pressable
            testID="auth-forgot-password"
            style={styles.forgotRow}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        )}

        {mode === "signup" && (
          <Pressable
            testID="auth-agree-toggle"
            style={styles.agreeRow}
            onPress={() => setAgreed((a) => !a)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed && <Ionicons name="checkmark" size={13} color="#FFF" />}
            </View>
            <Text style={styles.agreeText}>
              I agree to the{" "}
              <Text style={styles.link} onPress={() => router.push("/legal/terms")}>
                Terms &amp; Conditions
              </Text>{" "}
              and{" "}
              <Text style={styles.link} onPress={() => router.push("/legal/privacy")}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>
        )}
        <Pressable
          testID="auth-submit-button"
          style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.ctaText}>
              {mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </Pressable>

        <View style={styles.paymentNote}>
          <Ionicons name="cash" size={16} color={C.success} />
          <Text style={styles.paymentNoteText}>Pay by cash at pickup · Online payment coming soon</Text>
        </View>
        <View style={styles.legalFooter}>
          <Text style={styles.link} onPress={() => router.push("/legal/terms")}>
            Terms
          </Text>
          <Text style={styles.legalDot}>·</Text>
          <Text style={styles.link} onPress={() => router.push("/legal/privacy")}>
            Privacy Policy
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
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
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    backgroundColor: C.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP.lg,
  },
  title: { fontFamily: F.bold, fontSize: 30, color: C.text },
  subtitle: {
    fontFamily: F.regular,
    fontSize: 14,
    color: C.textSecondary,
    marginTop: SP.xs,
    marginBottom: SP.xl,
    lineHeight: 20,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.md,
    padding: 4,
    marginBottom: SP.xl,
  },
  toggleItem: {
    flex: 1,
    height: 40,
    borderRadius: R.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: C.card,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleText: { fontFamily: F.medium, fontSize: 14, color: C.textSecondary },
  toggleTextActive: { color: C.text, fontFamily: F.semibold },
  field: { marginBottom: SP.lg },
  label: { fontFamily: F.medium, fontSize: 13, color: C.textSecondary, marginBottom: SP.sm },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    height: 50,
    paddingHorizontal: SP.lg,
    fontFamily: F.regular,
    fontSize: 15,
    color: C.text,
  },
  hint: { fontFamily: F.regular, fontSize: 12, color: C.textTertiary, marginTop: SP.xs },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  eye: {
    width: 50,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.sm,
  },
  ctaText: { color: "#FFF", fontFamily: F.semibold, fontSize: 16 },
  paymentNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    marginTop: SP.lg,
  },
  paymentNoteText: { fontFamily: F.regular, fontSize: 12, color: C.textSecondary },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: SP.sm, marginBottom: SP.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: R.sm,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: C.brand, borderColor: C.brand },
  agreeText: { flex: 1, fontFamily: F.regular, fontSize: 12.5, color: C.textSecondary, lineHeight: 18 },
  link: { fontFamily: F.semibold, color: C.brand },
  legalFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SP.sm,
    marginTop: SP.lg,
  },
  legalDot: { color: C.textTertiary, fontFamily: F.regular },
  forgotRow: { alignSelf: "flex-end", marginTop: -SP.sm, marginBottom: SP.md },
  forgotText: { fontFamily: F.semibold, fontSize: 13, color: C.brand },
});
