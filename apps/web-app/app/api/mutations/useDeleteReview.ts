import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

export function useDeleteReview() {
  return useMutation({
    mutationFn: async (id: string) => {
      await ApiClient.api.reviewsControllerDeleteReviewV1(id);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review deleted");
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast.error(error.response?.data?.message ?? "Could not delete review");
      }
      toast.error(error.message);
    }
  });
}
