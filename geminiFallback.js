const { GoogleGenerativeAI } = require("@google/generative-ai");

console.log("📦 Loading Gemini module...");

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing from .env");
  throw new Error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });

console.log("✅ Gemini model initialized: gemini-pro");

const systemPrompt = `
Eres BeautyBot, la asistente profesional y cálida de Beauty Blossoms Studio, un salón de belleza en Zapopan, Jalisco.

Tu única tarea es:
1. Detectar la intención del usuario
2. Extraer los siguientes datos si están presentes:
   - servicio (uñas, pestañas, etc.)
   - fecha (hoy, mañana, martes, 10 de agosto, etc.)
   - hora (10am, 2:30pm, etc.)
3. Responder en español, en máximo 3 oraciones, con calidez profesional.

Responde en este formato JSON **exacto**:

{
  "intent": "book_appointment" | "greeting" | "gratitude" | "faq_price" | "faq_location" | "fallback",
  "slots": {
    "servicio": "string or null",
    "fecha": "string or null",
    "hora": "string or null"
  },
  "response": "respuesta cálida para WhatsApp"
}
`;

async function getGeminiReply(userText) {
  console.log("🧠 getGeminiReply called with input:", userText);

  try {
    const chat = await model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
      ],
    });

    console.log("💬 Chat session started successfully");
    console.log("📨 Sending user message to Gemini:", userText);

    const result = await chat.sendMessage(userText);

    console.log("✅ Gemini responded");
    const responseText = result.response.text().trim();
    console.log("📄 Raw Gemini response:\n", responseText);

    const jsonStart = responseText.indexOf("{");
    const jsonText = responseText.slice(jsonStart);

    console.log("🧾 Extracted JSON snippet:\n", jsonText);

    const parsed = JSON.parse(jsonText);

    console.log("✅ Parsed JSON response:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ Gemini fallback error:", err.message || err);
    return {
      intent: "fallback",
      slots: {},
      response:
        "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
    };
  }
}

module.exports = { getGeminiReply };
