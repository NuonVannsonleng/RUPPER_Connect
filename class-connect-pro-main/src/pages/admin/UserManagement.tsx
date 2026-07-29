import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Plus, Search, Trash2, UserCog, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatus } from "@/components/shared/SyncStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { ADMIN_STATS_QUERY_KEY, ADMIN_USERS_QUERY_KEY, useAdminUsers, type AdminUser } from "@/hooks/useAdmin";
import { apiRequest } from "@/lib/api";

const roleTone: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  teacher: "bg-info/10 text-info border-info/20",
  student: "bg-success/10 text-success border-success/20",
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const emptyForm = { name: "", email: "", password: "", role: "student" as UserRole };

export default function UserManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isFetching, isError, error, refetch } = useAdminUsers();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: ADMIN_STATS_QUERY_KEY });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((account) => {
      if (roleFilter !== "all" && account.role !== roleFilter) return false;
      if (!term) return true;
      return account.name.toLowerCase().includes(term) || account.email.toLowerCase().includes(term);
    });
  }, [users, search, roleFilter]);

  const changeRole = async (account: AdminUser, role: UserRole) => {
    if (role === account.role) return;
    setSavingId(account.id);
    try {
      await apiRequest<AdminUser>(`/admin/users/${account.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      await refresh();
      toast.success(`${account.name} is now a ${role}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change this role");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await apiRequest<{ message: string }>(`/admin/users/${userToDelete.id}`, { method: "DELETE" });
      await refresh();
      toast.success(`${userToDelete.name} was removed`);
      setUserToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setIsResetting(true);
    try {
      const data = await apiRequest<{ message: string }>(`/admin/users/${resetTarget.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      toast.success(data.message);
      setResetTarget(null);
      setResetPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set this password");
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error("Name, email, and password are required.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsCreating(true);
    try {
      await apiRequest<AdminUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...form, name: form.name.trim(), email: form.email.trim() }),
      });
      await refresh();
      toast.success("Account created");
      setCreateOpen(false);
      setForm(emptyForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create this account");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Create accounts, promote teachers, and control who can administer the platform."
        actions={
          <Button size="sm" variant="secondary" className="font-semibold" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New account
          </Button>
        }
      />

      {isFetching && <SyncStatus label="accounts" />}

      <Card className="mb-6 border-border/60 p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="student">Students</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <UserCog className="h-5 w-5 text-primary" />
            Accounts
          </div>
          <Badge variant="secondary">{filtered.length} shown</Badge>
        </div>

        {isError ? (
          <div className="p-5">
            <LoadError label="accounts" error={error} onRetry={() => refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title={users.length === 0 ? "No accounts yet" : "No accounts match your filters"}
              detail={users.length === 0 ? "Accounts will appear here as people sign up." : "Try a different search or role filter."}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((account) => {
              const isSelf = String(account.id) === String(user?.id ?? "");
              return (
                <li key={account.id} className="flex flex-col gap-3 px-5 py-4 transition-base hover:bg-secondary/30 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {initials(account.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      {/* A div rather than a p: Badge renders a div, which isn't valid inside a p. */}
                      <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                        <span className="truncate">{account.name}</span>
                        {isSelf && <Badge variant="outline" className="text-[10px] uppercase">You</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.email}
                        {account.studentId ? ` - ${account.studentId}` : ""}
                        {account.department ? ` - ${account.department}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border capitalize ${roleTone[account.role] ?? ""}`}>{account.role}</Badge>

                    <Select
                      value={account.role}
                      onValueChange={(value) => changeRole(account, value as UserRole)}
                      disabled={savingId === account.id || isSelf}
                    >
                      <SelectTrigger className="h-9 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    {savingId === account.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      onClick={() => {
                        setResetTarget(account);
                        setResetPassword("");
                      }}
                      aria-label={`Set a new password for ${account.name}`}
                      title="Set a new password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setUserToDelete(account)}
                      disabled={isSelf}
                      aria-label={`Delete ${account.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setForm(emptyForm);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="admin-user-name">Full name</Label>
              <Input
                id="admin-user-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sok Dara"
              />
            </div>
            <div>
              <Label htmlFor="admin-user-email">Email</Label>
              <Input
                id="admin-user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="sok.dara@rupp.edu.kh"
              />
            </div>
            <div>
              <Label htmlFor="admin-user-password">Temporary password</Label>
              <Input
                id="admin-user-password"
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 6 characters"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Share this with the account holder - they can change it from Settings.
              </p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm((f) => ({ ...f, role: value as UserRole }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} className="bg-gradient-primary text-primary-foreground" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              For <span className="font-semibold text-foreground">{resetTarget?.name}</span> ({resetTarget?.email}).
              Use this when someone can't receive the reset email. They'll be signed out everywhere and will need to
              sign in again with this password.
            </p>
            <div>
              <Label htmlFor="admin-reset-password">New password</Label>
              <Input
                id="admin-reset-password"
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Give it to them in person or over a channel you trust, and ask them to change it from Settings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={isResetting}>
              Cancel
            </Button>
            <Button onClick={handleSetPassword} className="bg-gradient-primary text-primary-foreground" disabled={isResetting}>
              {isResetting ? "Saving..." : "Set password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete
                ? `${userToDelete.name} (${userToDelete.email}) will be permanently removed, along with their attendance, grades, and submissions.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
