import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

const DEPARTMENTS = ["Inbound", "Outbound", "Returns", "Inventory", "VNA"];
const SHIFTS = ["Shift A", "Shift B", "Shift C"];
const GENDERS = ["All", "Male", "Female"];
const FILTER_DEPTS = ["All", ...DEPARTMENTS];
const FILTER_SHIFTS = ["All", "Shift A", "Shift B", "Shift C"];

interface LiveEmployee {
  id: string;
  attendanceId: string;
  slpid: string;
  name: string;
  department: string;
  shiftName: string;
  gender: string;
  gateInTime: string;
  hoursWorked: number;
  isWeekOffEntry?: boolean;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, resetInactivityTimer } = useAuth();

  const [deptFilter, setDeptFilter] = useState("All");
  const [shiftFilter, setShiftFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(DEPARTMENTS));
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset inactivity timer on user interaction
  useEffect(() => {
    resetInactivityTimer();
  }, [deptFilter, shiftFilter, genderFilter]);

  const role = user?.role as string || "";
  const isReadOnly = role === "supervisor";
  const canEdit = (["admin", "manager", "mis"] as string[]).includes(role);

  const { data, refetch, isRefetching } = useQuery<any>({
    queryKey: ["/api/dashboard/live"],
    refetchInterval: 5000, // Reduced refresh rate to prevent excessive re-renders and scroll issues
  });

  const { data: newJoiners = [] } = useQuery<any[]>({
    queryKey: ["/api/reports/new-joiners"],
  });

  const liveManpower: LiveEmployee[] = data?.liveManpower || [];
  const allEmployees = data?.allEmployees || [];
  const todayEntryEmpIds = new Set(data?.todayEntryEmpIds || []);
  const rosters = data?.rosters || [];

  const normalizeShift = (shift: string) => {
    if (shift === "Morning" || shift === "A") return "Shift A";
    if (shift === "Evening" || shift === "B") return "Shift B";
    if (shift === "Night" || shift === "C") return "Shift C";
    return shift;
  };

  const normalizeDepartment = (dept: string) => {
    if (dept === "Return") return "Returns";
    return dept;
  };

  const filteredLive = useMemo(() => {
    return liveManpower.filter((emp) => {
      const normalizedShift = normalizeShift(emp.shiftName);
      const normalizedDept = normalizeDepartment(emp.department);
      const matchDept = deptFilter === "All" || normalizedDept === deptFilter;
      const matchShift = shiftFilter === "All" || normalizedShift === shiftFilter;
      const matchGender = genderFilter === "All" || emp.gender?.toLowerCase() === genderFilter.toLowerCase();
      return matchDept && matchShift && matchGender;
    });
  }, [liveManpower, deptFilter, shiftFilter, genderFilter]);

  const stats = useMemo(() => {
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
    
    const present = filteredLive.length;
    const absent = allEmployees.filter((emp: any) => {
      const normalizedDept = normalizeDepartment(emp.department);
      const matchDept = deptFilter === "All" || normalizedDept === deptFilter;
      const matchGender = genderFilter === "All" || emp.gender?.toLowerCase() === genderFilter.toLowerCase();
      return matchDept && matchGender && !todayEntryEmpIds.has(emp.id);
    }).length;
    
    const weekOffPresent = filteredLive.filter((emp) => {
      const roster = rosters.find((r: any) => r.employeeId === emp.id);
      return roster && roster.weekOff?.toLowerCase() === dayOfWeek.toLowerCase();
    }).length;
    
    const overtime = filteredLive.filter((emp) => emp.hoursWorked >= 9).length;

    return { present, absent, weekOffPresent, overtime };
  }, [filteredLive, allEmployees, todayEntryEmpIds, rosters, deptFilter, genderFilter]);

  const deptMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, { male: number; female: number; total: number }>> = {};
    
    DEPARTMENTS.forEach(dept => {
      matrix[dept] = {};
      SHIFTS.forEach(shift => {
        matrix[dept][shift] = { male: 0, female: 0, total: 0 };
      });
    });

    liveManpower.forEach((emp) => {
      const dept = normalizeDepartment(emp.department);
      const shift = normalizeShift(emp.shiftName);
      const gender = emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1).toLowerCase() : "";
      
      if (matrix[dept] && matrix[dept][shift]) {
        if (gender === "Male") {
          matrix[dept][shift].male++;
        } else if (gender === "Female") {
          matrix[dept][shift].female++;
        }
        matrix[dept][shift].total++;
      }
    });

    return matrix;
  }, [liveManpower]);

  const toggleDept = (dept: string) => {
    const next = new Set(expandedDepts);
    if (next.has(dept)) next.delete(dept);
    else next.add(dept);
    setExpandedDepts(next);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const renderFilterChips = (label: string, options: string[], current: string, setter: (v: string) => void) => (
    <View style={styles.filterSection}>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>{label}</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {options.map(opt => (
            <Pressable
              key={opt}
              onPress={() => setter(opt)}
              style={[styles.filterChip, { backgroundColor: current === opt ? "#003366" : theme.backgroundSecondary }]}
            >
              <ThemedText type="small" style={{ color: current === opt ? "#FFFFFF" : theme.text }}>{opt}</ThemedText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderDeptCard = (dept: string) => {
    const isExpanded = expandedDepts.has(dept);
    const deptData = deptMatrix[dept];
    const deptTotal = SHIFTS.reduce((sum, s) => sum + (deptData[s]?.total || 0), 0);

    return (
      <View key={dept} style={[styles.deptCard, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable onPress={() => toggleDept(dept)} style={styles.deptHeader}>
          <View style={styles.deptHeaderLeft}>
            <ThemedText type="h4">{dept}</ThemedText>
            <View style={[styles.badge, { backgroundColor: "#003366" }]}>
              <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>{deptTotal}</ThemedText>
            </View>
          </View>
          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
        </Pressable>
        
        {isExpanded ? (
          <View style={styles.matrixTable}>
            <View style={[styles.matrixRow, styles.matrixHeaderRow]}>
              <View style={[styles.matrixCell, { flex: 1.5 }]}><ThemedText type="small" style={styles.headerText}>Shift</ThemedText></View>
              <View style={styles.matrixCell}><ThemedText type="small" style={[styles.headerText, { color: "#1976D2" }]}>Male</ThemedText></View>
              <View style={styles.matrixCell}><ThemedText type="small" style={[styles.headerText, { color: "#E91E63" }]}>Female</ThemedText></View>
              <View style={styles.matrixCell}><ThemedText type="small" style={styles.headerText}>Total</ThemedText></View>
            </View>
            {SHIFTS.map(shift => (
              <View key={shift} style={[styles.matrixRow, { borderBottomColor: theme.border }]}>
                <View style={[styles.matrixCell, { flex: 1.5 }]}><ThemedText type="small">{shift}</ThemedText></View>
                <View style={styles.matrixCell}><ThemedText type="body" style={{ color: "#1976D2" }}>{deptData[shift]?.male || 0}</ThemedText></View>
                <View style={styles.matrixCell}><ThemedText type="body" style={{ color: "#E91E63" }}>{deptData[shift]?.female || 0}</ThemedText></View>
                <View style={styles.matrixCell}><ThemedText type="body" style={{ fontWeight: "600" }}>{deptData[shift]?.total || 0}</ThemedText></View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.headerSection}>
          <View style={styles.welcomeRow}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: "#003366" }]}>
              <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="h2" style={{ color: "#003366", fontWeight: "700" }}>
                Welcome, {user?.name || "User"}.
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)} | Attendance Management System
              </ThemedText>
            </View>
          </View>
          <View style={styles.liveTimeRow}>
            <View style={styles.dateContainer}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </ThemedText>
            </View>
            <View style={[styles.liveTimeContainer, { backgroundColor: "#003366" }]}>
              <View style={styles.liveDot} />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 18 }}>
                {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.summaryBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.summaryItem}>
            <ThemedText type="h2" style={{ color: "#059669", fontWeight: "700" }}>{stats.present}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "500" }}>Present (Live)</ThemedText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText type="h2" style={{ color: "#DC2626", fontWeight: "700" }}>{stats.absent}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "500" }}>Absent</ThemedText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText type="h2" style={{ color: "#D97706", fontWeight: "700" }}>{stats.weekOffPresent}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "500" }}>WO Present</ThemedText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText type="h2" style={{ color: "#003366", fontWeight: "700" }}>{stats.overtime}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "500" }}>OT (9+ Hrs)</ThemedText>
          </View>
        </View>

        <View style={[styles.filterCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md, fontWeight: "600" }}>Filters</ThemedText>
          {renderFilterChips("Department", FILTER_DEPTS, deptFilter, setDeptFilter)}
          {renderFilterChips("Shift", FILTER_SHIFTS, shiftFilter, setShiftFilter)}
          {renderFilterChips("Gender", GENDERS, genderFilter, setGenderFilter)}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="h3">New Joiners (Last 7 Days)</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{newJoiners.length} employees</ThemedText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.newJoinersScroll}>
          {newJoiners.length > 0 ? newJoiners.map((emp) => (
            <View key={emp.id} style={[styles.newJoinerCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>{emp.name}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{emp.slpid} | {emp.department}</ThemedText>
              <View style={styles.newJoinerFooter}>
                <ThemedText type="small" style={{ color: "#003366", fontWeight: "600" }}>{emp.shiftName}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Joined: {emp.dateOfJoining}</ThemedText>
              </View>
            </View>
          )) : (
            <View style={[styles.newJoinerCard, { backgroundColor: theme.backgroundDefault, width: 200, alignItems: "center", justifyContent: "center" }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>No new joiners</ThemedText>
            </View>
          )}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <ThemedText type="h3">Department Matrix</ThemedText>
          <Pressable onPress={() => refetch()} style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        {DEPARTMENTS.map(renderDeptCard)}

        <View style={styles.sectionHeader}>
          <ThemedText type="h3">Live Inside Manpower</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{filteredLive.length} people</ThemedText>
        </View>

        <View style={[styles.tableCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.tableCell, { flex: 2 }]}><ThemedText type="small" style={styles.headerText}>Name</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1.2 }]}><ThemedText type="small" style={styles.headerText}>SLPID</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1 }]}><ThemedText type="small" style={styles.headerText}>Dept</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1 }]}><ThemedText type="small" style={styles.headerText}>Shift</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1.5 }]}><ThemedText type="small" style={styles.headerText}>Date</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1.5 }]}><ThemedText type="small" style={styles.headerText}>In</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1 }]}><ThemedText type="small" style={styles.headerText}>Hrs</ThemedText></View>
            <View style={[styles.tableCell, { flex: 1.5 }]}><ThemedText type="small" style={styles.headerText}>Status</ThemedText></View>
          </View>
          
          {filteredLive.length > 0 ? filteredLive.slice(0, 50).map((emp, idx) => {
            const isOT = emp.hoursWorked >= 9;
            const isWO = emp.isWeekOffEntry;
            const gateInDate = new Date(emp.gateInTime).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });
            return (
              <View key={emp.attendanceId || idx} style={[styles.tableRow, { backgroundColor: isOT ? "#FFF3E0" : (isWO ? "#E3F2FD" : "transparent"), borderBottomColor: theme.border }]}>
                <View style={[styles.tableCell, { flex: 2 }]}>
                  <ThemedText type="small" numberOfLines={1}>{emp.name}</ThemedText>
                </View>
                <View style={[styles.tableCell, { flex: 1.2 }]}><ThemedText type="small">{emp.slpid}</ThemedText></View>
                <View style={[styles.tableCell, { flex: 1 }]}><ThemedText type="small" numberOfLines={1}>{emp.department?.substring(0,3)}</ThemedText></View>
                <View style={[styles.tableCell, { flex: 1 }]}><ThemedText type="small" style={{ textAlign: "center" }}>{normalizeShift(emp.shiftName).replace("Shift ", "")}</ThemedText></View>
                <View style={[styles.tableCell, { flex: 1.5 }]}><ThemedText type="small">{gateInDate}</ThemedText></View>
                <View style={[styles.tableCell, { flex: 1.5 }]}><ThemedText type="small">{formatTime(emp.gateInTime)}</ThemedText></View>
                <View style={[styles.tableCell, { flex: 1 }]}><ThemedText type="small" style={{ textAlign: "center" }}>{formatHours(emp.hoursWorked)}</ThemedText></View>
                <View style={[styles.tableCell, { flex: 1.5, alignItems: "center" }]}>
                  {isOT ? (
                    <View style={[styles.statusBadge, { backgroundColor: "#FF9800" }]}>
                      <ThemedText type="small" style={{ color: "#FFFFFF", fontSize: 10 }}>OT</ThemedText>
                    </View>
                  ) : isWO ? (
                    <View style={[styles.statusBadge, { backgroundColor: "#2196F3" }]}>
                      <ThemedText type="small" style={{ color: "#FFFFFF", fontSize: 10 }}>WO</ThemedText>
                    </View>
                  ) : (
                    <ThemedText type="small" style={{ color: "#4CAF50" }}>Normal</ThemedText>
                  )}
                </View>
              </View>
            );
          }) : (
            <View style={styles.emptyState}>
              <Feather name="users" size={32} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>No manpower currently inside</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Developed by Gaurav Bhati
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { marginBottom: Spacing.xl },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  liveTimeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md },
  dateContainer: { flex: 1 },
  liveTimeContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  summaryBar: { flexDirection: "row", borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, borderWidth: 1 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, backgroundColor: "#E2E8F0", marginHorizontal: Spacing.md },
  filterCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1 },
  filterSection: { marginBottom: Spacing.md },
  filterRow: { flexDirection: "row", gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg, marginTop: Spacing.md },
  refreshBtn: { padding: Spacing.md },
  newJoinersScroll: { marginBottom: Spacing.xl, paddingVertical: Spacing.sm },
  newJoinerCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginRight: Spacing.lg, width: 240, borderLeftWidth: 4, borderLeftColor: "#003366" },
  newJoinerFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md, alignItems: "center" },
  deptCard: { borderRadius: BorderRadius.xl, marginBottom: Spacing.lg, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  deptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.lg },
  deptHeaderLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, minWidth: 36, alignItems: "center" },
  matrixTable: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  matrixRow: { flexDirection: "row", paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  matrixHeaderRow: { borderBottomWidth: 2, borderBottomColor: "#CBD5E1", backgroundColor: "#F8FAFC" },
  matrixCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerText: { fontWeight: "700", textAlign: "center", letterSpacing: 0.3 },
  tableCard: { borderRadius: BorderRadius.xl, overflow: "hidden", marginBottom: Spacing.xl, borderWidth: 1, borderColor: "#E2E8F0" },
  tableHeader: { flexDirection: "row", padding: Spacing.md, borderBottomWidth: 2, borderBottomColor: "#CBD5E1", backgroundColor: "#F8FAFC" },
  tableRow: { flexDirection: "row", padding: Spacing.md, borderBottomWidth: 1, minHeight: 48 },
  tableCell: { justifyContent: "center", paddingHorizontal: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "center" },
  emptyState: { alignItems: "center", paddingVertical: Spacing["3xl"] },
  footer: { paddingVertical: Spacing.xl, marginTop: Spacing.xl },
});
