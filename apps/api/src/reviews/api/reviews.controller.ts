import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";
import { memoryStorage } from "multer";
import type { Express } from "express";
import {
  baseResponse,
  BaseResponse,
  nullResponse,
  UUIDSchema,
} from "src/common";
import { Session, UserSession } from "src/auth";
import { ReviewsService } from "../reviews.service";
import { REVIEW_LIMITS } from "../reviews.constants";
import {
  CreateReviewBody,
  reviewDetailsSchema,
  ReviewDetailsResponse,
  reviewListItemSchema,
  ReviewListItemResponse,
  reviewsListSchema,
  reviewStatsSchema,
  ReviewStatsResponse,
} from "../schemas/review.schema";

@Controller({
  path: "reviews",
  version: "1",
})
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor("files", REVIEW_LIMITS.maxUploads, {
      storage: memoryStorage(),
      limits: { fileSize: REVIEW_LIMITS.maxUploadBytes },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        aiEnabled: { type: "string", enum: ["true", "false"] },
        files: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
      },
      required: ["files"],
    },
  })
  @Validate({
    response: baseResponse(reviewListItemSchema),
  })
  async createReview(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: CreateReviewBody,
    @Session() session: UserSession,
  ): Promise<BaseResponse<ReviewListItemResponse>> {
    const created = await this.reviewsService.createReview(session, files, {
      title: body?.title,
      aiEnabled:
        body?.aiEnabled === undefined ? true : body.aiEnabled !== "false",
    });

    return new BaseResponse(created);
  }

  @Get()
  @Validate({
    response: baseResponse(reviewsListSchema),
  })
  async listReviews(
    @Session() session: UserSession,
  ): Promise<BaseResponse<ReviewListItemResponse[]>> {
    const reviews = await this.reviewsService.listReviews(session);

    return new BaseResponse(reviews);
  }

  @Get("stats")
  @Validate({
    response: baseResponse(reviewStatsSchema),
  })
  async getStats(
    @Session() session: UserSession,
  ): Promise<BaseResponse<ReviewStatsResponse>> {
    const stats = await this.reviewsService.getStats(session);

    return new BaseResponse(stats);
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(reviewDetailsSchema),
  })
  async getReview(
    id: string,
    @Session() session: UserSession,
  ): Promise<BaseResponse<ReviewDetailsResponse>> {
    const details = await this.reviewsService.getReview(session, id);

    return new BaseResponse(details);
  }

  @Post(":id/retry")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(reviewListItemSchema),
  })
  async retryReview(
    id: string,
    @Session() session: UserSession,
  ): Promise<BaseResponse<ReviewListItemResponse>> {
    const updated = await this.reviewsService.retryReview(session, id);

    return new BaseResponse(updated);
  }

  @Delete(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: nullResponse(),
  })
  async deleteReview(
    id: string,
    @Session() session: UserSession,
  ): Promise<null> {
    await this.reviewsService.deleteReview(session, id);

    return null;
  }
}
