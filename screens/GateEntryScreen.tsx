import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, View, ScrollView, TextInput, Pressable, FlatList, ActivityIndicator, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ThemedText } from "@/components/ThemedText";
import { ShiftBadge } from "@/components/ShiftBadge";
import { Toast } from "@/components/Toast";
import { WeekOffModal } from "@/components/WeekOffModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

interface GateEntryResult {
  success: boolean;
  employee?: {
    id: string;
    name: string;
    slpid: string;
    department: string;
    shift: string;
    isWeekOff: boolean;
  };
  message?: string;
}

interface RecentEntry {
  id: string;
  name: string;
  slpid: string;
  time: string;
  status: "allowed" | "denied";
}

export default function GateEntryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { resetInactivityTimer } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedRef = useRef<string>("");
  const scanCooldownRef = useRef<boolean>(false);

  const [slpid, setSlpid] = useState("");
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [showWeekOffModal, setShowWeekOffModal] = useState(false);
  const [pendingEntry, setPendingEntry] = useState<any>(null);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" | "info" });
  const [showCamera, setShowCamera] = useState(false);
  const [scanMode, setScanMode] = useState<"manual" | "camera" | "scanner">("manual");

  const entryMutation = useMutation({
    mutationFn: async ({ slpidValue, allowWeekOff }: { slpidValue: string; allowWeekOff: boolean }) => {
      resetInactivityTimer();
      const response = await apiRequest("POST", "/api/gate/entry", { slpid: slpidValue, allowWeekOff });
      return response.json();
    },
    onSuccess: (data: any) => {
      const isGateOut = data.action === "gate_out";
      const newEntry: RecentEntry = {
        id: Date.now().toString(),
        name: data.employeeName || "Employee",
        slpid: lastScannedRef.current || slpid.toUpperCase(),
        time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
        status: "allowed",
      };
      setRecentEntries((prev) => [newEntry, ...prev.slice(0, 9)]);
      setToast({
        visible: true,
        message: isGateOut 
          ? `${data.employeeName} - Gate Out (${data.hoursWorked}h)` 
          : `${data.employeeName || "Employee"} - Gate In recorded`,
        type: "success",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/live"] });
    },
    onError: (error: any) => {
      if (error?.message?.includes("week off")) {
        setPendingEntry({ slpid: lastScannedRef.current || slpid.toUpperCase() });
        setShowWeekOffModal(true);
      } else if (error?.message?.includes("already scanned")) {
        setToast({
          visible: true,
          message: "Card already scanned",
          type: "info",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        resetForm();
      } else {
        setToast({
          visible: true,
          message: error?.message || "Failed to record entry",
          type: "error",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanCooldownRef.current) return;
    
    scanCooldownRef.current = true;
    lastScannedRef.current = data.toUpperCase();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCamera(false);
    
    entryMutation.mutate({ slpidValue: data.toUpperCase(), allowWeekOff: false });
    
    setTimeout(() => {
      scanCooldownRef.current = false;
    }, 2000);
  };

  const handleExternalScannerInput = (text: string) => {
    setSlpid(text);
    if (text.length >= 6 && scanMode === "scanner") {
      lastScannedRef.current = text.toUpperCase();
      entryMutation.mutate({ slpidValue: text.toUpperCase(), allowWeekOff: false });
      setSlpid("");
    }
  };

  const handleScan = () => {
    if (!slpid.trim()) return;
    lastScannedRef.current = slpid.trim().toUpperCase();
    entryMutation.mutate({ slpidValue: slpid.trim().toUpperCase(), allowWeekOff: false });
  };

  const openCameraScanner = async () => {
    if (Platform.OS === "web") {
      setToast({
        visible: true,
        message: "Camera scanning works best in Expo Go app",
        type: "info",
      });
      return;
    }
    
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setToast({
          visible: true,
          message: "Camera permission is required for QR scanning",
          type: "error",
        });
        return;
      }
    }
    setShowCamera(true);
  };

  const handleWeekOffAllow = () => {
    setShowWeekOffModal(false);
    if (pendingEntry) {
      entryMutation.mutate({ slpidValue: pendingEntry.slpid, allowWeekOff: true });
    }
  };

  const handleWeekOffDeny = () => {
    setShowWeekOffModal(false);
    const newEntry: RecentEntry = {
      id: Date.now().toString(),
      name: "Employee",
      slpid: slpid.toUpperCase(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
      status: "denied",
    };
    setRecentEntries((prev) => [newEntry, ...prev.slice(0, 9)]);
    setToast({
      visible: true,
      message: "Entry denied - Week off",
      type: "error",
    });
    resetForm();
  };

  const resetForm = () => {
    setSlpid("");
    setPendingEntry(null);
    inputRef.current?.focus();
  };

  const renderRecentEntry = ({ item }: { item: RecentEntry }) => (
    <View style={[styles.recentItem, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.recentInfo}>
        <ThemedText type="small" style={{ fontWeight: "600" }}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {item.slpid} - {item.time}
        </ThemedText>
      </View>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: item.status === "allowed" ? Colors.light.success : Colors.light.error },
        ]}
      />
    </View>
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.scanCard, { backgroundColor: theme.backgroundDefault }, Shadows.md]}>
          <View style={styles.scanHeader}>
            <View style={[styles.scanIcon, { backgroundColor: `${Colors.light.link}15` }]}>
              <Feather name="maximize" size={28} color={Colors.light.link} />
            </View>
            <ThemedText type="h3">Smart Gate Entry</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Same scan for Gate In and Gate Out (auto-detects)
            </ThemedText>
          </View>

          <View style={styles.scanModeRow}>
            <Pressable
              onPress={() => setScanMode("manual")}
              style={[styles.scanModeBtn, { backgroundColor: scanMode === "manual" ? Colors.light.link : theme.backgroundSecondary }]}
            >
              <Feather name="edit-3" size={16} color={scanMode === "manual" ? "#FFF" : theme.text} />
              <ThemedText type="small" style={{ color: scanMode === "manual" ? "#FFF" : theme.text }}>Manual</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => { setScanMode("camera"); openCameraScanner(); }}
              style={[styles.scanModeBtn, { backgroundColor: scanMode === "camera" ? Colors.light.link : theme.backgroundSecondary }]}
            >
              <Feather name="camera" size={16} color={scanMode === "camera" ? "#FFF" : theme.text} />
              <ThemedText type="small" style={{ color: scanMode === "camera" ? "#FFF" : theme.text }}>Camera</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => { setScanMode("scanner"); inputRef.current?.focus(); }}
              style={[styles.scanModeBtn, { backgroundColor: scanMode === "scanner" ? Colors.light.link : theme.backgroundSecondary }]}
            >
              <Feather name="cpu" size={16} color={scanMode === "scanner" ? "#FFF" : theme.text} />
              <ThemedText type="small" style={{ color: scanMode === "scanner" ? "#FFF" : theme.text }}>Scanner</ThemedText>
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: theme.text }]}
                placeholder={scanMode === "scanner" ? "Waiting for scanner..." : "Enter SLPID"}
                placeholderTextColor={theme.textSecondary}
                value={slpid}
                onChangeText={scanMode === "scanner" ? handleExternalScannerInput : setSlpid}
                onSubmitEditing={handleScan}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="go"
                autoFocus={scanMode === "scanner"}
              />
              {slpid.length > 0 ? (
                <Pressable onPress={() => setSlpid("")}>
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={handleScan}
              disabled={entryMutation.isPending || !slpid.trim()}
              style={[
                styles.scanButton,
                { backgroundColor: Colors.light.success, opacity: !slpid.trim() ? 0.5 : 1 },
              ]}
            >
              {entryMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Feather name="log-in" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          <View style={[styles.helpBanner, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
              Smart Logic: Within 1hr = "Already Scanned" | After 1hr = Auto Gate Out
            </ThemedText>
          </View>
        </View>

        <View style={styles.recentSection}>
          <ThemedText type="h4" style={styles.recentTitle}>
            Recent Entries
          </ThemedText>
          {recentEntries.length > 0 ? (
            <FlatList
              data={recentEntries}
              renderItem={renderRecentEntry}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            />
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="clock" size={32} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                No recent entries
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={styles.cameraContainer}>
          <View style={styles.cameraHeader}>
            <ThemedText type="h3" style={{ color: "#FFF" }}>Scan QR Code</ThemedText>
            <Pressable onPress={() => setShowCamera(false)} style={styles.closeButton}>
              <Feather name="x" size={28} color="#FFF" />
            </Pressable>
          </View>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
          </View>
          <View style={styles.cameraFooter}>
            <ThemedText type="body" style={{ color: "#FFF", textAlign: "center" }}>
              Point camera at QR code or barcode
            </ThemedText>
          </View>
        </View>
      </Modal>

      <WeekOffModal
        visible={showWeekOffModal}
        employeeName={pendingEntry?.name || "Employee"}
        onAllow={handleWeekOffAllow}
        onDeny={handleWeekOffDeny}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type as "success" | "error"}
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
  scanCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  scanHeader: {
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  scanIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  helpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  recentSection: {
    marginTop: Spacing.md,
  },
  recentTitle: {
    marginBottom: Spacing.md,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  recentInfo: {
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
  },
  scanModeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  scanModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  closeButton: {
    padding: Spacing.sm,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.light.link,
    borderRadius: BorderRadius.lg,
    backgroundColor: "transparent",
  },
  cameraFooter: {
    padding: Spacing.xl,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
});
