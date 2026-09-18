import {
  AlertOctagon,
  AlertTriangle,
  CircleAlert,
  Info,
  Lightbulb,
  type LucideIcon
} from "lucide-react";

export type Priority = "critical" | "high" | "medium" | "low" | "info";
export type ReviewStatus = "pending" | "processing" | "completed" | "failed";

export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low", "info"];

export const PRIORITY_META: Record<
  Priority,
  { label: string; icon: LucideIcon; dot: string; badge: string; bar: string }
> = {
  critical: {
    label: "Critical",
    icon: AlertOctagon,
    dot: "bg-[#d03b3b]",
    badge: "border-[#d03b3b]/40 bg-[#d03b3b]/10 text-[#a52d2d] dark:text-[#f08a8a]",
    bar: "bg-[#d03b3b]"
  },
  high: {
    label: "High",
    icon: AlertTriangle,
    dot: "bg-[#ec835a]",
    badge: "border-[#ec835a]/40 bg-[#ec835a]/10 text-[#9a4a2b] dark:text-[#f5b193]",
    bar: "bg-[#ec835a]"
  },
  medium: {
    label: "Medium",
    icon: CircleAlert,
    dot: "bg-[#fab219]",
    badge: "border-[#fab219]/40 bg-[#fab219]/10 text-[#7a5300] dark:text-[#fbd27a]",
    bar: "bg-[#fab219]"
  },
  low: {
    label: "Low",
    icon: Lightbulb,
    dot: "bg-[#3b7dd8]",
    badge: "border-[#3b7dd8]/40 bg-[#3b7dd8]/10 text-[#25548f] dark:text-[#9bc0f2]",
    bar: "bg-[#3b7dd8]"
  },
  info: {
    label: "Info",
    icon: Info,
    dot: "bg-muted-foreground/60",
    badge: "border-border bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/50"
  }
};

export const STATUS_META: Record<ReviewStatus, { label: string; className: string }> = {
  pending: {
    label: "Queued",
    className: "border-border bg-muted text-muted-foreground"
  },
  processing: {
    label: "Analysing",
    className: "border-[#3b7dd8]/40 bg-[#3b7dd8]/10 text-[#25548f] dark:text-[#9bc0f2]"
  },
  completed: {
    label: "Completed",
    className: "border-[#0ca30c]/40 bg-[#0ca30c]/10 text-[#0b6f0b] dark:text-[#7fd67f]"
  },
  failed: {
    label: "Failed",
    className: "border-[#d03b3b]/40 bg-[#d03b3b]/10 text-[#a52d2d] dark:text-[#f08a8a]"
  }
};

export const CATEGORY_LABELS: Record<string, string> = {
  security: "Security",
  bug: "Bug",
  performance: "Performance",
  maintainability: "Maintainability",
  style: "Style",
  "best-practice": "Best practice",
  testing: "Testing",
  documentation: "Documentation"
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const seconds = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  );
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export const ACCEPTED_EXTENSIONS =
  ".zip,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.rb,.go,.rs,.java,.kt,.scala,.php,.cs,.c,.h,.cpp,.hpp,.swift,.dart,.sh,.sql,.html,.css,.scss,.json,.yaml,.yml,.toml,.xml,.md,.tf,.graphql,.vue,.svelte,.env,.txt";
