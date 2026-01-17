import React, { useState } from "react";
import { StyleSheet, TextInput, View, Pressable, TextInputProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  leftIcon,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? Colors.light.error
    : isFocused
      ? theme.link
      : theme.border;

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor,
          },
        ]}
      >
        {leftIcon ? (
          <Feather
            name={leftIcon}
            size={20}
            color={theme.textSecondary}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              paddingLeft: leftIcon ? 0 : Spacing.lg,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText
          type="small"
          style={[styles.error, { color: Colors.light.error }]}
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    height: Spacing.inputHeight,
  },
  leftIcon: {
    marginLeft: Spacing.lg,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    paddingRight: Spacing.lg,
  },
  eyeButton: {
    padding: Spacing.md,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
