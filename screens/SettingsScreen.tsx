import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, Modal, Alert, ActivityIndicator, FlatList, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { apiRequest, queryClient, getApiUrl } from "@/lib/query-client";

interface UserData {
  id: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("supervisor");
  const [newUserIsActive, setNewUserIsActive] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch(new URL("/api/users", getApiUrl()).toString(), {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setUsers(data);
        }
      } else {
        console.error("Failed to fetch users: ", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (showUserManagement && isAdmin) {
      fetchUsers();
    }
  }, [showUserManagement]);

  useEffect(() => {
    if (showUserManagement && isAdmin && users.length === 0 && !loadingUsers) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleResetPassword = async (userId: string, userName: string) => {
    const doReset = async () => {
      setActionLoading(userId);
      try {
        await apiRequest("POST", `/api/users/${userId}/reset-password`, {});
        if (Platform.OS === "web") {
          alert(`Password reset to "Welcome". User must change password on next login.`);
        } else {
          Alert.alert("Success", `Password reset to "Welcome". User must change password on next login.`);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchUsers();
      } catch (error: any) {
        if (Platform.OS === "web") {
          alert(error.message || "Failed to reset password");
        } else {
          Alert.alert("Error", error.message || "Failed to reset password");
        }
      } finally {
        setActionLoading(null);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Reset password for ${userName} to "Welcome"?`);
      if (confirmed) {
        doReset();
      }
    } else {
      Alert.alert(
        "Reset Password",
        `Reset password for ${userName} to "Welcome"?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: doReset }
        ]
      );
    }
  };

  const handleUnlockAccount = async (userId: string, userName: string) => {
    setActionLoading(userId);
    try {
      await apiRequest("POST", `/api/users/${userId}/unlock`, {});
      Alert.alert("Success", `Account for ${userName} has been unlocked.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchUsers();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to unlock account");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserUsername || !newUserPassword) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }
    
    try {
      const response = await apiRequest("POST", "/api/users", {
        name: newUserName,
        username: newUserUsername,
        password: newUserPassword,
        role: newUserRole,
        isActive: newUserIsActive
      });
      
      if (response) {
        Alert.alert("Success", "User created successfully");
        setShowAddUserModal(false);
        setNewUserName("");
        setNewUserUsername("");
        setNewUserPassword("");
        setNewUserRole("supervisor");
        setNewUserIsActive(true);
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create user");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword
      });
      
      Alert.alert("Success", "Password changed successfully");
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to change password");
    }
  };

  const roleLabel = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : "";

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const role = user?.role as string || "";
  const isSupervisor = role === "supervisor";
  const isMIS = role === "mis";
  const isManager = role === "manager";

  const renderMenuItem = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightContent?: React.ReactNode
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : theme.backgroundDefault },
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${Colors.light.link}15` }]}>
        <Feather name={icon} size={20} color={Colors.light.link} />
      </View>
      <View style={styles.menuContent}>
        <ThemedText type="body" style={{ fontWeight: "500" }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightContent || <Feather name="chevron-right" size={20} color={theme.textSecondary} />}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={[styles.profileCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <View style={[styles.avatar, { backgroundColor: `${Colors.light.link}15` }]}>
            <ThemedText type="h2" style={{ color: Colors.light.link }}>
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </ThemedText>
          </View>
          <View style={styles.profileInfo}>
            <ThemedText type="h3">{user?.name || "User"}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {user?.username || ""}
            </ThemedText>
          </View>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: isAdmin ? `${Colors.light.link}20` : `${Colors.light.success}20` },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: isAdmin ? Colors.light.link : Colors.light.success,
                fontWeight: "600",
              }}
            >
              {roleLabel || ""}
            </ThemedText>
          </View>
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              System Administration
            </ThemedText>
            <View style={[styles.menuCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
              {renderMenuItem("users", "User Management", "Manage users, reset passwords, unlock accounts", () => setShowUserManagement(true))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Account
          </ThemedText>
          <View style={[styles.menuCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
            {renderMenuItem("user", "Profile", "View and edit your profile")}
            {renderMenuItem("lock", "Change Password", "Update your password", () => setShowPasswordModal(true))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Preferences
          </ThemedText>
          <View style={[styles.menuCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
            {renderMenuItem("bell", "Notifications", "Manage notification settings")}
            {renderMenuItem(
              "moon",
              "Appearance",
              "System default",
              undefined,
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Auto
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            About
          </ThemedText>
          <View style={[styles.menuCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
            {renderMenuItem(
              "info",
              "Version",
              undefined,
              undefined,
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                1.0.0
              </ThemedText>
            )}
            {renderMenuItem("help-circle", "Help & Support")}
          </View>
        </View>

        <Pressable
          onPress={() => setShowLogoutModal(true)}
          style={[styles.logoutButton, { backgroundColor: `${Colors.light.error}10` }]}
        >
          <Feather name="log-out" size={20} color={Colors.light.error} />
          <ThemedText type="body" style={{ color: Colors.light.error, fontWeight: "600" }}>
            Sign Out
          </ThemedText>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }, Shadows.lg]}>
            <View style={[styles.modalIcon, { backgroundColor: `${Colors.light.error}15` }]}>
              <Feather name="log-out" size={28} color={Colors.light.error} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Sign Out?
            </ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Are you sure you want to sign out of your account?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowLogoutModal(false)}
                style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleLogout}
                style={[styles.modalButton, { backgroundColor: Colors.light.error }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Sign Out
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault, maxWidth: 380 }, Shadows.lg]}>
            <View style={[styles.modalIcon, { backgroundColor: `${Colors.light.link}15` }]}>
              <Feather name="lock" size={28} color={Colors.light.link} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Change Password
            </ThemedText>
            <View style={styles.formContainer}>
              <Input
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                leftIcon="key"
                isPassword
              />
              <View style={{ height: Spacing.md }} />
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
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleChangePassword}
                style={[styles.modalButton, { backgroundColor: Colors.light.link }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Update
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUserManagement}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserManagement(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.userManagementModal, { backgroundColor: theme.backgroundDefault }, Shadows.lg]}>
            <View style={styles.userManagementHeader}>
              <ThemedText type="h3">User Management</ThemedText>
              <Pressable onPress={() => setShowUserManagement(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            <Pressable
              onPress={() => setShowAddUserModal(true)}
              style={[styles.addUserButton, { backgroundColor: Colors.light.link }]}
            >
              <Feather name="user-plus" size={18} color="#FFF" />
              <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
                Add New User
              </ThemedText>
            </Pressable>

            {loadingUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.link} />
              </View>
            ) : (
              <ScrollView 
                style={styles.userList} 
                showsVerticalScrollIndicator={true} 
                contentContainerStyle={{ paddingBottom: Spacing.xl }}
                nestedScrollEnabled={true}
              >
                {/* Active Users Section */}
                <View style={styles.userSectionHeader}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                    ACTIVE USERS ({users.filter(u => u.isActive && !u.isLocked).length})
                  </ThemedText>
                </View>
                {users.filter(u => u.isActive && !u.isLocked).map((u) => (
                  <View key={u.id} style={[styles.userCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={styles.userInfo}>
                      <View style={styles.userHeader}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>{u.name}</ThemedText>
                        <View style={styles.statusBadges}>
                          <View style={[styles.statusBadge, { backgroundColor: `${Colors.light.success}20` }]}>
                            <ThemedText type="small" style={{ color: Colors.light.success }}>Active</ThemedText>
                          </View>
                        </View>
                      </View>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        @{u.username} | {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </ThemedText>
                    </View>
                    <View style={styles.userActions}>
                      <Pressable
                        onPress={() => handleResetPassword(u.id, u.name)}
                        disabled={actionLoading === u.id}
                        style={[styles.actionButton, { backgroundColor: `${Colors.light.link}15` }]}
                      >
                        {actionLoading === u.id ? (
                          <ActivityIndicator size="small" color={Colors.light.link} />
                        ) : (
                          <>
                            <Feather name="key" size={14} color={Colors.light.link} />
                            <ThemedText type="small" style={{ color: Colors.light.link, marginLeft: 4 }}>Reset Pwd</ThemedText>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}

                {/* Blocked/Inactive Users Section */}
                {users.filter(u => u.isLocked || !u.isActive).length > 0 && (
                  <>
                    <View style={[styles.userSectionHeader, { marginTop: Spacing.xl }]}>
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>
                        BLOCKED / INACTIVE ({users.filter(u => u.isLocked || !u.isActive).length})
                      </ThemedText>
                    </View>
                    {users.filter(u => u.isLocked || !u.isActive).map((u) => (
                      <View key={u.id} style={[styles.userCard, { backgroundColor: theme.backgroundSecondary }]}>
                        <View style={styles.userInfo}>
                          <View style={styles.userHeader}>
                            <ThemedText type="body" style={{ fontWeight: "600" }}>{u.name}</ThemedText>
                            <View style={styles.statusBadges}>
                              {u.isLocked && (
                                <View style={[styles.statusBadge, { backgroundColor: `${Colors.light.error}20` }]}>
                                  <Feather name="lock" size={12} color={Colors.light.error} />
                                  <ThemedText type="small" style={{ color: Colors.light.error, marginLeft: 4 }}>Locked</ThemedText>
                                </View>
                              )}
                              {!u.isActive && (
                                <View style={[styles.statusBadge, { backgroundColor: `${Colors.light.warning}20` }]}>
                                  <ThemedText type="small" style={{ color: Colors.light.warning }}>Inactive</ThemedText>
                                </View>
                              )}
                            </View>
                          </View>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            @{u.username} | {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </ThemedText>
                        </View>
                        <View style={styles.userActions}>
                          {u.isLocked && (
                            <Pressable
                              onPress={() => handleUnlockAccount(u.id, u.name)}
                              disabled={actionLoading === u.id}
                              style={[styles.actionButton, { backgroundColor: `${Colors.light.success}15` }]}
                            >
                              <Feather name="unlock" size={14} color={Colors.light.success} />
                              <ThemedText type="small" style={{ color: Colors.light.success, marginLeft: 4 }}>Unlock</ThemedText>
                            </Pressable>
                          )}
                          <Pressable
                            onPress={() => handleResetPassword(u.id, u.name)}
                            disabled={actionLoading === u.id}
                            style={[styles.actionButton, { backgroundColor: `${Colors.light.link}15` }]}
                          >
                            <Feather name="key" size={14} color={Colors.light.link} />
                            <ThemedText type="small" style={{ color: Colors.light.link, marginLeft: 4 }}>Reset Pwd</ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault, maxWidth: 400 }, Shadows.lg]}>
            <View style={[styles.modalIcon, { backgroundColor: `${Colors.light.link}15` }]}>
              <Feather name="user-plus" size={28} color={Colors.light.link} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Add New User
            </ThemedText>
            <ScrollView style={{ width: '100%', maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <Input
                  label="Full Name"
                  value={newUserName}
                  onChangeText={setNewUserName}
                  placeholder="Enter full name"
                  leftIcon="user"
                />
                <View style={{ height: Spacing.md }} />
                <Input
                  label="User ID"
                  value={newUserUsername}
                  onChangeText={setNewUserUsername}
                  placeholder="Enter unique user ID"
                  leftIcon="at-sign"
                  autoCapitalize="none"
                />
                <View style={{ height: Spacing.md }} />
                <Input
                  label="Password"
                  value={newUserPassword}
                  onChangeText={setNewUserPassword}
                  placeholder="Enter password"
                  leftIcon="lock"
                  isPassword
                />
                <View style={{ height: Spacing.lg }} />
                
                <View style={styles.inputContainer}>
                  <ThemedText type="small" style={styles.label}>Role</ThemedText>
                  <View style={styles.pickerContainer}>
                    {["admin", "manager", "mis", "supervisor"].map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => setNewUserRole(r)}
                        style={[
                          styles.roleOption,
                          newUserRole === r && { backgroundColor: Colors.light.link, borderColor: Colors.light.link }
                        ]}
                      >
                        <ThemedText style={{ color: newUserRole === r ? "#FFF" : theme.text, fontSize: 13, fontWeight: "500" }}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <ThemedText type="body">Active Status</ThemedText>
                  <Pressable 
                    onPress={() => setNewUserIsActive(!newUserIsActive)}
                    style={[styles.switch, { backgroundColor: newUserIsActive ? Colors.light.success : theme.border }]}
                  >
                    <View style={[styles.switchThumb, { marginLeft: newUserIsActive ? 22 : 2 }]} />
                  </Pressable>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setShowAddUserModal(false);
                  setNewUserName("");
                  setNewUserUsername("");
                  setNewUserPassword("");
                  setNewUserRole("supervisor");
                  setNewUserIsActive(true);
                }}
                style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await handleCreateUser();
                  fetchUsers();
                }}
                style={[styles.modalButton, { backgroundColor: Colors.light.link }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Create User
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  roleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.link,
    minWidth: 80,
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    marginTop: Spacing.md,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  formContainer: {
    padding: Spacing.md,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing["2xl"],
    gap: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginBottom: Spacing["2xl"],
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
  userManagementModal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  userManagementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  addUserButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  userList: {
    flex: 1,
  },
  userCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  userInfo: {
    marginBottom: Spacing.sm,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statusBadges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  userActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "flex-end",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  userSectionHeader: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: Spacing.sm,
  },
});
