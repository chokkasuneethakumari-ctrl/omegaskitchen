import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, R, SP } from "@/src/theme";

// Native in-app Google Sign-In (no browser): Google Play Services shows the account-picker sheet
// right inside the app. The Web client ID is the audience for the returned id_token; the Android
// OAuth client (package + SHA-1) authorises the app. Configured once at module load.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export default function GoogleSignInButton() {
  const { googleSignIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();
      if (res.type !== "success") {
        return; // user dismissed the picker
      }
      const idToken = res.data?.idToken;
      if (!idToken) {
        toast.show("Google didn't return a token — check the OAuth setup", "error");
        return;
      }
      const u = await googleSignIn(idToken);
      router.replace(u.role === "admin" ? "/admin" : "/(tabs)/home");
    } catch (e: any) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) {
          // user cancelled / already in progress — stay quiet
        } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          toast.show("Google Play Services isn't available on this device", "error");
        } else {
          toast.show(e.message || "Google sign-in failed", "error");
        }
      } else {
        toast.show(e?.message || "Google sign-in failed", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      testID="google-signin-button"
      style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color={C.text} />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color={C.text} />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    height: 52,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: SP.md,
  },
  text: { fontFamily: F.semibold, fontSize: 15, color: C.text },
});
