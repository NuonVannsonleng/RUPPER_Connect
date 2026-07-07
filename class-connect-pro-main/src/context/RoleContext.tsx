import { createContext, useContext, ReactNode } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";

export type Role = UserRole;

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  user: { name: string; subtitle: string };
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const { user: authUser } = useAuth();
  const role: Role = authUser?.role ?? "student";

  const setRole = (_r: Role) => undefined;

  const user = authUser
    ? {
        name: authUser.name,
        subtitle:
          authUser.role === "teacher"
            ? authUser.department || "Teacher Account"
            : authUser.major || authUser.year || "Student Account",
      }
    : { name: "Guest", subtitle: "Not signed in" };

  return <RoleContext.Provider value={{ role, setRole, user }}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
};
