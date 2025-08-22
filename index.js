require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 8080;

const { messageDispatcher } = require("./messageDispatcher");
const { handleUnsupportedMedia } = require("./mediaHandler");
const { admin, db } = require("./firebase");

// Startup logging (redact secrets)
(function startupLogs() {
  const redactedEnv = {
    NODE_ENV: process.env.NODE_ENV || "",
    PORT: process.env.PORT || "",
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || "",
    GCP_LOCATION: process.env.GCP_LOCATION || "",
    TUNED_MODEL_NAME: process.env.TUNED_MODEL_NAME || "",
    GEMINI_BASE_MODEL: process.env.GEMINI_BASE_MODEL || "",
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  };
  console.log("🔧 Environment (redacted):", redactedEnv);

  const hasTuned = !!process.env.TUNED_MODEL_NAME;
  const hasBase = !!(process.env.GEMINI_BASE_MODEL && process.env.GEMINI_API_KEY);
  console.log("🧭 Model mode:", hasTuned ? "tuned" : hasBase ? "base" : "none");

  if (hasTuned && (!process.env.GCP_PROJECT_ID || !process.env.GCP_LOCATION)) {
    throw new Error("models/undefined: GCP project/location missing for tuned mode");
  }
  if (!hasTuned && !hasBase) {
    throw new Error("No model configured (neither tuned nor base)");
  }
})();

app.use(express.json());

app.post("/", async (req, res) => {
  const { phone, text } = req.body;

  try {
    await messageDispatcher({ phone, text });
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("Webhook failed");
  }
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "beauty-bot-token";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verify hit");
  console.log("  mode:", mode);
  console.log("  token:", token);
  console.log("  challenge:", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("❌ Token mismatch or bad mode");
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!messageEntry) {
      console.log("⚠️ No message found in webhook payload.");
      return res.status(200).send("No message to process");
    }

    const phone = messageEntry.from;
    const messageText = messageEntry.text?.body;
    const messageId = messageEntry.id;

    if (!phone || !messageText) {
      console.log("❌ Missing phone or message text");
      return res.status(200).send("Invalid payload");
    }

    console.log("📞 From:", phone);
    console.log("💬 Text:", messageText);

    const messageMetaRef = db.doc(`chats/${phone}/metadata/lastMessage`);
    const previous = await messageMetaRef.get();
    if (previous.exists && previous.data().id === messageId) {
      console.log("🔁 Duplicate message detected. Skipping.");
      return res.status(200).send("Duplicate ignored");
    }
    await messageMetaRef.set({ id: messageId });

    const mediaCheck = handleUnsupportedMedia(messageEntry);
    if (mediaCheck) {
      await messageDispatcher({
        phone: mediaCheck.phone,
        text: `[${messageEntry.type} message]`,
        nlpResult: {
          intent: "media",
          action: mediaCheck.action,
          response: mediaCheck.response,
        },
        slotResult: {},
      });
      return res.status(200).send("Media handled");
    }

    await messageDispatcher({ phone, text: messageText });
    return res.status(200).send("Message processed");
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return res.status(500).send("Internal server error");
  }
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Gemini BeautyBot server is running.");
});

app.listen(port, () => {
  console.log(`🚀 Server live on port ${port}`);
});
