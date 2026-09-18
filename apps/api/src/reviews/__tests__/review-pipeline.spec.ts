import { describe, expect, it } from "vitest";
import {
  buildStaticSummary,
  mergeFindings,
} from "../reviews-analysis.consumer";
import { buildBatches } from "../analysis/ai-review.batching";
import { MockReviewerAdapter } from "../analysis/mock-reviewer.adapter";
import type { Finding } from "../analysis/finding.types";
import type { SourceFile } from "../analysis/source-collector";

const files: SourceFile[] = [
  {
    path: "src/a.ts",
    language: "typescript",
    content: "a".repeat(100),
    byteSize: 100,
    lineCount: 1,
  },
  {
    path: "src/b.ts",
    language: "typescript",
    content: "b".repeat(100),
    byteSize: 100,
    lineCount: 1,
  },
  {
    path: "README.md",
    language: "markdown",
    content: "c".repeat(100),
    byteSize: 100,
    lineCount: 1,
  },
];

function finding(overrides: Partial<Finding>): Finding {
  return {
    filePath: "src/a.ts",
    line: 10,
    endLine: null,
    priority: "medium",
    category: "bug",
    source: "static",
    rule: "x",
    title: "t",
    description: "d",
    suggestion: null,
    snippet: null,
    ...overrides,
  };
}

describe("review pipeline helpers", () => {
  it("drops AI findings duplicating static ones and orders by priority", () => {
    const merged = mergeFindings(
      [finding({ priority: "low", line: 10 })],
      [
        finding({ source: "ai", priority: "critical", line: 11 }),
        finding({
          source: "ai",
          priority: "high",
          line: 40,
          filePath: "src/b.ts",
        }),
        finding({ source: "ai", filePath: "unknown.ts" }),
      ],
      files,
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].priority).toBe("high");
    expect(merged[1].priority).toBe("low");
  });

  it("builds batches that respect the character budget and prioritise code", () => {
    const { batches, leftover } = buildBatches(files, 400, 1);

    expect(batches).toHaveLength(1);
    expect(batches[0].map((file) => file.path)).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(leftover.map((file) => file.path)).toEqual(["README.md"]);
  });

  it("summarises static-only results", () => {
    expect(buildStaticSummary([], 3)).toContain("no issues");
    expect(
      buildStaticSummary(
        [finding({ priority: "critical" }), finding({ priority: "high" })],
        3,
      ),
    ).toContain("1 critical and 1 high");
  });

  it("mock reviewer produces deterministic findings", async () => {
    const adapter = new MockReviewerAdapter();
    const result = await adapter.review({
      reviewTitle: "demo",
      files: [
        {
          path: "src/auth/login.ts",
          language: "typescript",
          content: "export {}",
          byteSize: 9,
          lineCount: 1,
        },
      ],
      staticFindings: [],
    });

    expect(result.model).toBe("mock-reviewer");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("testing");
  });
});
