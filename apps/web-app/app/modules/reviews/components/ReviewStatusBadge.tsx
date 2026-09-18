import { Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { STATUS_META, type ReviewStatus } from "../review.utils";

export function ReviewStatusBadge({
  status,
  progress
}: {
  status: ReviewStatus;
  progress?: number;
}) {
  const meta = STATUS_META[status];
  const isActive = status === "pending" || status === "processing";

  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.className)}>
      {isActive && <Loader2 className="size-3 animate-spin" />}
      {meta.label}
      {status === "processing" && typeof progress === "number" ? ` · ${progress}%` : ""}
    </Badge>
  );
}
