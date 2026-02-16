'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { globalSearch, type SearchResult } from '@/actions/search-actions';
import { useSettings } from '@/lib/settings-context';
import { Search, Loader2, Building2, ArrowRightLeft, ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig = {
  account: { icon: Building2, color: 'text-blue-500 bg-blue-500/10' },
  income: { icon: ArrowUpRight, color: 'text-emerald-500 bg-emerald-500/10' },
  expense: { icon: ArrowDownRight, color: 'text-red-500 bg-red-500/10' },
  daily_expense: { icon: Receipt, color: 'text-orange-500 bg-orange-500/10' },
  transfer: { icon: ArrowRightLeft, color: 'text-purple-500 bg-purple-500/10' },
};

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const { formatCurrency: fmt } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const formatCurrency = (amount: string | undefined) => {
    if (!amount) return '';
    return fmt(parseFloat(amount));
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await globalSearch(searchQuery);
      setResults(searchResults);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    router.push(result.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-md shadow-2xl rounded-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 h-11 border-b border-border/50 dark:border-white/[0.06]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <input
            placeholder="Suche Konten, Einnahmen, Ausgaben..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            autoFocus
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 dark:border-white/[0.08] bg-muted/30 text-[10px] text-muted-foreground/60">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto">
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground/60">
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
                  'flex items-center gap-3 px-4 h-10 cursor-pointer transition-colors',
                  isSelected 
                    ? 'bg-accent/50 dark:bg-white/[0.05]' 
                    : 'hover:bg-accent/30 dark:hover:bg-white/[0.03]'
                )}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', config.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="flex-1 text-sm truncate">{result.title}</span>
                {result.amount && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(result.amount)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center justify-end gap-4 px-4 h-8 border-t border-border/50 dark:border-white/[0.06] text-[10px] text-muted-foreground/50">
            <div className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/50">↑↓</kbd>
              <span>navigieren</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/50">↵</kbd>
              <span>öffnen</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
