export const REVIEW_LIMITS = {
  /** Max number of uploaded parts (zip archives or single files) per review. */
  maxUploads: 50,
  /** Max size of a single uploaded part. */
  maxUploadBytes: 25 * 1024 * 1024,
  /** Max number of source files analysed per review (after filtering). */
  maxSourceFiles: 300,
  /** Source files larger than this are skipped. */
  maxSourceFileBytes: 256 * 1024,
  /** Total bytes of extracted source content we are willing to hold in memory. */
  maxTotalSourceBytes: 20 * 1024 * 1024,
} as const;

export const FINDING_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
] as const;

export type FindingPriority = (typeof FINDING_PRIORITIES)[number];

export const FINDING_CATEGORIES = [
  "security",
  "bug",
  "performance",
  "maintainability",
  "style",
  "best-practice",
  "testing",
  "documentation",
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const PRIORITY_WEIGHT: Record<FindingPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};
