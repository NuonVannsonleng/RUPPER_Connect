import { useState } from "react";
import { Laptop, Lock, Mail, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/shared/PageHeader";
import { AvatarUpload } from "@/components/shared/AvatarUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type ThemeChoice = "light" | "dark" | "system";

export default function Settings() {
  const { user, updateProfile, changePassword, requestEmailChange } = useAuth();
  const { theme = "system", setTheme } = useTheme();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [studentId, setStudentId] = useState(user?.studentId ?? "");
  const [major, setMajor] = useState(user?.major ?? "");
  const [year, setYear] = useState(user?.year ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [office, setOffice] = useState(user?.office ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);
  const activeTheme = theme as ThemeChoice;

  if (!user) return null;

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    const ok = await updateProfile({
      name,
      phone,
      avatar,
      studentId,
      major,
      year,
      department,
      office,
    });
    setIsSavingProfile(false);

    if (ok) {
      toast.success("Profile updated");
    } else {
      toast.error("Could not update profile");
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsSavingPassword(true);
    const ok = await changePassword(currentPassword, newPassword);
    setIsSavingPassword(false);

    if (!ok) {
      toast.error("Current password is incorrect");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password changed successfully");
  };

  const handleEmailChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("Enter the new email address");
      return;
    }
    if (!emailChangePassword) {
      toast.error("Enter your current password to confirm this change");
      return;
    }

    setIsRequestingEmailChange(true);
    const result = await requestEmailChange(newEmail.trim(), emailChangePassword);
    setIsRequestingEmailChange(false);

    if (!result.ok) {
      toast.error(result.message || "Could not start the email change");
      return;
    }

    toast.success(result.message || "Confirmation link sent", { duration: 8000 });
    setNewEmail("");
    setEmailChangePassword("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, photo, and password for your RUPPER Connect account."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" /> Profile information
            </CardTitle>
            <CardDescription>This information is saved to your backend account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSave} className="space-y-5">
              <AvatarUpload value={avatar} onChange={setAvatar} name={name || user.name} />

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user.email} disabled />
                  <p className="text-xs text-muted-foreground">Use "Change email" to update your sign-in address.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={user.role} disabled className="capitalize" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                </div>
              </div>

              {user.role === "student" ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Student ID</Label>
                    <Input id="studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. RUPPER001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="major">Major</Label>
                    <Input id="major" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. Year 2" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. IT Department" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="office">Office</Label>
                    <Input id="office" value={office} onChange={(e) => setOffice(e.target.value)} placeholder="e.g. Building A, Room 204" />
                  </div>
                </div>
              )}

              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" /> Appearance
              </CardTitle>
              <CardDescription>Choose how RUPPER Connect appears on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <ToggleGroup
                type="single"
                value={activeTheme}
                onValueChange={(value) => {
                  if (value) setTheme(value as ThemeChoice);
                }}
                className="grid grid-cols-3 gap-2"
              >
                <ToggleGroupItem
                  value="light"
                  aria-label="Light mode"
                  className="h-auto flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Sun className="h-4 w-4" />
                  <span className="text-xs font-semibold">Light</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  aria-label="Dark mode"
                  className="h-auto flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Moon className="h-4 w-4" />
                  <span className="text-xs font-semibold">Dark</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="system"
                  aria-label="System mode"
                  className="h-auto flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3 text-card-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Laptop className="h-4 w-4" />
                  <span className="text-xs font-semibold">System</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Change email
              </CardTitle>
              <CardDescription>
                We'll send a confirmation link to the new address. Your current email keeps working to sign in until
                you open it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailChangeRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newEmail">New email</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@rupp.edu.kh"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailChangePassword">Current password</Label>
                  <Input
                    id="emailChangePassword"
                    type="password"
                    value={emailChangePassword}
                    onChange={(e) => setEmailChangePassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isRequestingEmailChange}>
                  {isRequestingEmailChange ? "Sending..." : "Send confirmation link"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" /> Change password
              </CardTitle>
              <CardDescription>Update the password used for backend sign in.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={isSavingPassword}>
                  {isSavingPassword ? "Changing..." : "Change password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
