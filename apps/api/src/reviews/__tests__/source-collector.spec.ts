import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import {
  collectSources,
  detectLanguage,
  isZipUpload,
  normalizeArchivePath,
  stripCommonRoot,
} from "../analysis/source-collector";

function zipOf(entries: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.addFile(
      path,
      Buffer.isBuffer(content) ? content : Buffer.from(content),
    );
  }
  return zip.toBuffer();
}

describe("source collector", () => {
  it("detects languages from extensions and well-known filenames", () => {
    expect(detectLanguage("src/index.ts")).toBe("typescript");
    expect(detectLanguage("app/main.py")).toBe("python");
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage(".env.local")).toBe("dotenv");
    expect(detectLanguage("README")).toBe("plaintext");
  });

  it("rejects zip-slip paths", () => {
    expect(normalizeArchivePath("../../etc/passwd")).toBeNull();
    expect(normalizeArchivePath("/etc/passwd")).toBe("etc/passwd");
    expect(normalizeArchivePath("C:\\Windows\\system32")).toBeNull();
    expect(normalizeArchivePath("./src/./a.ts")).toBe("src/a.ts");
  });

  it("strips a single common root directory", () => {
    const mapping = stripCommonRoot([
      "repo-main/src/a.ts",
      "repo-main/README.md",
    ]);
    expect(mapping.get("repo-main/src/a.ts")).toBe("src/a.ts");

    const untouched = stripCommonRoot(["a.ts", "src/b.ts"]);
    expect(untouched.get("src/b.ts")).toBe("src/b.ts");
  });

  it("recognises zip uploads by extension, mime type or magic bytes", () => {
    expect(isZipUpload({ name: "repo.zip", buffer: Buffer.alloc(0) })).toBe(
      true,
    );
    expect(
      isZipUpload({
        name: "x",
        buffer: Buffer.alloc(0),
        mimeType: "application/zip",
      }),
    ).toBe(true);
    expect(isZipUpload({ name: "x", buffer: zipOf({ "a.txt": "a" }) })).toBe(
      true,
    );
    expect(
      isZipUpload({ name: "a.ts", buffer: Buffer.from("const a = 1;") }),
    ).toBe(false);
  });

  it("extracts a zip, drops vendored/binary files and keeps source files", () => {
    const archive = zipOf({
      "repo/src/index.ts": "export const a = 1;\n",
      "repo/node_modules/dep/index.js": "module.exports = {}",
      "repo/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]),
      "repo/bin.dat": Buffer.from([1, 2, 0, 3]),
      "repo/pnpm-lock.yaml": "lockfileVersion: 9",
    });

    const result = collectSources([{ name: "repo.zip", buffer: archive }]);

    expect(result.files.map((file) => file.path)).toEqual(["src/index.ts"]);
    expect(result.files[0].lineCount).toBe(1);
    expect(result.skipped.map((entry) => entry.reason).sort()).toEqual([
      "binary",
      "excluded-path",
      "excluded-path",
      "excluded-path",
    ]);
  });

  it("treats standalone uploads as single files", () => {
    const result = collectSources([
      { name: "main.py", buffer: Buffer.from("print('hi')\n") },
      { name: "../evil.ts", buffer: Buffer.from("const x = 1;") },
    ]);

    expect(result.files.map((file) => file.path).sort()).toEqual([
      "evil.ts",
      "main.py",
    ]);
  });
});
