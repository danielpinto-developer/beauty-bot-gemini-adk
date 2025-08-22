#!/usr/bin/env node

/**
 * Model Evaluation Tool
 * Tests the bot with evaluation data and reports performance metrics
 */

const fs = require("fs");
const path = require("path");

// Import bot functionality
const { generateIntentVariants } = require("../api_backend/lib/nlg");

const EVAL_JSONL = path.join(__dirname, "..", "artifacts", "eval.jsonl");

function calculateExactMatch(predicted, expected) {
  // Normalize strings for comparison
  const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, " ");
  return normalize(predicted) === normalize(expected);
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function detectIntent(input) {
  const lowerInput = input.toLowerCase();

  if (
    lowerInput.includes("precio") ||
    lowerInput.includes("cuánto") ||
    lowerInput.includes("costo")
  ) {
    return "faq_price";
  }
  if (
    lowerInput.includes("dónde") ||
    lowerInput.includes("ubicación") ||
    lowerInput.includes("dirección")
  ) {
    return "faq_location";
  }
  if (
    lowerInput.includes("hola") ||
    lowerInput.includes("buenos") ||
    lowerInput.includes("saludos")
  ) {
    return "greeting";
  }
  if (lowerInput.includes("gracias") || lowerInput.includes("thank")) {
    return "gratitude";
  }
  if (
    lowerInput.includes("cita") ||
    lowerInput.includes("agendar") ||
    lowerInput.includes("turno")
  ) {
    return "book_appointment";
  }

  return "fallback";
}

function extractSlots(input) {
  const slots = {};
  const lowerInput = input.toLowerCase();

  // Extract service
  const services = [
    "uñas acrílicas",
    "pestañas clásicas",
    "lifting de pestañas",
    "manicure spa",
    "pedicure spa",
    "bblips",
    "uñas soft gel",
  ];

  for (const service of services) {
    if (lowerInput.includes(service)) {
      slots.servicio = service;
      break;
    }
  }

  // Extract date (simplified)
  if (lowerInput.includes("mañana")) {
    slots.fecha = "mañana";
  } else if (lowerInput.includes("hoy")) {
    slots.fecha = "hoy";
  }

  // Extract time (simplified)
  const timeMatch = input.match(/(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i);
  if (timeMatch) {
    slots.hora = timeMatch[1];
  }

  return slots;
}

async function evaluateBot(input) {
  try {
    // This is a simplified evaluation - in a real scenario,
    // you would call your actual bot endpoint or dispatcher
    console.log(`🤖 Evaluating: "${input}"`);

    // For now, we'll just test the NLG system directly
    // In production, you would integrate with your actual bot logic

    // Try to extract intent and slots from input (simplified)
    const intent = detectIntent(input);
    const slots = extractSlots(input);

    console.log(`   Intent: ${intent}, Slots:`, slots);

    // Generate response using NLG
    const variants = await generateIntentVariants(intent, slots);
    const predicted = variants[0]; // Use first variant

    console.log(`   Predicted: "${predicted}"`);

    return predicted;
  } catch (error) {
    console.error(`   ❌ Error evaluating input "${input}":`, error.message);
    return "ERROR: " + error.message;
  }
}

async function main() {
  console.log("🧪 Starting model evaluation...");

  if (!fs.existsSync(EVAL_JSONL)) {
    console.error(`❌ Evaluation file not found: ${EVAL_JSONL}`);
    console.error("   Run: npm run ft:prepare");
    process.exit(1);
  }

  // Read evaluation data
  console.log(`📖 Loading evaluation data from: ${EVAL_JSONL}`);
  const evalContent = fs.readFileSync(EVAL_JSONL, "utf-8");
  const evalRecords = evalContent
    .trim()
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.warn(`⚠️ Skipping invalid JSON line: ${line}`);
        return null;
      }
    })
    .filter((record) => record !== null);

  console.log(`✅ Loaded ${evalRecords.length} evaluation examples`);

  // Evaluate each example
  const results = [];
  let exactMatches = 0;
  let totalSimilarity = 0;

  console.log("\n🔍 Evaluating examples...");

  for (let i = 0; i < evalRecords.length; i++) {
    const record = evalRecords[i];
    const { input, expected } = record;

    console.log(`\n[${i + 1}/${evalRecords.length}]`);

    try {
      const predicted = await evaluateBot(input);
      const isExactMatch = calculateExactMatch(predicted, expected);
      const similarity = calculateSimilarity(predicted, expected);

      results.push({
        input,
        expected,
        predicted,
        exactMatch: isExactMatch,
        similarity: similarity,
      });

      if (isExactMatch) {
        exactMatches++;
        console.log("   ✅ EXACT MATCH");
      } else {
        console.log("   ❌ No match");
        console.log(`   Similarity: ${(similarity * 100).toFixed(1)}%`);
      }

      totalSimilarity += similarity;
    } catch (error) {
      console.error(`   ❌ Evaluation failed: ${error.message}`);
      results.push({
        input,
        expected,
        predicted: null,
        exactMatch: false,
        similarity: 0,
        error: error.message,
      });
    }

    // Add delay to avoid rate limiting
    if (i < evalRecords.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Calculate metrics
  const exactMatchAccuracy = (exactMatches / evalRecords.length) * 100;
  const averageSimilarity = (totalSimilarity / evalRecords.length) * 100;

  // Print summary
  console.log("\n📊 EVALUATION RESULTS");
  console.log("═".repeat(50));
  console.log(`Total Examples: ${evalRecords.length}`);
  console.log(`Exact Matches: ${exactMatches}`);
  console.log(`Exact Match Accuracy: ${exactMatchAccuracy.toFixed(1)}%`);
  console.log(`Average Similarity: ${averageSimilarity.toFixed(1)}%`);

  // Save detailed results
  const resultsPath = path.join(
    __dirname,
    "..",
    "artifacts",
    `eval_results_${Date.now()}.json`
  );
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        summary: {
          totalExamples: evalRecords.length,
          exactMatches,
          exactMatchAccuracy,
          averageSimilarity,
          timestamp: new Date().toISOString(),
        },
        results,
      },
      null,
      2
    )
  );

  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);

  // Print some examples
  console.log("\n📝 Sample Results:");
  console.log("─".repeat(30));

  const sampleResults = results.slice(0, 5);
  sampleResults.forEach((result, index) => {
    console.log(`\n${index + 1}. Input: "${result.input}"`);
    console.log(`   Expected: "${result.expected}"`);
    console.log(`   Predicted: "${result.predicted}"`);
    console.log(`   Match: ${result.exactMatch ? "✅" : "❌"}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Error during evaluation:", error.message);
    process.exit(1);
  });
}

module.exports = { main, calculateExactMatch, calculateSimilarity };
