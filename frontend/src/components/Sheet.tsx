import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F, R, SP } from "@/src/theme";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}

export default function Sheet({ visible, onClose, title, children, testID }: SheetProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [visible, slide]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: slide }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} testID="sheet-backdrop" />
        </Animated.View>
        <Animated.View
          testID={testID}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, SP.lg),
              transform: [
                {
                  translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    paddingHorizontal: SP.lg,
    paddingTop: SP.md,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: R.pill,
    backgroundColor: C.borderStrong,
    marginBottom: SP.md,
  },
  title: {
    fontFamily: F.bold,
    fontSize: 20,
    color: C.text,
    marginBottom: SP.lg,
  },
});
