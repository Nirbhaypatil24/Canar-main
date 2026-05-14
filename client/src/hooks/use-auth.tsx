import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  token: string | null;
  setToken: (token: string | null) => void;
};

type LoginData = Pick<InsertUser, "username" | "password">;

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
  const [token, setToken] = useState<string | null>(() => {
    // Initialize token from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  });

  // Update localStorage when token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }, [token]);

  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({
      on401: "returnNull"
    }),
    enabled: true, // Always enable the query to check authentication status
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const data: AuthResponse = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      // Store token if provided (JWT mode)
      if (data.token) {
        setToken(data.token);
      }

      return data.user;
    },
    onSuccess: (user: SelectUser) => {
      // Set the user data directly in the cache
      queryClient.setQueryData(["/api/user"], user);

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
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      const data: AuthResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Registration failed");
      }

      // Store token if provided (JWT mode)
      if (data.token) {
        setToken(data.token);
      }

      return data.user;
    },
    onSuccess: (user: SelectUser) => {
      // Set the user data directly in the cache
      queryClient.setQueryData(["/api/user"], user);

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
      // Clear token and user data
      setToken(null);
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear(); // Clear all cached data

      toast({
        title: "Logout successful",
        description: "You have been logged out",
      });
    },
    onError: (error: Error) => {
      // Even if logout fails, clear local data
      setToken(null);
      queryClient.setQueryData(["/api/user"], null);

      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check authentication status
  const isAuthenticated = !!user;
  // Auto-refresh token if needed (for JWT mode)
  useEffect(() => {
    if (token && user) {
      // In a real implementation, you might want to check token expiry
      // and refresh it before it expires
      const checkTokenExpiry = () => {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiryTime = payload.exp * 1000; // Convert to milliseconds
          const currentTime = Date.now();

          // If token expires in less than 5 minutes, refresh it
          if (expiryTime - currentTime < 5 * 60 * 1000) {
            // Implement token refresh logic here
            console.log("Token expiring soon, should refresh");
          }
        } catch (error) {
          console.error("Error parsing token:", error);
        }
      };

      checkTokenExpiry();
      const interval = setInterval(checkTokenExpiry, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [token, user]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        isAuthenticated,
        loginMutation,
        logoutMutation,
        registerMutation,
        token,
        setToken,
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

// Hook for checking if user has required subscription
export function useSubscription() {
  const { isAuthenticated } = useAuth();
  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/credits"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  return {
    hasActiveSubscription: subscriptionStatus?.hasActiveSubscription || false,
    creditsRemaining: subscriptionStatus?.creditsRemaining || 0,
    planType: subscriptionStatus?.planType || null,
    canEdit: subscriptionStatus?.canEdit || false,
    isExpired: subscriptionStatus?.isExpired || false,
    daysUntilExpiry: subscriptionStatus?.daysUntilExpiry || null,
  };
}
