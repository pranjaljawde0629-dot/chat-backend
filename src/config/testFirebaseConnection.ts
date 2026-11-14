import { firestore } from "./firebase";

async function testFirebaseConnection() {
  try {
    await firestore.listCollections();

    console.log("Firebase Firestore connected successfully!");
  } catch (error) {
    console.error("Firebase connection failed:", error);
  }
}

testFirebaseConnection();