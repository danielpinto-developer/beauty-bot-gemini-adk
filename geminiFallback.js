const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");

console.log("📦 Loading Gemini module...");

// Keep support for tuned and base models
const hasTUNED = !!process.env.TUNED_MODEL_NAME;

if (hasTUNED) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is missing from env");
    throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
  }
  console.log(`⚡ Using tuned model name: ${process.env.TUNED_MODEL_NAME}`);
} else if (process.env.GEMINI_BASE_MODEL && process.env.GEMINI_API_KEY) {
  console.log(`⚡ Using base model: ${process.env.GEMINI_BASE_MODEL}`);
} else {
  throw new Error("No model configured");
}

const validServicios = [
  // 💅 NAIL BAR
  "manicure spa",
  "manicure ruso",
  "uñas acrílicas",
  "uñas soft gel",
  "gelish",
  "rubber",
  "pedicure spa",
  "acripie",
  "gelish en pies",

  // 👁️ LASH STUDIO
  "pestañas clásicas",
  "pestañas rimel",
  "pestañas híbridas",
  "pestañas mojado",
  "volumen hawaiano",
  "volumen ruso",
  "volumen americano",
  "pestañas efecto especial",
  "mega volumen",
  "chopy",
  "bratz",
  "wispy",
  "anime",
  "coreano",
  "foxy",
  "eye liner",
  "degradado de color",

  // 🧖‍♀️ BEAUTY LAB
  "bblips",
  "bb glow",
  "bb glow facial",
  "relleno de labios",
  "enzimas reductoras (corporal)",
  "armonización facial con enzimas",

  // 👁️ CEJAS
  "lifting de pestañas",
  "lifting de cejas",
  "diseño de cejas hd",
  "diseño de cejas 4k",
  "consulta microblading",
  "microblading",
  "microshading pro",

  // ✨ HAIR & GLOW
  "baño de color",
  "tinte",
  "matiz",
  "retoque de caña",
  "diseño de color",
  "corte de dama",
  "keratina",
  "nanoplastia japonesa",
  "botox capilar",
  "tratamiento capilar premium",

  // 🧽 DEPILACIÓN INDIVIDUAL
  "bigote",
  "cejas",
  "patilla",
  "barbilla",
  "mejillas",
  "axila",
  "piernas completas",
  "medias piernas",
  "piernas",
  "bikini",
  "bikini brasileño",
  "línea interglúeta",
  "fosas nasales",
  "espalda completa",
  "media espalda baja",
  "abdomen",
  "brazos completos",
  "brazos",
  "medios brazos",
  "glúteos media",
  "glúteos completos",

  // 🎁 DEPILACIÓN PAQUETES
  "cara completa 1",
  "cara completa 3",
  "cara completa 5",
  "piernas y brazos 1",
  "piernas y brazos 3",
  "piernas y brazos 5",
  "cuerpo completo 1",
  "cuerpo completo 3",
  "cuerpo completo 5",
];

function validateServicioKey(key) {
  if (!key) return null;
  const cleaned = key.toLowerCase().trim();
  return validServicios.includes(cleaned) ? cleaned : null;
}

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
    "servicio": "string o null",
    "fecha": "string o null",
    "hora": "string o null"
  },
  "response": "respuesta cálida para WhatsApp"
}

IMPORTANTE: el campo "servicio" debe coincidir exactamente con uno de los siguientes:
${validServicios.join(", ")}
`;

async function getGeminiReply(userText) {
  console.log("🧠 getGeminiReply called with input:", userText);

  try {
    let apiUrl;
    let headers = { "Content-Type": "application/json" };
    let requestBody;

    if (hasTUNED) {
      apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/${process.env.TUNED_MODEL_NAME}:generateContent`;
      console.log("🔧 Mode: tuned model (Vertex)");
      console.log("🔗 apiUrl:", apiUrl);

      console.log("🔑 Retrieving GoogleAuth token...");
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      const token = typeof accessToken === "string" ? accessToken : accessToken.token;
      headers = { ...headers, Authorization: `Bearer ${token}` };
      console.log("✅ Token acquired, headers set.");

      // Vertex tuned messages schema
      requestBody = {
        instances: [
          {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText },
            ],
          },
        ],
        parameters: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      };
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_BASE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      console.log("🔧 Mode: base model (API key)");
      console.log("🔗 apiUrl:", apiUrl);

      // Keep base model body (contents schema)
      requestBody = {
        contents: [
          { parts: [{ text: systemPrompt }] },
          { parts: [{ text: userText }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      };
    }

    console.log("🧾 Request body:", JSON.stringify(requestBody, null, 2));
    console.log("📨 Sending request to API...");
    const response = await axios.post(apiUrl, requestBody, { headers });

    console.log("📄 Full raw response:", JSON.stringify(response.data, null, 2));

    let rawText = "";
    if (hasTUNED) {
      // Many tuned endpoints still return candidates with content/parts when using generateContent.
      rawText =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        response.data?.predictions?.[0]?.content?.[0]?.parts?.[0]?.text ||
        "";
    } else {
      rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    console.log("📝 Raw Gemini text:", rawText);

    // Try to extract JSON block
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("⚠️ No JSON block found in response text");
      return {
        intent: "fallback",
        slots: { servicio: null, fecha: null, hora: null },
        response: rawText || "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
      };
    }

    const jsonText = jsonMatch[0];
    console.log("🧾 JSON snippet:", jsonText);

    console.log("🔎 Parsing JSON...");
    const parsed = JSON.parse(jsonText);
    console.log("✅ Parsed JSON:", parsed);

    console.log("🧹 Cleaning servicio slot...");
    const cleanedServicio = validateServicioKey(parsed.slots?.servicio);

    const result = {
      intent: parsed.intent || "fallback",
      slots: {
        servicio: cleanedServicio,
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
    console.error("❌ Gemini reply error:", err.message || err);
    if (err.response) {
      console.error("📄 Response status:", err.response.status);
      console.error("📄 Response data:", JSON.stringify(err.response.data, null, 2));
    }
    const fallback = {
      intent: "fallback",
      slots: { servicio: null, fecha: null, hora: null },
      response: "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
    };
    console.log("📦 getGeminiReply returning (fallback):", JSON.stringify(fallback));
    return fallback;
  }
}

module.exports = { getGeminiReply };
