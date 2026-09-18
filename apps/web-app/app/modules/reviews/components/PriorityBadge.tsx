import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { PRIORITY_META, type Priority } from "../review.utils";

export function PriorityBadge({
  priority,
  className
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", meta.badge, className)}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}
