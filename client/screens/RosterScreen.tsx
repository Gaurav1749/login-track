import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, TextInput, Pressable, RefreshControl, ActivityIndicator, Modal, Platform, ScrollView, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { ThemedText } from "@/components/ThemedText";
import { ShiftBadge } from "@/components/ShiftBadge";
import { Toast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

interface Roster {
  id: string;
  slpid: string;
  employeeName: string;
  gender: string;
  department: string;
  designation: string;
  shiftName: string;
  weekOff: string;
}

const SHIFTS = ["Shift A", "Shift B", "Shift C"];
const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RosterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingRoster, setEditingRoster] = useState<Roster | null>(null);
  const [editShift, setEditShift] = useState("");
  const [editWeekOff, setEditWeekOff] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" });

  const { data: rosters = [], isLoading, refetch, isRefetching } = useQuery<Roster[]>({
    queryKey: ["/api/rosters"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, shiftName, weekOff }: { id: string; shiftName: string; weekOff: string }) => {
      const response = await apiRequest("PUT", `/api/rosters/${id}`, { shiftName, weekOff });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rosters"] });
      setToast({ visible: true, message: "Roster updated successfully", type: "success" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingRoster(null);
    },
    onError: (error: any) => {
      setToast({ visible: true, message: error?.message || "Failed to update roster", type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deleteRosterMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/rosters", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rosters"] });
      setToast({ visible: true, message: "Roster deleted successfully", type: "success" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      setToast({ visible: true, message: error?.message || "Failed to delete roster", type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleDeleteAll = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete the entire roster and all employees? This action cannot be undone.");
      if (confirmed) {
        deleteRosterMutation.mutate();
      }
      return;
    }

    Alert.alert(
      "Delete Roster & Employees",
      "Are you sure you want to delete the entire roster and all associated employees? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete All", 
          style: "destructive", 
          onPress: () => deleteRosterMutation.mutate() 
        }
      ]
    );
  };

  const filteredRosters = useMemo(() => {
    if (!searchQuery.trim()) return rosters;
    const query = searchQuery.toLowerCase();
    return rosters.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(query) ||
        r.slpid.toLowerCase().includes(query) ||
        r.department.toLowerCase().includes(query)
    );
  }, [rosters, searchQuery]);

  const handleEdit = (roster: Roster) => {
    setEditingRoster(roster);
    setEditShift(roster.shiftName);
    setEditWeekOff(roster.weekOff);
  };

  const handleSave = () => {
    if (!editingRoster) return;
    updateMutation.mutate({
      id: editingRoster.id,
      shiftName: editShift,
      weekOff: editWeekOff,
    });
  };

  const handleDownloadRoster = () => {
    const baseUrl = getApiUrl();
    const url = `${baseUrl}api/rosters/download`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  const handleDownloadTemplate = () => {
    const baseUrl = getApiUrl();
    const url = `${baseUrl}api/rosters/template`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsUploading(true);
      const file = result.assets[0];
      
      const formData = new FormData();
      
      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append("file", blob, file.name);
      } else {
        formData.append("file", {
          uri: file.uri,
          type: file.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          name: file.name,
        } as any);
      }

      const baseUrl = getApiUrl();
      const uploadResponse = await fetch(`${baseUrl}api/rosters/upload`, {
        method: "POST",
        body: formData,
        credentials: "include", // Ensure session cookie is sent
      });

      const data = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(data.message || "Upload failed");
      }

      setToast({ visible: true, message: data.message || "Roster uploaded successfully", type: "success" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/rosters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowUploadModal(false);
    } catch (error: any) {
      setToast({ visible: true, message: error?.message || "Failed to upload roster", type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  };

  const role = user?.role as string || "";
  const isReadOnly = role === "supervisor";
  const canUpload = (["admin", "manager", "mis"] as string[]).includes(role);
  const canEdit = (["admin", "manager", "mis"] as string[]).includes(role);

  const renderRosterItem = ({ item }: { item: Roster }) => (
    <View style={[styles.rosterCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
      <View style={styles.rosterHeader}>
        <View style={styles.rosterInfo}>
          <ThemedText type="h4" style={styles.rosterName}>
            {item.employeeName}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.slpid} | {item.gender || ""}
          </ThemedText>
        </View>
        {canEdit ? (
          <Pressable onPress={() => handleEdit(item)} style={styles.editButton}>
            <Feather name="edit-2" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.rosterDetails}>
        <View style={styles.detailItem}>
          <Feather name="briefcase" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.department}
          </ThemedText>
        </View>
        <ShiftBadge shift={item.shiftName} />
      </View>
      <View style={styles.weekOffRow}>
        <Feather name="calendar" size={14} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Week Off: {item.weekOff}
        </ThemedText>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: `${Colors.light.link}15` }]}>
        <Feather name="upload-cloud" size={40} color={Colors.light.link} />
      </View>
      <ThemedText type="h4" style={styles.emptyTitle}>
        No roster data
      </ThemedText>
      <ThemedText type="small" style={[styles.emptyMessage, { color: theme.textSecondary }]}>
        Upload an Excel roster file to get started
      </ThemedText>
      {canUpload ? (
        <Pressable
          onPress={() => setShowUploadModal(true)}
          style={[styles.uploadEmptyButton, { backgroundColor: Colors.light.link }]}
        >
          <Feather name="upload" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
            Upload Roster
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault, flex: 1 }, Shadows.sm]}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search roster..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          {canUpload ? (
            <Pressable
              onPress={handleDownloadRoster}
              style={[styles.uploadButton, { backgroundColor: Colors.light.success, marginRight: Spacing.xs }, Shadows.sm]}
            >
              <Feather name="download" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {canUpload ? (
            <Pressable
              onPress={handleDeleteAll}
              style={[styles.uploadButton, { backgroundColor: Colors.light.error, marginRight: Spacing.xs }, Shadows.sm]}
            >
              <Feather name="trash-2" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {canUpload ? (
            <Pressable
              onPress={() => setShowUploadModal(true)}
              style={[styles.uploadButton, { backgroundColor: Colors.light.link }, Shadows.sm]}
            >
              <Feather name="upload" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
        {canUpload ? (
          <View style={[styles.infoBanner, { backgroundColor: `${Colors.light.link}10` }]}>
            <Feather name="info" size={14} color={Colors.light.link} />
            <ThemedText type="small" style={{ color: Colors.light.link, flex: 1 }}>
              Total Manpower: {rosters.length} | Upload Excel roster or tap edit
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.infoBanner, { backgroundColor: `${Colors.light.link}10` }]}>
            <Feather name="info" size={14} color={Colors.light.link} />
            <ThemedText type="small" style={{ color: Colors.light.link, flex: 1 }}>
              Total Manpower: {rosters.length}
            </ThemedText>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.link} />
        </View>
      ) : (
        <FlatList
          data={filteredRosters}
          renderItem={renderRosterItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            flexGrow: 1,
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          scrollIndicatorInsets={{ bottom: insets.bottom }}
        />
      )}

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Upload Roster</ThemedText>
              <Pressable onPress={() => setShowUploadModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={[styles.uploadInfo, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                  Excel File Format
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  Required columns:
                </ThemedText>
                <View style={styles.columnList}>
                  {["SLPID", "Employee Name", "Gender", "Employee ID", "Department", "Designation", "Date of Joining", "Shift Name", "Week Off"].map((col) => (
                    <View key={col} style={styles.columnItem}>
                      <Feather name="check" size={12} color={Colors.light.success} />
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {col}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleDownloadTemplate}
                style={[styles.templateButton, { borderColor: Colors.light.link }]}
              >
                <Feather name="download" size={18} color={Colors.light.link} />
                <ThemedText type="body" style={{ color: Colors.light.link, fontWeight: "600" }}>
                  Download Template
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleUploadFile}
                disabled={isUploading}
                style={[styles.selectFileButton, { backgroundColor: Colors.light.link }]}
              >
                {isUploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="file-plus" size={20} color="#FFFFFF" />
                    <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                      Select Excel File
                    </ThemedText>
                  </>
                )}
              </Pressable>

              <View style={[styles.noteBox, { backgroundColor: `${Colors.light.warning}15` }]}>
                <Feather name="alert-circle" size={16} color={Colors.light.warning} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                  Existing employees will be updated, new employees will be created automatically.
                </ThemedText>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={!!editingRoster}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingRoster(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Edit Roster</ThemedText>
              <Pressable onPress={() => setEditingRoster(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {editingRoster ? (
              <View style={styles.modalBody}>
                <ThemedText type="h4">{editingRoster.employeeName}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  {editingRoster.slpid} | {editingRoster.department}
                </ThemedText>

                <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                  Shift
                </ThemedText>
                <View style={styles.optionsRow}>
                  {SHIFTS.map((shift) => (
                    <Pressable
                      key={shift}
                      onPress={() => setEditShift(shift)}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: editShift === shift ? Colors.light.link : theme.backgroundSecondary,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: editShift === shift ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                      >
                        {shift}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                  Week Off
                </ThemedText>
                <View style={styles.optionsRow}>
                  {WEEK_DAYS.map((day) => (
                    <Pressable
                      key={day}
                      onPress={() => setEditWeekOff(day)}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: editWeekOff === day ? Colors.light.link : theme.backgroundSecondary,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: editWeekOff === day ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                      >
                        {day.slice(0, 3)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    onPress={() => setEditingRoster(null)}
                    style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
                  >
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={updateMutation.isPending}
                    style={[styles.modalButton, { backgroundColor: Colors.light.link }]}
                  >
                    {updateMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                        Save Changes
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  uploadButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  rosterCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  rosterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  rosterInfo: {
    flex: 1,
  },
  rosterName: {
    marginBottom: Spacing.xs,
  },
  editButton: {
    padding: Spacing.sm,
  },
  rosterDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  weekOffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  uploadEmptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalBody: {},
  uploadInfo: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  columnList: {
    gap: Spacing.xs,
  },
  columnItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  templateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  selectFileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
