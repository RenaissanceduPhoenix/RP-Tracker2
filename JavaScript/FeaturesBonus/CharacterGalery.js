import { charactersDB } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Mapping avec le sous-dossier exact et correction des accents pour la sécurité du serveur
const nameToImage = {
    "Petite Lynx": "Lynx.png",
    "Nuage de Lynx": "Lynx.png",
    "Frasques du Lynx": "Lynx.png",
    "Petite Anémone": "Anemone.webp",  // Sans accent sur le fichier pour la sécurité
    "Nuage d’Anémone": "Anemone.webp",
    "Nuage d'Anémone": "Anemone.webp",
    "Eclats d’Anémone": "Anemone.webp",
    "Eclats d'Anémone": "Anemone.webp",
    "Etincelle de Vie": "Etincelle.png",
    "Racine de Pissenlit": "Racine.webp"
};

// Liste par défaut mise à jour (Sans Sables, avec les bons noms de Lynx, Racine et Étincelle)
// FORCE la mise à jour de la liste pour nettoyer l'ancien cache (Sables, Ardeur du Lynx...)
const MaNouvelleListe = ["Frasques du Lynx", "Nuage d'Anémone", "Etincelle de Vie", "Racine de Pissenlit"];
localStorage.setItem("myActiveChars", JSON.stringify(MaNouvelleListe));

const getActiveChars = () => JSON.parse(localStorage.getItem("myActiveChars"));

// --- GÉNÉRATION VISUELLE DE LA GALERIE ---
window.afficherGaleriePersonnages = function() {
    const container = document.getElementById("char-gallery");
    if (!container) {
        console.warn("⚠️ Conteneur de la galerie (char-gallery) introuvable.");
        return;
    }

    container.innerHTML = "";
    const activeChars = getActiveChars();

    activeChars.forEach(charName => {
        // SÉCURITÉ : Si un vieux nom traîne encore, on passe au suivant sans cracher
        if (charName === "Pelage des Sables" || charName === "Ardeur du Lynx") return;

        const imgName = nameToImage[charName] || "Lynx.png"; 
        const basePath = "./JavaScript/FeaturesBonus/Assets/Avatars/";

        const card = document.createElement("div");
        card.className = "char-card";
        card.setAttribute("data-name", charName); 
        
        card.innerHTML = `
            <img src="${basePath}${imgName}" alt="${charName}" onerror="this.onerror=null; this.src='${basePath}Lynx.png';">
            <h3>${charName}</h3>
        `;

        card.addEventListener("click", function() {
            document.querySelectorAll(".char-card").forEach(c => c.classList.remove("active"));
            card.classList.add("active");

            const filterSelect = document.getElementById("filterCharacter");
            if (filterSelect) {
                filterSelect.value = charName;
                filterSelect.dispatchEvent(new Event("change"));
            }

            if (typeof window.mettreAJourMiniStats === "function") {
                window.mettreAJourMiniStats(charName);
            }
            
            if (typeof window.openFullPerso === "function") {
                window.openFullPerso();
            }
        });

        container.appendChild(card);
    });
};

// --- LOGIQUE DES MINI-STATS REELLES (FIRESTORE) ---
window.mettreAJourMiniStats = async function(charName) {
    const pendingText = document.getElementById("stat-pending-count");
    const sentText = document.getElementById("stat-sent-total");

    if (!pendingText || !sentText) return;

    try {
        // Compte les RPs en attente (pending) pour ce personnage
        const qPending = query(collection(db, "rps_received"), where("character", "==", charName), where("status", "==", "pending"));
        const snapPending = await getDocs(qPending);
        pendingText.innerText = `Attente : ${snapPending.size}`;

        // Compte le total des RPs envoyés par ce personnage
        const qSent = query(collection(db, "rps_sent"), where("character", "==", charName));
        const snapSent = await getDocs(qSent);
        sentText.innerText = `Total Envoyés : ${snapSent.size}`;

    } catch (error) {
        console.error("Erreur lors du calcul des mini-stats :", error);
    }
};

// Initialisation au chargement de la page
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.afficherGaleriePersonnages());
} else {
    window.afficherGaleriePersonnages();
}