import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest, buildApiUrl, getToken, TOKEN_KEY } from "@/lib/api";

/**
 * Two top-level groups, with "user" splitting by what someone can do:
 *
 *   admin
 *   user ──┬── teacher
 *          └── student
 *
 * "user" is a grouping rather than a stored value - the column holds one of these three.
 * Public signup only ever accepts teacher/student; admin is granted by another admin or
 * by the `npm run make-admin` script.
 */
export type UserRole = "admin" | "teacher" | "student";

/** Roles that make up the "user" side of the hierarchy. */
export const USER_ROLES: UserRole[] = ["teacher", "student"];

/** Roles a person can pick for themselves when registering. */
export const SIGNUP_ROLES: UserRole[] = ["student", "teacher"];

export const isAdmin = (role?: UserRole) => role === "admin";
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

/** `error` carries the API's own message so the form can say what actually went wrong. */
export interface LoginResult {
  user: AuthUser | null;
  error?: string;
}

export interface SignupResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  startOAuthLogin: (provider: OAuthProvider, role: UserRole, rememberMe?: boolean) => void;
  completeOAuthLogin: (token: string, rememberMe?: boolean) => Promise<boolean>;
  signup: (name: string, email: string, password: string, role: UserRole) => Promise<SignupResult>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string; emailConfigured?: boolean }>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<{ ok: boolean; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<boolean>;
  requestEmailChange: (newEmail: string, currentPassword: string) => Promise<{ ok: boolean; message?: string }>;
  confirmEmailChange: (token: string) => Promise<{ ok: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "app_auth_user";
const REMEMBER_KEY = "app_auth_remember";
const LEGACY_USERS_KEY = "app_auth_users";

/** apiRequest throws Error(message) built from the API's JSON body. */
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

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
      return { ok: true };
    } catch (error) {
      return { ok: false, error: messageOf(error) };
    }
  };

  // Returns the signed-in account (so the caller can route by its real role), plus the
  // server's own message when it fails. Collapsing every failure into "wrong password"
  // hid a real outage once: the API was rejecting the request outright and the form still
  // blamed the user's credentials.
  const login = async (email: string, password: string, rememberMe = true) => {
    try {
      const data = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      persistSession(data.user, data.token, rememberMe);
      return { user: data.user };
    } catch (error) {
      return { user: null, error: messageOf(error) };
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

  // Step one: ask for a link. The reply is intentionally the same whether or not the
  // address is registered, so there's nothing here to distinguish the two cases.
  const requestPasswordReset = async (email: string) => {
    try {
      const data = await apiRequest<{ message: string; emailConfigured: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return { ok: true, message: data.message, emailConfigured: data.emailConfigured };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  };

  // Step two: redeem the token from the emailed link.
  const resetPasswordWithToken = async (token: string, newPassword: string) => {
    try {
      const data = await apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
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

  // Step one: ask for a change. Password-checked server-side; the reply says plainly whether
  // the link went out, since (unlike a password reset) there's no fallback if it can't be
  // delivered and the caller is already proven to own the account.
  const requestEmailChange = async (newEmail: string, currentPassword: string) => {
    try {
      const data = await apiRequest<{ message: string }>("/auth/email-change/request", {
        method: "POST",
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  };

  // Step two: redeem the token from the link sent to the NEW address. Not authenticated by a
  // token in this browser - opening the link is the proof - so a successful confirm returns a
  // fresh session and this signs the account in immediately with the updated email, even if
  // the link was opened in a different tab or device than the one that requested the change.
  const confirmEmailChange = async (token: string) => {
    try {
      const data = await apiRequest<AuthResponse>("/auth/email-change/confirm", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const remember = localStorage.getItem(REMEMBER_KEY) !== "false";
      persistSession(data.user, data.token, remember);
      return { ok: true, message: "Email updated." };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
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
        requestPasswordReset,
        resetPasswordWithToken,
        changePassword,
        updateProfile,
        requestEmailChange,
        confirmEmailChange,
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
