import { useState } from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EMOJI_GROUPS, STICKERS } from "@/lib/messageAttachments";

/**
 * Hand-rolled rather than pulling in emoji-mart or emoji-picker-react. Those ship a full
 * Unicode index and its search data - hundreds of kilobytes - and this needs a grid of the
 * characters people actually reach for in a school chat.
 */
export function EmojiPickerButton({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          aria-label="Insert emoji"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <ScrollArea className="h-72">
          <div className="p-3">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {group.emoji.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      // The picker stays open: people add several in a row.
                      onClick={() => onPick(emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none transition-base hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The sticker grid on its own, so it can sit inside the attach menu rather than needing a
 * seventh button of its own in the composer row.
 */
export function StickerGrid({ onSend }: { onSend: (sticker: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1 p-1">
      {STICKERS.map((sticker) => (
        <button
          key={sticker}
          type="button"
          onClick={() => onSend(sticker)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl leading-none transition-base hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Send ${sticker}`}
        >
          {sticker}
        </button>
      ))}
    </div>
  );
}
