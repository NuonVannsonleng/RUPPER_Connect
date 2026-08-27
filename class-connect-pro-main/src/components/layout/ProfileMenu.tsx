import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  student: "Student",
};

const ROLE_TONE: Record<UserRole, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  teacher: "border-info/30 bg-info/10 text-info",
  student: "border-success/30 bg-success/10 text-success",
};

/**
 * The fields worth showing differ by role - a student has no office, an admin has no major -
 * so each role names its own, and anything the account hasn't filled in is skipped rather
 * than rendered as an empty row.
 */
const detailsFor = (role: UserRole, account: ReturnType<typeof useAuth>["user"]) => {
  if (!account) return [];

  const byRole: Array<[string, string | undefined]> =
    role === "student"
      ? [
          ["Student ID", account.studentId],
          ["Major", account.major],
          ["Year", account.year],
        ]
      : role === "teacher"
        ? [
            ["Department", account.department],
            ["Office", account.office],
          ]
        : [["Department", account.department]];

  return [...byRole, ["Phone", account.phone] as [string, string | undefined]].filter(
    (entry): entry is [string, string] => Boolean(entry[1]?.trim())
  );
};

export function ProfileMenu() {
  const { role, user } = useRole();
  const { user: account, logout } = useAuth();
  const navigate = useNavigate();

  const details = detailsFor(role, account);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          // On a phone only the avatar shows, so the trigger has to be a circle around it - the
          // old asymmetric pl-1 pr-2 left it a lopsided squircle with a visible box behind
          // the round photo. Even padding here, and it grows into a pill once the name appears.
          className="flex items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm transition-base hover:border-primary/40 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:py-1 sm:pl-1 sm:pr-3"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={account?.avatar} alt="" />
            <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-xs font-semibold text-foreground">{user.name}</span>
            <span className="block text-[10px] text-muted-foreground">{user.subtitle}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-2rem))] p-0">
        <div className="flex items-start gap-3 px-4 py-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={account?.avatar} alt="" />
            <AvatarFallback className="bg-gradient-primary text-sm font-bold text-primary-foreground">
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            {account?.email && <p className="truncate text-xs text-muted-foreground">{account.email}</p>}
            <Badge variant="outline" className={`mt-1.5 h-5 px-2 text-[10px] font-semibold ${ROLE_TONE[role]}`}>
              {ROLE_LABEL[role]}
            </Badge>
          </div>
        </div>

        {details.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <dl className="grid gap-1.5 px-4 py-3">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="truncate font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          {/* One entry, not two: /settings is a single page holding the profile fields,
              appearance, email and password, so a separate "profile" item pointed at exactly
              the same place. The name says both, since that is what the page covers. */}
          <DropdownMenuItem onSelect={() => navigate("/settings")} className="cursor-pointer gap-2">
            <SettingsIcon className="h-4 w-4" />
            Profile &amp; settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              logout();
              navigate("/login");
            }}
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
