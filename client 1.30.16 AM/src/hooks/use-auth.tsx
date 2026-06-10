import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, InsertUser } from "@shared/schema";
import {
  getQueryFn,
  apiRequest,
  queryClient,
  setAccessToken,
  getAccessToken,
  initCsrfToken,
} from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

type LoginData = { username: string; password: string };
type RegisterData = { email: string; username?: string; password: string; role?: 'candidate' | 'recruiter' };

interface AuthResponse {
  success: boolean;
  user: SelectUser;
  token?: string;
  message?: string;
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  planType: string | null;
  creditsRemaining: number;
  creditsAllocated: number;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  canEdit: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize CSRF token and attempt silent refresh on app load
  useEffect(() => {
    const init = async () => {
      // Fetch CSRF token for mutation requests
      await initCsrfToken();

      // Try to restore session via refresh token (httpOnly cookie)
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data.token) {
            setAccessToken(data.token);
          }
        }
      } catch {
        // Silent fail — user needs to login
      }

      setIsInitialized(true);
    };

    init();
  }, []);

  // Query current user — works for both session (cookie) and JWT (token in memory)
  const {
    data: userData,
    error,
    isLoading: isQueryLoading,
  } = useQuery<{ success: boolean; user: SelectUser } | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isInitialized, // Only run after init completes
  });

  const user = userData?.user ?? null;
  const isLoading = !isInitialized || isQueryLoading;

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const data: AuthResponse = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      // Store access token in memory (refresh token is in httpOnly cookie)
      if (data.token) {
        setAccessToken(data.token);
      }

      return data.user;
    },
    onSuccess: (user: SelectUser) => {
      // Invalidate and refetch user data
      queryClient.setQueryData(["/api/user"], { success: true, user });

      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      const data: AuthResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Registration failed");
      }

      if (data.token) {
        setAccessToken(data.token);
      }

      return data.user;
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], { success: true, user });

      toast({
        title: "Registration successful",
        description: "Welcome to Canar!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      setAccessToken(null);
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();

      toast({
        title: "Logout successful",
        description: "You have been logged out",
      });
    },
    onError: (error: Error) => {
      // Even if logout fails server-side, clear local state
      setAccessToken(null);
      queryClient.setQueryData(["/api/user"], null);

      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAuthenticated,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Hook for checking subscription status
export function useSubscription() {
  const { isAuthenticated } = useAuth();
  const { data: subscriptionData } = useQuery<{
    success: boolean;
  } & SubscriptionStatus>({
    queryKey: ["/api/credits"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  return {
    hasActiveSubscription: subscriptionData?.hasActiveSubscription || false,
    creditsRemaining: subscriptionData?.creditsRemaining || 0,
    planType: subscriptionData?.planType || null,
    canEdit: subscriptionData?.canEdit || false,
    isExpired: subscriptionData?.isExpired || false,
    daysUntilExpiry: subscriptionData?.daysUntilExpiry || null,
  };
}
