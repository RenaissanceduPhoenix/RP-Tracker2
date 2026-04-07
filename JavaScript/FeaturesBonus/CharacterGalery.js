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

window.rankUp = function(oldName, newName) {
    let chars = getActiveChars();
    const index = chars.indexOf(oldName);
    if (index !== -1) {
        chars[index] = newName;
        localStorage.setItem("myActiveChars", JSON.stringify(chars));
        window.initGallery(); 
    }
};

window.initGallery = function() {
    const container = document.getElementById("char-gallery");
    if (!container) return;
    container.innerHTML = "";
    getActiveChars().forEach(name => {
        const div = document.createElement("div");
        div.className = "char-card";
        const fileName = nameToImage[name] || "default.png";
        div.innerHTML = `
            <img src="./JavaScript/FeaturesBonus/Assets/Avatars/${fileName}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
            <p style="color:white; font-size:12px; font-weight:bold; margin-top:5px;">${name}</p>
        `;
        // CORRECTION : On passe 'div' (l'élément) en deuxième argument
        div.onclick = () => window.filterDashboard(name, div); 
        container.appendChild(div);
    });
};

window.filterDashboard = function(charName, element) {
    // Style actif
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    element.classList.add('active');

    // Récupérer la fiche et TOUS les noms associés (ex: Nuage de Lynx, Ardeur du Lynx...)
    const currentFiche = charactersDB[charName];
    if (!currentFiche) return;

    const allAliases = Object.keys(charactersDB).filter(key => charactersDB[key] === currentFiche);

    // Appeler la fonction globale de RP.js avec le tableau de noms
    if (typeof window.loadPending === "function") {
        window.loadPending(allAliases);
    }
    
    // Mettre à jour les mini-stats (si tu as la fonction)
    if (typeof updateCharStats === "function") {
        updateCharStats(allAliases);
    }
};

// --- LA FONCTION QUI MANQUAIT ---
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
    document.getElementById('stat-pending-count').innerText = "RP en attente : -";
    document.getElementById('stat-sent-total').innerText = "Total envoyés : -";
};

window.initGallery();