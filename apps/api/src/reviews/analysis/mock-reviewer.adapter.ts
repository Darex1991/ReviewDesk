import { Injectable } from "@nestjs/common";
import {
  AiReviewerAdapter,
  AiReviewInput,
  AiReviewResult,
} from "./ai-reviewer.adapter";
import type { Finding } from "./finding.types";

/**
 * Deterministic, offline stand-in for the LLM reviewer. Used in tests and
 * when no API key is configured, so the whole pipeline can still be exercised.
 */
@Injectable()
export class MockReviewerAdapter extends AiReviewerAdapter {
  readonly name = "mock";

  async review(input: AiReviewInput): Promise<AiReviewResult> {
    const findings: Finding[] = [];

    for (const file of input.files) {
      const lines = file.content.split("\n");

      const longFunctionLine = lines.findIndex((line) =>
        /^(export\s+)?(async\s+)?function\s+\w+\s*\([^)]{120,}\)/.test(line),
      );
      if (longFunctionLine >= 0) {
        findings.push({
          filePath: file.path,
          line: longFunctionLine + 1,
          endLine: null,
          priority: "low",
          category: "maintainability",
          source: "ai",
          rule: "ai-review",
          title: "Function takes too many parameters",
          description:
            "A long positional parameter list is error-prone at call sites and hard to extend.",
          suggestion: "Group the parameters into a single options object.",
          snippet: lines[longFunctionLine].trim().slice(0, 300),
        });
      }

      const noTestsForRiskyCode =
        /(auth|payment|billing|crypto|password)/i.test(file.path) &&
        !/(spec|test)/i.test(file.path);
      if (noTestsForRiskyCode) {
        findings.push({
          filePath: file.path,
          line: null,
          endLine: null,
          priority: "medium",
          category: "testing",
          source: "ai",
          rule: "ai-review",
          title: "Security-sensitive module without visible tests",
          description:
            "This file handles authentication/payment logic but no accompanying test file was uploaded.",
          suggestion:
            "Add unit tests covering the failure paths (invalid credentials, expired tokens, declined payments).",
          snippet: null,
        });
      }
    }

    const summary = `Mock AI review of ${input.files.length} file(s). ${
      findings.length
    } heuristic finding(s) generated. Configure AI_REVIEW_ADAPTER=anthropic with an ANTHROPIC_API_KEY to enable real model-based review.`;

    return {
      model: "mock-reviewer",
      summary,
      findings,
      unreviewedFiles: [],
    };
  }
}
