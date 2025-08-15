const { sendMessage } = require("./whatsapp");
const { getGeminiReply } = require("./geminiFallback");
const { db, admin } = require("./firebase");

const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const precios = {
  "uñas acrílicas": "$350 MXN",
  "pestañas clásicas": "$300 MXN",
  "lifting de cejas": "$280 MXN",
  "lifting de pestañas": "$280 MXN",
  bblips: "$400 MXN",
  acripie: "$220 MXN",
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
    replyText = `📍 Ubicación: Beauty Blossoms en Google Maps\nhttps://maps.app.goo.gl/CtavKUYUV3zyvaLU6`;
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

  return replyText; // 🔥 For testing return
}

module.exports = { messageDispatcher };
