import { charactersDB } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION DES IMAGES ---
const nameToImage = {
    "Petite Lynx": "Lynx.png",
    "Nuage de Lynx": "Lynx.png",
    "Ardeur du Lynx": "Lynx.png",
    "Petite Anémone": "Anémone.webp",
    "Nuage d’Anémone": "Anémone.webp",
    "Eclats d’Anémone": "Anémone.webp",
    "Boule de Sable": "Sables.webp",
    "Nuage des Sables": "Sables.webp",
    "Pelage des Sables": "Sables.webp"
};

if (!localStorage.getItem("myActiveChars")) {
    const defaultChars = ["Ardeur du Lynx", "Nuage d’Anémone", "Pelage des Sables"];
    localStorage.setItem("myActiveChars", JSON.stringify(defaultChars));
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
        div.id = `card-${name.replace(/\s+/g, '')}`;
        const fileName = nameToImage[name] || "default.png";
        const imgPath = `./JavaScript/FeaturesBonus/Assets/Avatars/${fileName}`;
        div.innerHTML = `
            <img src="${imgPath}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
            <p style="color:black; font-size:12px; font-weight:bold; margin-top:5px;">${name}</p>
        `;
        div.onclick = () => window.filterDashboard(name);
        container.appendChild(div);
    });
};

window.filterDashboard = async function(charName) {
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`card-${charName.replace(/\s+/g, '')}`)?.classList.add('active');
    const currentFiche = charactersDB[charName];
    const allAliases = Object.keys(charactersDB).filter(key => charactersDB[key] === currentFiche);
    if (typeof window.loadPending === "function") window.loadPending(allAliases); 
    updateCharStats(allAliases);
};

// --- LA FONCTION QUI MANQUAIT ---
// À mettre à la toute fin du fichier CharacterGalery.js
window.resetCharFilter = function() {
    console.log("Reset du filtre activé");
    // Retire la classe active des cartes
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    
    // Recharge tous les RPs sans filtre
    if (typeof window.loadPending === "function") {
        window.loadPending(); 
    }
    
    // Remet les compteurs à zéro
    const pendingStat = document.getElementById('stat-pending-count');
    const sentStat = document.getElementById('stat-sent-total');
    if(pendingStat) pendingStat.innerText = "RP en attente : -";
    if(sentStat) sentStat.innerText = "Total envoyés : -";
};

window.initGallery();