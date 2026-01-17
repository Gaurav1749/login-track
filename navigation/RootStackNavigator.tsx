import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import AddEmployeeScreen from "@/screens/AddEmployeeScreen";
import EditEmployeeScreen from "@/screens/EditEmployeeScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { Colors } from "@/constants/theme";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  AddEmployee: undefined;
  EditEmployee: { employee: any };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}>
        <ActivityIndicator size="large" color={Colors.light.link} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {user ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AddEmployee"
            component={AddEmployeeScreen}
            options={{
              headerTitle: "Add Employee",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="EditEmployee"
            component={EditEmployeeScreen}
            options={{
              headerTitle: "Edit Employee",
              presentation: "modal",
            }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
