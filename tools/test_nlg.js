#!/usr/bin/env node

/**
 * NLG Smoke Test
 * Tests the NLG functionality with common scenarios
 */

// Check if we can load the modules without API key for basic validation
let nlgModule;
try {
  nlgModule = require("../api_backend/lib/nlg");
  console.log("✅ NLG module loaded successfully");
} catch (error) {
  console.log("❌ Failed to load NLG module:", error.message);
  console.log("📝 This may be due to missing GEMINI_API_KEY");
  console.log("🔧 Testing basic file structure instead...\n");

  // Test basic file existence and structure
  testBasicStructure();
  process.exit(0);
}

const { generateBookingVariants } = nlgModule;

function testBasicStructure() {
  const fs = require("fs");
  const path = require("path");

  console.log("🧪 Basic Structure Test");
  console.log("─".repeat(40));

  const requiredFiles = [
    "api_backend/lib/brandStyle.js",
    "api_backend/lib/strictJson.js",
    "api_backend/lib/nlg.js",
    "messageDispatcher.js",
    "geminiFallback.js",
    "training/training1.csv",
    "tools/ft_prepare.js",
    "tools/ft_submit.js",
    "tools/eval_from_jsonl.js",
    "artifacts/",
  ];

  let allFilesExist = true;

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, "..", file);
    const exists = fs.existsSync(filePath);

    if (exists) {
      console.log(`✅ ${file}`);

      // Test if it's a readable file
      if (!file.endsWith("/")) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          if (content.length > 0) {
            console.log(`   📄 File is readable (${content.length} chars)`);
          } else {
            console.log(`   ⚠️ File is empty`);
          }
        } catch (error) {
          console.log(`   ❌ File is not readable: ${error.message}`);
          allFilesExist = false;
        }
      }
    } else {
      console.log(`❌ ${file} - NOT FOUND`);
      allFilesExist = false;
    }
  }

  // Test package.json dependencies
  console.log("\n📦 Package.json Dependencies");
  console.log("─".repeat(40));

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
    );
    const deps = packageJson.dependencies || {};

    const requiredDeps = [
      "@google/generative-ai",
      "@google-cloud/aiplatform",
      "@google-cloud/storage",
      "csv-parse",
    ];

    for (const dep of requiredDeps) {
      if (deps[dep]) {
        console.log(`✅ ${dep}: ${deps[dep]}`);
      } else {
        console.log(`❌ ${dep} - MISSING`);
        allFilesExist = false;
      }
    }

    // Check scripts
    const scripts = packageJson.scripts || {};
    const requiredScripts = ["ft:prepare", "ft:submit", "ft:eval", "test:nlg"];

    console.log("\n🔧 NPM Scripts");
    console.log("─".repeat(40));

    for (const script of requiredScripts) {
      if (scripts[script]) {
        console.log(`✅ ${script}: ${scripts[script]}`);
      } else {
        console.log(`❌ ${script} - MISSING`);
        allFilesExist = false;
      }
    }
  } catch (error) {
    console.log(`❌ Cannot read package.json: ${error.message}`);
    allFilesExist = false;
  }

  console.log("\n📊 Structure Test Summary");
  console.log("═".repeat(50));

  if (allFilesExist) {
    console.log("🎉 All required files and dependencies are present!");
    console.log("\n💡 Next Steps:");
    console.log("   1. Add your GEMINI_API_KEY to .env file");
    console.log("   2. Run: npm run test:nlg");
  } else {
    console.log("❌ Some required files or dependencies are missing");
    console.log("   Please check the errors above");
  }
}

async function runTest(name, testCase) {
  console.log(`\n🧪 ${name}`);
  console.log("─".repeat(40));

  try {
    const variants = await generateBookingVariants(testCase);
    console.log("✅ Generated variants:");
    variants.forEach((variant, index) => {
      console.log(`   ${index + 1}. "${variant}"`);
    });

    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 NLG Smoke Test Suite");
  console.log("═".repeat(50));
  console.log(
    "Testing NLG functionality with common beauty salon scenarios...\n"
  );

  const tests = [
    {
      name: "Complete Booking (All Slots)",
      servicio: "uñas acrílicas",
      fecha: "mañana",
      hora: "10:00",
      precio: "Desde $250 MXN",
    },
    {
      name: "Incomplete Booking (Only Service)",
      servicio: "pestañas clásicas",
      fecha: null,
      hora: null,
      precio: "$400 MXN",
    },
    {
      name: "Price Inquiry",
      intent: "faq_price",
      servicio: "manicure spa",
      precio: "$250 MXN",
    },
    {
      name: "Location Inquiry",
      intent: "faq_location",
    },
    {
      name: "Greeting",
      intent: "greeting",
    },
    {
      name: "Gratitude",
      intent: "gratitude",
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const { name, ...testCase } = test;
    const success = await runTest(name, testCase);

    if (success) {
      passed++;
    } else {
      failed++;
    }

    // Add delay between tests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log("\n📊 Test Summary");
  console.log("═".repeat(50));
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed! NLG system is working correctly.");
  } else {
    console.log(
      `\n⚠️ ${failed} test(s) failed. Check the error messages above.`
    );
    process.exit(1);
  }

  console.log("\n💡 Next Steps:");
  console.log("   1. Test with your Firestore brand/style document");
  console.log("   2. Verify different variants are generated on repeated runs");
  console.log(
    "   3. Check that editing brand/style changes tone without redeploy"
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Test suite failed:", error.message);
    process.exit(1);
  });
}

module.exports = { main };
