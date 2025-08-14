require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 8080;

const { messageDispatcher } = require("./messageDispatcher");
const { handleUnsupportedMedia } = require("./mediaHandler");
const { db } = require("./firebase");
const { doc, getDoc, setDoc } = require("firebase-admin/firestore");

app.use(express.json());

// ✅ Webhook verification for Meta (GET /webhook)
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

// 📩 Message receiver (POST /webhook)
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

    // 🛡️ Deduplication logic
    const messageMetaRef = doc(db, "chats", phone, "metadata", "lastMessage");
    const previous = await getDoc(messageMetaRef);
    if (previous.exists() && previous.data().id === messageId) {
      console.log("🔁 Duplicate message detected. Skipping.");
      return res.status(200).send("Duplicate ignored");
    }
    await setDoc(messageMetaRef, { id: messageId });

    // 🖼️ Media handling
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

    // 🤖 NLP → Gemini Dispatcher
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
