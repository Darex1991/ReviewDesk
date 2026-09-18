import { queryOptions, useQuery } from "@tanstack/react-query";
import { ApiClient } from "../api-client";
import type { ListReviewsResponse } from "../generated-api";

export type ReviewListItem = ListReviewsResponse["data"][number];

const ACTIVE_STATUSES = new Set(["pending", "processing"]);

export const reviewsQueryOptions = queryOptions({
  queryKey: ["reviews"],
  queryFn: async () => {
    const response = await ApiClient.api.reviewsControllerListReviewsV1();
    return response.data.data;
  },
  refetchInterval: (query) => {
    const data = query.state.data;
    return data?.some((item) => ACTIVE_STATUSES.has(item.status)) ? 3000 : false;
  }
});

export function useReviews() {
  return useQuery(reviewsQueryOptions);
}
