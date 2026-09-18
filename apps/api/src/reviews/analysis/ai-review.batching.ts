import type { SourceFile } from "./source-collector";
import type { Finding } from "./finding.types";

const LOW_VALUE_LANGUAGES = new Set([
  "markdown",
  "json",
  "yaml",
  "toml",
  "xml",
  "plaintext",
  "gitignore",
  "css",
  "scss",
  "less",
  "html",
]);

/**
 * Orders files so that the most review-worthy ones (application code) go
 * first, then splits them into batches that fit the character budget.
 */
export function buildBatches(
  files: SourceFile[],
  maxCharsPerBatch: number,
  maxBatches: number,
): { batches: SourceFile[][]; leftover: SourceFile[] } {
  const ordered = [...files].sort((a, b) => {
    const aLow = LOW_VALUE_LANGUAGES.has(a.language) ? 1 : 0;
    const bLow = LOW_VALUE_LANGUAGES.has(b.language) ? 1 : 0;
    if (aLow !== bLow) return aLow - bLow;
    return a.path.localeCompare(b.path);
  });

  const batches: SourceFile[][] = [];
  const leftover: SourceFile[] = [];
  let current: SourceFile[] = [];
  let currentChars = 0;

  for (const file of ordered) {
    const cost = file.content.length + file.path.length + 64;

    if (cost > maxCharsPerBatch) {
      leftover.push(file);
      continue;
    }

    if (currentChars + cost > maxCharsPerBatch && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
      if (batches.length >= maxBatches) {
        leftover.push(file);
        continue;
      }
    }

    if (batches.length >= maxBatches) {
      leftover.push(file);
      continue;
    }

    current.push(file);
    currentChars += cost;
  }

  if (current.length > 0 && batches.length < maxBatches) {
    batches.push(current);
  } else if (current.length > 0) {
    leftover.push(...current);
  }

  return { batches, leftover };
}

export function renderFilesForPrompt(files: SourceFile[]): string {
  return files
    .map((file) => {
      const numbered = file.content
        .split("\n")
        .map((line, index) => `${String(index + 1).padStart(4, " ")} | ${line}`)
        .join("\n");

      return `<file path="${file.path}" language="${file.language}">\n${numbered}\n</file>`;
    })
    .join("\n\n");
}

export function renderStaticFindingsForPrompt(
  findings: Finding[],
  files: SourceFile[],
): string {
  const paths = new Set(files.map((file) => file.path));
  const relevant = findings.filter((finding) => paths.has(finding.filePath));

  if (relevant.length === 0) return "none";

  return relevant
    .slice(0, 80)
    .map(
      (finding) =>
        `- ${finding.filePath}${finding.line ? `:${finding.line}` : ""} [${finding.priority}] ${finding.title}`,
    )
    .join("\n");
}
