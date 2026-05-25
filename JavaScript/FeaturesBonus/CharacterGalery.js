import { charactersDB } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const nameToImage = {
    "Petite Lynx": "Lynx.png",
    "Nuage de Lynx": "Lynx.png",
    "Ardeur du Lynx": "Lynx.png",
    "Petite Anémone": "Anémone.webp",
    "Nuage d’Anémone": "Anémone.webp",
    "Nuage d'Anémone": "Anémone.webp",
    "Eclats d’Anémone": "Anémone.webp",
    "Eclats d'Anémone": "Anémone.webp",
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
    // CORRECTION 1 : On cible l'ID exact de ton index.html
    const cible = document.getElementById("char-gallery"); 
    
    if (!cible) {
        console.error("Conteneur de la galerie (char-gallery) introuvable.");
        return;
    }

    const listePersos = getActiveChars();
    let html = `<div class="character-gallery" style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">`;

    listePersos.forEach(nom => {
        const imageFichier = nameToImage[nom] || "default-avatar.png";
        const imagePath = `./JavaScript/FeaturesBonus/Assets/Avatars/${imageFichier}`; 

        // CORRECTION 2 : Utilisation de data-name pour empêcher l'apostrophe de casser le JS
        // Et on retire le nom des arguments du onclick
        html += `
            <div class="character-avatar-card char-card" data-name="${nom.replace(/"/g, '&quot;')}" onclick="window.selectChar(this)" style="opacity: 0.8; cursor: pointer; transition: all 0.2s;">
                <img src="${imagePath}" class="character-avatar-img" alt="${nom}" onerror="this.src='./JavaScript/FeaturesBonus/Assets/Avatars/default-avatar.png'" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #a777e3;">
                <div class="character-avatar-name" style="font-size: 12px; margin-top: 5px; text-align: center;">${nom}</div>
            </div>
        `;
    });

    html += `</div>`;
    cible.innerHTML = html;
};

// CORRECTION 3 : La fonction récupère le nom directement dans le dataset
window.selectChar = function(element) {
    const nom = element.getAttribute('data-name');
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    
    // Filtrage des listes de RP s'il est actif
    if (typeof window.loadPending === "function") {
        window.loadPending([nom]);
    }
    if (typeof updateCharStats === "function") {
        updateCharStats([nom]);
    }
};

async function updateCharStats(namesArray) {
    try {
        const qSent = query(collection(db, "rps_sent"), where("character", "in", namesArray));
        const snapSent = await getDocs(qSent);
        const qPending = query(collection(db, "rps_received"), where("character", "in", namesArray), where("status", "==", "pending"));
        const snapPending = await getDocs(qPending);

        const sentEl = document.getElementById('stat-sent-total');
        const pendingEl = document.getElementById('stat-pending-count');
        if (sentEl) sentEl.innerText = `Total envoyés : ${snapSent.size}`;
        if (pendingEl) pendingEl.innerText = `RP en attente : ${snapPending.size}`;
    } catch (e) { console.error("Erreur stats perso:", e); }
}

window.resetCharFilter = function() {
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    if (typeof window.loadPending === "function") window.loadPending();
};

window.openFullPerso = function() {
    console.log("Ouverture du Profil détaillé");
    const charName = getActiveCharacterName();
    if (!charName) return;

    // Si tu as une modale ou un panneau de profil avancé, on l'appelle ici
    if (typeof window.afficherProfilAvance === "function") {
        window.afficherProfilAvance(charName);
    } else {
        // Logique de repli : fait défiler la page jusqu'au panneau de détails
        const detailsArea = document.getElementById("displayAreaPerso");
        if (detailsArea) {
            detailsArea.scrollIntoView({ behavior: 'smooth' });
        }
    }
};

window.openOriginalFiche = function() {
    console.log("Ouverture de la Fiche originale");
    const charName = getActiveCharacterName();
    if (!charName) return;

    // On va chercher les données du personnage (souvent stockées dans CharacterData)
    if (window.DATA_PERSONNAGES && window.DATA_PERSONNAGES[charName]) {
        const urlFiche = window.DATA_PERSONNAGES[charName].ficheUrl || window.DATA_PERSONNAGES[charName].url;
        if (urlFiche) {
            window.open(urlFiche, '_blank'); // Ouvre la fiche de recherche/RP dans un nouvel onglet
        } else {
            alert(`ℹ️ Aucune URL de fiche renseignée pour ${charName}.`);
        }
    } else {
        console.warn("Base DATA_PERSONNAGES indisponible ou personnage introuvable.");
        alert(`❌ Impossible de trouver la fiche originale de ${charName}.`);
    }
};

// Lancement automatique au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.afficherGaleriePersonnages();
});