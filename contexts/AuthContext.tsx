import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

export type UserRole = "admin" | "supervisor" | "manager" | "mis";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  resetInactivityTimer: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "@attendance_auth_user";
const LAST_ACTIVITY_KEY = "@attendance_last_activity";
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  const performLogout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      setUser(null);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(LAST_ACTIVITY_KEY);
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (user) {
      AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      inactivityTimer.current = setTimeout(() => {
        console.log("Session timeout - logging out");
        performLogout();
      }, SESSION_TIMEOUT_MS);
    }
  }, [user, performLogout]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active" && user) {
        const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivity) {
          const elapsed = Date.now() - parseInt(lastActivity, 10);
          if (elapsed >= SESSION_TIMEOUT_MS) {
            console.log("Session expired while app was in background");
            performLogout();
            return;
          }
        }
        resetInactivityTimer();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user, performLogout, resetInactivityTimer]);

  useEffect(() => {
    if (user) {
      resetInactivityTimer();
    }
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
      
      if (storedUser && lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= SESSION_TIMEOUT_MS) {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          await AsyncStorage.removeItem(LAST_ACTIVITY_KEY);
        } else {
          setUser(JSON.parse(storedUser));
        }
      } else if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to load stored user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<AuthUser> => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { username, password });
      const userData = await response.json();
      setUser(userData);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const clearMustChangePassword = async () => {
    if (user) {
      const updatedUser = { ...user, mustChangePassword: false };
      setUser(updatedUser);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
    }
  };

  const logout = async () => {
    await performLogout();
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin, resetInactivityTimer, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
