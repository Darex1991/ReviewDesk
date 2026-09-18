import { queryOptions, useQuery } from "@tanstack/react-query";
import { ApiClient } from "../api-client";
import type { GetStatsResponse } from "../generated-api";

export type ReviewStats = GetStatsResponse["data"];

export const reviewStatsQueryOptions = queryOptions({
  queryKey: ["reviews", "stats"],
  queryFn: async () => {
    const response = await ApiClient.api.reviewsControllerGetStatsV1();
    return response.data.data;
  }
});

export function useReviewStats() {
  return useQuery(reviewStatsQueryOptions);
}
