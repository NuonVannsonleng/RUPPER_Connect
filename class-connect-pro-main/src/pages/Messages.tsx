import { useState } from "react";
import { Mail, MessageSquarePlus, Send, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ACADEMIC_MESSAGES_QUERY_KEY, useAcademicMessages } from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";

export default function Messages() {
  const queryClient = useQueryClient();
  const { data: threads = [], isFetching } = useAcademicMessages();
  const [body, setBody] = useState("");
  const unread = threads.filter((thread) => thread.unread).length;

  const refreshMessages = () => queryClient.invalidateQueries({ queryKey: ACADEMIC_MESSAGES_QUERY_KEY });

  const createMessage = async () => {
    const messageBody = body.trim() || "Hello, I would like to follow up about class progress.";
    try {
      await apiRequest<{ message: string }>("/academic/messages", {
        method: "POST",
        body: JSON.stringify({
          subject: "Academic support message",
          body: messageBody,
        }),
      });
      setBody("");
      await refreshMessages();
      toast.success("Message sent through backend");
    } catch {
      toast.error("Could not send message");
    }
  };

  const openThread = async (threadId: string, subject: string, unreadThread: boolean) => {
    try {
      if (unreadThread) {
        await apiRequest<{ message: string }>(`/academic/messages/${threadId}/read`, {
          method: "PUT",
        });
        await refreshMessages();
      }
      toast.info(`Opened ${subject}`);
    } catch {
      toast.info(`Opened ${subject}`);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Internal communication"
        title="Messages"
        description="Direct teacher and student conversations for academic support, feedback, and class coordination."
        actions={
          <Button size="sm" variant="secondary" className="font-semibold" onClick={createMessage}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New message
          </Button>
        }
      />

      {isFetching && (
        <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          Syncing messages with backend...
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
        <Card className="overflow-hidden border-border/60 shadow-soft">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-4">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Mail className="h-5 w-5 text-primary" />
              Inbox
            </div>
            <Badge variant="secondary">{unread} unread</Badge>
          </div>
          <div className="divide-y divide-border">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => openThread(thread.id, thread.subject, thread.unread)}
                className="flex w-full flex-col gap-3 p-5 text-left transition-base hover:bg-secondary/40 sm:flex-row sm:items-start"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{thread.person}</span>
                    <Badge variant="outline">{thread.role}</Badge>
                    {thread.unread && <Badge className="bg-accent text-accent-foreground">Unread</Badge>}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-foreground">{thread.subject}</span>
                  <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">{thread.preview}</span>
                </span>
                <span className="text-xs text-muted-foreground">{thread.time}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 p-5 shadow-soft">
          <h2 className="font-display text-lg font-bold text-foreground">Quick reply</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft a message now. It will be saved through the messaging API.
          </p>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-4 min-h-44"
            placeholder="Write a clear academic message..."
          />
          <Button className="mt-4 w-full bg-gradient-primary text-primary-foreground" onClick={createMessage}>
            <Send className="mr-2 h-4 w-4" />
            Send message
          </Button>
        </Card>
      </div>
    </>
  );
}
