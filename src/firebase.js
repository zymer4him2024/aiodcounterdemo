// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Detect environment from hostname - staging URLs contain "staging" or "aiodcounter03-staging"
const isStaging = 
  typeof window !== "undefined" && 
  (window.location.hostname.includes("staging") || 
   window.location.hostname.includes("aiodcounter03-staging"));

// Production Firebase config (default)
const productionConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBJmDqQ-8bBQsgmojc31CAquYO_rvi5EKY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "aiodcounterdemo.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "aiodcounterdemo",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "aiodcounterdemo.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "506429518378",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:506429518378:web:000429796be33d72d90953",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-9KD244LGND"
};

// Staging Firebase config
// Note: You may need to create a web app in staging project and get the actual config values
// For now, using production values but with staging projectId
const stagingConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY_STAGING || productionConfig.apiKey,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN_STAGING || "aiodcounter03-staging.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID_STAGING || "aiodcounter03-staging", // KEY: This must be staging project ID
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET_STAGING || "aiodcounter03-staging.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID_STAGING || productionConfig.messagingSenderId,
  appId: process.env.REACT_APP_FIREBASE_APP_ID_STAGING || productionConfig.appId,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID_STAGING || productionConfig.measurementId
};

const firebaseConfig = isStaging ? stagingConfig : productionConfig;

// Log which environment we're using (for debugging)
if (typeof window !== "undefined") {
  console.log(`🔥 Firebase initialized for: ${isStaging ? 'STAGING' : 'PRODUCTION'} (projectId: ${firebaseConfig.projectId})`);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Analytics (only in browser)
if (typeof window !== "undefined") {
  getAnalytics(app);
}





