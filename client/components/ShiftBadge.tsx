import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ShiftBadgeProps {
  shift: string;
  style?: ViewStyle;
}

const getShiftColor = (shift: string): string => {
  const shiftLower = shift.toLowerCase();
  if (shiftLower.includes("morning") || shiftLower === "a") return "#3B82F6";
  if (shiftLower.includes("evening") || shiftLower === "b") return "#F59E0B";
  if (shiftLower.includes("night") || shiftLower === "c") return "#8B5CF6";
  return "#10B981";
};

export function ShiftBadge({ shift, style }: ShiftBadgeProps) {
  const color = getShiftColor(shift);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }, style]}>
      <ThemedText type="small" style={[styles.text, { color }]}>
        {shift.toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
  },
});
