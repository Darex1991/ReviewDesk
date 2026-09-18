import { Link, redirect, useNavigate } from "react-router";
import { Plus, RefreshCw, Trash2, Upload } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "~/components/ui/table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "~/components/ui/empty";
import { useReviews, type ReviewListItem } from "~/api/queries/useReviews";
import { useDeleteReview } from "~/api/mutations/useDeleteReview";
import { useRetryReview } from "~/api/mutations/useRetryReview";

import type { Route } from "./+types/reviews.page";
import { authClient } from "../Auth/auth.client";
import { DashboardHeader } from "./components/DashboardHeader";
import { ReviewStatusBadge } from "./components/ReviewStatusBadge";
import { FindingCountsRow } from "./components/FindingCountsRow";
import { formatDate, type ReviewStatus } from "./review.utils";

const authMiddleware: Route.ClientMiddlewareFunction = async () => {
  const session = await authClient.getSession();

  if (!session.data) {
    throw redirect("/auth");
  }
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [authMiddleware];

export const meta: Route.MetaFunction = () => [{ title: "Reviews · ReviewDesk" }];

export default function ReviewsPage() {
  const { data, isLoading, isError, error, refetch } = useReviews();

  return (
    <>
      <DashboardHeader
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Reviews" }]}
        actions={
          <Button asChild size="sm">
            <Link to="/dashboard/reviews/new">
              <Plus className="size-4" />
              New review
            </Link>
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {isLoading ? (
          <ReviewsSkeleton />
        ) : isError ? (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-start gap-3 pt-6 text-destructive">
              <p className="text-sm font-medium">We couldn&apos;t load your reviews.</p>
              <p className="text-xs opacity-80">{error?.message}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !data || data.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Upload />
              </EmptyMedia>
              <EmptyTitle>No reviews yet</EmptyTitle>
              <EmptyDescription>
                Upload a ZIP of a repository or a handful of source files. Static analysis
                and the AI reviewer will run in the background and produce a prioritised
                list of findings.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/dashboard/reviews/new">Start your first review</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ReviewsTable reviews={data} />
        )}
      </div>
    </>
  );
}

function ReviewsTable({ reviews }: { reviews: ReviewListItem[] }) {
  const navigate = useNavigate();
  const deleteReview = useDeleteReview();
  const retryReview = useRetryReview();

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Review</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Findings</TableHead>
            <TableHead className="hidden md:table-cell">Files</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => (
            <TableRow
              key={review.id}
              className="cursor-pointer"
              onClick={() => navigate(`/dashboard/reviews/${review.id}`)}
            >
              <TableCell className="max-w-[280px]">
                <div className="flex flex-col gap-0.5">
                  <span className="truncate font-medium">{review.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {review.sourceType === "zip"
                      ? "ZIP archive"
                      : `${review.uploadCount} uploaded file${review.uploadCount === 1 ? "" : "s"}`}
                    {review.aiEnabled ? "" : " · static only"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <ReviewStatusBadge
                  status={review.status as ReviewStatus}
                  progress={review.progress}
                />
              </TableCell>
              <TableCell>
                <FindingCountsRow counts={review.findingCounts} compact />
              </TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">
                {review.fileCount}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatDate(review.createdAt)}
              </TableCell>
              <TableCell
                className="text-right"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex justify-end gap-1">
                  {(review.status === "failed" || review.status === "completed") && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Re-run analysis"
                      title="Re-run analysis"
                      disabled={retryReview.isPending}
                      onClick={() => retryReview.mutate(review.id)}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete review"
                    title="Delete review"
                    disabled={deleteReview.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete review "${review.title}"?`)) {
                        deleteReview.mutate(review.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ReviewsSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="ml-auto h-5 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
