import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F, R, SP } from "@/src/theme";

export interface LegalSection {
  heading: string;
  body: string;
}

export default function LegalLayout({
  title,
  updated,
  intro,
  sections,
  testID,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
  testID?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container} testID={testID}>
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Pressable style={styles.back} onPress={() => router.back()} testID="legal-back">
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: insets.bottom + SP.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated {updated}</Text>
        {intro ? <Text style={[styles.body, { marginTop: SP.md }]}>{intro}</Text> : null}
        {sections.map((s, i) => (
          <View key={i} style={{ marginTop: SP.lg }}>
            <Text style={styles.heading}>{`${i + 1}. ${s.heading}`}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.disclaimer}>
          This document is a general template included with the app and is not legal advice. Have it
          reviewed by a qualified professional and tailored to your business before public release.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { fontFamily: F.bold, fontSize: 20, color: C.text },
  updated: { fontFamily: F.regular, fontSize: 12, color: C.textTertiary },
  heading: { fontFamily: F.semibold, fontSize: 16, color: C.text, marginBottom: SP.xs },
  body: { fontFamily: F.regular, fontSize: 14, color: C.textSecondary, lineHeight: 21 },
  disclaimer: {
    fontFamily: F.regular,
    fontSize: 12,
    color: C.textTertiary,
    lineHeight: 18,
    marginTop: SP.xl,
    fontStyle: "italic",
  },
});
