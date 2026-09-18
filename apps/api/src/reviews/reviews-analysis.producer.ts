import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { REVIEW_QUEUE, ReviewQueueJobPayloads } from "./reviews.queue";

@Injectable()
export class ReviewsAnalysisProducer {
  constructor(@InjectQueue(REVIEW_QUEUE.name) private readonly queue: Queue) {}

  async enqueueAnalysis(payload: ReviewQueueJobPayloads["ANALYZE_REVIEW"]) {
    await this.queue.add(REVIEW_QUEUE.actions.ANALYZE_REVIEW, payload, {
      jobId: `${payload.reviewId}:${Date.now()}`,
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 24 * 3600 },
    });
  }
}
