import { cn } from "~/lib/utils";
import { PRIORITIES, PRIORITY_META } from "../review.utils";

type Counts = Record<"critical" | "high" | "medium" | "low" | "info" | "total", number>;

export function FindingCountsRow({
  counts,
  compact = false
}: {
  counts: Counts;
  compact?: boolean;
}) {
  if (counts.total === 0) {
    return <span className="text-xs text-muted-foreground">No findings</span>;
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", compact && "gap-x-2")}
    >
      {PRIORITIES.filter((priority) => counts[priority] > 0).map((priority) => {
        const meta = PRIORITY_META[priority];
        return (
          <span
            key={priority}
            className="inline-flex items-center gap-1 text-xs text-foreground"
            title={`${counts[priority]} ${meta.label.toLowerCase()}`}
          >
            <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
            <span className="font-medium tabular-nums">{counts[priority]}</span>
            {!compact && (
              <span className="text-muted-foreground">{meta.label.toLowerCase()}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Horizontal stacked meter of findings by priority, with a legend beneath. */
export function PriorityDistribution({ counts }: { counts: Counts }) {
  if (counts.total === 0) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-full rounded-full bg-muted" />
        <p className="text-xs text-muted-foreground">No findings yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {PRIORITIES.filter((priority) => counts[priority] > 0).map((priority) => (
          <div
            key={priority}
            className={cn("h-full rounded-full", PRIORITY_META[priority].bar)}
            style={{ width: `${(counts[priority] / counts.total) * 100}%` }}
            title={`${PRIORITY_META[priority].label}: ${counts[priority]}`}
          />
        ))}
      </div>
      <FindingCountsRow counts={counts} />
    </div>
  );
}
