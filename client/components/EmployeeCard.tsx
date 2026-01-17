import React from "react";
import { StyleSheet, View, Pressable, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { ShiftBadge } from "@/components/ShiftBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface EmployeeCardProps {
  name: string;
  slpid: string;
  employeeId: string;
  department: string;
  gender: string;
  isActive: boolean;
  shift?: string;
  onPress?: () => void;
  onEdit?: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function EmployeeCard({
  name,
  slpid,
  employeeId,
  department,
  gender,
  isActive,
  shift,
  onPress,
  onEdit,
  style,
}: EmployeeCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        { backgroundColor: theme.backgroundDefault },
        Shadows.sm,
        animatedStyle,
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Feather
            name={gender.toLowerCase() === "female" ? "user" : "user"}
            size={24}
            color={theme.link}
          />
        </View>
        <View style={styles.headerInfo}>
          <ThemedText type="h4" style={styles.name}>
            {name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {slpid} | {employeeId}
          </ThemedText>
        </View>
        {onEdit ? (
          <Pressable onPress={onEdit} style={styles.editButton}>
            <Feather name="edit-2" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Feather name="briefcase" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {department}
          </ThemedText>
        </View>
        <View style={styles.badges}>
          <StatusBadge status={isActive ? "active" : "inactive"} />
          {shift ? <ShiftBadge shift={shift} /> : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1E40AF15",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  editButton: {
    padding: Spacing.sm,
  },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  badges: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
