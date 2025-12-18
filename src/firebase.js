// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBJmDqQ-8bBQsgmojc31CAquYO_rvi5EKY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "aiodcounterdemo.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "aiodcounterdemo",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "aiodcounterdemo.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "506429518378",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:506429518378:web:000429796be33d72d90953",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-9KD244LGND"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Analytics (only in browser)
if (typeof window !== "undefined") {
  getAnalytics(app);
}





