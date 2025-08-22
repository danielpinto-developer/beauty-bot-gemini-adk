const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");

console.log("📦 Loading Gemini module...");

// Force tuned endpoint usage
if (!process.env.TUNED_MODEL_ENDPOINT) {
  console.error("❌ TUNED_MODEL_ENDPOINT is missing from env");
  throw new Error("Missing TUNED_MODEL_ENDPOINT");
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is missing from env");
  throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
}

console.log(`⚡ Using tuned model endpoint: ${process.env.TUNED_MODEL_ENDPOINT}`);

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
`;

async function getGeminiReply(userText) {
  console.log("🧠 getGeminiReply called with input:", userText);

  try {
    const apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/${process.env.TUNED_MODEL_ENDPOINT}:predict`;
    console.log("🔧 Mode: tuned endpoint only");
    console.log("🔗 apiUrl:", apiUrl);

    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken.token;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const requestBody = {
      instances: [
        {
          content: {
            role: "user",
            parts: [{ text: userText }],
          },
        },
      ],
      parameters: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    };

    console.log("📨 Sending request to Vertex AI Predict");
    const response = await axios.post(apiUrl, requestBody, { headers });

    console.log("📄 Full raw response:", JSON.stringify(response.data, null, 2));
    const text =
      response.data?.predictions?.[0]?.content?.[0]?.parts?.[0]?.text || "";

    console.log("📝 Extracted text:", text);
    return text || "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?";
  } catch (err) {
    console.error("❌ Gemini tuned endpoint error:", err.message || err);
    if (err.response) {
      console.error("📄 Response status:", err.response.status);
      console.error(
        "📄 Response data:",
        JSON.stringify(err.response.data, null, 2)
      );
    }
    return "Lo siento, no entendí muy bien eso 🤖 ¿Podrías decírmelo de otra forma?";
  }
}

module.exports = { getGeminiReply };
