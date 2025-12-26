// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// KEEP YOUR REAL CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyAWeJH8Z7z0k7Ify6n7BlCuqDAcmx8QQr0", 
  authDomain: "civicflow-hackathon.firebaseapp.com",
  projectId: "civicflow-hackathon",
  storageBucket: "civicflow-hackathon.firebasestorage.app", // It's okay to leave this here, we just won't use it
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
// export const storage = getStorage(app); <--- DELETED THIS LINE
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();