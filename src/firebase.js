import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjT-gLMu6o1Q0V7uNZHILhc03T5hq5Rf8",
  authDomain: "interview-bot-5751b.firebaseapp.com",
  projectId: "interview-bot-5751b",
  storageBucket: "interview-bot-5751b.firebasestorage.app",
  messagingSenderId: "546731189961",
  appId: "1:546731189961:web:d0548948ff89a0c951cf18",
  measurementId: "G-Q504MCGN97"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);