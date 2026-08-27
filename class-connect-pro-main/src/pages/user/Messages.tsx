import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  MessagesSquare,
  Paperclip,
  Search,
  SendHorizonal,
  SquarePen,
  Sticker,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AttachmentBubble } from "@/components/chat/AttachmentBubble";
import { CameraCaptureDialog } from "@/components/chat/CameraCaptureDialog";
import { EmojiPickerButton, StickerGrid } from "@/components/chat/EmojiStickerPicker";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { PageHeader } from "@/components/shared/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  ACADEMIC_CONVERSATIONS_QUERY_KEY,
  academicThreadQueryKey,
  useAcademicContacts,
  useChatThread,
  useConversations,
  type AcademicContact,
  type ChatAttachment,
  type ChatMessage,
  type ChatThread,
  type DirectoryRole,
} from "@/hooks/useAcademicPlatform";
import { apiRequest } from "@/lib/api";
import { clockTime, conversationTime, dayLabel, isNewDay } from "@/lib/chatTime";
import {
  ACCEPT_ATTRIBUTE,
  fileToBase64,
  formatBytes,
  validateAttachment,
} from "@/lib/messageAttachments";

const ROLE_TONE: Record<DirectoryRole, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  teacher: "border-info/30 bg-info/10 text-info",
  student: "border-success/30 bg-success/10 text-success",
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function PersonAvatar({ name, avatar, className = "h-10 w-10" }: { name: string; avatar?: string; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={avatar || undefined} alt="" />
      <AvatarFallback className="bg-gradient-primary text-xs font-bold text-primary-foreground">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export default function Messages() {
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useConversations();
  const { data: contacts = [] } = useAcademicContacts();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [search, setSearch] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; fileName?: string } | null>(null);
  // Chosen but not sent yet, so a photo can be captioned before it goes.
  const [pendingFile, setPendingFile] = useState<{ kind: "image" | "file"; file: File; previewUrl?: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: thread, isLoading: threadLoading } = useChatThread(activeId);

  const totalUnread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  // Decides whether the right-hand button is Send or the mic.
  const hasSomethingToSend = Boolean(draft.trim() || pendingFile);

  // Someone picked from the directory who you have never messaged has no conversation row
  // yet, so the header falls back to the contact record until the first message exists.
  const activeContact: AcademicContact | undefined = useMemo(() => {
    if (!activeId) return undefined;
    if (thread?.person) return thread.person;
    return contacts.find((contact) => contact.id === activeId);
  }, [activeId, contacts, thread]);

  const visibleConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) => item.name.toLowerCase().includes(term));
  }, [conversations, search]);

  const visibleContacts = useMemo(() => {
    const term = directorySearch.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter(
      (contact) => contact.name.toLowerCase().includes(term) || contact.email.toLowerCase().includes(term)
    );
  }, [contacts, directorySearch]);

  // Pin to the newest message whenever the thread changes or grows.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, activeId]);

  const openConversation = (userId: string) => {
    setActiveId(userId);
    setDraft("");
  };

  /**
   * One path for everything the composer can produce. `attachment` carries the file half of
   * the request when there is one; text-only sends leave it undefined.
   */
  const deliver = async (options: {
    body?: string;
    attachment?: { kind: "image" | "file" | "voice" | "sticker"; file?: File; sticker?: string; durationMs?: number };
    optimistic: ChatAttachment | undefined;
  }) => {
    if (!activeId) return;

    const threadKey = academicThreadQueryKey(activeId);
    const pending: ChatMessage = {
      id: `pending-${Date.now()}`,
      body: options.body?.trim() || null,
      sentAt: new Date().toISOString(),
      fromMe: true,
      attachment: options.optimistic,
    };
    queryClient.setQueryData<ChatThread>(threadKey, (current) =>
      current ? { ...current, messages: [...current.messages, pending] } : current
    );

    setIsSending(true);
    try {
      const payload: Record<string, unknown> = { receiverId: activeId };
      if (options.body?.trim()) payload.body = options.body.trim();

      if (options.attachment) {
        const { kind, file, sticker, durationMs } = options.attachment;
        payload.attachment =
          kind === "sticker"
            ? { kind, sticker }
            : { kind, fileName: file!.name, fileData: await fileToBase64(file!), durationMs };
      }

      await apiRequest<{ message: string }>("/academic/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: threadKey }),
        queryClient.invalidateQueries({ queryKey: ACADEMIC_CONVERSATIONS_QUERY_KEY }),
      ]);
      return true;
    } catch (error) {
      queryClient.setQueryData<ChatThread>(threadKey, (current) =>
        current ? { ...current, messages: current.messages.filter((item) => item.id !== pending.id) } : current
      );
      toast.error(error instanceof Error ? error.message : "Could not send that message");
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const chooseAttachment = (kind: "image" | "file", file: File | null | undefined) => {
    if (!file) return;
    const problem = validateAttachment(kind, file);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile({
      kind,
      file,
      previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
    });
  };

  const clearPendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const sendSticker = (sticker: string) =>
    void deliver({ attachment: { kind: "sticker", sticker }, optimistic: { kind: "sticker" } });

  const sendVoice = async (file: File, durationMs: number) => {
    const problem = validateAttachment("voice", file);
    if (problem) {
      toast.error(problem);
      return;
    }
    await deliver({
      attachment: { kind: "voice", file, durationMs },
      optimistic: { kind: "voice", fileName: file.name, fileSize: file.size, durationMs },
    });
  };

  /** The composer's send button: text, an attached file, or both together. */
  const send = async () => {
    const body = draft.trim();
    if ((!body && !pendingFile) || !activeId) return;

    const attached = pendingFile;
    const previousDraft = draft;
    // Clear the box first so it feels immediate; both are restored if the send fails.
    setDraft("");
    clearPendingFile();

    const ok = await deliver({
      body,
      attachment: attached ? { kind: attached.kind, file: attached.file } : undefined,
      optimistic: attached
        ? { kind: attached.kind, fileName: attached.file.name, fileSize: attached.file.size }
        : undefined,
    });

    if (!ok) {
      setDraft(previousDraft);
      if (attached) setPendingFile(attached);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Internal communication"
        title="Messages"
        description="Talk directly with anyone at the university - students, teachers, and administrators."
        actions={
          <Button size="sm" variant="secondary" className="font-semibold" onClick={() => setDirectoryOpen(true)}>
            <SquarePen className="mr-2 h-4 w-4" />
            New message
          </Button>
        }
      />

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="grid h-[min(38rem,calc(100dvh-16rem))] grid-cols-1 md:grid-cols-[20rem_1fr]">
          {/* ---------------- conversation list ---------------- */}
          <aside
            className={`flex min-h-0 flex-col border-border md:border-r ${activeId ? "hidden md:flex" : "flex"}`}
          >
            <div className="border-b border-border px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-foreground">Chats</h2>
                {totalUnread > 0 && (
                  <Badge className="h-5 bg-accent px-2 text-[10px] text-accent-foreground">{totalUnread} unread</Badge>
                )}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats"
                  className="h-9 pl-9"
                />
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              {visibleConversations.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <MessagesSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">No conversations yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start one with anyone at the university.
                  </p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={() => setDirectoryOpen(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    Browse people
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {visibleConversations.map((item) => {
                    const active = item.userId === activeId;
                    return (
                      <li key={item.userId}>
                        <button
                          type="button"
                          onClick={() => openConversation(item.userId)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-base hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                            active ? "bg-secondary/80" : ""
                          }`}
                        >
                          <PersonAvatar name={item.name} avatar={item.avatar} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">{item.name}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {conversationTime(item.lastAt)}
                              </span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-2">
                              <span
                                className={`truncate text-xs ${
                                  item.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {item.lastFromMe ? "You: " : ""}
                                {item.lastMessage}
                              </span>
                              {item.unreadCount > 0 && (
                                <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                                  {item.unreadCount}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </aside>

          {/* ---------------- thread ---------------- */}
          <section className={`flex min-h-0 flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
            {!activeId ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <MessagesSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Pick a conversation</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Choose someone on the left, or start a new chat with anyone at the university.
                </p>
              </div>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 md:hidden"
                    onClick={() => setActiveId(null)}
                    aria-label="Back to chats"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <PersonAvatar name={activeContact?.name ?? "?"} avatar={activeContact?.avatar} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{activeContact?.name ?? "Loading..."}</p>
                    {activeContact?.email && (
                      <p className="truncate text-xs text-muted-foreground">{activeContact.email}</p>
                    )}
                  </div>
                  {activeContact && (
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${ROLE_TONE[activeContact.role]}`}>
                      {activeContact.role}
                    </Badge>
                  )}
                </header>

                <ScrollArea className="min-h-0 flex-1 bg-secondary/20">
                  <div className="flex flex-col gap-1 p-4">
                    {threadLoading && !thread ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation...
                      </div>
                    ) : thread && thread.messages.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        No messages yet - say hello.
                      </p>
                    ) : (
                      thread?.messages.map((message, index) => (
                        <div key={message.id}>
                          {isNewDay(thread.messages[index - 1]?.sentAt, message.sentAt) && (
                            <div className="my-3 flex items-center gap-3">
                              <span className="h-px flex-1 bg-border" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {dayLabel(message.sentAt)}
                              </span>
                              <span className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          <div className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
                            {message.attachment?.kind === "sticker" ? (
                              // A sticker is the message: no bubble around it, just the glyph.
                              <div className="flex flex-col items-end">
                                <span className="text-5xl leading-none">{message.body}</span>
                                <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                                  {clockTime(message.sentAt)}
                                </span>
                              </div>
                            ) : (
                              <div
                                className={`max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[70%] ${
                                  message.fromMe
                                    ? "rounded-br-sm bg-primary text-primary-foreground"
                                    // A border, not just a fill: the thread sits on a tinted card,
                                    // so a bare bg-card bubble was the same shade as the panel
                                    // behind it and had no edge at all.
                                    : "rounded-bl-sm border border-border bg-card text-foreground shadow-soft"
                                }`}
                              >
                                {message.attachment && (
                                  <span className="mb-1 block">
                                    <AttachmentBubble
                                      attachment={message.attachment}
                                      fromMe={message.fromMe}
                                      onOpenImage={(url, fileName) => setLightbox({ url, fileName })}
                                    />
                                  </span>
                                )}
                                {message.body && (
                                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                                )}
                                <p
                                  className={`mt-1 text-right text-[10px] tabular-nums ${
                                    message.fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                  }`}
                                >
                                  {clockTime(message.sentAt)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-border p-3">
                  {/* Chosen but not yet sent, so a photo can be captioned first. */}
                  {pendingFile && (
                    <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-2">
                      {pendingFile.previewUrl ? (
                        <img src={pendingFile.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded bg-secondary">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{pendingFile.file.name}</span>
                        <span className="block text-xs text-muted-foreground">{formatBytes(pendingFile.file.size)}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={clearPendingFile}
                        aria-label="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Six buttons in a row left the text box a squeezed sliver on a phone -
                      "Message Nuon" wrapped onto two lines. Everything that attaches something
                      now lives behind one paperclip, and the right-hand button is either the
                      mic or Send depending on whether there is anything to send, which is how
                      Telegram and WhatsApp handle the same problem. */}
                  {isRecording ? (
                    <VoiceRecorder
                      onRecorded={(file, ms) => void sendVoice(file, ms)}
                      onRecordingChange={setIsRecording}
                      disabled={isSending}
                    />
                  ) : (
                    <div className="flex items-end gap-1.5">
                      <EmojiPickerButton
                        onPick={(emoji) => setDraft((current) => current + emoji)}
                        disabled={isSending}
                      />

                      <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                            disabled={isSending}
                            aria-label="Attach something"
                          >
                            <Paperclip className="h-5 w-5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-56 p-1">
                          {[
                            { icon: ImagePlus, label: "Photo", onSelect: () => imageInputRef.current?.click() },
                            { icon: Camera, label: "Take photo", onSelect: () => setCameraOpen(true) },
                            { icon: Paperclip, label: "File", onSelect: () => fileInputRef.current?.click() },
                          ].map(({ icon: Icon, label, onSelect }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                setAttachMenuOpen(false);
                                onSelect();
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-base hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              {label}
                            </button>
                          ))}

                          <div className="my-1 h-px bg-border" />
                          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Sticker className="h-3 w-3" /> Stickers
                            </span>
                          </p>
                          <StickerGrid
                            onSend={(sticker) => {
                              setAttachMenuOpen(false);
                              sendSticker(sticker);
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          // Enter sends, Shift+Enter breaks the line - what every chat app does.
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                          }
                        }}
                        placeholder="Message..."
                        rows={1}
                        className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl py-3"
                      />

                      {hasSomethingToSend ? (
                        <Button
                          onClick={() => void send()}
                          disabled={isSending}
                          className="h-11 w-11 shrink-0 rounded-full bg-gradient-primary p-0 text-primary-foreground"
                          aria-label="Send message"
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendHorizonal className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <VoiceRecorder
                          onRecorded={(file, ms) => void sendVoice(file, ms)}
                          onRecordingChange={setIsRecording}
                          disabled={isSending}
                        />
                      )}
                    </div>
                  )}

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE.image}
                    className="hidden"
                    onChange={(event) => {
                      chooseAttachment("image", event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE.file}
                    className="hidden"
                    onChange={(event) => {
                      chooseAttachment("file", event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </Card>

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => chooseAttachment("image", file)}
      />

      {/* Full-size view of a photo already in the thread. The URL is the object URL the
          bubble built, so no second fetch and nothing to revoke here. */}
      <Dialog open={Boolean(lightbox)} onOpenChange={(next) => !next && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{lightbox?.fileName || "Photo"}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <img src={lightbox.url} alt={lightbox.fileName || "Photo"} className="max-h-[80vh] w-full object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- people directory ---------------- */}
      <Dialog open={directoryOpen} onOpenChange={setDirectoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>Everyone at the university you can message.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={directorySearch}
              onChange={(event) => setDirectorySearch(event.target.value)}
              placeholder="Search by name or email"
              className="h-10 pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="max-h-[22rem]">
            {visibleContacts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nobody matches that.</p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleContacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => {
                        openConversation(contact.id);
                        setDirectoryOpen(false);
                        setDirectorySearch("");
                      }}
                      className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-base hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <PersonAvatar name={contact.name} avatar={contact.avatar} className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{contact.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{contact.email}</span>
                      </span>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${ROLE_TONE[contact.role]}`}>
                        {contact.role}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
