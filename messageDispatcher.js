const { sendMessage } = require("./whatsapp");
const { getGeminiReply } = require("./geminiFallback");
const { db, admin } = require("./firebase");
const { collection, addDoc, setDoc } = require("firebase-admin/firestore");

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

const formatDateString = (inputDate, inputTime) => {
  try {
    const now = new Date();
    const lowercaseInput = inputDate?.toLowerCase();

    const keywordDates = {
      hoy: now,
      mañana: new Date(now.getTime() + 86400000),
      pasado: new Date(now.getTime() + 2 * 86400000),
    };

    const targetDate = keywordDates[lowercaseInput]
      ? keywordDates[lowercaseInput]
      : new Date(inputDate); // fallback for '10 de agosto'

    const formatted = targetDate.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const capitalized = formatted.replace(/\b\w/g, (c) => c.toUpperCase());

    return `${capitalized} a las ${inputTime}`;
  } catch (err) {
    console.error("⚠️ Error formatting date:", inputDate, inputTime, err);
    return `${inputDate} a las ${inputTime}`;
  }
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

  await addDoc(collection(db, "chats", phone, "messages"), data);
}

async function messageDispatcher({ phone, text }) {
  console.log("📬 messageDispatcher", { phone, text });

  const { intent, slots, response } = await getGeminiReply(text);
  const { servicio, fecha, hora } = slots || {};

  const chatRef = db.doc(`chats/${phone}`);
  await setDoc(chatRef, { last_updated: serverTimestamp() }, { merge: true });

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

    if (fecha && hora && servicio) {
      const formattedDateTime = formatDateString(fecha, hora);
      replyText = `Perfecto 💅 Cita para *${servicio}* el *${formattedDateTime}*${
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
      `Cita solicitada: ${fecha || "?"} ${hora || "?"} (${servicio || "?"})`
    );
  }

  if (intent === "faq_price" && servicio) {
    const price = precios[servicio.toLowerCase()];
    replyText = price
      ? `El precio de *${servicio}* es de ${price} 💵`
      : `Ese servicio tiene precios variables. ¿Te gustaría más información?`;
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
