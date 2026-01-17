import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface StatusBadgeProps {
  status: "active" | "inactive" | "present" | "absent";
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const isPositive = status === "active" || status === "present";
  const color = isPositive ? Colors.light.success : Colors.light.error;
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" style={[styles.text, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: "600",
    fontSize: 12,
  },
});
