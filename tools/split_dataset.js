#!/usr/bin/env node
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "training", "training1.csv");
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");
const TRAIN_JSONL = path.join(ARTIFACTS_DIR, "ft_train.jsonl");
const VALID_JSONL = path.join(ARTIFACTS_DIR, "ft_validation.jsonl");

function normalizeHeader(h) {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function findIndexWithSynonyms(headers, synonyms) {
  for (const name of headers) {
    const n = normalizeHeader(name);
    if (synonyms.includes(n)) return headers.indexOf(name);
  }
  return -1;
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => normalizeHeader(h));

  // Try to find input/output by common synonyms
  const inputSyn = [
    "input",
    "user",
    "prompt",
    "question",
    "query",
    "text",
    "source",
    "utterance",
  ];
  const outputSyn = [
    "output",
    "model",
    "assistant",
    "answer",
    "response",
    "target",
    "label",
  ];

  let inputIdx = -1;
  let outputIdx = -1;

  // map original header positions
  const originalHeaders = splitCsvLine(lines[0]);
  inputIdx = findIndexWithSynonyms(originalHeaders, inputSyn);
  outputIdx = findIndexWithSynonyms(originalHeaders, outputSyn);

  // Fallback: first two columns
  if (inputIdx === -1 || outputIdx === -1) {
    inputIdx = inputIdx === -1 ? 0 : inputIdx;
    outputIdx = outputIdx === -1 ? 1 : outputIdx;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;
    const input = cols[inputIdx] != null ? cols[inputIdx] : "";
    const output = cols[outputIdx] != null ? cols[outputIdx] : "";
    if (String(input).trim() || String(output).trim()) {
      rows.push({ input, output });
    }
  }
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((c) => c.trim());
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function toJsonlLine(input, output) {
  const obj = {
    messages: [
      { role: "user", content: input },
      { role: "model", content: output },
    ],
  };
  return JSON.stringify(obj);
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(content).filter((r) => r.input && r.output);
  if (!rows.length) throw new Error("No valid rows found in CSV");

  shuffleInPlace(rows);
  const splitIdx = Math.max(1, Math.floor(rows.length * 0.8));
  const trainRows = rows.slice(0, splitIdx);
  const validRows = rows.slice(splitIdx);

  fs.writeFileSync(
    TRAIN_JSONL,
    trainRows.map((r) => toJsonlLine(r.input, r.output)).join("\n") + "\n"
  );
  fs.writeFileSync(
    VALID_JSONL,
    validRows.map((r) => toJsonlLine(r.input, r.output)).join("\n") +
      (validRows.length ? "\n" : "")
  );

  console.log(`✅ Wrote training: ${trainRows.length} → ${TRAIN_JSONL}`);
  console.log(`✅ Wrote validation: ${validRows.length} → ${VALID_JSONL}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ split_dataset error:", err.message);
    process.exit(1);
  });
}
