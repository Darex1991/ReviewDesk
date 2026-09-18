import { Bot, ScanSearch } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import type { ReviewFinding } from "~/api/queries/useReview";
import { PriorityBadge } from "./PriorityBadge";
import { categoryLabel } from "../review.utils";

export function FindingCard({ finding }: { finding: ReviewFinding }) {
  const location = finding.line
    ? `${finding.filePath}:${finding.line}${finding.endLine && finding.endLine !== finding.line ? `-${finding.endLine}` : ""}`
    : finding.filePath;
  const SourceIcon = finding.source === "ai" ? Bot : ScanSearch;

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm leading-snug font-semibold">{finding.title}</h3>
          <p
            className="truncate font-mono text-xs text-muted-foreground"
            title={location}
          >
            {location}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={finding.priority} />
          <Badge variant="secondary">{categoryLabel(finding.category)}</Badge>
          <Badge variant="outline" className="gap-1">
            <SourceIcon className="size-3" />
            {finding.source === "ai" ? "AI review" : `static · ${finding.rule}`}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-foreground/90">{finding.description}</p>

      {finding.snippet && (
        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
          <code>{finding.snippet}</code>
        </pre>
      )}

      {finding.suggestion && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-primary">Suggested fix: </span>
          <span className="whitespace-pre-wrap">{finding.suggestion}</span>
        </div>
      )}
    </article>
  );
}
