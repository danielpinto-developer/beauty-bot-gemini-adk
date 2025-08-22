#!/usr/bin/env node
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");
const TRAIN_JSONL = path.join(ARTIFACTS_DIR, "ft_train.jsonl");
const VALID_JSONL = path.join(ARTIFACTS_DIR, "ft_validation.jsonl");

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l, idx) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`Invalid JSON on line ${idx + 1} in ${filePath}`);
      }
    });
}

function extractPair(obj) {
  // Case 1: already in { input_text, output_text }
  if (
    typeof obj?.input_text === "string" &&
    typeof obj?.output_text === "string"
  ) {
    const input = obj.input_text.trim();
    const output = obj.output_text.trim();
    if (input && output) return { input_text: input, output_text: output };
    return null;
  }
  // Case 2: messages array
  const messages = Array.isArray(obj?.messages) ? obj.messages : [];
  if (!messages.length) return null;
  const userMsg = messages.find(
    (m) => (m?.role || "").toLowerCase() === "user"
  );
  const modelMsg = messages.find(
    (m) => (m?.role || "").toLowerCase() === "model"
  );
  const inputText = (userMsg?.content || "").toString().trim();
  const outputText = (modelMsg?.content || "").toString().trim();
  if (!inputText || !outputText) return null;
  return { input_text: inputText, output_text: outputText };
}

function convertFileInPlace(filePath) {
  const rows = readJsonl(filePath);
  const converted = [];
  for (const obj of rows) {
    const pair = extractPair(obj);
    if (pair) converted.push(pair);
  }
  const out =
    converted.map((o) => JSON.stringify(o)).join("\n") +
    (converted.length ? "\n" : "");
  fs.writeFileSync(filePath, out);
  return converted.length;
}

async function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const trainCount = convertFileInPlace(TRAIN_JSONL);
  console.log(`✅ Converted training examples: ${trainCount}`);

  const validCount = convertFileInPlace(VALID_JSONL);
  console.log(`✅ Converted validation examples: ${validCount}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ convert_split error:", err.message);
    process.exit(1);
  });
}
