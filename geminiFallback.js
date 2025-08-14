// geminiFallback.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Init Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt — how Gemini should behave
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
  "intent": "book_appointment" | "greeting" | "gratitude" | "faq_price" | "faq_location" | "fallback" | etc.,
  "slots": {
    "servicio": "string or null",
    "fecha": "string or null",
    "hora": "string or null"
  },
  "response": "respuesta cálida para WhatsApp"
}
`;

async function getGeminiReply(userText) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent([
      { role: "system", content: systemPrompt },
      { role: "user", content: userText },
    ]);

    const text = result.response.text().trim();

    // Parse JSON from Gemini reply
    const jsonStart = text.indexOf("{");
    const jsonText = text.slice(jsonStart);
    const parsed = JSON.parse(jsonText);

    return parsed;
  } catch (err) {
    console.error("❌ Gemini fallback error:", err);
    return {
      intent: "fallback",
      slots: {},
      response:
        "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
    };
  }
}

module.exports = { getGeminiReply };
