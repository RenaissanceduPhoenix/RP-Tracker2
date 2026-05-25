import { charactersDB } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Mapping avec le sous-dossier exact et correction des accents pour la sécurité du serveur
const nameToImage = {
    "Petite Lynx": "Lynx.png",
    "Nuage de Lynx": "Lynx.png",
    "Ardeur du Lynx": "Lynx.png",
    "Petite Anémone": "Anemone.webp",  // Sans accent sur le fichier pour la sécurité
    "Nuage d’Anémone": "Anemone.webp",
    "Nuage d'Anémone": "Anemone.webp",
    "Eclats d’Anémone": "Anemone.webp",
    "Eclats d'Anémone": "Anemone.webp",
    "Boule de Sable": "Sables.webp",
    "Nuage des Sables": "Sables.webp",
    "Pelage des Sables": "Sables.webp"
};

if (!localStorage.getItem("myActiveChars")) {
    localStorage.setItem("myActiveChars", JSON.stringify(["Ardeur du Lynx", "Nuage d'Anémone", "Pelage des Sables"]));
}

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
        const imgName = nameToImage[charName] || "Lynx.png"; // Fallback sur Lynx si non trouvé
        
        // CORRECTION DU CHEMIN : On utilise le dossier exact de ton arborescence
        const basePath = "./JavaScript/FeaturesBonus/Assets/Avatars/";

        const card = document.createElement("div");
        card.className = "char-card";
        card.setAttribute("data-name", charName); // Crucial pour le lier à l'affichage et aux filtres
        
        card.innerHTML = `
            <img src="${basePath}${imgName}" alt="${charName}" onerror="this.onerror=null; this.src='${basePath}Lynx.png';">
            <h3>${charName}</h3>
        `;

        // LOGIQUE DES FILTRES ET ENCLENCHEMENT DU FILTRE GLOBAL
        card.addEventListener("click", function() {
            // 1. Gestion de la classe active (visuelle)
            document.querySelectorAll(".char-card").forEach(c => c.classList.remove("active"));
            card.classList.add("active");

            // 2. Application du filtre sur le sélecteur lié au graphique & aux listes (RP.js et Chart.js)
            const filterSelect = document.getElementById("filterCharacter");
            if (filterSelect) {
                filterSelect.value = charName;
                // Déclenche l'événement global 'change' pour forcer le graphique et les listes à s'actualiser
                filterSelect.dispatchEvent(new Event("change"));
            }

            // 3. Actualiser les mini-statistiques Firestore en bas de la galerie
            if (typeof window.mettreAJourMiniStats === "function") {
                window.mettreAJourMiniStats(charName);
            }
            
            // 4. Charger directement le profil dans la boîte d'infos de droite
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