import AdmZip from "adm-zip";
import { REVIEW_LIMITS } from "../reviews.constants";

export type SourceFile = {
  path: string;
  language: string;
  content: string;
  byteSize: number;
  lineCount: number;
};

export type CollectedSources = {
  files: SourceFile[];
  skipped: SkippedFile[];
};

export type SkippedFile = {
  path: string;
  reason: "excluded-path" | "binary" | "too-large" | "limit-reached";
};

export type UploadedPart = {
  name: string;
  buffer: Buffer;
  mimeType?: string;
};

const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "vendor",
  ".next",
  ".nuxt",
  ".turbo",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".idea",
  ".vscode",
  "__MACOSX",
  ".pytest_cache",
  ".mypy_cache",
  "bower_components",
]);

const EXCLUDED_FILENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "go.sum",
  "composer.lock",
  "Gemfile.lock",
  ".DS_Store",
  "Thumbs.db",
]);

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "svg",
  "pdf",
  "zip",
  "gz",
  "tgz",
  "tar",
  "rar",
  "7z",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "wav",
  "exe",
  "dll",
  "so",
  "dylib",
  "class",
  "jar",
  "pyc",
  "wasm",
  "map",
  "lock",
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  vue: "vue",
  svelte: "svelte",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  php: "php",
  cs: "csharp",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  swift: "swift",
  m: "objective-c",
  dart: "dart",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  md: "markdown",
  mdx: "markdown",
  tf: "terraform",
  hcl: "terraform",
  graphql: "graphql",
  gql: "graphql",
  prisma: "prisma",
  env: "dotenv",
};

const LANGUAGE_BY_FILENAME: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  Gemfile: "ruby",
  Rakefile: "ruby",
  ".env": "dotenv",
  ".gitignore": "gitignore",
};

export function detectLanguage(path: string): string {
  const fileName = basename(path);

  if (LANGUAGE_BY_FILENAME[fileName]) {
    return LANGUAGE_BY_FILENAME[fileName];
  }

  if (fileName.startsWith(".env")) {
    return "dotenv";
  }

  const extension = extensionOf(fileName);

  return LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
}

export function basename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

export function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index <= 0) return "";
  return fileName.slice(index + 1).toLowerCase();
}

export function isZipUpload(part: UploadedPart): boolean {
  const name = part.name.toLowerCase();
  if (name.endsWith(".zip")) return true;
  if (
    part.mimeType === "application/zip" ||
    part.mimeType === "application/x-zip-compressed"
  ) {
    return true;
  }
  // ZIP local file header signature: PK\x03\x04
  return (
    part.buffer.length >= 4 &&
    part.buffer[0] === 0x50 &&
    part.buffer[1] === 0x4b &&
    part.buffer[2] === 0x03 &&
    part.buffer[3] === 0x04
  );
}

/**
 * Normalises a path coming from an archive: forward slashes, no leading
 * slashes, no `.`/`..` segments (zip-slip protection). Returns null when the
 * path is unsafe or empty.
 */
export function normalizeArchivePath(rawPath: string): string | null {
  const unified = rawPath.replace(/\\/g, "/");
  const segments = unified
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");

  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === "..")) return null;
  if (/^[a-zA-Z]:/.test(segments[0])) return null;

  return segments.join("/");
}

export function isExcludedPath(path: string): boolean {
  const segments = path.split("/");
  const fileName = segments[segments.length - 1];

  if (
    segments.slice(0, -1).some((segment) => EXCLUDED_DIRECTORIES.has(segment))
  ) {
    return true;
  }

  if (EXCLUDED_FILENAMES.has(fileName)) return true;
  if (/\.min\.(js|css)$/.test(fileName)) return true;

  return BINARY_EXTENSIONS.has(extensionOf(fileName));
}

export function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

/**
 * Strips a single common top-level directory (GitHub-style `repo-main/`)
 * when every file in the archive lives under it.
 */
export function stripCommonRoot(paths: string[]): Map<string, string> {
  const mapping = new Map<string, string>();
  if (paths.length === 0) return mapping;

  const firstSegments = new Set(paths.map((path) => path.split("/")[0]));
  const everyPathIsNested = paths.every((path) => path.includes("/"));
  const shouldStrip = firstSegments.size === 1 && everyPathIsNested;

  for (const path of paths) {
    mapping.set(path, shouldStrip ? path.split("/").slice(1).join("/") : path);
  }

  return mapping;
}

type RawEntry = { path: string; buffer: Buffer };

function extractZipEntries(buffer: Buffer): RawEntry[] {
  const zip = new AdmZip(buffer);
  const entries: RawEntry[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const path = normalizeArchivePath(entry.entryName);
    if (!path) continue;
    entries.push({ path, buffer: entry.getData() });
  }

  return entries;
}

export function collectSources(parts: UploadedPart[]): CollectedSources {
  const rawEntries: RawEntry[] = [];

  for (const part of parts) {
    if (isZipUpload(part)) {
      const entries = extractZipEntries(part.buffer);
      const paths = entries.map((entry) => entry.path);
      const mapping = stripCommonRoot(paths);
      for (const entry of entries) {
        rawEntries.push({
          path: mapping.get(entry.path) ?? entry.path,
          buffer: entry.buffer,
        });
      }
    } else {
      const fileName = basename(part.name.replace(/\\/g, "/")).trim();
      rawEntries.push({
        path: fileName && fileName !== ".." ? fileName : "upload.txt",
        buffer: part.buffer,
      });
    }
  }

  const files: SourceFile[] = [];
  const skipped: SkippedFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const entry of rawEntries) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);

    if (isExcludedPath(entry.path)) {
      skipped.push({ path: entry.path, reason: "excluded-path" });
      continue;
    }

    if (entry.buffer.length > REVIEW_LIMITS.maxSourceFileBytes) {
      skipped.push({ path: entry.path, reason: "too-large" });
      continue;
    }

    if (looksBinary(entry.buffer)) {
      skipped.push({ path: entry.path, reason: "binary" });
      continue;
    }

    if (
      files.length >= REVIEW_LIMITS.maxSourceFiles ||
      totalBytes + entry.buffer.length > REVIEW_LIMITS.maxTotalSourceBytes
    ) {
      skipped.push({ path: entry.path, reason: "limit-reached" });
      continue;
    }

    const content = entry.buffer.toString("utf8");
    totalBytes += entry.buffer.length;

    files.push({
      path: entry.path,
      language: detectLanguage(entry.path),
      content,
      byteSize: entry.buffer.length,
      lineCount: countLines(content),
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return { files, skipped };
}

export function countLines(content: string): number {
  if (content.length === 0) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) count++;
  }
  if (content.endsWith("\n")) count--;
  return count;
}
