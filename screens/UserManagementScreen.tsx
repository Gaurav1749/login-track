import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, ScrollView, Pressable, Modal, Alert, ActivityIndicator, Platform, RefreshControl } from "react-native";
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
  mustChangePassword: boolean;
}

interface PasswordResetRequest {
  id: string;
  userId: string;
  username: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export default function UserManagementScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, isAdmin } = useAuth();

  const [users, setUsers] = useState<UserData[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Welcome");
  const [newUserRole, setNewUserRole] = useState("supervisor");
  const [selectedTab, setSelectedTab] = useState<"users" | "requests">("users");

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch(new URL("/api/users", getApiUrl()).toString(), {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchResetRequests = async () => {
    setLoadingRequests(true);
    try {
      const response = await fetch(new URL("/api/password-reset-requests", getApiUrl()).toString(), {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setResetRequests(data);
      }
    } catch (error) {
      console.error("Failed to fetch reset requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchResetRequests();
    }
  }, [isAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), fetchResetRequests()]);
    setRefreshing(false);
  }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "destructive", onPress: onConfirm }
      ]);
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    confirmAction("Reset Password", `Reset password for ${userName} to "Welcome"?`, async () => {
      setActionLoading(userId);
      try {
        await apiRequest("POST", `/api/users/${userId}/reset-password`, {});
        showAlert("Success", `Password reset to "Welcome". User must change password on next login.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchUsers();
      } catch (error: any) {
        showAlert("Error", error.message || "Failed to reset password");
      } finally {
        setActionLoading(null);
      }
    });
  };

  const handleUnlockAccount = async (userId: string, userName: string) => {
    setActionLoading(userId);
    try {
      await apiRequest("POST", `/api/users/${userId}/unlock`, {});
      showAlert("Success", `Account for ${userName} has been unlocked.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchUsers();
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to unlock account");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    confirmAction("Remove User", `Are you sure you want to remove ${userName}? This action cannot be undone.`, async () => {
      setActionLoading(userId);
      try {
        await apiRequest("DELETE", `/api/users/${userId}`, undefined);
        showAlert("Success", `${userName} has been removed.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchUsers();
      } catch (error: any) {
        showAlert("Error", error.message || "Failed to remove user");
      } finally {
        setActionLoading(null);
      }
    });
  };

  const handleApproveRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await apiRequest("POST", `/api/password-reset-requests/${requestId}/approve`, {});
      showAlert("Success", "Password reset approved. User's password is now 'Welcome'.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchResetRequests();
      fetchUsers();
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to approve request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await apiRequest("POST", `/api/password-reset-requests/${requestId}/reject`, {});
      showAlert("Success", "Password reset request rejected.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchResetRequests();
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to reject request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserUsername.trim()) {
      showAlert("Error", "Please fill all required fields");
      return;
    }

    try {
      await apiRequest("POST", "/api/users", {
        name: newUserName.trim(),
        username: newUserUsername.trim(),
        password: newUserPassword || "Welcome",
        role: newUserRole,
        isActive: true,
        mustChangePassword: true
      });

      showAlert("Success", `User created with password "${newUserPassword || "Welcome"}". They must change it on first login.`);
      setShowAddUserModal(false);
      setNewUserName("");
      setNewUserUsername("");
      setNewUserPassword("Welcome");
      setNewUserRole("supervisor");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchUsers();
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to create user");
    }
  };

  const pendingRequests = resetRequests.filter(r => r.status === "pending");

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.emptyState, { paddingTop: headerHeight + Spacing.xl }]}>
          <Feather name="lock" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={{ marginTop: Spacing.lg, textAlign: "center" }}>
            Access Restricted
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
            Only Admins can access User Management.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setSelectedTab("users")}
            style={[
              styles.tab,
              { backgroundColor: selectedTab === "users" ? "#003C71" : theme.backgroundSecondary }
            ]}
          >
            <Feather name="users" size={16} color={selectedTab === "users" ? "#FFF" : theme.text} />
            <ThemedText type="body" style={{ color: selectedTab === "users" ? "#FFF" : theme.text, marginLeft: Spacing.xs }}>
              Users ({users.length})
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setSelectedTab("requests")}
            style={[
              styles.tab,
              { backgroundColor: selectedTab === "requests" ? "#003C71" : theme.backgroundSecondary }
            ]}
          >
            <Feather name="key" size={16} color={selectedTab === "requests" ? "#FFF" : theme.text} />
            <ThemedText type="body" style={{ color: selectedTab === "requests" ? "#FFF" : theme.text, marginLeft: Spacing.xs }}>
              Reset Requests
            </ThemedText>
            {pendingRequests.length > 0 ? (
              <View style={styles.badge}>
                <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700" }}>
                  {pendingRequests.length}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {selectedTab === "users" ? (
          <>
            <Pressable
              onPress={() => setShowAddUserModal(true)}
              style={[styles.addButton, { backgroundColor: "#003C71" }]}
            >
              <Feather name="user-plus" size={18} color="#FFF" />
              <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                Add New User
              </ThemedText>
            </Pressable>

            {loadingUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003C71" />
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700" }}>
                    ACTIVE USERS ({users.filter(u => u.isActive && !u.isLocked).length})
                  </ThemedText>
                </View>
                {users.filter(u => u.isActive && !u.isLocked).map((u) => (
                  <View key={u.id} style={[styles.userCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
                    <View style={styles.userInfo}>
                      <View style={styles.userHeader}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>{u.name}</ThemedText>
                        <View style={[styles.roleBadge, { backgroundColor: `${Colors.light.link}15` }]}>
                          <ThemedText type="small" style={{ color: Colors.light.link }}>
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        @{u.username}
                      </ThemedText>
                    </View>
                    <View style={styles.userActions}>
                      <Pressable
                        onPress={() => handleResetPassword(u.id, u.name)}
                        disabled={actionLoading === u.id}
                        style={[styles.actionBtn, { backgroundColor: `${Colors.light.link}15` }]}
                      >
                        {actionLoading === u.id ? (
                          <ActivityIndicator size="small" color={Colors.light.link} />
                        ) : (
                          <Feather name="key" size={16} color={Colors.light.link} />
                        )}
                      </Pressable>
                      {u.id !== user?.id ? (
                        <Pressable
                          onPress={() => handleDeleteUser(u.id, u.name)}
                          disabled={actionLoading === u.id}
                          style={[styles.actionBtn, { backgroundColor: `${Colors.light.error}15` }]}
                        >
                          <Feather name="trash-2" size={16} color={Colors.light.error} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}

                {users.filter(u => u.isLocked || !u.isActive).length > 0 ? (
                  <>
                    <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700" }}>
                        LOCKED / INACTIVE ({users.filter(u => u.isLocked || !u.isActive).length})
                      </ThemedText>
                    </View>
                    {users.filter(u => u.isLocked || !u.isActive).map((u) => (
                      <View key={u.id} style={[styles.userCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
                        <View style={styles.userInfo}>
                          <View style={styles.userHeader}>
                            <ThemedText type="body" style={{ fontWeight: "600" }}>{u.name}</ThemedText>
                            <View style={styles.statusBadges}>
                              {u.isLocked ? (
                                <View style={[styles.statusBadge, { backgroundColor: `${Colors.light.error}20` }]}>
                                  <Feather name="lock" size={12} color={Colors.light.error} />
                                  <ThemedText type="small" style={{ color: Colors.light.error, marginLeft: 4 }}>Locked</ThemedText>
                                </View>
                              ) : null}
                              {!u.isActive ? (
                                <View style={[styles.statusBadge, { backgroundColor: `${Colors.light.warning}20` }]}>
                                  <ThemedText type="small" style={{ color: Colors.light.warning }}>Inactive</ThemedText>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            @{u.username} | {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </ThemedText>
                        </View>
                        <View style={styles.userActions}>
                          {u.isLocked ? (
                            <Pressable
                              onPress={() => handleUnlockAccount(u.id, u.name)}
                              disabled={actionLoading === u.id}
                              style={[styles.actionBtn, { backgroundColor: `${Colors.light.success}15` }]}
                            >
                              {actionLoading === u.id ? (
                                <ActivityIndicator size="small" color={Colors.light.success} />
                              ) : (
                                <Feather name="unlock" size={16} color={Colors.light.success} />
                              )}
                            </Pressable>
                          ) : null}
                          <Pressable
                            onPress={() => handleResetPassword(u.id, u.name)}
                            disabled={actionLoading === u.id}
                            style={[styles.actionBtn, { backgroundColor: `${Colors.light.link}15` }]}
                          >
                            <Feather name="key" size={16} color={Colors.light.link} />
                          </Pressable>
                          {u.id !== user?.id ? (
                            <Pressable
                              onPress={() => handleDeleteUser(u.id, u.name)}
                              disabled={actionLoading === u.id}
                              style={[styles.actionBtn, { backgroundColor: `${Colors.light.error}15` }]}
                            >
                              <Feather name="trash-2" size={16} color={Colors.light.error} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            {loadingRequests ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003C71" />
              </View>
            ) : pendingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={48} color={Colors.light.success} />
                <ThemedText type="body" style={{ marginTop: Spacing.lg, textAlign: "center", color: theme.textSecondary }}>
                  No pending password reset requests
                </ThemedText>
              </View>
            ) : (
              pendingRequests.map((req) => (
                <View key={req.id} style={[styles.requestCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
                  <View style={styles.requestInfo}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      @{req.username}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Requested: {new Date(req.requestedAt).toLocaleString()}
                    </ThemedText>
                  </View>
                  <View style={styles.requestActions}>
                    <Pressable
                      onPress={() => handleApproveRequest(req.id)}
                      disabled={actionLoading === req.id}
                      style={[styles.actionBtn, { backgroundColor: `${Colors.light.success}15` }]}
                    >
                      {actionLoading === req.id ? (
                        <ActivityIndicator size="small" color={Colors.light.success} />
                      ) : (
                        <Feather name="check" size={18} color={Colors.light.success} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => handleRejectRequest(req.id)}
                      disabled={actionLoading === req.id}
                      style={[styles.actionBtn, { backgroundColor: `${Colors.light.error}15` }]}
                    >
                      <Feather name="x" size={18} color={Colors.light.error} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {resetRequests.filter(r => r.status !== "pending").length > 0 ? (
              <>
                <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700" }}>
                    RESOLVED REQUESTS
                  </ThemedText>
                </View>
                {resetRequests.filter(r => r.status !== "pending").slice(0, 10).map((req) => (
                  <View key={req.id} style={[styles.requestCard, { backgroundColor: theme.backgroundDefault, opacity: 0.7 }, Shadows.sm]}>
                    <View style={styles.requestInfo}>
                      <ThemedText type="body">@{req.username}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {req.status === "approved" ? "Approved" : "Rejected"} on {new Date(req.resolvedAt || "").toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: req.status === "approved" ? `${Colors.light.success}20` : `${Colors.light.error}20` }]}>
                      <ThemedText type="small" style={{ color: req.status === "approved" ? Colors.light.success : Colors.light.error }}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showAddUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }, Shadows.lg]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Add New User</ThemedText>
              <Pressable onPress={() => setShowAddUserModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

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
                label="Username / User ID"
                value={newUserUsername}
                onChangeText={setNewUserUsername}
                placeholder="Enter username"
                leftIcon="at-sign"
                autoCapitalize="none"
              />
              <View style={{ height: Spacing.md }} />
              <Input
                label="Initial Password"
                value={newUserPassword}
                onChangeText={setNewUserPassword}
                placeholder="Welcome"
                leftIcon="lock"
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Default password is "Welcome". User must change it on first login.
              </ThemedText>
              <View style={{ height: Spacing.lg }} />
              <ThemedText type="small" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>Role</ThemedText>
              <View style={styles.roleSelector}>
                {["supervisor", "manager", "mis", "admin"].map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setNewUserRole(role)}
                    style={[
                      styles.roleOption,
                      { 
                        backgroundColor: newUserRole === role ? "#003C71" : theme.backgroundSecondary,
                        borderColor: newUserRole === role ? "#003C71" : theme.border
                      }
                    ]}
                  >
                    <ThemedText type="small" style={{ color: newUserRole === role ? "#FFF" : theme.text }}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowAddUserModal(false)}
                style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateUser}
                style={[styles.modalButton, { backgroundColor: "#003C71" }]}
              >
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>Create User</ThemedText>
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
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  badge: {
    marginLeft: Spacing.xs,
    backgroundColor: Colors.light.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
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
    gap: Spacing.xs,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  requestInfo: {
    flex: 1,
  },
  requestActions: {
    flexDirection: "row",
    gap: Spacing.xs,
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
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  formContainer: {
    marginBottom: Spacing.xl,
  },
  roleSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  roleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
