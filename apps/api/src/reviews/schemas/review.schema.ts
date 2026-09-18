import { Static, Type } from "@sinclair/typebox";
import { FINDING_CATEGORIES, FINDING_PRIORITIES } from "../reviews.constants";

const nullable = <T extends Parameters<typeof Type.Union>[0][number]>(
  schema: T,
) => Type.Union([schema, Type.Null()]);

export const reviewStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("processing"),
  Type.Literal("completed"),
  Type.Literal("failed"),
]);

export const findingPrioritySchema = Type.Union(
  FINDING_PRIORITIES.map((priority) => Type.Literal(priority)),
);

export const findingCategorySchema = Type.Union(
  FINDING_CATEGORIES.map((category) => Type.Literal(category)),
);

export const findingSourceSchema = Type.Union([
  Type.Literal("static"),
  Type.Literal("ai"),
]);

export const findingCountsSchema = Type.Object({
  critical: Type.Integer(),
  high: Type.Integer(),
  medium: Type.Integer(),
  low: Type.Integer(),
  info: Type.Integer(),
  total: Type.Integer(),
});

export const reviewSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  userId: Type.String(),
  title: Type.String(),
  status: reviewStatusSchema,
  sourceType: Type.String(),
  uploadCount: Type.Integer(),
  fileCount: Type.Integer(),
  skippedFileCount: Type.Integer(),
  progress: Type.Integer(),
  summary: nullable(Type.String()),
  errorMessage: nullable(Type.String()),
  aiEnabled: Type.Boolean(),
  aiModel: nullable(Type.String()),
  aiError: nullable(Type.String()),
  startedAt: nullable(Type.String()),
  completedAt: nullable(Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const reviewListItemSchema = Type.Intersect([
  reviewSchema,
  Type.Object({ findingCounts: findingCountsSchema }),
]);

export const reviewFileSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  path: Type.String(),
  language: Type.String(),
  byteSize: Type.Integer(),
  lineCount: Type.Integer(),
});

export const reviewFindingSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  filePath: Type.String(),
  line: nullable(Type.Integer()),
  endLine: nullable(Type.Integer()),
  priority: findingPrioritySchema,
  category: Type.String(),
  source: findingSourceSchema,
  rule: Type.String(),
  title: Type.String(),
  description: Type.String(),
  suggestion: nullable(Type.String()),
  snippet: nullable(Type.String()),
});

export const reviewDetailsSchema = Type.Intersect([
  reviewListItemSchema,
  Type.Object({
    files: Type.Array(reviewFileSchema),
    findings: Type.Array(reviewFindingSchema),
  }),
]);

export const reviewsListSchema = Type.Array(reviewListItemSchema);

export const reviewStatsSchema = Type.Object({
  totalReviews: Type.Integer(),
  byStatus: Type.Object({
    pending: Type.Integer(),
    processing: Type.Integer(),
    completed: Type.Integer(),
    failed: Type.Integer(),
  }),
  findingCounts: findingCountsSchema,
  filesAnalyzed: Type.Integer(),
});

export const createReviewBodySchema = Type.Object({
  title: Type.Optional(Type.String({ maxLength: 200 })),
  aiEnabled: Type.Optional(Type.String()),
});

export type ReviewResponse = Static<typeof reviewSchema>;
export type ReviewListItemResponse = Static<typeof reviewListItemSchema>;
export type ReviewDetailsResponse = Static<typeof reviewDetailsSchema>;
export type ReviewStatsResponse = Static<typeof reviewStatsSchema>;
export type FindingCounts = Static<typeof findingCountsSchema>;
export type CreateReviewBody = Static<typeof createReviewBodySchema>;
