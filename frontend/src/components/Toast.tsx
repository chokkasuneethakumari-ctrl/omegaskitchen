import { Ionicons } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F, R, SP } from "@/src/theme";

type ToastType = "success" | "error" | "info";

interface ToastCtx {
  show(message: string, type?: ToastType): void;
}

const ToastContext = createContext<ToastCtx | undefined>(undefined);

const META: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: C.success, icon: "checkmark-circle" },
  error: { bg: C.error, icon: "alert-circle" },
  info: { bg: C.info, icon: "information-circle" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          () => setToast(null),
        );
      }, 2800);
    },
    [anim],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? (
          <Animated.View
            pointerEvents="none"
            testID="toast-banner"
            style={[
              styles.toast,
              {
                top: insets.top + SP.sm,
                backgroundColor: META[toast.type].bg,
                opacity: anim,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name={META[toast.type].icon as any} size={18} color="#FFF" />
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: SP.lg,
    right: SP.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
    borderRadius: R.md,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 9999,
  },
  text: { flex: 1, color: "#FFF", fontFamily: F.medium, fontSize: 14 },
});
