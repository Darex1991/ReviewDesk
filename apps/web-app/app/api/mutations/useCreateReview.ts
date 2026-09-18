import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

type CreateReviewOptions = {
  files: File[];
  title?: string;
  aiEnabled: boolean;
};

export function useCreateReview() {
  return useMutation({
    mutationFn: async (options: CreateReviewOptions) => {
      const response = await ApiClient.api.reviewsControllerCreateReviewV1({
        files: options.files,
        title: options.title?.trim() || undefined,
        aiEnabled: options.aiEnabled ? "true" : "false"
      });

      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Upload complete. Analysis has started.");
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast.error(error.response?.data?.message ?? "Upload failed");
      }
      toast.error(error.message);
    }
  });
}
