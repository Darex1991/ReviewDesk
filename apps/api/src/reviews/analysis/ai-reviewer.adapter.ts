import type { Finding } from "./finding.types";
import type { SourceFile } from "./source-collector";

export type AiReviewInput = {
  reviewTitle: string;
  files: SourceFile[];
  /** Static findings already known, so the model can skip duplicates. */
  staticFindings: Finding[];
};

export type AiReviewResult = {
  model: string;
  summary: string;
  findings: Finding[];
  /** Paths that did not fit into the input budget and were not reviewed. */
  unreviewedFiles: string[];
};

export abstract class AiReviewerAdapter {
  abstract readonly name: string;

  abstract review(input: AiReviewInput): Promise<AiReviewResult>;
}
