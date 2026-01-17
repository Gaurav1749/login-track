import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface MetricCardProps {
  title: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  subtitle?: string;
  style?: ViewStyle;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.5,
  stiffness: 100,
};

export function MetricCard({
  title,
  value,
  icon,
  color,
  subtitle,
  style,
}: MetricCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconColor = color || theme.link;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
        },
        Shadows.md,
        animatedStyle,
        style,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
        <Feather name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.content}>
        <ThemedText
          type="small"
          style={[styles.title, { color: theme.textSecondary }]}
        >
          {title}
        </ThemedText>
        <ThemedText style={[styles.value, { color: theme.text }]}>
          {value.toLocaleString()}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            type="small"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
});
