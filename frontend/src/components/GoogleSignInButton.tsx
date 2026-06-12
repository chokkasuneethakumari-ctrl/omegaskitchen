import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { C, F, R, SP } from "@/src/theme";

// Required so the in-app browser auth session resolves on return.
WebBrowser.maybeCompleteAuthSession();

// Rendered only by the auth screen when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set, so the
// auth-session hook never runs in a build without Google configured.
export default function GoogleSignInButton() {
  const { googleSignIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type !== "success") {
      if (response.type === "error") toast.show("Google sign-in couldn't complete", "error");
      return;
    }
    const idToken = response.params?.id_token || response.authentication?.idToken;
    if (!idToken) {
      toast.show("Google didn't return a token — check the OAuth setup", "error");
      return;
    }
    setBusy(true);
    googleSignIn(idToken)
      .then((u) => router.replace(u.role === "admin" ? "/admin" : "/(tabs)/home"))
      .catch((e: any) => toast.show(e.message || "Google sign-in failed", "error"))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Pressable
      testID="google-signin-button"
      style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.85 }]}
      onPress={() => promptAsync()}
      disabled={!request || busy}
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
