import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest, buildApiUrl, getToken, TOKEN_KEY } from "@/lib/api";

export type UserRole = "teacher" | "student";
export type OAuthProvider = "google";

export interface AuthUser {
  id?: number;
  email: string;
  name: string;
  role: UserRole;
  studentId?: string;
  major?: string;
  year?: string;
  department?: string;
  office?: string;
  phone?: string;
  avatar?: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole, rememberMe?: boolean) => Promise<boolean>;
  startOAuthLogin: (provider: OAuthProvider, role: UserRole, rememberMe?: boolean) => void;
  completeOAuthLogin: (token: string, rememberMe?: boolean) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  resetPassword: (email: string, role: UserRole, newPassword: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "app_auth_user";
const REMEMBER_KEY = "app_auth_remember";
const LEGACY_USERS_KEY = "app_auth_users";

const safeParse = <T,>(value: string | null, fallback: T): T => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
    const saved = remember ? localStorage.getItem(STORAGE_KEY) : sessionStorage.getItem(STORAGE_KEY);
    const token = getToken();

    if (saved) setUser(safeParse<AuthUser | null>(saved, null));

    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest<{ user: AuthUser }>("/auth/me")
      .then(({ user }) => {
        if (active) persistSession(user, token, remember);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const persistSession = (session: AuthUser, token: string, rememberMe = true) => {
    setUser(session);
    localStorage.setItem(REMEMBER_KEY, String(rememberMe));
    localStorage.removeItem(LEGACY_USERS_KEY);

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const clearSession = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  };

  const signup = async (name: string, email: string, password: string, role: UserRole) => {
    try {
      const data = await apiRequest<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      persistSession(data.user, data.token, true);
      return true;
    } catch {
      return false;
    }
  };

  const login = async (email: string, password: string, role: UserRole, rememberMe = true) => {
    try {
      const data = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });
      persistSession(data.user, data.token, rememberMe);
      return true;
    } catch {
      return false;
    }
  };

  const startOAuthLogin = (provider: OAuthProvider, role: UserRole, rememberMe = true) => {
    const params = new URLSearchParams({
      role,
      rememberMe: String(rememberMe),
      frontendOrigin: window.location.origin,
    });
    window.location.href = buildApiUrl(`/auth/oauth/${provider}?${params.toString()}`);
  };

  const completeOAuthLogin = async (token: string, rememberMe = true) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;

    storage.setItem(TOKEN_KEY, token);
    otherStorage.removeItem(TOKEN_KEY);

    try {
      const data = await apiRequest<{ user: AuthUser }>("/auth/me");
      persistSession(data.user, token, rememberMe);
      return true;
    } catch {
      clearSession();
      return false;
    }
  };

  const resetPassword = async (email: string, role: UserRole, newPassword: string) => {
    try {
      await apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, role, newPassword }),
      });
      return true;
    } catch {
      return false;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await apiRequest<{ message: string }>("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return true;
    } catch {
      return false;
    }
  };

  const updateProfile = async (updates: Partial<AuthUser>) => {
    if (!user) return false;

    try {
      const payload = { ...user, ...updates, email: user.email, role: user.role };
      const data = await apiRequest<{ user: AuthUser }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const token = getToken();
      if (!token) return false;

      const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
      persistSession(data.user, token, remember);
      return true;
    } catch {
      return false;
    }
  };

  const logout = clearSession;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        startOAuthLogin,
        completeOAuthLogin,
        signup,
        logout,
        resetPassword,
        changePassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
