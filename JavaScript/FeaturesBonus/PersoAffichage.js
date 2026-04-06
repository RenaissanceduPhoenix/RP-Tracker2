import { db } from '../Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { charactersDB } from './CharacterData.js';

// --- BOUTON 1 : VOIR LE PROFIL COMPLET (Résumé + Historique) ---
window.openFullPerso = async function() {
    const activeCard = document.querySelector('.char-card.active');
    if (!activeCard) return alert("Sélectionne un personnage dans la galerie !");

    const charName = activeCard.querySelector('p').innerText;
    const data = charactersDB[charName];
    
    // On récupère tous les noms pour l'historique
    const allAliases = Object.keys(charactersDB).filter(key => charactersDB[key] === data);

    const displayArea = document.getElementById("displayArea");
    displayArea.style.display = "block";
    
    displayArea.innerHTML = `
        <div class="perso-view-container">
            <div class="perso-nav-top">
                <h2>📊 Profil : ${charName}</h2>
                <button class="btn-close-view" onclick="window.clearView()">×</button>
            </div>
            
            <div class="resume-section" style="margin-bottom:20px; padding:15px; background:rgba(255,255,255,0.05); border-radius:8px;">
                <h3 style="color:#ffcc00; margin-top:0;">Résumé du personnage</h3>
                <p style="line-height:1.5;">${data.resume}</p>
            </div>

            <div id="perso-history-content">
                <h3 style="color:#a777e3;">⏳ Historique des RP envoyés</h3>
                <div class="loading-text">Chargement de la base de données...</div>
            </div>
        </div>
    `;

    loadActivityHistory(allAliases);
};

// --- BOUTON 2 : VOIR LA FICHE DÉTAILLÉE (Version ORIGINALE sans stats) ---
window.openOriginalFiche = function() {
    const activeCard = document.querySelector('.char-card.active');
    if (!activeCard) return alert("Sélectionne un personnage dans la galerie !");

    const charName = activeCard.querySelector('p').innerText;
    const data = charactersDB[charName];

    const displayArea = document.getElementById("displayArea");
    displayArea.style.display = "block";

    displayArea.innerHTML = `
        <div class="perso-fiche-originale">
            <div class="fiche-header-aesthetic">
                <h1>${charName}</h1>
                <button class="btn-close-aesthetic" onclick="window.clearView()">Quitter la fiche</button>
            </div>
            <div class="fiche-body-content">
                ${data.complete.replace(/\n/g, '<br>')}
            </div>
        </div>
    `;
};

// --- LOGIQUE DE CHARGEMENT FIREBASE ---
async function loadActivityHistory(namesArray) {
    const container = document.getElementById('perso-history-content');
    try {
        const qSent = query(collection(db, "rps_sent"), where("character", "in", namesArray), orderBy("createdAt", "desc"));
        const snapSent = await getDocs(qSent);
        
        if (snapSent.empty) {
            container.innerHTML = `<p>Aucun RP envoyé enregistré pour ce personnage.</p>`;
            return;
        }

        let html = `<ul class="hist-list">`;
        snapSent.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt?.toDate().toLocaleDateString() || "Date inconnue";
            html += `<li>📅 <b>${date}</b> — Envoi sur le serveur : <strong>${d.server}</strong></li>`;
        });
        html += "</ul>";
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = "<p>Erreur lors de la récupération de l'historique.</p>";
    }
}