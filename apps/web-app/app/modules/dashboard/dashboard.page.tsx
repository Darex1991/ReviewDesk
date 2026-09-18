import { Link, redirect } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  FileCode2,
  ListChecks,
  Plus,
  ShieldAlert
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useReviewStats } from "~/api/queries/useReviewStats";
import { useReviews } from "~/api/queries/useReviews";

import type { Route } from "./+types/dashboard.page";
import { authClient } from "../Auth/auth.client";
import { DashboardHeader } from "../reviews/components/DashboardHeader";
import { ReviewStatusBadge } from "../reviews/components/ReviewStatusBadge";
import {
  FindingCountsRow,
  PriorityDistribution
} from "../reviews/components/FindingCountsRow";
import { formatDate, type ReviewStatus } from "../reviews/review.utils";

const authMiddleware: Route.ClientMiddlewareFunction = async () => {
  const session = await authClient.getSession();

  if (!session.data) {
    throw redirect("/auth");
  }
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [authMiddleware];

export const meta: Route.MetaFunction = () => [{ title: "Overview · ReviewDesk" }];

export default function DashboardPage() {
  const stats = useReviewStats();
  const reviews = useReviews();
  const recent = reviews.data?.slice(0, 5) ?? [];

  return (
    <>
      <DashboardHeader
        crumbs={[{ label: "Dashboard" }]}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Reviews"
            value={stats.data?.totalReviews}
            hint={
              stats.data
                ? `${stats.data.byStatus.pending + stats.data.byStatus.processing} in progress`
                : undefined
            }
            icon={ListChecks}
            loading={stats.isLoading}
          />
          <StatTile
            label="Files analysed"
            value={stats.data?.filesAnalyzed}
            icon={FileCode2}
            loading={stats.isLoading}
          />
          <StatTile
            label="Findings"
            value={stats.data?.findingCounts.total}
            hint={
              stats.data
                ? `${stats.data.findingCounts.critical + stats.data.findingCounts.high} critical or high`
                : undefined
            }
            icon={ShieldAlert}
            loading={stats.isLoading}
          />
          <StatTile
            label="Completed"
            value={stats.data?.byStatus.completed}
            hint={stats.data ? `${stats.data.byStatus.failed} failed` : undefined}
            icon={CheckCircle2}
            loading={stats.isLoading}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent reviews</CardTitle>
                <CardDescription>
                  The latest uploads and their analysis status.
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/reviews">
                  All reviews
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {reviews.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t uploaded anything yet. Start with a ZIP of a
                    repository or a few files to see static and AI findings here.
                  </p>
                  <Button asChild size="sm">
                    <Link to="/dashboard/reviews/new">Start a review</Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border">
                  {recent.map((review) => (
                    <li key={review.id}>
                      <Link
                        to={`/dashboard/reviews/${review.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/50"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-sm font-medium">{review.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(review.createdAt)} · {review.fileCount} files
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <FindingCountsRow counts={review.findingCounts} compact />
                          <ReviewStatusBadge
                            status={review.status as ReviewStatus}
                            progress={review.progress}
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Findings by priority</CardTitle>
              <CardDescription>Across all your reviews.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.isLoading || !stats.data ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <PriorityDistribution counts={stats.data.findingCounts} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading
}: {
  label: string;
  value: number | undefined;
  hint?: string;
  icon: typeof ListChecks;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-3xl font-semibold">{value ?? 0}</p>
          )}
          {hint && !loading && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
