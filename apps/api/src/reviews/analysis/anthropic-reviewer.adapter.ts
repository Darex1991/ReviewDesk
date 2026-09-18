import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiReviewerAdapter,
  AiReviewInput,
  AiReviewResult,
} from "./ai-reviewer.adapter";
import {
  AI_REVIEW_OUTPUT_SCHEMA,
  AI_REVIEW_SYSTEM_PROMPT,
  AiReviewOutput,
} from "./ai-review.prompt";
import {
  buildBatches,
  renderFilesForPrompt,
  renderStaticFindingsForPrompt,
} from "./ai-review.batching";
import type { Finding } from "./finding.types";
import type { SourceFile } from "./source-collector";
import { FINDING_CATEGORIES, FINDING_PRIORITIES } from "../reviews.constants";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

@Injectable()
export class AnthropicReviewerAdapter extends AiReviewerAdapter {
  readonly name = "anthropic";

  private readonly logger = new Logger(AnthropicReviewerAdapter.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: Effort;
  private readonly maxInputChars: number;
  private readonly maxBatches: number;

  constructor(configService: ConfigService) {
    super();

    const apiKey = configService.get<string>("ai.ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required when AI_REVIEW_ADAPTER=anthropic",
      );
    }

    this.client = new Anthropic({ apiKey });
    this.model = configService.get<string>("ai.AI_REVIEW_MODEL")!;
    this.effort = configService.get<Effort>("ai.AI_REVIEW_EFFORT")!;
    this.maxInputChars = configService.get<number>(
      "ai.AI_REVIEW_MAX_INPUT_CHARS",
    )!;
    this.maxBatches = configService.get<number>("ai.AI_REVIEW_MAX_BATCHES")!;
  }

  async review(input: AiReviewInput): Promise<AiReviewResult> {
    const { batches, leftover } = buildBatches(
      input.files,
      this.maxInputChars,
      this.maxBatches,
    );

    const summaries: string[] = [];
    const findings: Finding[] = [];
    const knownPaths = new Set(input.files.map((file) => file.path));

    for (const [index, batch] of batches.entries()) {
      this.logger.log(
        `Reviewing batch ${index + 1}/${batches.length} (${batch.length} files) with ${this.model}`,
      );
      const output = await this.reviewBatch(
        batch,
        input,
        index,
        batches.length,
      );
      summaries.push(output.summary);
      findings.push(...this.toFindings(output, knownPaths, batch));
    }

    return {
      model: this.model,
      summary: this.mergeSummaries(summaries, leftover),
      findings,
      unreviewedFiles: leftover.map((file) => file.path),
    };
  }

  private async reviewBatch(
    batch: SourceFile[],
    input: AiReviewInput,
    batchIndex: number,
    batchCount: number,
  ): Promise<AiReviewOutput> {
    const batchNote =
      batchCount > 1
        ? `This is part ${batchIndex + 1} of ${batchCount}; other files of the project are reviewed separately, so only report issues visible in the files below.\n\n`
        : "";

    const userMessage = `Project: ${input.reviewTitle}\n\n${batchNote}Already detected by static analysis (do not repeat):\n${renderStaticFindingsForPrompt(input.staticFindings, batch)}\n\nFiles to review (line numbers are shown before the "|" separator and are not part of the code):\n\n${renderFilesForPrompt(batch)}`;

    const message = await this.client.messages
      .stream({
        model: this.model,
        max_tokens: 32000,
        system: [
          {
            type: "text",
            text: AI_REVIEW_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        output_config: {
          effort: this.effort,
          format: {
            type: "json_schema",
            schema: AI_REVIEW_OUTPUT_SCHEMA as unknown as Record<
              string,
              unknown
            >,
          },
        },
        messages: [{ role: "user", content: userMessage }],
      })
      .finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error(
        `The model declined to review this batch${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ""}`,
      );
    }

    if (message.stop_reason === "max_tokens") {
      throw new Error(
        "The model response was cut off (max_tokens). Reduce AI_REVIEW_MAX_INPUT_CHARS.",
      );
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return this.parseOutput(text);
  }

  private parseOutput(text: string): AiReviewOutput {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Model returned malformed JSON: ${(error as Error).message}`,
      );
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as AiReviewOutput).summary !== "string" ||
      !Array.isArray((parsed as AiReviewOutput).findings)
    ) {
      throw new Error("Model output does not match the expected schema");
    }

    return parsed as AiReviewOutput;
  }

  private toFindings(
    output: AiReviewOutput,
    knownPaths: Set<string>,
    batch: SourceFile[],
  ): Finding[] {
    const linesByPath = new Map(
      batch.map((file) => [file.path, file.content.split("\n")]),
    );

    return output.findings
      .filter((item) => item && typeof item.file === "string" && item.title)
      .map((item) => {
        const filePath = this.resolvePath(item.file, knownPaths);
        const lines = linesByPath.get(filePath);
        const line =
          typeof item.line === "number" && item.line > 0
            ? Math.floor(item.line)
            : null;
        const snippet =
          line && lines && lines[line - 1] !== undefined
            ? lines[line - 1].trim().slice(0, 300)
            : null;

        return {
          filePath,
          line,
          endLine:
            typeof item.endLine === "number" && line && item.endLine >= line
              ? Math.floor(item.endLine)
              : null,
          priority: FINDING_PRIORITIES.includes(item.priority)
            ? item.priority
            : "medium",
          category: FINDING_CATEGORIES.includes(item.category)
            ? item.category
            : "best-practice",
          source: "ai" as const,
          rule: "ai-review",
          title: item.title.trim().slice(0, 200),
          description: item.description?.trim() ?? "",
          suggestion: item.suggestion?.trim() || null,
          snippet,
        };
      });
  }

  private resolvePath(candidate: string, knownPaths: Set<string>): string {
    const normalised = candidate.replace(/^\.?\//, "");
    if (knownPaths.has(normalised)) return normalised;

    for (const path of knownPaths) {
      if (path.endsWith(`/${normalised}`) || normalised.endsWith(`/${path}`)) {
        return path;
      }
    }

    return normalised;
  }

  private mergeSummaries(summaries: string[], leftover: SourceFile[]): string {
    const parts = summaries.filter((summary) => summary.trim().length > 0);
    if (leftover.length > 0) {
      parts.push(
        `${leftover.length} file(s) exceeded the AI input budget and were reviewed by static analysis only.`,
      );
    }
    return parts.join("\n\n");
  }
}
