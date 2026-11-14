import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = require("../../firebase-service-account.json");

const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

export const firestore = getFirestore(firebaseApp);