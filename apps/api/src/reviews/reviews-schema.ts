import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "src/storage/schema/utils";
import { user } from "src/auth/auth-schema";

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const findingPriorityEnum = pgEnum("finding_priority", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const findingSourceEnum = pgEnum("finding_source", ["static", "ai"]);

export const review = pgTable("review", {
  ...id,
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: reviewStatusEnum("status").default("pending").notNull(),
  sourceType: text("source_type").notNull(),
  uploadCount: integer("upload_count").default(0).notNull(),
  fileCount: integer("file_count").default(0).notNull(),
  skippedFileCount: integer("skipped_file_count").default(0).notNull(),
  progress: integer("progress").default(0).notNull(),
  summary: text("summary"),
  errorMessage: text("error_message"),
  aiEnabled: boolean("ai_enabled").default(true).notNull(),
  aiModel: text("ai_model"),
  aiError: text("ai_error"),
  startedAt: timestamp("started_at", {
    mode: "string",
    withTimezone: true,
    precision: 3,
  }),
  completedAt: timestamp("completed_at", {
    mode: "string",
    withTimezone: true,
    precision: 3,
  }),
  ...timestamps,
});

export const reviewFile = pgTable("review_file", {
  ...id,
  reviewId: uuid("review_id")
    .notNull()
    .references(() => review.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  language: text("language").notNull(),
  byteSize: integer("byte_size").notNull(),
  lineCount: integer("line_count").notNull(),
  ...timestamps,
});

export const reviewFinding = pgTable("review_finding", {
  ...id,
  reviewId: uuid("review_id")
    .notNull()
    .references(() => review.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  line: integer("line"),
  endLine: integer("end_line"),
  priority: findingPriorityEnum("priority").notNull(),
  category: text("category").notNull(),
  source: findingSourceEnum("source").notNull(),
  rule: text("rule").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  suggestion: text("suggestion"),
  snippet: text("snippet"),
  ...timestamps,
});
