import React from "react";
import { createBottomTabNavigator, BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import DashboardScreen from "@/screens/DashboardScreen";
import GateEntryScreen from "@/screens/GateEntryScreen";
import GateOutScreen from "@/screens/GateOutScreen";
import EmployeesScreen from "@/screens/EmployeesScreen";
import RosterScreen from "@/screens/RosterScreen";
import ReportsScreen from "@/screens/ReportsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import UserManagementScreen from "@/screens/UserManagementScreen";
import { useTheme } from "@/hooks/useTheme";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { HeaderTitle } from "@/components/HeaderTitle";

export type MainTabParamList = {
  Dashboard: undefined;
  GateEntry: undefined;
  GateOut: undefined;
  Employees: undefined;
  Roster: undefined;
  Reports: undefined;
  UserManagement: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const screenOptions = useScreenOptions() as BottomTabNavigationOptions;

  const role = user?.role as string || "";
  const isSupervisor = role === "supervisor";

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        ...screenOptions,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            web: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Maersk Attendance" />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GateEntry"
        component={GateEntryScreen}
        options={{
          headerTitle: "Gate In",
          tabBarLabel: "Gate In",
          tabBarIcon: ({ color, size }) => (
            <Feather name="log-in" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GateOut"
        component={GateOutScreen}
        options={{
          headerTitle: "Gate Out",
          tabBarLabel: "Gate Out",
          tabBarIcon: ({ color, size }) => (
            <Feather name="log-out" size={size} color={color} />
          ),
        }}
      />
      {!isSupervisor && (
        <Tab.Screen
          name="Employees"
          component={EmployeesScreen}
          options={{
            headerTitle: "Employees",
            tabBarIcon: ({ color, size }) => (
              <Feather name="users" size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Roster"
        component={RosterScreen}
        options={{
          headerTitle: "Roster",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          headerTitle: "Reports",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      {!isSupervisor && (
        <Tab.Screen
          name="UserManagement"
          component={UserManagementScreen}
          options={{
            headerTitle: "Users",
            tabBarLabel: "Users",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user-check" size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
