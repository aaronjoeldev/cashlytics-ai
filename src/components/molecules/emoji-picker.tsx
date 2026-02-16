'use client';

import { useState } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const EMOJI_GROUPS = {
  'Essen & Trinken': ['🍔', '🍕', '🍜', '🍣', '☕', '🍺', '🍷', '🍰', '🥗', '🍝', '🌮', '🥐', '🍳', '🥤', '🍫'],
  'Transport': ['🚗', '🚌', '🚇', '✈️', '🚲', '⛽', '🅿️', '🚕', '🛴', '🚆'],
  'Haus & Wohnen': ['🏠', '💡', '🛋️', '🛏️', '🚿', '🔧', '🧹', '🌿', '🔑', '📺'],
  'Shopping': ['🛒', '👗', '👟', '💄', '🎁', '📱', '💻', '🎮', '📚', '🧸'],
  'Gesundheit': ['💊', '🏥', '🩺', '💪', '🧘', '🏃', '🚴', '🏋️', '❤️', '🦷'],
  'Freizeit': ['🎬', '🎵', '🎮', '⚽', '🎾', '🎭', '🎪', '🎨', '📸', '🏖️'],
  'Finanzen': ['💰', '💳', '🏦', '📈', '💸', '🪙', '💎', '📊', '🔒', '💵'],
  'Bildung': ['📚', '🎓', '✏️', '💼', '🖥️', '📖', '🧠', '📝', '🎯', '🏫'],
  'Reisen': ['✈️', '🏨', '🗺️', '🏝️', '🎒', '🛂', '🏖️', '🌍', '🗽', '🎡'],
  'Familie': ['👶', '👨‍👩‍👧', '🐶', '🐱', '🎂', '🎄', '🎃', '💝', '🤝', '🎉'],
  'Standard': ['📁', '✨', '⭐', '📌', '🏷️', '🔹', '✅', '❌', '⚡', '🎯'],
};

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 font-normal"
        >
          {value ? (
            <span className="text-lg">{value}</span>
          ) : (
            <Smile className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={value ? '' : 'text-muted-foreground'}>
            {value || 'Emoji wählen'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
            <div key={group}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{group}</p>
              <div className="grid grid-cols-10 gap-1">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="w-7 h-7 flex items-center justify-center text-lg rounded-lg hover:bg-accent transition-colors"
                    onClick={() => {
                      onChange(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
