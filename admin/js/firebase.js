// ============================================================
//  firebase.js — Configuración e inicialización
//  GIStore Admin · SDK 12.10.0
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };