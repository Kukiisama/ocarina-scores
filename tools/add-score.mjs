#!/usr/bin/env node
/**
 * 往谱面库里加一首谱面。
 *
 *   node tools/add-score.mjs <谱面.json> --title "标题" --author "作者" [--id 自定义id]
 *
 * 做的事：校验文件 → 复制到 scores/<id>.json → 更新 index.json。
 * 之后自己 git add / commit / push 就行。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.json");
const scoresDir = path.join(root, "scores");

function fail(message) {
  console.error("✗ " + message);
  process.exitCode = 1;
  process.exit();
}

function parseArgs(argv) {
  const result = { input: "", title: "", author: "", id: "" };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--title" || arg === "-t") {
      result.title = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--author" || arg === "-a") {
      result.author = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--id") {
      result.id = argv[i + 1] ?? "";
      i += 1;
    } else if (!arg.startsWith("-")) {
      result.input = arg;
    }
  }

  return result;
}

function defaultId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return "score-" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
    pad(now.getHours()) + pad(now.getMinutes());
}

function readIndex() {
  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const args = parseArgs(process.argv.slice(2));

if (!args.input) {
  console.log("用法：node tools/add-score.mjs <谱面.json> --title \"标题\" --author \"作者\" [--id 自定义id]");
  process.exit(0);
}

const inputPath = path.resolve(args.input);

if (!existsSync(inputPath)) {
  fail("找不到文件：" + inputPath);
}

let score = null;
try {
  score = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (error) {
  fail("这个文件不是合法 JSON：" + (error instanceof Error ? error.message : String(error)));
}

const notes = Array.isArray(score?.notes) ? score.notes : null;
if (!notes || notes.length === 0) {
  fail("文件里没有 notes 数组，确认它是从编辑器「导出」出来的谱面");
}

const title = args.title.trim() || path.basename(inputPath, path.extname(inputPath));
const author = args.author.trim() || "未知作者";
let id = args.id.trim() || defaultId();

if (!/^[\w.-]+$/u.test(id)) {
  fail("id 只能用字母、数字、-、_、.：" + id);
}

const index = readIndex();

// 同 id 视为“更新”，避免重复条目
while (index.some((entry) => entry && entry.id === id)) {
  id = id + "-2";
}

mkdirSync(scoresDir, { recursive: true });
const targetPath = path.join(scoresDir, id + ".json");
copyFileSync(inputPath, targetPath);

index.unshift({
  id,
  title,
  author,
  file: "scores/" + id + ".json",
  notes: notes.length,
});

writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");

console.log("✓ 已加入谱面库");
console.log("  标题：" + title);
console.log("  作者：" + author);
console.log("  id  ：" + id);
console.log("  文件：scores/" + id + ".json（" + notes.length + " 个音）");
console.log("");
console.log("接着提交：");
console.log("  git add -A");
console.log("  git commit -m \"新增谱面：" + title + "\"");
console.log("  git push");
