import type { Finding } from "./finding.types";
import type { SourceFile } from "./source-collector";
import type { FindingCategory, FindingPriority } from "../reviews.constants";

type LineRule = {
  id: string;
  title: string;
  description: string;
  suggestion: string;
  priority: FindingPriority;
  category: FindingCategory;
  languages?: string[];
  pattern: RegExp;
  /** Skip the line when this pattern matches (false positives guard). */
  ignore?: RegExp;
  skipTests?: boolean;
  maxPerFile?: number;
};

const JS_LIKE = ["typescript", "javascript", "vue", "svelte"];
const PY = ["python"];

const SECRET_KEYWORD =
  /(api[_-]?key|secret|token|passw(or)?d|pwd|private[_-]?key|client[_-]?secret|access[_-]?key)\s*["']?\s*[:=]\s*["'`][^"'`]{8,}["'`]/i;

export const LINE_RULES: LineRule[] = [
  {
    id: "hardcoded-secret",
    title: "Hard-coded secret",
    description:
      "The line looks like it contains an API key, token or password literal. Secrets committed to a repository leak through history, forks and CI logs.",
    suggestion:
      "Move the value to an environment variable or a secret manager, rotate the exposed credential and add the file to .gitignore if it is a local config.",
    priority: "critical",
    category: "security",
    pattern: new RegExp(
      [
        SECRET_KEYWORD.source,
        /AKIA[0-9A-Z]{16}/.source,
        /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/.source,
        /xox[baprs]-[A-Za-z0-9-]{10,}/.source,
        /gh[pousr]_[A-Za-z0-9]{36}/.source,
        /sk-ant-[A-Za-z0-9_-]{20,}/.source,
        /sk-(live|test)_[A-Za-z0-9]{16,}/.source,
      ].join("|"),
      "i",
    ),
    ignore:
      /process\.env|os\.environ|getenv|import\.meta\.env|\$\{|example|placeholder|your[_-]|xxx|<[^>]+>|changeme|dummy|\*{3,}|passwordconfirm|password_confirmation|confirmpassword/i,
  },
  {
    id: "eval-usage",
    title: "Dynamic code evaluation",
    description:
      "eval()/new Function() executes arbitrary strings as code. With any user-controlled input this becomes remote code execution.",
    suggestion:
      "Replace with explicit parsing (JSON.parse, a small interpreter or a lookup table).",
    priority: "high",
    category: "security",
    languages: JS_LIKE,
    pattern: /(^|[^.\w])(eval\s*\(|new\s+Function\s*\()/,
  },
  {
    id: "python-dynamic-exec",
    title: "Dynamic code evaluation",
    description:
      "eval()/exec() execute arbitrary strings as Python code. pickle.loads deserialises attacker-controlled bytes into objects.",
    suggestion:
      "Use ast.literal_eval for data, json for serialisation, and avoid exec entirely.",
    priority: "high",
    category: "security",
    languages: PY,
    pattern:
      /(^|[^.\w])(eval|exec)\s*\(|pickle\.loads?\(|yaml\.load\((?![^)]*Loader)/,
  },
  {
    id: "dangerous-html",
    title: "Unsafe HTML injection",
    description:
      "Writing raw HTML (innerHTML, dangerouslySetInnerHTML, document.write) allows cross-site scripting if the content is not sanitised.",
    suggestion:
      "Render text nodes instead, or sanitise the markup with a library such as DOMPurify before injecting it.",
    priority: "high",
    category: "security",
    languages: [...JS_LIKE, "html"],
    pattern:
      /dangerouslySetInnerHTML|\.innerHTML\s*[+]?=|document\.write\s*\(|\.outerHTML\s*=/,
  },
  {
    id: "shell-injection",
    title: "Shell command built from dynamic input",
    description:
      "Shell commands assembled from variables can be hijacked with metacharacters, leading to command injection.",
    suggestion:
      "Use execFile/spawn (Node) or subprocess.run with an argument list (Python) and never enable shell=True with untrusted data.",
    priority: "high",
    category: "security",
    pattern:
      /(child_process\.)?(exec|execSync)\s*\(\s*(`[^`]*\$\{|["'][^"']*["']\s*\+)|os\.system\s*\(|shell\s*=\s*True|os\.popen\s*\(/,
  },
  {
    id: "sql-injection",
    title: "SQL query built with string concatenation",
    description:
      "Interpolating values into SQL text bypasses parameter binding and enables SQL injection.",
    suggestion:
      "Use parameterised queries / prepared statements or the query builder of your ORM.",
    priority: "high",
    category: "security",
    pattern:
      /["'`]\s*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b[^"'`]*(\$\{|["'`]\s*\+|%s|\.format\(|f["'])/i,
    ignore: /\/\/|#|\/\*|\bsql`|\bsql\.raw|\bsql\(/,
  },
  {
    id: "disabled-tls-verification",
    title: "TLS certificate verification disabled",
    description:
      "Disabling certificate validation makes every HTTPS connection vulnerable to man-in-the-middle attacks.",
    suggestion:
      "Remove the override and install the proper CA certificate for internal services instead.",
    priority: "high",
    category: "security",
    pattern:
      /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFYPEER\s*,\s*(false|0)/,
  },
  {
    id: "merge-conflict-marker",
    title: "Unresolved merge conflict marker",
    description:
      "The file still contains Git conflict markers, so it will not compile or behaves unpredictably.",
    suggestion: "Resolve the conflict and remove the markers.",
    priority: "critical",
    category: "bug",
    pattern: /^(<<<<<<< |>>>>>>> )/,
  },
  {
    id: "debugger-statement",
    title: "Leftover debugger statement",
    description:
      "A `debugger` statement pauses execution whenever dev tools are open and should never ship.",
    suggestion: "Remove the statement.",
    priority: "medium",
    category: "bug",
    languages: JS_LIKE,
    pattern: /^\s*debugger\s*;?\s*$/,
  },
  {
    id: "python-breakpoint",
    title: "Leftover breakpoint",
    description:
      "breakpoint()/pdb.set_trace() halts the program in production.",
    suggestion: "Remove the debugging call.",
    priority: "medium",
    category: "bug",
    languages: PY,
    pattern: /\bbreakpoint\(\)|pdb\.set_trace\(\)/,
  },
  {
    id: "empty-catch-block",
    title: "Exception swallowed silently",
    description:
      "An empty catch block hides failures and makes bugs extremely hard to diagnose.",
    suggestion:
      "Log the error, rethrow it, or add a comment explaining why ignoring it is safe.",
    priority: "medium",
    category: "bug",
    languages: [...JS_LIKE, "java", "kotlin", "csharp", "php"],
    pattern: /catch\s*(\([^)]*\))?\s*\{\s*\}/,
  },
  {
    id: "python-bare-except",
    title: "Bare except clause",
    description:
      "`except:` also catches SystemExit and KeyboardInterrupt and hides programming errors.",
    suggestion: "Catch a specific exception type, e.g. `except ValueError:`.",
    priority: "medium",
    category: "bug",
    languages: PY,
    pattern: /^\s*except\s*:\s*(#.*)?$|except\s+Exception\s*:\s*\n?\s*pass/,
  },
  {
    id: "loose-equality",
    title: "Loose equality comparison",
    description:
      "`==`/`!=` perform type coercion and produce surprising results (e.g. `0 == ''` is true).",
    suggestion: "Use `===` / `!==`.",
    priority: "low",
    category: "bug",
    languages: JS_LIKE,
    pattern: /(^|[^=!<>])(==|!=)(?!=)/,
    ignore:
      /^\s*(\/\/|\*|\/\*)|["'`][^"'`]*(==|!=)[^"'`]*["'`]|==\s*null|!=\s*null/,
    maxPerFile: 5,
  },
  {
    id: "explicit-any",
    title: "Explicit `any` type",
    description:
      "`any` switches off type checking for the value and everything derived from it.",
    suggestion: "Use `unknown` with narrowing or a precise type.",
    priority: "low",
    category: "maintainability",
    languages: ["typescript"],
    pattern: /:\s*any\b|<any>|as\s+any\b|Array<any>|any\[\]/,
    ignore: /^\s*(\/\/|\*|\/\*)|eslint-disable/,
    maxPerFile: 5,
  },
  {
    id: "console-statement",
    title: "Console statement left in code",
    description:
      "console.log/debug output leaks implementation details and clutters production logs.",
    suggestion: "Remove it or route it through the application logger.",
    priority: "low",
    category: "maintainability",
    languages: JS_LIKE,
    pattern: /console\.(log|debug|trace)\s*\(/,
    ignore: /^\s*(\/\/|\*|\/\*)/,
    skipTests: true,
    maxPerFile: 5,
  },
  {
    id: "python-print",
    title: "print() used for logging",
    description: "print() bypasses the logging configuration and log levels.",
    suggestion: "Use the `logging` module.",
    priority: "info",
    category: "maintainability",
    languages: PY,
    pattern: /^\s*print\s*\(/,
    skipTests: true,
    maxPerFile: 3,
  },
  {
    id: "todo-comment",
    title: "Unresolved TODO/FIXME",
    description: "The comment marks unfinished or known-broken work.",
    suggestion: "Track it in the issue tracker or resolve it before merging.",
    priority: "info",
    category: "maintainability",
    pattern: /\b(TODO|FIXME|HACK|XXX)\b[:\s]/,
    maxPerFile: 5,
  },
  {
    id: "insecure-http-url",
    title: "Plain HTTP URL",
    description:
      "Traffic to this URL is unencrypted and can be intercepted or modified.",
    suggestion: "Use https:// unless the endpoint is strictly local.",
    priority: "low",
    category: "security",
    pattern:
      /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|schemas?\.|www\.w3\.org|json-schema\.org|xmlns)/,
    ignore: /^\s*(\/\/|#|\*|\/\*)/,
    maxPerFile: 3,
  },
  {
    id: "weak-random-for-secret",
    title: "Non-cryptographic random used for a secret",
    description:
      "Math.random()/random.random() are predictable and must not be used for tokens, session IDs or passwords.",
    suggestion:
      "Use crypto.randomBytes / crypto.randomUUID (Node) or the `secrets` module (Python).",
    priority: "medium",
    category: "security",
    pattern:
      /(Math\.random\(\)|random\.(random|randint|choice)\().*(token|secret|password|session|nonce|salt|otp)|(token|secret|password|session|nonce|salt|otp).*(Math\.random\(\)|random\.(random|randint|choice)\()/i,
  },
  {
    id: "weak-hash",
    title: "Weak hashing algorithm",
    description:
      "MD5 and SHA-1 are broken for security purposes (collisions are practical).",
    suggestion:
      "Use SHA-256 for integrity checks and bcrypt/argon2 for passwords.",
    priority: "medium",
    category: "security",
    pattern:
      /createHash\(\s*["'](md5|sha1)["']|hashlib\.(md5|sha1)\(|MessageDigest\.getInstance\(\s*"(MD5|SHA-?1)"/i,
  },
  {
    id: "cors-wildcard-with-credentials",
    title: "CORS wildcard origin",
    description:
      "Allowing every origin exposes the API to any website; combined with credentials it is a serious vulnerability.",
    suggestion: "Whitelist explicit origins.",
    priority: "medium",
    category: "security",
    pattern:
      /origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/,
  },
];

const TEST_FILE_PATTERN =
  /(\.|_)(spec|test)\.[a-z]+$|(^|\/)(tests?|__tests__|spec)\//i;

export type FileLevelRule = (file: SourceFile) => Finding | null;

export const FILE_RULES: FileLevelRule[] = [
  (file) => {
    const name = file.path.split("/").pop() ?? file.path;
    if (
      !/^\.env(\.|$)/.test(name) ||
      name.endsWith(".example") ||
      name.endsWith(".sample") ||
      name.endsWith(".template")
    ) {
      return null;
    }

    return {
      filePath: file.path,
      line: null,
      endLine: null,
      priority: "high",
      category: "security",
      source: "static",
      rule: "env-file-committed",
      title: "Environment file included in the repository",
      description:
        "`.env` files usually hold credentials. Shipping them in the repository exposes secrets to everyone with read access.",
      suggestion:
        "Add the file to .gitignore, commit a `.env.example` with placeholders instead and rotate any exposed values.",
      snippet: null,
    };
  },
  (file) => {
    if (file.lineCount <= 800) return null;
    if (
      ["json", "yaml", "markdown", "plaintext", "xml", "sql"].includes(
        file.language,
      )
    ) {
      return null;
    }

    return {
      filePath: file.path,
      line: null,
      endLine: null,
      priority: "low",
      category: "maintainability",
      source: "static",
      rule: "large-file",
      title: `Very large file (${file.lineCount} lines)`,
      description:
        "Files this long usually mix several responsibilities and are hard to review and test.",
      suggestion: "Split the file into cohesive modules.",
      snippet: null,
    };
  },
  (file) => {
    if (
      ["markdown", "json", "yaml", "plaintext", "csv"].includes(file.language)
    ) {
      return null;
    }

    const longLines: number[] = [];
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 180 && !/https?:\/\//.test(lines[i])) {
        longLines.push(i + 1);
      }
    }

    if (longLines.length < 3) return null;

    return {
      filePath: file.path,
      line: longLines[0],
      endLine: null,
      priority: "info",
      category: "style",
      source: "static",
      rule: "long-lines",
      title: `${longLines.length} lines longer than 180 characters`,
      description: `Lines ${longLines.slice(0, 5).join(", ")}${longLines.length > 5 ? ", …" : ""} exceed 180 characters, which hurts readability and diffs.`,
      suggestion: "Run a formatter (Prettier, Black, gofmt) over the file.",
      snippet: null,
    };
  },
];

export function analyzeFile(file: SourceFile): Finding[] {
  const findings: Finding[] = [];
  const isTestFile = TEST_FILE_PATTERN.test(file.path);
  const lines = file.content.split("\n");

  for (const rule of LINE_RULES) {
    if (rule.languages && !rule.languages.includes(file.language)) continue;
    if (rule.skipTests && isTestFile) continue;

    let hits = 0;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!rule.pattern.test(line)) continue;
      if (rule.ignore && rule.ignore.test(line)) continue;

      hits++;
      findings.push({
        filePath: file.path,
        line: index + 1,
        endLine: null,
        priority: rule.priority,
        category: rule.category,
        source: "static",
        rule: rule.id,
        title: rule.title,
        description: rule.description,
        suggestion: rule.suggestion,
        snippet: line.trim().slice(0, 300),
      });

      if (rule.maxPerFile && hits >= rule.maxPerFile) break;
    }
  }

  for (const fileRule of FILE_RULES) {
    const finding = fileRule(file);
    if (finding) findings.push(finding);
  }

  return findings;
}

export function analyzeFiles(files: SourceFile[]): Finding[] {
  return files.flatMap((file) => analyzeFile(file));
}
