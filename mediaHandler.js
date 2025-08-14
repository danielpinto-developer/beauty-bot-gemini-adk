// mediaHandler.js
function handleUnsupportedMedia(messageEntry) {
  const type = messageEntry.type;
  const phone = messageEntry.from;

  const unsupported = ["audio", "image", "sticker", "video", "document"];

  if (unsupported.includes(type)) {
    return {
      phone,
      response:
        "¡Gracias por tu mensaje! 🙌 Moni te responderá personalmente muy pronto ✨",
      action: "manual_media_review",
    };
  }

  return null; // text or interactive is fine
}

module.exports = { handleUnsupportedMedia };
