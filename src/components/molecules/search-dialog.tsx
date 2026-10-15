"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { globalSearch, type SearchResult } from "@/actions/search-actions";
import { useSettings } from "@/lib/settings-context";
import {
  Search,
  Loader2,
  Building2,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig = {
  account: { icon: Building2, color: "text-blue-500 bg-blue-500/10" },
  income: { icon: ArrowUpRight, color: "text-emerald-500 bg-emerald-500/10" },
  expense: { icon: ArrowDownRight, color: "text-red-500 bg-red-500/10" },
  daily_expense: { icon: Receipt, color: "text-orange-500 bg-orange-500/10" },
  transfer: { icon: ArrowRightLeft, color: "text-purple-500 bg-purple-500/10" },
};

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const { formatAmount } = useSettings();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  // Only the latest query may fill the list; slower earlier answers are dropped
  const searchRequestRef = useRef(0);

  // Start empty each time the dialog opens (state adjusted during render, not in an effect)
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setResults([]);
    }
  }

  const performSearch = useCallback(async (searchQuery: string) => {
    const request = ++searchRequestRef.current;
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await globalSearch(searchQuery);
      if (request !== searchRequestRef.current) return;
      setResults(searchResults);
      setSelectedIndex(0);
    } catch {
      if (request === searchRequestRef.current) setResults([]);
    } finally {
      if (request === searchRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    router.push(result.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl">
        {/* Search Input */}
        <div className="border-border/50 flex h-11 items-center gap-3 border-b px-4 dark:border-white/[0.06]">
          <Search className="text-muted-foreground/60 h-4 w-4 shrink-0" />
          <input
            placeholder="Suche Konten, Einnahmen, Ausgaben..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="placeholder:text-muted-foreground/50 flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
          {loading && <Loader2 className="text-muted-foreground/50 h-4 w-4 animate-spin" />}
          <kbd className="border-border/50 bg-muted/30 text-muted-foreground/60 hidden items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] sm:inline-flex dark:border-white/[0.08]">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto">
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="text-muted-foreground/60 py-10 text-center text-sm">
              Keine Ergebnisse
            </div>
          )}

          {results.map((result, index) => {
            const config = typeConfig[result.type as keyof typeof typeConfig];
            const Icon = config.icon;
            const isSelected = index === selectedIndex;

            return (
              <div
                key={`${result.type}-${result.id}`}
                className={cn(
                  "flex h-10 cursor-pointer items-center gap-3 px-4 transition-colors",
                  isSelected
                    ? "bg-accent/50 dark:bg-white/[0.05]"
                    : "hover:bg-accent/30 dark:hover:bg-white/[0.03]"
                )}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    config.color
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="flex-1 truncate text-sm">{result.title}</span>
                {result.amount && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatAmount(result.amount, result.currency)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="border-border/50 text-muted-foreground/50 flex h-8 items-center justify-end gap-4 border-t px-4 text-[10px] dark:border-white/[0.06]">
            <div className="flex items-center gap-1">
              <kbd className="bg-muted/50 rounded px-1 py-0.5">↑↓</kbd>
              <span>navigieren</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="bg-muted/50 rounded px-1 py-0.5">↵</kbd>
              <span>öffnen</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
