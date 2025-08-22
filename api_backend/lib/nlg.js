const { getGeminiReply } = require("../../geminiFallback");
const {
  getBrandStyle,
  getRandomCTAs,
  getRandomEmojis,
} = require("./brandStyle");
const {
  parseVariantsJSONSafe,
  generateFallbackVariants,
  deduplicateVariants,
} = require("./strictJson");

/**
 * Generate booking response variants using Gemini NLG
 * @param {Object} options - Options for generating variants
 * @param {string} options.servicio - Service name (optional)
 * @param {string} options.fecha - Date string (optional)
 * @param {string} options.hora - Time string (optional)
 * @param {string} options.precio - Price string (optional)
 * @param {string} options.intent - Intent type (default: 'book_appointment')
 * @returns {Promise<Array<string>>} Array of 3 variant response texts
 */
async function generateBookingVariants({
  servicio,
  fecha,
  hora,
  precio,
  intent = "book_appointment",
}) {
  try {
    console.log("🎨 generateBookingVariants called with:", {
      servicio,
      fecha,
      hora,
      precio,
      intent,
    });

    // Get brand style configuration
    const brandStyle = await getBrandStyle();
    console.log("📋 Using brand style:", brandStyle.brand, brandStyle.vibe);

    // Build facts from available data
    const facts = [];
    if (servicio) facts.push(`servicio: ${servicio}`);
    if (fecha) facts.push(`fecha: ${fecha}`);
    if (hora) facts.push(`hora: ${hora}`);
    if (precio) facts.push(`precio: ${precio}`);

    // Determine if this is a confirmation or request for more info
    const hasAllSlots = servicio && fecha && hora;
    const action = hasAllSlots
      ? "confirmar la cita"
      : "solicitar información faltante";

    // Create NLG prompt in Spanish
    const nlgPrompt = `
Eres BeautyBot, asistente de ${brandStyle.brand}.
Tu estilo es: ${brandStyle.vibe}.
Emojis permitidos: ${brandStyle.allowed_emojis.join(", ")}.
Llamados a acción: ${brandStyle.ctas.join(", ")}.
Máximo ${brandStyle.max_chars} caracteres por respuesta.

Datos disponibles:
${
  facts.length > 0
    ? facts.map((f) => `- ${f}`).join("\n")
    : "No hay datos específicos"
}

Genera exactamente 3 variantes de respuesta en español para: ${action}

Instrucciones específicas:
- Si tienes TODOS los datos (servicio, fecha, hora): confirma la cita de forma cálida y profesional
- Si faltan datos: pregunta SÓLO por la información faltante + un CTA breve
- Mantén un tono ${brandStyle.vibe}
- Usa emojis de la lista permitida (máximo 2 por respuesta)
- Incluye CTAs del listado cuando sea apropiado
- Respuestas cortas, máximo ${brandStyle.max_chars} caracteres
- NO incluyas precios inventados ni enlaces
- Si hay precio en los datos, inclúyelo como "costo: ${precio}"

Respuesta en formato JSON exacto:
{
  "variants": [
    { "text": "Primera variante aquí" },
    { "text": "Segunda variante aquí" },
    { "text": "Tercera variante aquí" }
  ]
}
`;

    // Get Gemini response using existing client
    const geminiResponse = await getGeminiReply(nlgPrompt);

    // Extract variants from response
    let variants = [];
    if (geminiResponse.response) {
      variants = parseVariantsJSONSafe(geminiResponse.response);
    }

    // If we don't have 3 valid variants, use fallbacks
    if (variants.length !== 3) {
      console.warn(
        `⚠️ NLG returned ${variants.length} variants, using fallbacks`
      );
      variants = generateFallbackVariants(intent, {
        servicio,
        fecha,
        hora,
        precio,
      });
    }

    // Deduplicate similar variants
    variants = deduplicateVariants(variants);

    // Ensure we have exactly 3 variants
    while (variants.length < 3) {
      const fallbackVariants = generateFallbackVariants(intent, {
        servicio,
        fecha,
        hora,
        precio,
      });
      variants.push(...fallbackVariants.slice(variants.length - 3));
    }

    variants = variants.slice(0, 3);

    console.log("✅ Generated variants:", variants);
    return variants;
  } catch (error) {
    console.error("❌ NLG generation error:", error.message);

    // Return fallback variants
    const fallbacks = generateFallbackVariants(intent, {
      servicio,
      fecha,
      hora,
      precio,
    });
    console.log("📦 Using fallback variants:", fallbacks);
    return fallbacks;
  }
}

/**
 * Generate variants for different intent types
 * @param {string} intent - Intent type
 * @param {Object} slots - Available slots
 * @returns {Promise<Array<string>>} Array of variant response texts
 */
async function generateIntentVariants(intent, slots = {}) {
  const { servicio, fecha, hora } = slots;

  switch (intent) {
    case "book_appointment":
      return await generateBookingVariants({ servicio, fecha, hora, intent });

    case "faq_price":
      return await generateBookingVariants({
        servicio,
        intent: "faq_price",
        precio: null, // Price will be handled by dispatcher
      });

    case "faq_location":
      return await generateBookingVariants({
        intent: "faq_location",
      });

    case "greeting":
      return await generateBookingVariants({
        intent: "greeting",
      });

    case "gratitude":
      return await generateBookingVariants({
        intent: "gratitude",
      });

    default:
      return await generateBookingVariants({
        intent: "fallback",
      });
  }
}

module.exports = {
  generateBookingVariants,
  generateIntentVariants,
};
