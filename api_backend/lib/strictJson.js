/**
 * Strict JSON parsing and validation helpers
 */

/**
 * Parse JSON with better error handling
 * @param {string} jsonString - JSON string to parse
 * @returns {Object} Parsed JSON object
 * @throws {Error} If JSON is invalid
 */
function parseJSON(jsonString) {
  if (!jsonString || typeof jsonString !== "string") {
    throw new Error("Invalid input: expected non-empty string");
  }

  try {
    return JSON.parse(jsonString.trim());
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}`);
  }
}

/**
 * Validate that object has required structure for variants response
 * @param {Object} obj - Object to validate
 * @returns {boolean} True if valid
 */
function validateVariantsResponse(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  if (!Array.isArray(obj.variants)) {
    return false;
  }

  if (obj.variants.length !== 3) {
    return false;
  }

  return obj.variants.every(
    (variant) =>
      typeof variant === "object" &&
      variant !== null &&
      typeof variant.text === "string" &&
      variant.text.trim().length > 0
  );
}

/**
 * Extract and validate JSON from text that may contain extra content
 * @param {string} text - Text containing JSON
 * @returns {Object} Validated JSON object
 * @throws {Error} If no valid JSON found or validation fails
 */
function extractAndValidateVariantsJSON(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid input: expected non-empty string");
  }

  // Try to find JSON block in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in response");
  }

  const jsonString = jsonMatch[0];
  const parsed = parseJSON(jsonString);

  if (!validateVariantsResponse(parsed)) {
    throw new Error("Invalid variants response structure");
  }

  return parsed;
}

/**
 * Safely parse variants JSON with fallback
 * @param {string} text - Text containing JSON
 * @param {Array<string>} fallbacks - Fallback variants if parsing fails
 * @returns {Array<string>} Array of variant texts
 */
function parseVariantsJSONSafe(text, fallbacks = []) {
  try {
    const parsed = extractAndValidateVariantsJSON(text);
    return parsed.variants.map((v) => v.text.trim());
  } catch (error) {
    console.warn("Variants JSON parsing failed:", error.message);
    return fallbacks;
  }
}

/**
 * Generate fallback variants for common scenarios
 * @param {string} intent - The intent type
 * @param {Object} slots - Available slots
 * @returns {Array<string>} Fallback variant texts
 */
function generateFallbackVariants(intent, slots = {}) {
  const { servicio, fecha, hora } = slots;

  switch (intent) {
    case "book_appointment":
      if (servicio && fecha && hora) {
        return [
          `¡Perfecto! Tu cita para ${servicio} está confirmada para el ${fecha} a las ${hora}. 💅`,
          `Excelente elección. Te esperamos el ${fecha} a las ${hora} para tu ${servicio}. ✨`,
          `¡Listo! Tu cita de ${servicio} queda agendada para el ${fecha} a las ${hora}. 💖`,
        ];
      } else {
        const missing = [];
        if (!servicio) missing.push("servicio");
        if (!fecha) missing.push("fecha");
        if (!hora) missing.push("hora");
        return [
          `Solo necesito ${missing.join(", ")} para agendar tu cita. 💅`,
          `Para confirmar tu cita, necesito saber ${missing.join(
            ", "
          )}. ¿Me los puedes proporcionar? ✨`,
          `¡Con gusto te ayudo! Solo falta ${missing.join(
            ", "
          )} para agendar. 💖`,
        ];
      }

    case "faq_price":
      if (servicio) {
        return [
          `El precio del ${servicio} varía según el tratamiento. ¿Te gustaría más detalles? 💅`,
          `Para el ${servicio} tenemos diferentes opciones. ¿Quieres que te explique los precios? ✨`,
          `¡Claro! Los precios del ${servicio} dependen de varios factores. ¿Te doy más información? 💖`,
        ];
      }
      return [
        "¿De qué servicio te gustaría saber el precio? 💅",
        "¡Con gusto te informo! ¿Qué servicio te interesa? ✨",
        "Para darte información precisa, ¿cuál es el servicio? 💖",
      ];

    case "faq_location":
      return [
        "📍 Ubicación: Beauty Blossoms (https://maps.app.goo.gl/CtavKUYUV3zyvaLU6)",
        "¡Te esperamos en Beauty Blossoms! 📍 (https://maps.app.goo.gl/CtavKUYUV3zyvaLU6)",
        "Nuestra dirección: 📍 Beauty Blossoms (https://maps.app.goo.gl/CtavKUYUV3zyvaLU6)",
      ];

    case "greeting":
      return [
        "¡Hola hermosa! 💖 ¿Te gustaría agendar unas uñas, pestañas o cejas?",
        "¡Hola! ✨ ¿En qué podemos ayudarte hoy? Uñas, pestañas, cejas...",
        "¡Hola hermosa! 🌸 ¿Listas para consentirte? ¿Uñas, pestañas o cejas?",
      ];

    case "gratitude":
      return [
        "¡Con gusto hermosa! 💖 Estamos aquí para ti en Beauty Blossoms 🌸",
        "¡Es un placer ayudarte! ✨ ¡Nos vemos pronto!",
        "¡De nada! 💅 ¡Te esperamos en Beauty Blossoms!",
      ];

    default:
      return [
        "¡Con gusto te ayudo! ¿En qué más puedo asistirte?",
        "¿Hay algo más en lo que pueda ayudarte? 💖",
        "¡Estoy aquí para ti! ¿Qué más necesitas? ✨",
      ];
  }
}

/**
 * Deduplicate similar variants while maintaining order
 * @param {Array<string>} variants - Array of variant texts
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array<string>} Deduplicated variants
 */
function deduplicateVariants(variants, threshold = 0.8) {
  if (variants.length <= 1) return variants;

  const result = [variants[0]];

  for (let i = 1; i < variants.length; i++) {
    const current = variants[i].toLowerCase().trim();
    let isDuplicate = false;

    for (const existing of result) {
      const similarity = calculateSimilarity(
        current,
        existing.toLowerCase().trim()
      );
      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(variants[i]);
    }
  }

  return result;
}

/**
 * Calculate string similarity using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity ratio (0-1)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

module.exports = {
  parseJSON,
  validateVariantsResponse,
  extractAndValidateVariantsJSON,
  parseVariantsJSONSafe,
  generateFallbackVariants,
  deduplicateVariants,
  calculateSimilarity,
  levenshteinDistance,
};
