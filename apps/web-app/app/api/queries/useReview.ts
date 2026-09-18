import { queryOptions, useQuery } from "@tanstack/react-query";
import { ApiClient } from "../api-client";
import type { GetReviewResponse } from "../generated-api";

export type ReviewDetails = GetReviewResponse["data"];
export type ReviewFinding = ReviewDetails["findings"][number];
export type ReviewFile = ReviewDetails["files"][number];

export const reviewQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const response = await ApiClient.api.reviewsControllerGetReviewV1(id);
      return response.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 2000 : false;
    }
  });

export function useReview(id: string) {
  return useQuery(reviewQueryOptions(id));
}
