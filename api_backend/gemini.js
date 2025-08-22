const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");

// getGeminiReply: tuned (Vertex) or base (API key)
async function getGeminiReply(userText) {
  console.log("🧠 getGeminiReply called with input:", userText);

  const hasTuned = !!process.env.TUNED_MODEL_NAME;
  let apiUrl;
  let headers = { "Content-Type": "application/json" };
  let requestBody;

  try {
    if (hasTuned) {
      console.log("⚡ Mode: tuned (Vertex generateContent) with full TUNED_MODEL_NAME");
      apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/${process.env.TUNED_MODEL_NAME}:generateContent`;
      console.log("🔗 apiUrl:", apiUrl);

      console.log("🔑 Retrieving GoogleAuth token...");
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      const token = typeof accessToken === "string" ? accessToken : accessToken.token;
      headers = { ...headers, Authorization: `Bearer ${token}` };
      const headersSafe = { ...headers, Authorization: "Bearer <omitted>" };
      console.log("🪪 Headers (redacted):", JSON.stringify(headersSafe));

      requestBody = {
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      };
    } else {
      if (!process.env.GEMINI_BASE_MODEL || !process.env.GEMINI_API_KEY) {
        throw new Error("Base mode selected but GEMINI_BASE_MODEL or GEMINI_API_KEY missing");
      }
      console.log("⚡ Mode: base (Generative Language API key)");
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_BASE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      console.log("🔗 apiUrl:", apiUrl);
      console.log("🪪 Headers:", JSON.stringify(headers));

      requestBody = {
        contents: [
          { parts: [{ text: "" }] },
          { parts: [{ text: userText }] },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      };
    }

    console.log("🧾 Request body:", JSON.stringify(requestBody, null, 2));
    const resp = await axios.post(apiUrl, requestBody, { headers });

    console.log("📄 Raw response:", JSON.stringify(resp.data, null, 2));
    const raw = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📝 Raw text:", raw);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("⚠️ No JSON block found in model output. Returning fallback.");
      return {
        intent: "fallback",
        slots: { servicio: null, fecha: null, hora: null },
        response: raw || "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
      };
    }

    const jsonText = jsonMatch[0];
    console.log("🧾 JSON snippet:", jsonText);
    const parsed = JSON.parse(jsonText);
    console.log("✅ Parsed:", parsed);

    const result = {
      intent: parsed.intent || "fallback",
      slots: {
        servicio: parsed.slots?.servicio || null,
        fecha: parsed.slots?.fecha || null,
        hora: parsed.slots?.hora || null,
      },
      response:
        parsed.response ||
        "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
    };

    console.log("📦 getGeminiReply returning:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("❌ getGeminiReply error:", err.message || err);
    if (err.response) {
      console.error("📄 Response status:", err.response.status);
      console.error("📄 Response data:", JSON.stringify(err.response.data, null, 2));
    }
    const fb = {
      intent: "fallback",
      slots: { servicio: null, fecha: null, hora: null },
      response: "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
    };
    console.log("📦 getGeminiReply returning (fallback):", JSON.stringify(fb));
    return fb;
  }
}

module.exports = { getGeminiReply };
