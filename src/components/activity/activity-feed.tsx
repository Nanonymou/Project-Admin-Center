import { Badge } from "@/components/ui/badge";
import type { ActivityFeedItem } from "@/lib/mock/activity";
import { cn } from "@/lib/utils";

const DOT_MAP: Record<ActivityFeedItem["status"], string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  return (
    <ol className="relative">
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-3 py-3">
          <div className="relative mt-1 flex flex-col items-center">
            <span className={cn("h-2.5 w-2.5 rounded-full ring-4 ring-background", DOT_MAP[item.status])} />
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">{item.action}</span>
              <span className="text-xs text-muted-foreground">· {item.target}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{item.actor}</span>
              <span>·</span>
              <span>{item.time}</span>
              <Badge variant="outline" className="ml-1 h-5 px-1.5">
                {item.project}
              </Badge>
              <Badge variant="muted" className="h-5 px-1.5">
                {item.location}
              </Badge>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
