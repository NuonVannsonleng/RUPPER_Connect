import {
  BookOpenCheck,
  Brain,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SyncStatus } from "@/components/shared/SyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useAdminStats } from "@/hooks/useAdmin";

const roleTone: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  teacher: "bg-info/10 text-info border-info/20",
  student: "bg-success/10 text-success border-success/20",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats, isFetching } = useAdminStats();

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Platform administration"
        title={`Welcome back, ${user?.name?.split(" ").slice(-1)[0] ?? "Admin"}`}
        description="Manage accounts and roles, oversee every course on the platform, and keep an eye on overall activity."
        actions={
          <Button asChild size="sm" variant="secondary" className="font-semibold">
            <Link to="/admin/users">
              <UserCog className="mr-2 h-4 w-4" />
              Manage users
            </Link>
          </Button>
        }
      />

      {isFetching && <SyncStatus label="platform statistics" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.users.total} hint="All accounts" icon={Users} tone="primary" to="/admin/users" />
        <StatCard label="Teachers" value={stats.users.teacher} hint="Teaching staff" icon={GraduationCap} tone="info" to="/admin/users" />
        <StatCard label="Students" value={stats.users.student} hint="Enrolled learners" icon={Users} tone="success" to="/admin/users" />
        <StatCard label="Admins" value={stats.users.admin} hint="Platform managers" icon={ShieldCheck} tone="warning" to="/admin/users" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Courses" value={stats.courses} hint="Across faculties" icon={BookOpenCheck} tone="primary" to="/admin/courses" />
        <StatCard label="Assignments" value={stats.assignments} hint="Created platform-wide" icon={FileText} tone="info" />
        <StatCard label="Quizzes" value={stats.quizzes} hint="Created platform-wide" icon={Brain} tone="success" />
        <StatCard label="Announcements" value={stats.announcements} hint="Published notices" icon={Megaphone} tone="warning" />
        <StatCard label="Attendance records" value={stats.attendanceRecords} hint="Marks recorded" icon={ClipboardCheck} tone="success" />
      </div>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <UserCog className="h-5 w-5 text-primary" />
            Newest accounts
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link to="/admin/users">View all</Link>
          </Button>
        </div>

        {stats.recentUsers.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Users} title="No accounts yet" detail="New signups will appear here." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentUsers.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {account.createdAt && (
                    <span className="text-xs text-muted-foreground">{account.createdAt}</span>
                  )}
                  <Badge className={`border capitalize ${roleTone[account.role] ?? ""}`}>{account.role}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
