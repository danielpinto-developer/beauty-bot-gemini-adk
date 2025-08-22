const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");

console.log("📦 Loading Gemini module...");

const hasTuned = !!process.env.TUNED_MODEL_NAME;

if (hasTuned) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is missing from env");
    throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
  }
  console.log(`⚡ Using tuned model: ${process.env.TUNED_MODEL_NAME}`);
} else if (process.env.GEMINI_BASE_MODEL) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing from .env");
    throw new Error("Missing GEMINI_API_KEY");
  }
  console.log(`⚡ Using base model: ${process.env.GEMINI_BASE_MODEL}`);
} else {
  throw new Error("No model configured");
}

// Build modelName, stripping any '@version' suffix when using tuned model
const rawName = process.env.TUNED_MODEL_NAME;
const modelName = hasTuned
  ? String(rawName || "").split("@")[0]
  : `models/${process.env.GEMINI_BASE_MODEL}`;

console.log(`✅ Gemini model initialized: ${modelName}`);

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
    "servicio": "string or null",
    "fecha": "string or null",
    "hora": "string or null"
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

    if (hasTuned) {
      const tunedNameNoVersion = modelName; // modelName already stripped
      apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/${tunedNameNoVersion}:generateContent`;
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      const token = typeof accessToken === "string" ? accessToken : accessToken.token;
      headers = { ...headers, Authorization: `Bearer ${token}` };
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    }

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
        {
          parts: [
            {
              text: userText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    console.log("📨 Sending request to Gemini API");
    const response = await axios.post(apiUrl, requestBody, { headers });

    console.log("✅ Gemini responded");
    const raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📄 Raw Gemini response:\n", raw);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON block found");

    const jsonText = jsonMatch[0];
    console.log("🧾 Extracted JSON snippet:\n", jsonText);

    const parsed = JSON.parse(jsonText);
    console.log("✅ Parsed JSON response:", parsed);

    const cleanedServicio = validateServicioKey(parsed.slots?.servicio);

    return {
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
  } catch (err) {
    console.error("❌ Gemini fallback error:", err.message || err);
    if (err.response) {
      console.error("📄 Response status:", err.response.status);
      console.error(
        "📄 Response data:",
        JSON.stringify(err.response.data, null, 2)
      );
    }
    return {
      intent: "fallback",
      slots: {
        servicio: null,
        fecha: null,
        hora: null,
      },
      response:
        "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?",
    };
  }
}

module.exports = { getGeminiReply };
