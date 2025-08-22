#!/usr/bin/env node
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");
const TRAIN_JSONL = path.join(ARTIFACTS_DIR, "ft_train.jsonl");
const VALID_JSONL = path.join(ARTIFACTS_DIR, "ft_validation.jsonl");
const GCS_BUCKET = process.env.GCS_BUCKET || "beautybot-finetune-data";

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs
    .readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`Invalid JSON on line ${i + 1} in ${filePath}`);
      }
    });
}

function toContents(userText, modelText) {
  return {
    contents: [
      { role: "user", parts: [{ text: String(userText || "").trim() }] },
      { role: "model", parts: [{ text: String(modelText || "").trim() }] },
    ],
  };
}

function extractFromMessages(obj) {
  const messages = Array.isArray(obj?.messages) ? obj.messages : [];
  if (messages.length === 0) return null;

  // First user message (if present), otherwise first message content
  const firstUser =
    messages.find((m) => (m?.role || "").toLowerCase() === "user") ||
    messages[0];

  // Per spec: take the SECOND message as the correct answer if available
  let secondMsg = messages[1];

  // Fallback: find the first model message after the first user
  if (!secondMsg || !secondMsg.content) {
    const startIdx = Math.max(0, messages.indexOf(firstUser));
    secondMsg =
      messages
        .slice(startIdx + 1)
        .find((m) => (m?.role || "").toLowerCase() === "model") || messages[1];
  }

  const userText = firstUser?.content || "";
  const modelText = secondMsg?.content || "";
  if (!String(userText).trim() || !String(modelText).trim()) return null;
  return toContents(userText, modelText);
}

function normalizeRow(obj) {
  // Case A: already { input_text, output_text }
  if (
    typeof obj?.input_text === "string" &&
    typeof obj?.output_text === "string"
  ) {
    const u = obj.input_text.trim();
    const m = obj.output_text.trim();
    if (!u || !m) return null;
    return toContents(u, m);
  }

  // Case B: messages array
  const fromMessages = extractFromMessages(obj);
  if (fromMessages) return fromMessages;

  // Unknown shape: skip
  return null;
}

function rewriteJsonlInPlace(filePath) {
  const rows = readJsonl(filePath);
  const cleaned = [];
  for (const obj of rows) {
    const normalized = normalizeRow(obj);
    if (normalized) cleaned.push(normalized);
  }
  fs.writeFileSync(
    filePath,
    cleaned.map((o) => JSON.stringify(o)).join("\n") +
      (cleaned.length ? "\n" : "")
  );
  return cleaned.length;
}

function uploadToGcs(localPath, gcsUri) {
  execSync(
    `gcloud storage cp ${JSON.stringify(localPath)} ${JSON.stringify(gcsUri)}`,
    {
      stdio: "inherit",
    }
  );
}

async function main() {
  // Clean and overwrite
  const trainCount = rewriteJsonlInPlace(TRAIN_JSONL);
  const validCount = rewriteJsonlInPlace(VALID_JSONL);
  console.log(`✅ Cleaned training examples: ${trainCount}`);
  console.log(`✅ Cleaned validation examples: ${validCount}`);

  // Upload both
  const trainGcs = `gs://${GCS_BUCKET}/ft_train.jsonl`;
  const validGcs = `gs://${GCS_BUCKET}/ft_validation.jsonl`;

  uploadToGcs(TRAIN_JSONL, trainGcs);
  console.log(`📤 Uploaded training to ${trainGcs}`);

  uploadToGcs(VALID_JSONL, validGcs);
  console.log(`📤 Uploaded validation to ${validGcs}`);

  console.log("🚀 Done");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ fix_and_upload error:", err.message);
    process.exit(1);
  });
}
