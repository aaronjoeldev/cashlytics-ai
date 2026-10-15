"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Check, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getActiveInsights, markInsightRead } from "@/actions/insights-actions";
import type { Insight } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/** Bell in the header: lists the unread insights and lets the user mark them as read. */
export function NotificationsMenu() {
  const t = useTranslations("notificationsMenu");
  const tCommon = useTranslations("common");
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let current = true;
    getActiveInsights()
      .then((result) => {
        if (!current) return;
        if (result.success) {
          setInsights(result.data);
        } else {
          setLoadFailed(true);
        }
      })
      .catch(() => {
        if (current) setLoadFailed(true);
      });
    return () => {
      current = false;
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    const previous = insights;
    setInsights((list) => list?.filter((insight) => insight.id !== id) ?? null);
    try {
      const result = await markInsightRead(id);
      if (!result.success) throw new Error(result.error);
    } catch {
      setInsights(previous);
      toast.error(t("markReadFailed"));
    }
  };

  const unreadCount = insights?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground relative h-8 w-8 rounded-xl hover:bg-white/5"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
          <span className="sr-only">{tCommon("notifications")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-border/50 border-b px-4 py-3 text-sm font-semibold dark:border-white/[0.08]">
          {tCommon("notifications")}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loadFailed ? (
            <p className="text-destructive px-4 py-6 text-center text-sm">{t("loadFailed")}</p>
          ) : insights === null ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              {tCommon("loading")}
            </p>
          ) : insights.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-border/50 divide-y dark:divide-white/[0.06]">
              {insights.map((insight) => {
                const Icon = insight.severity === "info" ? Info : AlertTriangle;
                return (
                  <li key={insight.id} className="flex gap-3 px-4 py-3">
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        insight.severity === "critical"
                          ? "text-red-500"
                          : insight.severity === "warning"
                            ? "text-amber-500"
                            : "text-primary"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {insight.message}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleMarkRead(insight.id)}
                      title={t("markRead")}
                      aria-label={t("markRead")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
