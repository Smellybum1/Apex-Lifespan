#!/usr/bin/env node
const fs = require("node:fs");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/composer/summarize-run.cjs <log-file> [more-log-files]");
  process.exit(2);
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

const interesting = [];
const classes = new Set();
let totalLines = 0;

function classify(line) {
  if (/agent-timeout|timed out|timeout\b/i.test(line)) return "timeout";
  if (/login required|not logged in|sign in|unauth|safety_proven|sandbox|model identifier|fast mode|preflight/i.test(line)) return "preflight";
  if (/allowed_paths|forbidden_paths|task\.json|contract|validate-task|schema_version|max_diff_lines|max_files_changed/i.test(line)) return "contract";
  if (/not recognized|cannot find|command not found|launcher|executable file not found|npm.*not/i.test(line)) return "check-unavailable";
  if (/(^|\s)BLOCKED\b|forbidden|denied|policy/i.test(line)) return "policy-blocked";
  if (/fail|error|exception|traceback/i.test(line)) return "check-failed";
  return "unknown";
}

function recordSignal(text) {
  const signal = text.replace(/\s+/g, " ").slice(0, 240);
  interesting.push(signal);
  classes.add(classify(signal));
}

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const lines = stripAnsi(fs.readFileSync(file, "utf8")).split(/\r?\n/);
  totalLines += lines.length;
  for (const line of lines) {
    const cleaned = line.trim();
    if (!cleaned) continue;
    if (cleaned.startsWith("{")) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.is_error === true || parsed.subtype === "error") {
          recordSignal(`Composer error result: ${String(parsed.result ?? parsed.error ?? cleaned)}`);
        } else if (typeof parsed.result === "string" && /(^|\n)\s*(status:\s*)?BLOCKED\b/i.test(parsed.result)) {
          recordSignal(parsed.result);
        }
        continue;
      } catch {
        // Fall through to text matching for non-JSON progress lines.
      }
    }
    if (/error|fail|denied|blocked|exception|traceback|forbidden|not recognized|cannot find/i.test(cleaned)) {
      recordSignal(cleaned);
    }
  }
}

const unique = [...new Set(interesting)].slice(0, 20);
const classOrder = ["timeout", "preflight", "contract", "check-unavailable", "policy-blocked", "check-failed", "unknown"];
const failureClass = classOrder.find((entry) => classes.has(entry)) ?? "none";
console.log(JSON.stringify({
  files,
  total_lines: totalLines,
  failure_class: failureClass,
  failure_classes: [...classes].sort((a, b) => classOrder.indexOf(a) - classOrder.indexOf(b)),
  interesting_lines: unique.length,
  preview: unique,
}, null, 2));
