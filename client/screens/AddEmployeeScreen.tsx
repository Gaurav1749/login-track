import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Toast } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

const DEPARTMENTS = ["Inbound", "Outbound", "Returns", "Inventory", "VNA"];
const GENDERS = ["Male", "Female", "Other"];
const SHIFTS = ["Shift A", "Shift B", "Shift C"];

export default function AddEmployeeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [slpid, setSlpid] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [gender, setGender] = useState("");
  const [department, setDepartment] = useState("");
  const [shiftName, setShiftName] = useState("Shift A");
  const [weekOff, setWeekOff] = useState("Sunday");
  const [dateOfJoining, setDateOfJoining] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/employees", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rosters"] });
      setToast({ visible: true, message: "Employee added successfully", type: "success" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: (error: any) => {
      setToast({ visible: true, message: error?.message || "Failed to add employee", type: "error" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !slpid.trim() || !employeeId.trim() || !gender || !department) {
      setToast({ visible: true, message: "Please fill in all fields", type: "error" });
      return;
    }

    mutation.mutate({
      name: name.trim(),
      slpid: slpid.trim().toUpperCase(),
      employeeId: employeeId.trim().toUpperCase(),
      gender,
      department,
      shiftName,
      dateOfJoining: dateOfJoining.toISOString().split("T")[0],
      weekOff,
      isActive: true,
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setDateOfJoining(selectedDate);
    }
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
        <View style={[styles.formCard, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <Input
            label="Full Name"
            placeholder="Enter employee name"
            value={name}
            onChangeText={setName}
            leftIcon="user"
          />

          <Input
            label="SLPID"
            placeholder="Enter SLPID"
            value={slpid}
            onChangeText={setSlpid}
            leftIcon="hash"
            autoCapitalize="characters"
          />

          <Input
            label="Employee ID"
            placeholder="Enter employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            leftIcon="credit-card"
            autoCapitalize="characters"
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

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Shift
            </ThemedText>
            <View style={styles.optionsRow}>
              {SHIFTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setShiftName(s)}
                  style={[
                    styles.optionChip,
                    { backgroundColor: shiftName === s ? Colors.light.link : theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: shiftName === s ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                  >
                    {s}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Date of Joining
            </ThemedText>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateButton,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }
              ]}
            >
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={dateOfJoining.toISOString().split("T")[0]}
                  onChange={(e: any) => setDateOfJoining(new Date(e.target.value))}
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
                <ThemedText style={{ color: theme.text }}>
                  {dateOfJoining.toLocaleDateString()}
                </ThemedText>
              )}
            </Pressable>
            {showDatePicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={dateOfJoining}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
              />
            )}
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Week Off
            </ThemedText>
            <View style={styles.optionsRow}>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                <Pressable
                  key={day}
                  onPress={() => setWeekOff(day)}
                  style={[
                    styles.optionChip,
                    { backgroundColor: weekOff === day ? Colors.light.link : theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: weekOff === day ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                  >
                    {day.slice(0, 3)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
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
              <Feather name="user-plus" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Add Employee
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
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
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
