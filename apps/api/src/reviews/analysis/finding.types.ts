import type { FindingCategory, FindingPriority } from "../reviews.constants";

export type Finding = {
  filePath: string;
  line: number | null;
  endLine: number | null;
  priority: FindingPriority;
  category: FindingCategory;
  source: "static" | "ai";
  rule: string;
  title: string;
  description: string;
  suggestion: string | null;
  snippet: string | null;
};
