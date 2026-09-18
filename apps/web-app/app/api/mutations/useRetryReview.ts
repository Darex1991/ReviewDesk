import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

export function useRetryReview() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await ApiClient.api.reviewsControllerRetryReviewV1(id);
      return response.data.data;
    },
    onSuccess: (review) => {
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["reviews", review.id] });
      toast.success("Analysis restarted");
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast.error(error.response?.data?.message ?? "Could not restart analysis");
      }
      toast.error(error.message);
    }
  });
}
