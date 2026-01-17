import React, { useState } from "react";
import { StyleSheet, View, Image, Pressable, ActivityIndicator, Modal, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
import { Toast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { login, clearMustChangePassword } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<"error" | "success">("error");

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [tempUserData, setTempUserData] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);

  const showToast = (message: string, type: "error" | "success" = "error") => {
    setError(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showToast("Please enter both username and password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const userData = await login(username.trim(), password);
      
      if (userData.mustChangePassword) {
        setTempUserData(userData);
        setCurrentPassword(password);
        setShowChangePassword(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      const message = err?.message || "Invalid credentials. Please try again.";
      showToast(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotUsername.trim()) {
      showToast("Please enter your User ID");
      return;
    }

    setForgotLoading(true);
    try {
      const response = await fetch(new URL("/api/auth/forgot-password", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || "Reset request submitted successfully", "success");
        setShowForgotPassword(false);
        setForgotUsername("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showToast(data.message || "Failed to submit reset request");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      showToast("Failed to submit reset request");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showToast("Please fill all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters");
      return;
    }
    if (newPassword === "Welcome") {
      showToast("Please choose a different password");
      return;
    }

    setChangeLoading(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword
      });

      showToast("Password changed successfully", "success");
      clearMustChangePassword();
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showToast(error.message || "Failed to change password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.gradient, { backgroundColor: "#003C71" }]} />
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={styles.appName}>
            AttendanceHub
          </ThemedText>
          <ThemedText type="body" style={styles.tagline}>
            Maersk Offroll Staff Management
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }, Shadows.md]}>
          <View style={styles.form}>
            <Input
              label="User ID / Username"
              placeholder="Enter your user ID"
              value={username}
              onChangeText={setUsername}
              leftIcon="user"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              leftIcon="lock"
              isPassword
              autoCapitalize="none"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.loginButton,
              { backgroundColor: "#003C71", opacity: pressed || isLoading ? 0.8 : 1 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText type="body" style={styles.loginButtonText}>
                Sign In
              </ThemedText>
            )}
          </Pressable>

          <Pressable onPress={() => setShowForgotPassword(true)} style={styles.forgotPassword}>
            <ThemedText type="small" style={{ color: Colors.light.link }}>
              Forgot Password?
            </ThemedText>
          </Pressable>

          <View style={styles.developedBy}>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", opacity: 0.6 }}>
              Developed by Gaurav Bhati
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" style={[styles.footer, { color: "rgba(255,255,255,0.7)" }]}>
          Contact your administrator for access
        </ThemedText>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showForgotPassword}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }, Shadows.lg]}>
            <View style={[styles.modalIcon, { backgroundColor: `${Colors.light.link}15` }]}>
              <Feather name="key" size={28} color={Colors.light.link} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Forgot Password
            </ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Enter your User ID to request a password reset. Admin will review and approve your request.
            </ThemedText>
            
            <View style={styles.formContainer}>
              <Input
                label="User ID"
                value={forgotUsername}
                onChangeText={setForgotUsername}
                placeholder="Enter your user ID"
                leftIcon="user"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowForgotPassword(false);
                  setForgotUsername("");
                }}
                style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleForgotPassword}
                disabled={forgotLoading}
                style={[styles.modalButton, { backgroundColor: "#003C71" }]}
              >
                {forgotLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Submit Request
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showChangePassword}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }, Shadows.lg]}>
            <View style={[styles.modalIcon, { backgroundColor: `${Colors.light.warning}15` }]}>
              <Feather name="alert-triangle" size={28} color={Colors.light.warning} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Change Your Password
            </ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              You must create a new password before continuing. Your current password is temporary.
            </ThemedText>
            
            <View style={styles.formContainer}>
              <Input
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                leftIcon="lock"
                isPassword
              />
              <View style={{ height: Spacing.md }} />
              <Input
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                leftIcon="check-circle"
                isPassword
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                Password must be at least 6 characters and different from "Welcome"
              </ThemedText>
            </View>
            
            <Pressable
              onPress={handleChangePassword}
              disabled={changeLoading}
              style={[styles.changeButton, { backgroundColor: "#003C71" }]}
            >
              {changeLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Set New Password
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toastVisible}
        message={error}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  appName: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  tagline: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    marginBottom: Spacing["2xl"],
  },
  form: {
    gap: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  loginButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  forgotPassword: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  developedBy: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  footer: {
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  formContainer: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  changeButton: {
    width: "100%",
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
