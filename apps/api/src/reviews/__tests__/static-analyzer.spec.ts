import { describe, expect, it } from "vitest";
import { analyzeFile } from "../analysis/static-analyzer";
import type { SourceFile } from "../analysis/source-collector";
import { countLines } from "../analysis/source-collector";

function file(path: string, content: string, language?: string): SourceFile {
  return {
    path,
    language: language ?? (path.endsWith(".py") ? "python" : "typescript"),
    content,
    byteSize: Buffer.byteLength(content),
    lineCount: countLines(content),
  };
}

describe("static analyzer", () => {
  it("flags hard-coded secrets as critical security findings", () => {
    const findings = analyzeFile(
      file(
        "src/config.ts",
        `const apiKey = "sk-ant-abcdefghijklmnopqrstuvwxyz0123";\nconst aws = "AKIAIOSFODNN7EXAMPLE";`,
      ),
    );

    const secrets = findings.filter(
      (finding) => finding.rule === "hardcoded-secret",
    );
    expect(secrets).toHaveLength(1);
    expect(secrets[0].priority).toBe("critical");
    expect(secrets[0].category).toBe("security");
    expect(secrets[0].line).toBe(1);
  });

  it("does not flag secrets read from the environment", () => {
    const findings = analyzeFile(
      file(
        "src/config.ts",
        `const apiKey = process.env.API_KEY ?? "placeholder-value-here";`,
      ),
    );

    expect(
      findings.filter((finding) => finding.rule === "hardcoded-secret"),
    ).toHaveLength(0);
  });

  it("detects eval, debugger and loose equality in JavaScript-like files", () => {
    const findings = analyzeFile(
      file(
        "src/app.js",
        `const result = eval(input);\ndebugger;\nif (a == b) {}\n`,
        "javascript",
      ),
    );

    const rules = findings.map((finding) => finding.rule);
    expect(rules).toContain("eval-usage");
    expect(rules).toContain("debugger-statement");
    expect(rules).toContain("loose-equality");
  });

  it("skips console statements in test files", () => {
    const findings = analyzeFile(
      file("src/app.spec.ts", `console.log("debugging");`),
    );

    expect(
      findings.filter((finding) => finding.rule === "console-statement"),
    ).toHaveLength(0);
  });

  it("applies python specific rules", () => {
    const findings = analyzeFile(
      file(
        "app/main.py",
        `try:\n    run()\nexcept:\n    pass\nos.system("rm -rf " + path)\n`,
      ),
    );

    const rules = findings.map((finding) => finding.rule);
    expect(rules).toContain("python-bare-except");
    expect(rules).toContain("shell-injection");
  });

  it("flags committed .env files at file level", () => {
    const findings = analyzeFile(
      file(".env", "DATABASE_URL=postgres://x", "dotenv"),
    );

    const envFinding = findings.find(
      (finding) => finding.rule === "env-file-committed",
    );
    expect(envFinding).toBeDefined();
    expect(envFinding?.line).toBeNull();
    expect(envFinding?.priority).toBe("high");
  });

  it("ignores .env.example files", () => {
    const findings = analyzeFile(
      file(".env.example", "DATABASE_URL=", "dotenv"),
    );

    expect(
      findings.find((finding) => finding.rule === "env-file-committed"),
    ).toBeUndefined();
  });

  it("caps noisy rules per file", () => {
    const content = Array.from(
      { length: 20 },
      (_, i) => `console.log(${i});`,
    ).join("\n");
    const findings = analyzeFile(file("src/noisy.ts", content));

    expect(
      findings.filter((finding) => finding.rule === "console-statement"),
    ).toHaveLength(5);
  });
});
