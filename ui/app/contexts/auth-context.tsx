import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  setTokens,
  clearTokens,
  isAuthenticated as checkAuth,
  getTokenPayload,
  type AuthTokens,
} from "@/lib/auth";
import {
  authTokenCreate,
  authTokenRefreshCreate,
} from "@/client/gen/dashy/auth/auth";
import { toast } from "sonner";

const USER_INFO_KEY = "user_info";

interface User {
  id?: number;
  username?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to get stored user info
const getStoredUserInfo = (): User | null => {
  try {
    const stored = localStorage.getItem(USER_INFO_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Helper to store user info
const setStoredUserInfo = (user: User) => {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
};

// Helper to clear stored user info
const clearStoredUserInfo = () => {
  localStorage.removeItem(USER_INFO_KEY);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const extractUserFromToken = useCallback((usernameFromLogin?: string) => {
    const payload = getTokenPayload();
    if (payload) {
      // Get user ID from token (could be user_id or id)
      const userId = (payload.user_id ?? payload.id) as number;

      // Try to get stored user info first, then fall back to token/login data
      const storedUser = getStoredUserInfo();

      const userInfo: User = {
        id: userId,
        username:
          usernameFromLogin ||
          storedUser?.username ||
          (payload.username as string) ||
          `User ${userId}`,
        email: storedUser?.email || (payload.email as string),
      };

      setUser(userInfo);
      setStoredUserInfo(userInfo);
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    // Check authentication status on mount
    if (checkAuth()) {
      extractUserFromToken();
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
    setIsLoading(false);
  }, [extractUserFromToken]);

  const login = async (username: string, password: string) => {
    try {
      const response = await authTokenCreate({ username, password } as any);
      console.log("Login response:", response);

      if (!response.access || !response.refresh) {
        toast.error("Invalid response from server - missing tokens");
        return;
      }

      const tokens: AuthTokens = {
        access: response.access,
        refresh: response.refresh,
      };
      setTokens(tokens);
      extractUserFromToken(username);
      toast.success("Logged in successfully");
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Invalid credentials");
      throw error;
    }
  };

  const logout = useCallback(() => {
    clearTokens();
    clearStoredUserInfo();
    setUser(null);
    setIsAuthenticated(false);
    toast.success("Logged out successfully");
    navigate("/login");
  }, [navigate]);

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (!refresh) return false;

      const response = await authTokenRefreshCreate({ refresh } as any);
      const tokens: AuthTokens = {
        access: response.access,
        refresh: refresh,
      };
      setTokens(tokens);
      extractUserFromToken();
      return true;
    } catch {
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshToken,
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
