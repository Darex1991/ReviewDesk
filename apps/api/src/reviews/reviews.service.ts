import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { DatabasePg } from "src/common";
import { FileStorageService } from "src/file-storage";
import type { UserSession } from "src/auth";
import { review, reviewFile, reviewFinding } from "./reviews-schema";
import { ReviewsAnalysisProducer } from "./reviews-analysis.producer";
import { REVIEW_LIMITS } from "./reviews.constants";
import { isZipUpload } from "./analysis/source-collector";
import type {
  FindingCounts,
  ReviewDetailsResponse,
  ReviewListItemResponse,
  ReviewStatsResponse,
} from "./schemas/review.schema";

type UploadedPart = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const EMPTY_COUNTS: FindingCounts = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  total: 0,
};

@Injectable()
export class ReviewsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly fileStorageService: FileStorageService,
    private readonly producer: ReviewsAnalysisProducer,
  ) {}

  async createReview(
    session: UserSession,
    parts: UploadedPart[] | undefined,
    options: { title?: string; aiEnabled?: boolean },
  ): Promise<ReviewListItemResponse> {
    if (!parts || parts.length === 0) {
      throw new BadRequestException(
        "Upload at least one file or a ZIP archive",
      );
    }

    if (parts.length > REVIEW_LIMITS.maxUploads) {
      throw new BadRequestException(
        `You can upload at most ${REVIEW_LIMITS.maxUploads} files per review`,
      );
    }

    const hasZip = parts.some((part) =>
      isZipUpload({
        name: part.originalname,
        buffer: part.buffer,
        mimeType: part.mimetype,
      }),
    );
    const sourceType = hasZip
      ? parts.length === 1
        ? "zip"
        : "mixed"
      : "files";
    const title = options.title?.trim() || this.defaultTitle(parts);

    const [created] = await this.db
      .insert(review)
      .values({
        userId: session.user.id,
        title,
        sourceType,
        uploadCount: parts.length,
        aiEnabled: options.aiEnabled ?? true,
        status: "pending",
      })
      .returning();

    const entityRef = this.fileStorageService.generateEntityRef(
      "review",
      created.id,
    );

    for (const part of parts) {
      const safeName = part.originalname
        .replace(/[^\w.\-()\s]/g, "_")
        .slice(-150);
      await this.fileStorageService.uploadFile({
        key: `reviews/${created.id}/uploads/${randomUUID()}-${safeName}`,
        body: part.buffer,
        contentType: part.mimetype || "application/octet-stream",
        originalName: part.originalname,
        byteSize: part.size,
        entityRef,
        metadata: { originalName: encodeURIComponent(part.originalname) },
      });
    }

    await this.producer.enqueueAnalysis({ reviewId: created.id });

    return { ...created, findingCounts: EMPTY_COUNTS };
  }

  async listReviews(session: UserSession): Promise<ReviewListItemResponse[]> {
    const rows = await this.db
      .select()
      .from(review)
      .where(eq(review.userId, session.user.id))
      .orderBy(desc(review.createdAt))
      .limit(100);

    if (rows.length === 0) return [];

    const counts = await this.countFindings(rows.map((row) => row.id));

    return rows.map((row) => ({
      ...row,
      findingCounts: counts.get(row.id) ?? EMPTY_COUNTS,
    }));
  }

  async getReview(
    session: UserSession,
    id: string,
  ): Promise<ReviewDetailsResponse> {
    const found = await this.findOwned(session, id);

    const [files, findings, counts] = await Promise.all([
      this.db
        .select({
          id: reviewFile.id,
          path: reviewFile.path,
          language: reviewFile.language,
          byteSize: reviewFile.byteSize,
          lineCount: reviewFile.lineCount,
        })
        .from(reviewFile)
        .where(eq(reviewFile.reviewId, id))
        .orderBy(reviewFile.path),
      this.db
        .select({
          id: reviewFinding.id,
          filePath: reviewFinding.filePath,
          line: reviewFinding.line,
          endLine: reviewFinding.endLine,
          priority: reviewFinding.priority,
          category: reviewFinding.category,
          source: reviewFinding.source,
          rule: reviewFinding.rule,
          title: reviewFinding.title,
          description: reviewFinding.description,
          suggestion: reviewFinding.suggestion,
          snippet: reviewFinding.snippet,
        })
        .from(reviewFinding)
        .where(eq(reviewFinding.reviewId, id))
        .orderBy(
          sql`case ${reviewFinding.priority} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`,
          reviewFinding.filePath,
          reviewFinding.line,
        ),
      this.countFindings([id]),
    ]);

    return {
      ...found,
      findingCounts: counts.get(id) ?? EMPTY_COUNTS,
      files,
      findings,
    };
  }

  async retryReview(
    session: UserSession,
    id: string,
  ): Promise<ReviewListItemResponse> {
    const found = await this.findOwned(session, id);

    if (found.status === "pending" || found.status === "processing") {
      throw new ConflictException("Review is already being processed");
    }

    await this.db.delete(reviewFinding).where(eq(reviewFinding.reviewId, id));
    await this.db.delete(reviewFile).where(eq(reviewFile.reviewId, id));

    const [updated] = await this.db
      .update(review)
      .set({
        status: "pending",
        progress: 0,
        summary: null,
        errorMessage: null,
        aiModel: null,
        aiError: null,
        fileCount: 0,
        skippedFileCount: 0,
        startedAt: null,
        completedAt: null,
      })
      .where(eq(review.id, id))
      .returning();

    await this.producer.enqueueAnalysis({ reviewId: id });

    return { ...updated, findingCounts: EMPTY_COUNTS };
  }

  async deleteReview(session: UserSession, id: string): Promise<void> {
    await this.findOwned(session, id);

    await this.fileStorageService.deleteByEntityRef(
      this.fileStorageService.generateEntityRef("review", id),
    );
    await this.db.delete(review).where(eq(review.id, id));
  }

  async getStats(session: UserSession): Promise<ReviewStatsResponse> {
    const statusRows = await this.db
      .select({
        status: review.status,
        count: count(),
        files: sql<number>`coalesce(sum(${review.fileCount}), 0)::int`,
      })
      .from(review)
      .where(eq(review.userId, session.user.id))
      .groupBy(review.status);

    const priorityRows = await this.db
      .select({ priority: reviewFinding.priority, count: count() })
      .from(reviewFinding)
      .innerJoin(review, eq(review.id, reviewFinding.reviewId))
      .where(eq(review.userId, session.user.id))
      .groupBy(reviewFinding.priority);

    const byStatus = { pending: 0, processing: 0, completed: 0, failed: 0 };
    let totalReviews = 0;
    let filesAnalyzed = 0;
    for (const row of statusRows) {
      byStatus[row.status] = Number(row.count);
      totalReviews += Number(row.count);
      filesAnalyzed += Number(row.files);
    }

    const findingCounts: FindingCounts = { ...EMPTY_COUNTS };
    for (const row of priorityRows) {
      findingCounts[row.priority] = Number(row.count);
      findingCounts.total += Number(row.count);
    }

    return { totalReviews, byStatus, findingCounts, filesAnalyzed };
  }

  private async findOwned(session: UserSession, id: string) {
    const [found] = await this.db
      .select()
      .from(review)
      .where(eq(review.id, id));

    if (!found) {
      throw new NotFoundException("Review not found");
    }

    if (found.userId !== session.user.id && session.user.role !== "admin") {
      throw new ForbiddenException("You do not have access to this review");
    }

    return found;
  }

  private async countFindings(
    reviewIds: string[],
  ): Promise<Map<string, FindingCounts>> {
    const result = new Map<string, FindingCounts>();
    if (reviewIds.length === 0) return result;

    const rows = await this.db
      .select({
        reviewId: reviewFinding.reviewId,
        priority: reviewFinding.priority,
        count: count(),
      })
      .from(reviewFinding)
      .where(inArray(reviewFinding.reviewId, reviewIds))
      .groupBy(reviewFinding.reviewId, reviewFinding.priority);

    for (const row of rows) {
      const counts = result.get(row.reviewId) ?? { ...EMPTY_COUNTS };
      counts[row.priority] = Number(row.count);
      counts.total += Number(row.count);
      result.set(row.reviewId, counts);
    }

    return result;
  }

  private defaultTitle(parts: UploadedPart[]): string {
    if (parts.length === 1) {
      return parts[0].originalname.replace(/\.zip$/i, "");
    }
    return `${parts[0].originalname} +${parts.length - 1} more`;
  }
}
