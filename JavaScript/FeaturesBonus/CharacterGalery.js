import { db } from '../Firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Liste de tes persos principaux
const myMainChars = ["Ardeur du Lynx", "Nuage d’Anémone", "Pelage des Sables"];

window.initGallery = function() {
    const container = document.getElementById("char-gallery");
    if (!container) return;
    container.innerHTML = "";

    myMainChars.forEach(name => {
        const div = document.createElement("div");
        div.className = "char-card";
        div.id = `card-${name.replace(/\s+/g, '')}`;
        div.innerHTML = `
            <img src="./Assets/Avatars/${name}.png" onerror="this.src='https://via.placeholder.com/70?text=Avatar'">
            <p style="color:black; font-size:12px; margin-top:5px;">${name}</p>
        `;
        // On appelle la fonction de filtrage
        div.onclick = () => window.filterDashboard(name);
        container.appendChild(div);
    });
};

window.filterDashboard = async function(charName) {
    // 1. UI : Mettre en évidence la carte sélectionnée
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`card-${charName.replace(/\s+/g, '')}`);
    if (activeCard) activeCard.classList.add('active');

    // 2. Filtrer la liste Pending dans RP.js
    if (typeof window.loadPending === "function") {
        window.loadPending(charName); 
    }

    // 3. Mettre à jour les stats pour ce perso
    updateCharStats(charName);
};

window.resetCharFilter = function() {
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    if (typeof window.loadPending === "function") {
        window.loadPending(); // Charge tout sans filtre
    }
    document.getElementById('stat-pending-count').innerText = "RP en attente : -";
    document.getElementById('stat-sent-total').innerText = "Total envoyés : -";
};

async function updateCharStats(name) {
    try {
        // Compter les envoyés (Base rps_sent)
        const qSent = query(collection(db, "rps_sent"), where("character", "==", name));
        const snapSent = await getDocs(qSent);
        const countSent = snapSent.size;

        // Compter les pending (Base rps_received)
        const qPending = query(collection(db, "rps_received"), where("character", "==", name), where("status", "==", "pending"));
        const snapPending = await getDocs(qPending);
        const countPending = snapPending.size;

        document.getElementById('stat-sent-total').innerText = `Total envoyés : ${countSent}`;
        document.getElementById('stat-pending-count').innerText = `RP en attente : ${countPending}`;
    } catch (e) {
        console.error("Erreur stats galerie:", e);
    }
}

// Initialisation au chargement du module
window.initGallery();