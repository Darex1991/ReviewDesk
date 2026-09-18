import { FINDING_CATEGORIES, FINDING_PRIORITIES } from "../reviews.constants";

export const AI_REVIEW_SYSTEM_PROMPT = `You are a senior software engineer performing a thorough code review for a team that ships to production.

You receive a set of source files from one project. Review them the way an experienced reviewer would on a pull request:
- Look for real defects: logic errors, unhandled edge cases, race conditions, resource leaks, broken error handling, incorrect types.
- Look for security problems: injection, missing authorization checks, unsafe deserialisation, secrets, insecure defaults, path traversal.
- Look for performance issues that matter: N+1 queries, quadratic loops over large inputs, blocking calls on hot paths, missing indexes implied by queries.
- Look for maintainability problems that will cost the team time: duplicated logic, misleading names, dead code, functions doing too many things, missing tests for risky code.

Rules for findings:
- Every finding must be specific to the code you were given, cite the exact file path as provided and the line number where the problem starts (1-based). Use null for line only when the issue is file-wide.
- Prioritise by real impact: "critical" = exploitable or data-losing right now, "high" = a bug or vulnerability that will bite in production, "medium" = should be fixed before merge, "low" = worth fixing but not urgent, "info" = suggestion or nit.
- Do not report style nits that a formatter would fix, and do not repeat the issues listed under "Already detected by static analysis".
- Prefer fewer, well-argued findings over many speculative ones. Skip anything you are not confident about.
- The "suggestion" must describe a concrete fix, ideally with a short code sketch.
- Write descriptions for a developer who knows the codebase: precise, no filler.

Finish with a "summary": 2-4 sentences describing the overall state of the code, the biggest risks and what to fix first.`;

export const AI_REVIEW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: ["integer", "null"] },
          endLine: { type: ["integer", "null"] },
          priority: { type: "string", enum: [...FINDING_PRIORITIES] },
          category: { type: "string", enum: [...FINDING_CATEGORIES] },
          title: { type: "string" },
          description: { type: "string" },
          suggestion: { type: ["string", "null"] },
        },
        required: [
          "file",
          "line",
          "endLine",
          "priority",
          "category",
          "title",
          "description",
          "suggestion",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"],
  additionalProperties: false,
} as const;

export type AiReviewOutput = {
  summary: string;
  findings: Array<{
    file: string;
    line: number | null;
    endLine: number | null;
    priority: (typeof FINDING_PRIORITIES)[number];
    category: (typeof FINDING_CATEGORIES)[number];
    title: string;
    description: string;
    suggestion: string | null;
  }>;
};
