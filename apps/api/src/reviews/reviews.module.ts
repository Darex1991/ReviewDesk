import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FileStorageModule } from "src/file-storage";
import { ReviewsController } from "./api/reviews.controller";
import { ReviewsService } from "./reviews.service";
import { ReviewsAnalysisProducer } from "./reviews-analysis.producer";
import {
  AI_REVIEWER_ADAPTER,
  ReviewsAnalysisConsumer,
} from "./reviews-analysis.consumer";
import { REVIEW_QUEUE } from "./reviews.queue";
import { AnthropicReviewerAdapter } from "./analysis/anthropic-reviewer.adapter";
import { MockReviewerAdapter } from "./analysis/mock-reviewer.adapter";
import type { AiReviewerAdapter } from "./analysis/ai-reviewer.adapter";

@Module({
  imports: [
    ConfigModule,
    FileStorageModule,
    BullModule.registerQueue({
      name: REVIEW_QUEUE.name,
    }),
    BullBoardModule.forFeature({
      name: REVIEW_QUEUE.name,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    ReviewsAnalysisProducer,
    ReviewsAnalysisConsumer,
    {
      provide: AI_REVIEWER_ADAPTER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): AiReviewerAdapter | null => {
        const adapter = configService.get<string>("ai.AI_REVIEW_ADAPTER");

        switch (adapter) {
          case "anthropic":
            return new AnthropicReviewerAdapter(configService);
          case "mock":
            return new MockReviewerAdapter();
          case "disabled":
            return null;
          default:
            throw new Error(`Unknown AI review adapter: ${adapter}`);
        }
      },
    },
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
