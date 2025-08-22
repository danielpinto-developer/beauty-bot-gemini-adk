const { db } = require("../../firebase");

let cachedBrandStyle = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

// Default brand/style configuration
const DEFAULT_BRAND_STYLE = {
  brand: "Beauty Blossoms Studio",
  locale: "es-MX",
  vibe: "warm, professional, and feminine",
  allowed_emojis: ["💅", "✨", "💖", "🌸", "💄", "🧴", "💆‍♀️", "🎀"],
  ctas: [
    "¿Te gustaría agendar una cita?",
    "¿Cuándo te gustaría venir?",
    "¡Con gusto te atendemos!",
    "Estamos aquí para ti",
    "¡Será un placer atenderte!",
  ],
  max_chars: 280,
};

/**
 * Get brand/style configuration from Firestore with caching
 * @returns {Promise<Object>} Brand style configuration
 */
async function getBrandStyle() {
  const now = Date.now();

  // Return cached version if still valid
  if (
    cachedBrandStyle &&
    cacheTimestamp &&
    now - cacheTimestamp < CACHE_DURATION
  ) {
    return cachedBrandStyle;
  }

  try {
    console.log("🔄 Fetching brand/style from Firestore...");
    const docRef = db.collection("config").doc("brand_style");
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      cachedBrandStyle = {
        ...DEFAULT_BRAND_STYLE,
        ...data,
        // Ensure arrays are present with fallbacks
        allowed_emojis:
          data.allowed_emojis || DEFAULT_BRAND_STYLE.allowed_emojis,
        ctas: data.ctas || DEFAULT_BRAND_STYLE.ctas,
      };
      cacheTimestamp = now;
      console.log("✅ Brand/style loaded from Firestore");
      return cachedBrandStyle;
    } else {
      console.log("⚠️ Brand/style document not found, using defaults");
      cachedBrandStyle = DEFAULT_BRAND_STYLE;
      cacheTimestamp = now;
      return DEFAULT_BRAND_STYLE;
    }
  } catch (error) {
    console.error("❌ Error fetching brand/style:", error.message);
    // Return cached version if available, otherwise defaults
    if (cachedBrandStyle) {
      console.log("📦 Using cached brand/style due to error");
      return cachedBrandStyle;
    }
    console.log("📦 Using default brand/style due to error");
    cachedBrandStyle = DEFAULT_BRAND_STYLE;
    cacheTimestamp = now;
    return DEFAULT_BRAND_STYLE;
  }
}

/**
 * Force refresh the brand/style cache
 * @returns {Promise<Object>} Fresh brand style configuration
 */
async function refreshBrandStyle() {
  cachedBrandStyle = null;
  cacheTimestamp = null;
  return await getBrandStyle();
}

/**
 * Get random CTAs from the brand style
 * @param {Object} brandStyle - Brand style configuration
 * @param {number} count - Number of CTAs to return
 * @returns {Array<string>} Random CTAs
 */
function getRandomCTAs(brandStyle, count = 1) {
  const ctas = brandStyle?.ctas || DEFAULT_BRAND_STYLE.ctas;
  const shuffled = [...ctas].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Get random emojis from the brand style
 * @param {Object} brandStyle - Brand style configuration
 * @param {number} count - Number of emojis to return
 * @returns {Array<string>} Random emojis
 */
function getRandomEmojis(brandStyle, count = 1) {
  const emojis =
    brandStyle?.allowed_emojis || DEFAULT_BRAND_STYLE.allowed_emojis;
  const shuffled = [...emojis].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = {
  getBrandStyle,
  refreshBrandStyle,
  getRandomCTAs,
  getRandomEmojis,
  DEFAULT_BRAND_STYLE,
};
