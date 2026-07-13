import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// 🌟 AJOUT : Importation du module d'authentification officiel de Firebase
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC-zOoJfL2LmW5MumympTQq5l2VdkL0uLU",
    authDomain: "rp-tracker-140ec.firebaseapp.com",
    projectId: "rp-tracker-140ec",
    storageBucket: "rp-tracker-140ec.firebasestorage.app",
    messagingSenderId: "160091122533",    
    appId: "1:160091122533:web:9c86f1fef71f1fcc744f8c"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
// 🌟 AJOUT : Exportation de la variable 'auth' requise par ton script d'authentification
export const auth = getAuth(app);