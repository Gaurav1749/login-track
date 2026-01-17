import React, { useState } from "react";
import { StyleSheet, View, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ShiftBadge } from "@/components/ShiftBadge";
import { Toast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

interface PresentEmployee {
  id: string;
  attendanceId: string;
  slpid: string;
  name: string;
  department: string;
  shift: string;
  gateInTime: string;
  hoursWorked: number;
  isSelected: boolean;
}

export default function GateOutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" });

  const { data: presentEmployees = [], isLoading, refetch, isRefetching } = useQuery<PresentEmployee[]>({
    queryKey: ["/api/gate/present"],
  });

  const gateOutMutation = useMutation({
    mutationFn: async (attendanceIds: string[]) => {
      const response = await apiRequest("POST", "/api/gate/bulk-out", { attendanceIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gate/present"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setToast({
        visible: true,
        message: `${data.count || selectedIds.size} employees marked as Gate Out`,
        type: "success",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      setToast({
        visible: true,
        message: error?.message || "Failed to process Gate Out",
        type: "error",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectAll = () => {
    if (selectedIds.size === presentEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(presentEmployees.map((e) => e.attendanceId)));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleBulkGateOut = () => {
    if (selectedIds.size === 0) {
      setToast({ visible: true, message: "Please select employees to Gate Out", type: "error" });
      return;
    }
    gateOutMutation.mutate(Array.from(selectedIds));
  };

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const renderEmployee = ({ item }: { item: PresentEmployee }) => {
    const isSelected = selectedIds.has(item.attendanceId);
    const isOT = item.hoursWorked >= 9;

    return (
      <Pressable
        onPress={() => toggleSelection(item.attendanceId)}
        style={[
          styles.employeeCard,
          { backgroundColor: theme.backgroundDefault, borderColor: isSelected ? Colors.light.link : "transparent" },
          Shadows.sm,
        ]}
      >
        <View style={[styles.checkbox, { borderColor: isSelected ? Colors.light.link : theme.border, backgroundColor: isSelected ? Colors.light.link : "transparent" }]}>
          {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
        </View>
        <View style={styles.employeeInfo}>
          <View style={styles.employeeHeader}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {item.name}
            </ThemedText>
            <ShiftBadge shift={item.shift} />
          </View>
          <View style={styles.employeeDetails}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.slpid} | {item.department}
            </ThemedText>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Feather name="log-in" size={14} color={Colors.light.success} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {formatTime(item.gateInTime)}
              </ThemedText>
            </View>
            <View style={styles.timeItem}>
              <Feather name="clock" size={14} color={isOT ? Colors.light.warning : theme.textSecondary} />
              <ThemedText type="small" style={{ color: isOT ? Colors.light.warning : theme.textSecondary, fontWeight: isOT ? "600" : "400" }}>
                {item.hoursWorked.toFixed(1)}h {isOT ? "(OT)" : ""}
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: `${Colors.light.success}15` }]}>
        <Feather name="check-circle" size={40} color={Colors.light.success} />
      </View>
      <ThemedText type="h4" style={styles.emptyTitle}>
        No Active Entries
      </ThemedText>
      <ThemedText type="small" style={[styles.emptyMessage, { color: theme.textSecondary }]}>
        All employees have been gated out for today
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.headerRow}>
          <ThemedText type="h4">
            {presentEmployees.length} Present
          </ThemedText>
          <Pressable onPress={selectAll} style={styles.selectAllButton}>
            <ThemedText type="small" style={{ color: Colors.light.link, fontWeight: "600" }}>
              {selectedIds.size === presentEmployees.length ? "Deselect All" : "Select All"}
            </ThemedText>
          </Pressable>
        </View>
        {selectedIds.size > 0 ? (
          <View style={[styles.selectionBar, { backgroundColor: `${Colors.light.link}10` }]}>
            <ThemedText type="small" style={{ color: Colors.light.link }}>
              {selectedIds.size} selected
            </ThemedText>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.link} />
        </View>
      ) : (
        <FlatList
          data={presentEmployees}
          renderItem={renderEmployee}
          keyExtractor={(item) => item.attendanceId}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl + 70,
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

      {presentEmployees.length > 0 ? (
        <View style={[styles.footer, { bottom: tabBarHeight + Spacing.lg, backgroundColor: theme.backgroundRoot }]}>
          <Pressable
            onPress={handleBulkGateOut}
            disabled={gateOutMutation.isPending || selectedIds.size === 0}
            style={[
              styles.gateOutButton,
              { backgroundColor: Colors.light.error, opacity: selectedIds.size === 0 ? 0.5 : 1 },
              Shadows.md,
            ]}
          >
            {gateOutMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="log-out" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Gate Out ({selectedIds.size})
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  selectAllButton: {
    padding: Spacing.sm,
  },
  selectionBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  employeeInfo: {
    flex: 1,
  },
  employeeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  employeeDetails: {
    marginBottom: Spacing.sm,
  },
  timeRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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
  },
  footer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
  },
  gateOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
  },
});
