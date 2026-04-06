import { db } from '../Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { charactersDB } from './CharacterData.js';

// Nettoyage de la zone
window.clearView = function() {
    document.getElementById("displayArea").innerHTML = `<p style="color:#666; text-align:center; margin-top:100px;">Sélectionnez un perso et cliquez sur Profil/Fiche</p>`;
};

// Profil Complet
window.openFullPerso = async function() {
    const activeCard = document.querySelector('.char-card.active');
    if (!activeCard) return alert("Choisis un perso !");
    const charName = activeCard.querySelector('p').innerText;
    const data = charactersDB[charName];
    const allAliases = Object.keys(charactersDB).filter(key => charactersDB[key] === data);
    
    document.getElementById("displayArea").innerHTML = `
        <div class="perso-info">
            <h3>📊 Profil : ${charName}</h3>
            <p><strong>Résumé :</strong> ${data.resume}</p>
            <div id="perso-history-content">Chargement de l'historique...</div>
        </div>`;
    loadActivityHistory(allAliases);
};

// Fiche Détaillée
window.openOriginalFiche = function() {
    const activeCard = document.querySelector('.char-card.active');
    if (!activeCard) return alert("Choisis un perso !");
    const charName = activeCard.querySelector('p').innerText;
    const data = charactersDB[charName];

    document.getElementById("displayArea").innerHTML = `
        <div class="perso-fiche-originale">
            <h2 style="color:#a777e3">${charName}</h2>
            <div class="fiche-content">${data.complete.replace(/\n/g, '<br>')}</div>
        </div>`;
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