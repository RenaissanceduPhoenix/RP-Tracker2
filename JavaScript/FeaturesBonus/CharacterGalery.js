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
    localStorage.setItem("myActiveChars", JSON.stringify(["Ardeur du Lynx", "Nuage d’Anémone", "Pelage des Sables"]));
}

const getActiveChars = () => JSON.parse(localStorage.getItem("myActiveChars"));

// --- GÉNÉRATION VISUELLE DE LA GALERIE ---
window.afficherGaleriePersonnages = function() {
    const conteneurGalerie = document.getElementById("character-gallery-target"); 
    // Utilisons la bonne classe si l'ID n'est pas trouvé
    const cible = conteneurGalerie || document.querySelector(".char-gallery");
    
    if (!cible) {
        console.error("Conteneur de la galerie introuvable.");
        return;
    }

    const listePersos = getActiveChars();
    let html = `<div class="character-gallery" style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">`;

    listePersos.forEach(nom => {
        const imageFichier = nameToImage[nom] || "default-avatar.png";
        
        // CORRECTION CRITIQUE : Le bon chemin vers tes images selon ton arborescence
        const imagePath = `./JavaScript/FeaturesBonus/Assets/Avatars/${imageFichier}`; 

        html += `
            <div class="character-avatar-card char-card" onclick="window.selectChar(this, '${nom}')" style="opacity: 0.8; cursor: pointer; transition: all 0.2s;">
                <img src="${imagePath}" class="character-avatar-img" alt="${nom}" onerror="this.src='./JavaScript/FeaturesBonus/Assets/Avatars/default-avatar.png'" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #a777e3;">
                <div class="character-avatar-name" style="font-size: 12px; margin-top: 5px; text-align: center;">${nom}</div>
            </div>
        `;
    });

    html += `</div>`;
    cible.innerHTML = html;
    html += `</div>`;
    conteneurGalerie.innerHTML = html;
};

window.selectChar = function(element, nom) {
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

// Lancement automatique au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.afficherGaleriePersonnages();
});