#!/usr/bin/env node
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Storage } = require("@google-cloud/storage");
const { GoogleAuth } = require("google-auth-library");

const MESSAGES_JSONL = path.join(
  __dirname,
  "..",
  "artifacts",
  "ft_messages.jsonl"
);

async function uploadJsonlToGcs(localPath, bucketName, objectPath) {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  await bucket.upload(localPath, {
    destination: objectPath,
    metadata: { contentType: "application/json" },
  });
  const uri = `gs://${bucketName}/${objectPath}`;
  console.log(`📤 Uploaded training data to ${uri}`);
  return uri;
}

async function main() {
  console.log("🚀 Starting fine-tuning submission...");

  // Validate environment
  const requiredEnv = [
    "GCP_PROJECT_ID",
    "GCP_LOCATION",
    "GCS_BUCKET",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`${key} environment variable is required`);
    }
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION;
  const bucketName = process.env.GCS_BUCKET;

  // Ensure training file exists
  if (!fs.existsSync(MESSAGES_JSONL)) {
    throw new Error(
      `Training file not found: ${MESSAGES_JSONL}. Run 'npm run ft:prepare' first.`
    );
  }

  const timestamp = Date.now();
  const baseModel = "publishers/google/models/gemini-2.5-flash-001";
  console.log(`🤖 Base model: ${baseModel}`);

  // Upload JSONL as-is to GCS
  const objectPath = `beautybot/training_${timestamp}.jsonl`;
  const trainingDatasetUri = await uploadJsonlToGcs(
    MESSAGES_JSONL,
    bucketName,
    objectPath
  );

  // Prepare auth
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const parent = `projects/${projectId}/locations/${location}`;
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/${parent}/tuningJobs`;

  const requestBody = {
    displayName: `beautybot-job-${timestamp}`,
    baseModel,
    supervisedTuningSpec: {
      trainingDatasetUri,
    },
    tunedModelDisplayName: `beautybot-gemini-tuned-${timestamp}`,
  };

  console.log("\n🚀 Creating tuning job via Vertex AI...");
  console.log(`Parent: ${parent}`);
  console.log(`Training data: ${trainingDatasetUri}`);

  const resp = await axios.post(
    endpoint,
    { tuningJob: requestBody },
    {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = resp.data;
  console.log(`✅ Fine-tuning job created → ${data.name} (Gemini 2.5 Flash)`);

  const jobInfo = {
    name: data.name,
    displayName: data.displayName,
    state: data.state,
    baseModel: data.baseModel || baseModel,
    tunedModelDisplayName: data.tunedModelDisplayName,
    submittedAt: new Date().toISOString(),
  };

  const jobInfoPath = path.join(__dirname, "..", "artifacts", "last_job.json");
  fs.writeFileSync(jobInfoPath, JSON.stringify(jobInfo, null, 2));
  console.log("💾 Job info saved to artifacts/last_job.json");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Error during submission:", error.message);
    if (error.response) {
      console.error("📄 Response status:", error.response.status);
      console.error(
        "📄 Response data:",
        typeof error.response.data === "string"
          ? error.response.data
          : JSON.stringify(error.response.data, null, 2)
      );
    }
    process.exit(1);
  });
}

module.exports = { main };
