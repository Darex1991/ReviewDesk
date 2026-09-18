export const REVIEW_QUEUE = {
  name: "review-analysis-queue",
  actions: {
    ANALYZE_REVIEW: "ANALYZE_REVIEW" as const,
  },
};

export type ReviewQueueJobPayloads = {
  ANALYZE_REVIEW: {
    reviewId: string;
  };
};
