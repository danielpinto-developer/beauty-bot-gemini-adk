const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();

module.exports = { admin, db };
