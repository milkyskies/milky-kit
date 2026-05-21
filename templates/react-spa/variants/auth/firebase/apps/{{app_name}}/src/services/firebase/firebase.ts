/// <reference types="vite/client" />

import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

// Reads VITE_FIREBASE_* directly from import.meta.env so we don't have to
// overlay the base config/env.ts file (which would collide on non-firebase
// scaffolds). Add `VITE_FIREBASE_*` to your `.env` from the Firebase
// Console (Project settings → General → Your apps → Web → SDK config).
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
