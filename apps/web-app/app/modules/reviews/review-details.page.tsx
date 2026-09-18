import { useMemo, useState } from "react";
import { redirect, useParams } from "react-router";
import { Bot, FileCode2, RefreshCw, ScanSearch } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  useReview,
  type ReviewDetails,
  type ReviewFinding
} from "~/api/queries/useReview";
import { useRetryReview } from "~/api/mutations/useRetryReview";

import type { Route } from "./+types/review-details.page";
import { authClient } from "../Auth/auth.client";
import { DashboardHeader } from "./components/DashboardHeader";
import { ReviewStatusBadge } from "./components/ReviewStatusBadge";
import { PriorityDistribution } from "./components/FindingCountsRow";
import { FindingCard } from "./components/FindingCard";
import {
  categoryLabel,
  formatBytes,
  formatDate,
  formatDuration,
  PRIORITIES,
  PRIORITY_META,
  type Priority,
  type ReviewStatus
} from "./review.utils";

const authMiddleware: Route.ClientMiddlewareFunction = async () => {
  const session = await authClient.getSession();

  if (!session.data) {
    throw redirect("/auth");
  }
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [authMiddleware];

export const meta: Route.MetaFunction = () => [{ title: "Review · ReviewDesk" }];

export default function ReviewDetailsPage() {
  const { id = "" } = useParams();
  const { data, isLoading, isError, error } = useReview(id);
  const retryReview = useRetryReview();

  return (
    <>
      <DashboardHeader
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Reviews", to: "/dashboard/reviews" },
          { label: data?.title ?? "Review" }
        ]}
        actions={
          data && (data.status === "completed" || data.status === "failed") ? (
            <Button
              variant="outline"
              size="sm"
              disabled={retryReview.isPending}
              onClick={() => retryReview.mutate(data.id)}
            >
              <RefreshCw className="size-4" />
              Re-run analysis
            </Button>
          ) : null
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {isLoading ? (
          <DetailsSkeleton />
        ) : isError || !data ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load this review</AlertTitle>
            <AlertDescription>{error?.message ?? "Unknown error"}</AlertDescription>
          </Alert>
        ) : (
          <ReviewContent review={data} />
        )}
      </div>
    </>
  );
}

function ReviewContent({ review }: { review: ReviewDetails }) {
  const isActive = review.status === "pending" || review.status === "processing";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <CardTitle className="truncate text-xl">{review.title}</CardTitle>
              <CardDescription>
                Created {formatDate(review.createdAt)}
                {review.completedAt && review.startedAt
                  ? ` · analysed in ${formatDuration(review.startedAt, review.completedAt)}`
                  : ""}
              </CardDescription>
            </div>
            <ReviewStatusBadge
              status={review.status as ReviewStatus}
              progress={review.progress}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {isActive && (
              <div className="space-y-2">
                <Progress value={review.progress} />
                <p className="text-xs text-muted-foreground">
                  {review.status === "pending"
                    ? "Waiting for a worker to pick up the job…"
                    : progressLabel(review.progress)}
                </p>
              </div>
            )}

            {review.status === "failed" && (
              <Alert variant="destructive">
                <AlertTitle>Analysis failed</AlertTitle>
                <AlertDescription>
                  {review.errorMessage ?? "Unknown error"}
                </AlertDescription>
              </Alert>
            )}

            {review.summary && (
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Summary</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {review.summary}
                </p>
              </div>
            )}

            {review.aiError && (
              <Alert>
                <Bot className="size-4" />
                <AlertTitle>AI review unavailable</AlertTitle>
                <AlertDescription>{review.aiError}</AlertDescription>
              </Alert>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Files analysed" value={review.fileCount} />
              <Stat label="Files skipped" value={review.skippedFileCount} />
              <Stat
                label="Static findings"
                value={
                  review.findings.filter((finding) => finding.source === "static").length
                }
              />
              <Stat
                label="AI findings"
                value={
                  review.findings.filter((finding) => finding.source === "ai").length
                }
                hint={review.aiModel ?? (review.aiEnabled ? undefined : "disabled")}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Findings by priority</CardTitle>
            <CardDescription>{review.findingCounts.total} total</CardDescription>
          </CardHeader>
          <CardContent>
            <PriorityDistribution counts={review.findingCounts} />
          </CardContent>
        </Card>
      </div>

      {review.findings.length > 0 ? (
        <FindingsList findings={review.findings} files={review.files} />
      ) : review.status === "completed" ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No findings. Nice work.
          </CardContent>
        </Card>
      ) : null}

      {review.files.length > 0 && <FilesList files={review.files} />}
    </>
  );
}

function FindingsList({
  findings,
  files
}: {
  findings: ReviewFinding[];
  files: ReviewDetails["files"];
}) {
  const [priority, setPriority] = useState<"all" | Priority>("all");
  const [source, setSource] = useState<"all" | "static" | "ai">("all");
  const [category, setCategory] = useState<string>("all");
  const [filePath, setFilePath] = useState<string>("all");

  const categories = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.category))).sort(),
    [findings]
  );
  const filesWithFindings = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.filePath))).sort(),
    [findings]
  );

  const filtered = findings.filter(
    (finding) =>
      (priority === "all" || finding.priority === priority) &&
      (source === "all" || finding.source === source) &&
      (category === "all" || finding.category === category) &&
      (filePath === "all" || finding.filePath === filePath)
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold">
          Findings{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {filtered.length} of {findings.length}
          </span>
        </h2>
        <Tabs value={source} onValueChange={(value) => setSource(value as typeof source)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="static" className="gap-1">
              <ScanSearch className="size-3.5" /> Static
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1">
              <Bot className="size-3.5" /> AI
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select
          value={priority}
          onValueChange={(value) => setPriority(value as typeof priority)}
        >
          <SelectTrigger className="w-36" size="sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((item) => (
              <SelectItem key={item} value={item}>
                {PRIORITY_META[item].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {categoryLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {files.length > 1 && (
          <Select value={filePath} onValueChange={setFilePath}>
            <SelectTrigger className="w-56" size="sm">
              <SelectValue placeholder="File" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All files</SelectItem>
              {filesWithFindings.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No findings match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </section>
  );
}

function FilesList({ files }: { files: ReviewDetails["files"] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? files : files.slice(0, 12);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCode2 className="size-4 text-muted-foreground" />
          Analysed files
          <span className="text-sm font-normal text-muted-foreground">
            ({files.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/60"
            >
              <span className="truncate font-mono text-xs" title={file.path}>
                {file.path}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {file.language} · {file.lineCount} ln · {formatBytes(file.byteSize)}
              </span>
            </li>
          ))}
        </ul>
        {files.length > 12 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show fewer" : `Show all ${files.length} files`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {hint && (
        <p className="truncate text-[11px] text-muted-foreground" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

function progressLabel(progress: number) {
  if (progress < 25) return "Downloading and unpacking uploaded files…";
  if (progress < 45) return "Indexing source files…";
  if (progress < 90) return "Running static analysis and AI review…";
  return "Saving findings…";
}

function DetailsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}
