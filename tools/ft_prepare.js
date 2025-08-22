#!/usr/bin/env node

/**
 * Fine-tuning Preparation Tool
 * Converts training CSV to JSONL format for Vertex AI supervised tuning
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const TRAINING_CSV = path.join(__dirname, "..", "training", "training1.csv");
const MESSAGES_JSONL = path.join(
  __dirname,
  "..",
  "artifacts",
  "ft_messages.jsonl"
);
const EVAL_JSONL = path.join(__dirname, "..", "artifacts", "eval.jsonl");

function main() {
  console.log("🚀 Starting fine-tuning preparation...");

  // Ensure artifacts directory exists
  const artifactsDir = path.dirname(MESSAGES_JSONL);
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
    console.log(`📁 Created artifacts directory: ${artifactsDir}`);
  }

  // Read and parse CSV
  console.log(`📖 Reading training data from: ${TRAINING_CSV}`);
  const csvContent = fs.readFileSync(TRAINING_CSV, "utf-8");

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`✅ Loaded ${records.length} training examples`);

  // Prepare data structures
  const messagesData = [];
  const evalData = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const input = record["Input"];
    const expected = record["Expected Bot Response"];
    const actual = record["Actual Bot Response"];

    if (!input || !expected) {
      console.warn(
        `⚠️ Skipping record ${i + 1}: missing input or expected response`
      );
      continue;
    }

    // Create chat message format for fine-tuning
    const chatMessage = {
      messages: [
        {
          role: "user",
          content: input,
        },
        {
          role: "model",
          content: expected,
        },
      ],
    };

    messagesData.push(chatMessage);

    // Create evaluation format
    const evalRecord = {
      input: input,
      expected: expected,
      actual: actual || null,
    };

    evalData.push(evalRecord);
  }

  // Write messages JSONL
  console.log(`💾 Writing training messages to: ${MESSAGES_JSONL}`);
  const messagesJsonl = messagesData.map(JSON.stringify).join("\n");
  fs.writeFileSync(MESSAGES_JSONL, messagesJsonl, "utf-8");

  // Write evaluation JSONL
  console.log(`💾 Writing evaluation data to: ${EVAL_JSONL}`);
  const evalJsonl = evalData.map(JSON.stringify).join("\n");
  fs.writeFileSync(EVAL_JSONL, evalJsonl, "utf-8");

  // Print summary
  console.log("\n📊 Summary:");
  console.log(`   Training examples: ${messagesData.length}`);
  console.log(`   Evaluation examples: ${evalData.length}`);
  console.log(`   Training file: ${MESSAGES_JSONL}`);
  console.log(`   Evaluation file: ${EVAL_JSONL}`);

  console.log("\n✅ Fine-tuning preparation completed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Review the generated JSONL files");
  console.log("   2. Run: npm run ft:submit");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("❌ Error during preparation:", error.message);
    process.exit(1);
  }
}

module.exports = { main };
