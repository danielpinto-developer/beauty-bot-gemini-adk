const { sendMessage } = require("./whatsapp");
const { getGeminiReply } = require("./geminiFallback");
const { db, admin } = require("./firebase");

const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const precios = {
  // 💅 NAIL BAR
  "manicure spa": "$250 MXN",
  "manicure ruso": "$180 MXN",
  "uñas acrílicas": "Desde $250 MXN",
  "uñas soft gel": "$350 MXN",
  gelish: "$180 MXN",
  rubber: "$200 MXN",
  "pedicure spa": "$400 MXN",
  acripie: "$300 MXN",
  "gelish en pies": "$200 MXN",

  // 👁️ LASH STUDIO
  "pestañas clásicas": "$400 MXN",
  "pestañas rimel": "$450 MXN",
  "pestañas híbridas": "$500 MXN",
  "pestañas mojado": "$450 MXN",
  "volumen hawaiano": "$600 MXN",
  "volumen ruso": "$600 MXN",
  "volumen americano": "$600 MXN",
  "pestañas efecto especial": "$600 MXN",
  "mega volumen": "$700 MXN",
  // 🎨 Estilos especiales extraídos de carta
  "pestañas chopy": "$600 MXN",
  "pestañas bratz": "$600 MXN",
  "pestañas wispy": "$600 MXN",
  "pestañas anime": "$600 MXN",
  "pestañas coreano": "$600 MXN",
  "pestañas foxy": "$600 MXN",
  "pestañas eye liner": "$600 MXN",
  "degradado de color": "$900 MXN",

  // 🧖‍♀️ BEAUTY LAB
  bblips: "$500 MXN",
  "bb glow": "$550 MXN",
  "relleno de labios": "$4900 MXN",

  // 👁️ CEJAS
  "lifting de pestañas": "$350 MXN",
  "lifting de cejas": "FALTANTE",
  "diseño de cejas hd": "$350 MXN",
  "diseño de cejas 4k": "$200 MXN",
  "consulta microblading": "$200 MXN",
  microblading: "De $2000 a $2800 MXN",
  "microshading pro": "De $2300 a $2500 MXN",

  // ✨ HAIR & GLOW
  "baño de color": "$400 MXN",
  tinte: "$600 MXN",
  matiz: "$400 MXN",
  "retoque de caña": "$650 MXN",
  "diseño de color": "Desde $1500 MXN",
  "corte de dama": "$350 MXN",
  keratina: "Desde $900 MXN",
  "nanoplastia japonesa": "Desde $800 MXN",
  "botox capilar": "Desde $700 MXN",
  "tratamiento capilar premium": "$550 MXN",

  // 🧽 DEPILACIÓN (Individual)
  bigote: "$80 MXN",
  cejas: "$100 MXN",
  patilla: "$200 MXN",
  barbilla: "$80 MXN",
  mejillas: "$150 MXN",
  axila: "$130 MXN",
  "piernas completas": "$550 MXN",
  "medias piernas": "$300 MXN",
  bikini: "$300 MXN",
  "bikini brasileño": "$350 MXN",
  "línea interglútea": "$150 MXN",
  "fosas nasales": "$80 MXN",
  "espalda completa": "$330 MXN",
  "media espalda baja": "$200 MXN",
  abdomen: "$200 MXN",
  "brazos completos": "$330 MXN",
  "medios brazos": "$200 MXN",
  "glúteos media": "$150 MXN",
  "glúteos completos": "$200 MXN",

  // 🎁 DEPILACIÓN (Paquetes)
  "cara completa 1": "$550 MXN",
  "cara completa 3": "$1,320 MXN",
  "cara completa 5": "$1,650 MXN",
  "piernas y brazos 1": "$650 MXN",
  "piernas y brazos 3": "$1,560 MXN",
  "piernas y brazos 5": "$1,950 MXN",
  "cuerpo completo 1": "$1,900 MXN",
  "cuerpo completo 3": "$2,640 MXN",
  "cuerpo completo 5": "$2,750 MXN",
};

const notifyMoni = async (phone, reason) => {
  console.log(`📣 Notify Moni: ${phone} needs manual follow-up (${reason})`);
};

async function logMessage({
  phone,
  text,
  sender,
  direction,
  intent,
  confidence,
  action,
  slots,
}) {
  const data = {
    text,
    sender,
    direction,
    timestamp: serverTimestamp(),
  };
  if (intent) data.intent = intent;
  if (confidence) data.confidence = confidence;
  if (action) data.action = action;
  if (slots) data.slots = slots;

  await admin
    .firestore()
    .collection("chats")
    .doc(phone)
    .collection("messages")
    .add(data);
}

function formatFecha(fechaStr) {
  const now = new Date();
  let targetDate;

  if (fechaStr?.toLowerCase() === "mañana") {
    targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 1);
  } else if (fechaStr?.toLowerCase() === "hoy") {
    targetDate = new Date(now);
  } else {
    return fechaStr;
  }

  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(targetDate)
    .replace(/\b\w/, (l) => l.toUpperCase());
}

async function messageDispatcher({ phone, text }) {
  console.log("📬 messageDispatcher", { phone, text });

  const { intent, slots, response } = await getGeminiReply(text);
  const { servicio, fecha, hora } = slots || {};

  await admin
    .firestore()
    .doc(`chats/${phone}`)
    .set({ last_updated: serverTimestamp() }, { merge: true });

  await logMessage({
    phone,
    text,
    sender: "user",
    direction: "inbound",
    intent,
    slots,
  });

  let replyText = response;

  if (intent === "book_appointment") {
    const price = servicio ? precios[servicio.toLowerCase()] : null;
    const fechaFormatted = formatFecha(fecha);

    if (fecha && hora && servicio) {
      replyText = `Perfecto 💅 Cita para *${servicio}* el *${fechaFormatted}* a las *${hora}*${
        price ? ` (costo: ${price})` : ""
      }. En unos momentos confirmamos la disponibilidad de tu cita ✨`;
    } else {
      const missing = [];
      if (!servicio) missing.push("servicio");
      if (!fecha) missing.push("fecha");
      if (!hora) missing.push("hora");
      replyText = `Solo necesito ${missing.join(", ")} para agendar tu cita 💅`;
    }

    await notifyMoni(
      phone,
      `Cita solicitada: ${fechaFormatted || "?"} ${hora || "?"} (${
        servicio || "?"
      })`
    );
  }

  if (intent === "faq_price" && servicio) {
    const price = precios[servicio.toLowerCase()];
    replyText = price
      ? `El precio de *${servicio}* es de ${price} 💵`
      : `Ese servicio tiene precios variables. ¿Te gustaría más información?`;
  }

  if (intent === "faq_location") {
    replyText = `📍 Ubicación: Beauty Blossoms \n(https://maps.app.goo.gl/CtavKUYUV3zyvaLU6)`;
  }

  if (intent === "gratitude") {
    replyText = `¡Con gusto hermosa! 💖 Estamos aquí para ti en Beauty Blossoms 🌸`;
  }

  if (intent === "greeting") {
    replyText = `¡Hola hermosa! 💖 ¿Te gustaría agendar unas uñas, pestañas o cejas? Cuéntame qué necesitas y para qué día.`;
  }

  await logMessage({
    phone,
    text: replyText,
    sender: "bot",
    direction: "outbound",
    intent,
    slots,
  });

  await sendMessage({ to: phone, text: replyText });
}

module.exports = { messageDispatcher };
