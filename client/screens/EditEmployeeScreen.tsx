import React, { useState } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Toast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

const DEPARTMENTS = ["Inbound", "Outbound", "Returns", "Inventory", "VNA"];
const GENDERS = ["Male", "Female", "Other"];

export default function EditEmployeeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const employee = route.params?.employee;

  const [name, setName] = useState(employee?.name || "");
  const [gender, setGender] = useState(employee?.gender || "");
  const [department, setDepartment] = useState(employee?.department || "");
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/employees/${employee.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setToast({ visible: true, message: "Employee updated successfully", type: "success" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: (error: any) => {
      setToast({ visible: true, message: error?.message || "Failed to update employee", type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !gender || !department) {
      setToast({ visible: true, message: "Please fill in all fields", type: "error" });
      return;
    }

    mutation.mutate({
      name: name.trim(),
      gender,
      department,
      isActive,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <View style={styles.infoRow}>
            <Feather name="hash" size={18} color={theme.textSecondary} />
            <View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                SLPID
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {employee?.slpid}
              </ThemedText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Feather name="credit-card" size={18} color={theme.textSecondary} />
            <View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Employee ID
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {employee?.employeeId}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <Input
            label="Full Name"
            placeholder="Enter employee name"
            value={name}
            onChangeText={setName}
            leftIcon="user"
          />

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Gender
            </ThemedText>
            <View style={styles.optionsRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[
                    styles.optionChip,
                    { backgroundColor: gender === g ? Colors.light.link : theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: gender === g ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                  >
                    {g}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Department
            </ThemedText>
            <View style={styles.optionsRow}>
              {DEPARTMENTS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDepartment(d)}
                  style={[
                    styles.optionChip,
                    { backgroundColor: department === d ? Colors.light.link : theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: department === d ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                  >
                    {d}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.switchRow}>
            <View>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                Active Status
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Employee can be marked for attendance
              </ThemedText>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: theme.border, true: `${Colors.light.success}80` }}
              thumbColor={isActive ? Colors.light.success : theme.textSecondary}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={mutation.isPending}
          style={[
            styles.submitButton,
            { backgroundColor: Colors.light.link, opacity: mutation.isPending ? 0.7 : 1 },
          ]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="save" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Save Changes
              </ThemedText>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>

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
  infoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  formCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  fieldContainer: {
    gap: Spacing.sm,
  },
  label: {
    fontWeight: "500",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
  },
});
