import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { DatabasePg } from "src/common";
import { FileStorageService } from "src/file-storage";
import { REVIEW_QUEUE, ReviewQueueJobPayloads } from "./reviews.queue";
import { review, reviewFile, reviewFinding } from "./reviews-schema";
import { collectSources, SourceFile } from "./analysis/source-collector";
import { analyzeFiles } from "./analysis/static-analyzer";
import { AiReviewerAdapter } from "./analysis/ai-reviewer.adapter";
import type { Finding } from "./analysis/finding.types";
import { PRIORITY_WEIGHT } from "./reviews.constants";

type AnalyzeJob = Job<
  ReviewQueueJobPayloads["ANALYZE_REVIEW"],
  unknown,
  typeof REVIEW_QUEUE.actions.ANALYZE_REVIEW
>;

export const AI_REVIEWER_ADAPTER = "AI_REVIEWER_ADAPTER";

@Processor(REVIEW_QUEUE.name, { concurrency: 2 })
export class ReviewsAnalysisConsumer extends WorkerHost {
  private readonly logger = new Logger(ReviewsAnalysisConsumer.name);

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly fileStorageService: FileStorageService,
    @Inject(AI_REVIEWER_ADAPTER)
    private readonly aiReviewer: AiReviewerAdapter | null,
  ) {
    super();
  }

  async process(job: AnalyzeJob): Promise<unknown> {
    switch (job.name) {
      case REVIEW_QUEUE.actions.ANALYZE_REVIEW:
        return this.analyze(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  async analyze(job: AnalyzeJob): Promise<void> {
    const { reviewId } = job.data;
    const [current] = await this.db
      .select()
      .from(review)
      .where(eq(review.id, reviewId));

    if (!current) {
      this.logger.warn(`Review ${reviewId} no longer exists, skipping`);
      return;
    }

    await this.updateReview(reviewId, {
      status: "processing",
      progress: 5,
      startedAt: new Date().toISOString(),
      errorMessage: null,
    });
    await job.updateProgress(5);

    try {
      const sources = await this.loadSources(reviewId);
      await this.updateReview(reviewId, {
        fileCount: sources.files.length,
        skippedFileCount: sources.skipped.length,
        progress: 25,
      });
      await job.updateProgress(25);

      if (sources.files.length === 0) {
        throw new Error(
          "No reviewable source files were found in the upload (binary, vendored and oversized files are skipped).",
        );
      }

      await this.db.insert(reviewFile).values(
        sources.files.map((file) => ({
          reviewId,
          path: file.path,
          language: file.language,
          byteSize: file.byteSize,
          lineCount: file.lineCount,
        })),
      );

      const staticFindings = analyzeFiles(sources.files);
      await this.updateReview(reviewId, { progress: 45 });
      await job.updateProgress(45);

      let aiFindings: Finding[] = [];
      let summary: string | null = null;
      let aiModel: string | null = null;
      let aiError: string | null = null;

      if (current.aiEnabled && this.aiReviewer) {
        try {
          const result = await this.aiReviewer.review({
            reviewTitle: current.title,
            files: sources.files,
            staticFindings,
          });
          aiFindings = result.findings;
          summary = result.summary;
          aiModel = result.model;
        } catch (error) {
          aiError = (error as Error).message;
          this.logger.error(`AI review failed for ${reviewId}: ${aiError}`);
        }
      } else if (current.aiEnabled && !this.aiReviewer) {
        aiError =
          "AI review is disabled on this server (AI_REVIEW_ADAPTER=disabled)";
      }

      await this.updateReview(reviewId, { progress: 90 });
      await job.updateProgress(90);

      const findings = mergeFindings(staticFindings, aiFindings, sources.files);

      if (findings.length > 0) {
        await this.db
          .insert(reviewFinding)
          .values(findings.map((finding) => ({ reviewId, ...finding })));
      }

      await this.updateReview(reviewId, {
        status: "completed",
        progress: 100,
        summary: summary ?? buildStaticSummary(findings, sources.files.length),
        aiModel,
        aiError,
        completedAt: new Date().toISOString(),
      });
      await job.updateProgress(100);

      this.logger.log(
        `Review ${reviewId} completed: ${sources.files.length} files, ${findings.length} findings`,
      );
    } catch (error) {
      const message = (error as Error).message ?? "Unknown error";
      this.logger.error(`Review ${reviewId} failed: ${message}`);
      await this.updateReview(reviewId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date().toISOString(),
      });
    }
  }

  private async loadSources(reviewId: string) {
    const uploads = await this.fileStorageService.listByEntityRef(
      this.fileStorageService.generateEntityRef("review", reviewId),
    );

    if (uploads.length === 0) {
      throw new Error("No uploaded files found for this review");
    }

    const parts = await Promise.all(
      uploads.map(async (upload) => ({
        name: upload.originalName,
        mimeType: upload.mimeType,
        buffer: await this.fileStorageService.downloadFile(upload.storageKey),
      })),
    );

    return collectSources(parts);
  }

  private async updateReview(
    reviewId: string,
    data: Partial<typeof review.$inferInsert>,
  ) {
    await this.db.update(review).set(data).where(eq(review.id, reviewId));
  }
}

/**
 * Drops AI findings that duplicate a static finding (same file, same or
 * adjacent line, same category), then sorts by priority, file and line.
 */
export function mergeFindings(
  staticFindings: Finding[],
  aiFindings: Finding[],
  files: SourceFile[],
): Finding[] {
  const knownPaths = new Set(files.map((file) => file.path));

  const deduped = aiFindings.filter((ai) => {
    if (!knownPaths.has(ai.filePath)) return false;

    return !staticFindings.some(
      (existing) =>
        existing.filePath === ai.filePath &&
        existing.category === ai.category &&
        existing.line !== null &&
        ai.line !== null &&
        Math.abs(existing.line - ai.line) <= 1,
    );
  });

  return [...staticFindings, ...deduped].sort((a, b) => {
    const priorityDiff =
      PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const pathDiff = a.filePath.localeCompare(b.filePath);
    if (pathDiff !== 0) return pathDiff;
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

export function buildStaticSummary(
  findings: Finding[],
  fileCount: number,
): string {
  if (findings.length === 0) {
    return `Static analysis reviewed ${fileCount} file(s) and found no issues.`;
  }

  const critical = findings.filter(
    (finding) => finding.priority === "critical",
  ).length;
  const high = findings.filter((finding) => finding.priority === "high").length;

  return (
    `Static analysis reviewed ${fileCount} file(s) and found ${findings.length} issue(s)` +
    (critical || high
      ? `, including ${critical} critical and ${high} high priority.`
      : ".")
  );
}
