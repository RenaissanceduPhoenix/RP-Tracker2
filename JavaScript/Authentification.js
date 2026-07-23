// =========================================================================
// 🌐 CENTRALISATEUR D'AUTHENTIFICATION ET DE CHARGEMENT DYNAMIQUE
// =========================================================================
import { db, auth } from "./Firebase.js"; 
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

document.addEventListener("DOMContentLoaded", () => {
    const loginScreen = document.getElementById("login-screen");
    const mainDashboard = document.getElementById("main-dashboard");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const errorMessage = document.getElementById("error-message");

    // Sécurité visuelle immédiate : on cache TOUT au départ
    if (loginScreen) loginScreen.classList.add("hidden");
    if (mainDashboard) mainDashboard.classList.add("hidden");

    // =========================================================================
    // 🔄 L'AIGUILLAGE CENTRAL
    // =========================================================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log(`👤 Connecté : ${user.email}`);
            if (loginScreen) loginScreen.classList.add("hidden");
            
            try {
                console.log("⏳ Chargement sécurisé des modules applicatifs...");
                
                // 🚀 CHARGEMENT DYNAMIQUE DE TOUS TES SCRIPTS (Uniquement si connecté !)
                await Promise.all([
                    import("./Markdown.js?v=2.5"),
                    import("./RP.js?v=5"),
                    import("./FeaturesBonus/UrgencyTags.js"),
                    import("./FeaturesBonus/alertes_inactivite.js?v=2"),
                    import("./Chart.js"),
                    import("./FeaturesBonus/Tags.js"),
                    import("./FeaturesBonus/CharacterGalery.js?v=2.4"),
                    import("./FeaturesBonus/PersoAffichage.js?v=2.4"),
                    import("./FeaturesBonus/AICoachs.js?v=16.9"),
                    import("./FeaturesBonus/CharacterData.js?v=2.4"),
                    import("./FeaturesBonus/RpHistorySummary.js?v=2.2"),
                    import("./Firebase.js"),
                    import("./FeaturesBonus/Thème.js")
                ]);

                console.log("📚 Tous les scripts de jeu ont été importés et exécutés avec succès.");
                
                // On affiche enfin le dashboard complet une fois que tout est prêt
                if (mainDashboard) { mainDashboard.classList.remove("hidden");
// 🌟 AJOUT : On signale que le dashboard est affiché et prêt
document.dispatchEvent(new CustomEvent("dashboard-pret")); }
                
            } catch (err) {
                console.error("❌ Erreur lors du chargement des modules :", err);
            }
            
        } else {
            console.log("🔒 Non connecté -> Écran de connexion unique.");
            if (mainDashboard) mainDashboard.classList.add("hidden");
            if (loginScreen) loginScreen.classList.remove("hidden");
        }
    });

    // =========================================================================
    // ⚡ ACTIONS DES BOUTONS
    // =========================================================================
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            if (errorMessage) errorMessage.classList.add("hidden");
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("❌ Erreur Google Pop-up :", error.message);
                if (errorMessage) {
                    errorMessage.innerText = "Erreur : " + error.message;
                    errorMessage.classList.remove("hidden");
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                if (mainDashboard) mainDashboard.classList.add("hidden");
                await signOut(auth);
                window.location.reload();
            } catch (error) {
                console.error("❌ Erreur Déconnexion :", error.message);
            }
        });
    }
});