import { createContext, useContext, ReactNode } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";

export type Role = UserRole;

/**
 * Admin is the fallback path when a teacher account has a problem - one predicate, reused
 * everywhere a page currently asks "am I a teacher" to decide whether to show teaching
 * actions. Widening this one function is what gives admin those actions, rather than
 * duplicating every teacher screen into an admin-only copy.
 */
export const canActAsTeacher = (role: Role) => role === "teacher" || role === "admin";

interface RoleContextValue {
  role: Role;
  canTeach: boolean;
  setRole: (r: Role) => void;
  user: { name: string; subtitle: string };
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const { user: authUser } = useAuth();
  const role: Role = authUser?.role ?? "student";
  const canTeach = canActAsTeacher(role);

  const setRole = (_r: Role) => undefined;

  const subtitleFor = (account: NonNullable<typeof authUser>) => {
    if (account.role === "admin") return account.department || "Administrator";
    if (account.role === "teacher") return account.department || "Teacher Account";
    return account.major || account.year || "Student Account";
  };

  const user = authUser
    ? { name: authUser.name, subtitle: subtitleFor(authUser) }
    : { name: "Guest", subtitle: "Not signed in" };

  return <RoleContext.Provider value={{ role, canTeach, setRole, user }}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
};
