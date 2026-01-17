import React from "react";
import { StyleSheet, View, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface WeekOffModalProps {
  visible: boolean;
  employeeName: string;
  onAllow: () => void;
  onDeny: () => void;
}

export function WeekOffModal({
  visible,
  employeeName,
  onAllow,
  onDeny,
}: WeekOffModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDeny}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.backgroundDefault }, Shadows.lg]}>
          <View style={[styles.iconContainer, { backgroundColor: `${Colors.light.warning}20` }]}>
            <Feather name="alert-triangle" size={32} color={Colors.light.warning} />
          </View>
          <ThemedText type="h3" style={styles.title}>
            Week Off Alert
          </ThemedText>
          <ThemedText type="body" style={[styles.message, { color: theme.textSecondary }]}>
            {employeeName} is present on their week off. Do you want to allow entry?
          </ThemedText>
          <View style={styles.buttons}>
            <Pressable
              onPress={onDeny}
              style={[styles.button, styles.denyButton, { borderColor: theme.border }]}
            >
              <ThemedText type="body" style={[styles.buttonText, { color: theme.text }]}>
                Deny
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onAllow}
              style={[styles.button, styles.allowButton, { backgroundColor: Colors.light.success }]}
            >
              <ThemedText type="body" style={[styles.buttonText, { color: "#FFFFFF" }]}>
                Allow Entry
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  denyButton: {
    borderWidth: 1,
  },
  allowButton: {},
  buttonText: {
    fontWeight: "600",
  },
});
