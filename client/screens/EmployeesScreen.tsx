import React, { useState, useMemo } from "react";
import { StyleSheet, View, FlatList, TextInput, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { EmployeeCard } from "@/components/EmployeeCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

interface Employee {
  id: string;
  slpid: string;
  employeeId: string;
  name: string;
  gender: string;
  department: string;
  dateOfJoining: string;
  isActive: boolean;
}

export default function EmployeesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
  const navigation = useNavigation<any>();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  const { data: employees = [], isLoading, refetch, isRefetching } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: rosters = [] } = useQuery<any[]>({
    queryKey: ["/api/rosters"],
  });

  const rosteredEmployeeIds = useMemo(() => new Set(rosters.map(r => r.employeeId)), [rosters]);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter(emp => rosteredEmployeeIds.has(emp.id));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(query) ||
          emp.slpid.toLowerCase().includes(query) ||
          emp.employeeId.toLowerCase().includes(query)
      );
    }

    if (activeFilter !== "all") {
      result = result.filter((emp) =>
        activeFilter === "active" ? emp.isActive : !emp.isActive
      );
    }

    return result;
  }, [employees, searchQuery, activeFilter]);

  const handleAddEmployee = () => {
    navigation.navigate("AddEmployee");
  };

  const handleEditEmployee = (employee: Employee) => {
    navigation.navigate("EditEmployee", { employee });
  };

  const renderFilterChip = (
    label: string,
    value: "all" | "active" | "inactive"
  ) => (
    <Pressable
      onPress={() => setActiveFilter(value)}
      style={[
        styles.filterChip,
        {
          backgroundColor:
            activeFilter === value ? Colors.light.link : theme.backgroundSecondary,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={{
          color: activeFilter === value ? "#FFFFFF" : theme.text,
          fontWeight: "600",
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderEmployee = ({ item }: { item: Employee }) => (
    <EmployeeCard
      name={item.name}
      slpid={item.slpid}
      employeeId={item.employeeId}
      department={item.department}
      gender={item.gender}
      isActive={item.isActive}
      onEdit={isAdmin ? () => handleEditEmployee(item) : undefined}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: `${Colors.light.link}15` }]}>
        <Feather name="users" size={40} color={Colors.light.link} />
      </View>
      <ThemedText type="h4" style={styles.emptyTitle}>
        No employees found
      </ThemedText>
      <ThemedText type="small" style={[styles.emptyMessage, { color: theme.textSecondary }]}>
        {searchQuery ? "Try a different search term" : "Add your first employee to get started"}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, SLPID, or ID..."
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

        <View style={styles.filterRow}>
          {renderFilterChip("All", "all")}
          {renderFilterChip("Active", "active")}
          {renderFilterChip("Inactive", "inactive")}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.link} />
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          renderItem={renderEmployee}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl + 60,
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

      {isAdmin ? (
        <Pressable
          onPress={handleAddEmployee}
          style={[
            styles.fab,
            { backgroundColor: Colors.light.link, bottom: tabBarHeight + Spacing.lg },
            Shadows.lg,
          ]}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
