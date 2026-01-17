import React, { useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  duration?: number;
}

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case "success":
      return { icon: "check-circle" as const, color: Colors.light.success };
    case "error":
      return { icon: "x-circle" as const, color: Colors.light.error };
    case "warning":
      return { icon: "alert-circle" as const, color: Colors.light.warning };
    default:
      return { icon: "info" as const, color: Colors.light.link };
  }
};

export function Toast({
  visible,
  message,
  type = "info",
  onDismiss,
  duration = 4000,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);
  const { icon, color } = getToastConfig(type);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.value = withSpring(-150);
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, duration]);

  const dismiss = () => {
    translateY.value = withSpring(-150, { damping: 15 }, () => {
      runOnJS(onDismiss)();
    });
    opacity.value = withTiming(0, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: Math.max(insets.top, Spacing.md) },
        animatedStyle,
      ]}
    >
      <View style={[styles.toast, Shadows.lg]}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
        <ThemedText type="small" style={styles.message} numberOfLines={2}>
          {message}
        </ThemedText>
        <Pressable onPress={dismiss} style={styles.closeButton}>
          <Feather name="x" size={18} color="#6B7280" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    color: "#111827",
  },
  closeButton: {
    padding: Spacing.xs,
  },
});
