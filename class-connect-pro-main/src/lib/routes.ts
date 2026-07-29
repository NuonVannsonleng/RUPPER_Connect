import type { UserRole } from "@/context/AuthContext";

/** Where a signed-in account belongs when it lands on a page meant for visitors. */
export const landingPathFor = (role: UserRole) => (role === "admin" ? "/admin" : "/dashboard");
