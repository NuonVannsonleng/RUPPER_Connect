import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, Pin, AlertTriangle, Calendar, BookOpen, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Announcement } from "@/data/mockData";
import { useRole } from "@/context/RoleContext";
import { apiRequest } from "@/lib/api";
import {
  ANNOUNCEMENTS_QUERY_KEY,
  ApiAnnouncement,
  formatAnnouncement,
  useAnnouncements,
} from "@/hooks/useAnnouncements";

const categoryConfig: Record<Announcement["category"], { label: string; icon: typeof Megaphone; classes: string }> = {
  exam: { label: "Exam", icon: BookOpen, classes: "bg-info/10 text-info border-info/20" },
  event: { label: "Event", icon: Calendar, classes: "bg-success/10 text-success border-success/20" },
  general: { label: "General", icon: Megaphone, classes: "bg-secondary text-secondary-foreground border-border" },
  urgent: { label: "Urgent", icon: AlertTriangle, classes: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function Announcements() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const { data: loadedItems = [], isError } = useAnnouncements();
  const [items, setItems] = useState<Announcement[]>(loadedItems);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Announcement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Announcement["category"]>("general");

  useEffect(() => {
    setItems(loadedItems);
  }, [loadedItems]);

  useEffect(() => {
    if (isError) toast.error("Could not load backend announcements. Showing sample notices.");
  }, [isError]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setCategory("general");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: Announcement) => {
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setCategory(item.category);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in both title and message.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = { title: title.trim(), content: body.trim(), category };
      const saved = editing
        ? await apiRequest<ApiAnnouncement>(`/announcements/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiRequest<ApiAnnouncement>("/announcements", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const formatted = formatAnnouncement(saved);
      const nextItems = editing
        ? items.map((item) => (item.id === formatted.id ? formatted : item))
        : [formatted, ...items];

      setItems(nextItems);
      queryClient.setQueryData<Announcement[]>(ANNOUNCEMENTS_QUERY_KEY, nextItems);
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
      setOpen(false);
      resetForm();
      toast.success(editing ? "Announcement updated" : "Announcement published");
    } catch {
      toast.error(editing ? "Could not update announcement" : "Could not publish announcement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      await apiRequest<{ message: string }>(`/announcements/${itemToDelete.id}`, {
        method: "DELETE",
      });
      const nextItems = items.filter((item) => item.id !== itemToDelete.id);

      setItems(nextItems);
      queryClient.setQueryData<Announcement[]>(ANNOUNCEMENTS_QUERY_KEY, nextItems);
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
      toast.success("Announcement deleted");
      setItemToDelete(null);
    } catch {
      toast.error("Could not delete announcement");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        description={
          role === "teacher"
            ? "Broadcast updates, reminders and urgent notices to your students."
            : "Updates from your teachers and the academic office."
        }
        actions={
          role === "teacher" ? (
            <Button onClick={openCreate} className="bg-gradient-primary text-primary-foreground hover:opacity-95">
              <Plus className="mr-1.5 h-4 w-4" />
              New announcement
            </Button>
          ) : undefined
        }
      />

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "Publish a new announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Midterm review session"
              />
            </div>
            <div>
              <Label htmlFor="announcement-body">Message</Label>
              <Textarea
                id="announcement-body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share the details..."
              />
            </div>
            <div>
              <Label>Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(categoryConfig) as Announcement["category"][]).map((nextCategory) => {
                  const cfg = categoryConfig[nextCategory];
                  const active = category === nextCategory;
                  return (
                    <button
                      key={nextCategory}
                      type="button"
                      onClick={() => setCategory(nextCategory)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-base ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground hover:opacity-95" disabled={isSaving}>
              {isSaving ? "Saving..." : editing ? "Save changes" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.length === 0 && (
          <Card className="border-border/60 p-6 text-sm text-muted-foreground shadow-soft">
            No announcements yet.
          </Card>
        )}

        {items.map((announcement, idx) => {
          const cfg = categoryConfig[announcement.category];
          const Icon = cfg.icon;
          const pinned = idx === 0 && announcement.category === "urgent";
          return (
            <Card
              key={announcement.id}
              className={`group flex flex-col gap-3 p-5 shadow-soft transition-base hover:-translate-y-0.5 hover:shadow-elegant ${
                announcement.category === "urgent" ? "border-destructive/30" : "border-border/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${cfg.classes}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${cfg.classes}`}>
                      {cfg.label}
                    </Badge>
                    <h3 className="mt-1 font-display text-base font-bold leading-tight text-foreground">
                      {announcement.title}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {pinned && <Pin className="h-4 w-4 fill-accent text-accent" />}
                  {role === "teacher" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => openEdit(announcement)}
                        aria-label={`Edit ${announcement.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setItemToDelete(announcement)}
                        aria-label={`Delete ${announcement.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{announcement.body}</p>

              <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
                <span className="font-medium">{announcement.author}</span>
                <span>{announcement.date}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This announcement will be removed for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
