import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/src/api/client";

// Show a banner + play a sound even when a notification arrives while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for notification permission, get this device's Expo push token, and register it with the
 * backend so the kitchen can reach the customer (kitchen-online broadcasts, wish replies).
 *
 * Entirely best-effort: a denied prompt, a simulator with no push support, or a network blip are
 * all swallowed — this must never block or break sign-in.
 */
export async function registerPushToken(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (token) {
      await api("/me/push-token", { method: "POST", body: { token } });
    }
  } catch {
    // best-effort — never throw into the auth flow
  }
}
