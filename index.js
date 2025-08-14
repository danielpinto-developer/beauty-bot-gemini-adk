require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 8080;

const { messageDispatcher } = require("./messageDispatcher");
const { handleUnsupportedMedia } = require("./mediaHandler");

const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} = require("firebase-admin/firestore");
const db = getFirestore();

app.use(express.json());

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "beauty-bot-token";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("\uD83D\uDD0D Webhook verify hit");
  console.log("  mode:", mode);
  console.log("  token:", token);
  console.log("  challenge:", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("\u2705 Webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("\u274C Token mismatch or bad mode");
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!messageEntry) {
      console.log("\u26A0\uFE0F No message found in webhook payload.");
      return res.status(200).send("No message to process");
    }

    const phone = messageEntry.from;
    const messageText = messageEntry.text?.body;
    const messageId = messageEntry.id;

    if (!phone || !messageText) {
      console.log("\u274C Missing phone or message text");
      return res.status(200).send("Invalid payload");
    }

    console.log("\uD83D\uDCDE From:", phone);
    console.log("\uD83D\uDCAC Text:", messageText);

    const messageMetaRef = doc(db, "chats", phone, "metadata", "lastMessage");
    const previous = await getDoc(messageMetaRef);
    if (previous.exists() && previous.data().id === messageId) {
      console.log("\uD83D\uDD01 Duplicate message detected. Skipping.");
      return res.status(200).send("Duplicate ignored");
    }
    await setDoc(messageMetaRef, { id: messageId });

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
    console.error("\u274C Webhook error:", error);
    return res.status(500).send("Internal server error");
  }
});

app.get("/", (req, res) => {
  res.send("\u2705 Gemini BeautyBot server is running.");
});

app.listen(port, () => {
  console.log(`\uD83D\uDE80 Server live on port ${port}`);
});
