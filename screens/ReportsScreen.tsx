import React, { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, Platform, Linking, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemedText } from "@/components/ThemedText";
import { Toast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

interface AttendanceRecord {
  id: string;
  employeeName: string;
  slpid: string;
  employeeIdCode: string;
  gender: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  weekOff: string;
  date: string;
  gateInTime: string;
  gateOutTime: string | null;
  shiftName: string;
  isWeekOffEntry: boolean;
  isOvertime: boolean;
  totalHours: string;
  otHours: string;
  status: string;
}

const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const DEPARTMENTS = ["All", "Inbound", "Outbound", "Returns", "Inventory", "VNA"];

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [onlyAbsent, setOnlyAbsent] = useState(false);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" });

  const { user } = useAuth();
  const role = user?.role as string || "";
  const isSupervisor = role === "supervisor";

  const { data: attendanceData = [], isLoading, refetch, isFetching } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/reports", formatDate(fromDate), formatDate(toDate), departmentFilter !== "All" ? departmentFilter : ""],
    enabled: hasSearched,
  });

  const handleSearch = () => {
    if (fromDate > toDate) {
      setToast({ visible: true, message: "From date cannot be after To date", type: "error" });
      return;
    }
    setHasSearched(true);
    refetch();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleExport = async (type: "summary" | "detailed" | "newJoiners") => {
    setIsExporting(true);
    try {
      const baseUrl = getApiUrl();
      const params = new URLSearchParams({ 
        fromDate: formatDate(fromDate), 
        toDate: formatDate(toDate) 
      });
      if (departmentFilter !== "All") params.append("department", departmentFilter);
      
      let endpoint = type === "summary" ? "export" : "export-detailed";
      if (type === "newJoiners") endpoint = "export-new-joiners";

      const url = `${baseUrl}api/reports/${endpoint}?${params.toString()}`;
      
      if (Platform.OS === "web") {
        window.open(url, "_blank");
        setToast({ visible: true, message: "Download started", type: "success" });
      } else {
        await Linking.openURL(url);
        setToast({ visible: true, message: "Download started", type: "success" });
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setToast({ visible: true, message: "Failed to export data", type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsExporting(false);
    }
  };

  const onFromDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowFromDatePicker(false);
      if (selectedDate) {
        setFromDate(selectedDate);
      }
    } else {
      // iOS handling
      if (selectedDate) {
        setFromDate(selectedDate);
      }
      if (event.type === "dismissed") {
        setShowFromDatePicker(false);
      }
    }
  };

  const onToDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowToDatePicker(false);
      if (selectedDate) {
        setToDate(selectedDate);
      }
    } else {
      // iOS handling
      if (selectedDate) {
        setToDate(selectedDate);
      }
      if (event.type === "dismissed") {
        setShowToDatePicker(false);
      }
    }
  };

  const renderTableRow = (record: AttendanceRecord) => {
    const gateInDate = record.gateInTime ? new Date(record.gateInTime).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }) : "--/--/----";

    return (
      <View key={record.id} style={[styles.tableRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.tableCell, { width: 100 }]}>
          <ThemedText type="small" style={{ fontWeight: "600" }}>
            {record.employeeName}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
            {record.slpid}
          </ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 70 }]}>
          <ThemedText type="small">{record.department}</ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 70 }]}>
          <ThemedText type="small">{record.shiftName}</ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 80 }]}>
          <ThemedText type="small">{record.date}</ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 70 }]}>
          <ThemedText type="small">{gateInDate}</ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 60 }]}>
          <ThemedText type="small">
            {record.gateInTime ? new Date(record.gateInTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
          </ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 60 }]}>
          <ThemedText type="small">
            {record.gateOutTime 
              ? new Date(record.gateOutTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
              : "--:--"}
          </ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 50 }]}>
          <ThemedText type="small" style={{ fontWeight: "600" }}>
            {record.totalHours}h
          </ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 45 }]}>
          <ThemedText 
            type="small" 
            style={{ 
              color: parseFloat(record.otHours) > 0 ? Colors.light.warning : theme.textSecondary,
              fontWeight: parseFloat(record.otHours) > 0 ? "600" : "400"
            }}
          >
            {record.otHours}h
          </ThemedText>
        </View>
        <View style={[styles.tableCell, { width: 40 }]}>
          <View style={[styles.statusBadge, { backgroundColor: record.status === "A" ? `${Colors.light.error}20` : `${Colors.light.success}20` }]}>
            <ThemedText type="small" style={{ color: record.status === "A" ? Colors.light.error : Colors.light.success, fontSize: 10, fontWeight: "600" }}>
              {record.status}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

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
        {/* Filter Card */}
        <View style={[styles.filterCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Select Date Range
          </ThemedText>
          
          <View style={styles.dateFilters}>
            <View style={styles.datePickerContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                From Date *
              </ThemedText>
              <Pressable
                onPress={() => setShowFromDatePicker(true)}
                style={[styles.dateInput, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <Feather name="calendar" size={16} color={theme.textSecondary} />
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={formatDate(fromDate)}
                    onChange={(e: any) => setFromDate(new Date(e.target.value))}
                    style={{ 
                      flex: 1, 
                      color: theme.text, 
                      backgroundColor: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: "16px",
                      fontFamily: "inherit"
                    }}
                  />
                ) : (
                  <ThemedText type="body">
                    {fromDate.toLocaleDateString()}
                  </ThemedText>
                )}
              </Pressable>
              {showFromDatePicker && Platform.OS !== "web" && (
                <View style={Platform.OS === "ios" ? [styles.iosPickerContainer, { position: "absolute", top: 80, left: 0, right: 0, width: 300 }] : null}>
                  {Platform.OS === "ios" && (
                    <View style={styles.iosPickerHeader}>
                      <Pressable onPress={() => setShowFromDatePicker(false)}>
                        <ThemedText type="body" style={{ color: Colors.light.link, fontWeight: "600" }}>Done</ThemedText>
                      </Pressable>
                    </View>
                  )}
                  <DateTimePicker
                    value={fromDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onFromDateChange}
                  />
                </View>
              )}
            </View>
            <View style={styles.datePickerContainer}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                To Date *
              </ThemedText>
              <Pressable
                onPress={() => setShowToDatePicker(true)}
                style={[styles.dateInput, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <Feather name="calendar" size={16} color={theme.textSecondary} />
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={formatDate(toDate)}
                    onChange={(e: any) => setToDate(new Date(e.target.value))}
                    style={{ 
                      flex: 1, 
                      color: theme.text, 
                      backgroundColor: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: "16px",
                      fontFamily: "inherit"
                    }}
                  />
                ) : (
                  <ThemedText type="body">
                    {toDate.toLocaleDateString()}
                  </ThemedText>
                )}
              </Pressable>
              {showToDatePicker && Platform.OS !== "web" && (
                <View style={Platform.OS === "ios" ? [styles.iosPickerContainer, { position: "absolute", top: 80, right: 0, left: -150, width: 300 }] : null}>
                  {Platform.OS === "ios" && (
                    <View style={styles.iosPickerHeader}>
                      <Pressable onPress={() => setShowToDatePicker(false)}>
                        <ThemedText type="body" style={{ color: Colors.light.link, fontWeight: "600" }}>Done</ThemedText>
                      </Pressable>
                    </View>
                  )}
                  <DateTimePicker
                    value={toDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onToDateChange}
                  />
                </View>
              )}
            </View>
          </View>

          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            Department (Optional)
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deptScroll}>
            <View style={styles.deptRow}>
              {DEPARTMENTS.map((dept) => (
                <Pressable
                  key={dept}
                  onPress={() => setDepartmentFilter(dept)}
                  style={[
                    styles.deptChip,
                    {
                      backgroundColor: departmentFilter === dept ? Colors.light.link : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: departmentFilter === dept ? "#FFFFFF" : theme.text, fontWeight: "500" }}
                  >
                    {dept}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={handleSearch}
            disabled={isFetching}
            style={[styles.searchButton, { backgroundColor: Colors.light.link }]}
          >
            {isFetching ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="search" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Search Attendance
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {/* Export Card */}
        <View style={[styles.exportCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Download Reports
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Export attendance data with master details and P/A marking
          </ThemedText>
          
          <View style={styles.exportButtons}>
            <Pressable
              onPress={() => handleExport("summary")}
              disabled={isExporting || !hasSearched}
              style={[
                styles.exportButton,
                { backgroundColor: Colors.light.success, opacity: !hasSearched ? 0.5 : 1 },
              ]}
            >
              <Feather name="file-text" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                P/A Summary
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleExport("detailed")}
              disabled={isExporting || !hasSearched}
              style={[
                styles.exportButton,
                { backgroundColor: Colors.light.link, opacity: !hasSearched ? 0.5 : 1 },
              ]}
            >
              <Feather name="download" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Detailed Report
              </ThemedText>
            </Pressable>
          </View>

          {!isSupervisor && (
            <View style={[styles.exportButtons, { marginTop: Spacing.md }]}>
              <Pressable
                onPress={() => handleExport("newJoiners")}
                disabled={isExporting}
                style={[styles.exportButton, { backgroundColor: "#003366" }]}
              >
                <Feather name="user-plus" size={16} color="#FFFFFF" />
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  New Joiners (Last 7 Days)
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Results Card */}
        {hasSearched ? (
          <View style={[styles.resultsCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
            <View style={styles.resultsHeader}>
              <ThemedText type="h4">Attendance Records</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {attendanceData.length} records
              </ThemedText>
            </View>

            {isLoading || isFetching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.link} />
              </View>
            ) : attendanceData.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.table}>
                  <View style={[styles.tableHeader, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="small" style={[styles.headerCell, { width: 100, fontWeight: "600" }]}>
                      Employee
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 70, fontWeight: "600" }]}>
                      Dept
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 70, fontWeight: "600" }]}>
                      Shift
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 80, fontWeight: "600" }]}>
                      Date
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 70, fontWeight: "600" }]}>
                      In Date
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 60, fontWeight: "600" }]}>
                      In Time
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 60, fontWeight: "600" }]}>
                      Out
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 50, fontWeight: "600" }]}>
                      Total
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 45, fontWeight: "600" }]}>
                      OT
                    </ThemedText>
                    <ThemedText type="small" style={[styles.headerCell, { width: 40, fontWeight: "600" }]}>
                      Status
                    </ThemedText>
                  </View>
                  {attendanceData.map(renderTableRow)}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={40} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                  No records found
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Try adjusting your date range
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.placeholderCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
            <Feather name="calendar" size={48} color={theme.textSecondary} />
            <ThemedText type="h4" style={{ marginTop: Spacing.lg, textAlign: "center" }}>
              Select Dates to View Reports
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
              Choose a date range above and click "Search Attendance" to view records
            </ThemedText>
          </View>
        )}
      </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  filterCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  dateFilters: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    zIndex: 100,
  },
  datePickerContainer: {
    flex: 1,
    position: "relative",
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
  },
  deptScroll: {
    marginBottom: Spacing.lg,
  },
  deptRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  deptChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  exportCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  exportButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  exportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 44,
    borderRadius: BorderRadius.md,
  },
  resultsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  table: {
    minWidth: 550,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  headerCell: {
    paddingHorizontal: Spacing.xs,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  tableCell: {
    paddingHorizontal: Spacing.xs,
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    alignSelf: "flex-start",
  },
  iosPickerContainer: {
    backgroundColor: "white",
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: "#EEE",
    zIndex: 1000,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    marginBottom: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  placeholderCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing["3xl"],
    alignItems: "center",
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  dateModalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  dateTextInput: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  dateModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  dateModalButton: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
