import { db } from '../Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { charactersDB } from '../CharacterData.js';

// --- PROFIL (Résumé + Historique) ---
window.openFullPerso = async function() {
    const active = document.querySelector('.char-card.active');
    if(!active) return alert("Veuillez sélectionner un personnage dans la galerie.");
    
    const charName = active.querySelector('p').innerText;
    const data = charactersDB[charName];
    const area = document.getElementById('displayAreaPerso');
    
    area.innerHTML = `
        <div class="perso-view">
            <h2 style="border:none">📊 Profil : ${charName}</h2>
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:20px;">
                <h3 style="color:#ffcc00; margin-top:0;">Résumé</h3>
                <p>${data.resume}</p>
            </div>
            <div id="hist-container">
                <h3 style="color:#a777e3">⏳ Derniers RP envoyés</h3>
                <p>Chargement de l'historique...</p>
            </div>
        </div>
    `;

    // Fetch historique Firebase
    try {
        const q = query(collection(db, "rps_sent"), where("character", "==", charName), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        let html = '<ul style="list-style:none; padding:0;">';
        if(snap.empty) html += '<li>Aucun historique trouvé.</li>';
        snap.forEach(doc => {
            const d = doc.data();
            html += `<li style="padding:8px 0; border-bottom:1px solid #333;">📅 ${d.createdAt.toDate().toLocaleDateString()} — <strong>${d.server}</strong></li>`;
        });
        document.getElementById('hist-container').innerHTML = html + '</ul>';
    } catch(e) {
        document.getElementById('hist-container').innerHTML = '<p>Erreur lors du chargement.</p>';
    }
};

// --- FICHE (Texte complet) ---
window.openOriginalFiche = function() {
    const active = document.querySelector('.char-card.active');
    if(!active) return alert("Veuillez sélectionner un personnage dans la galerie.");
    
    const charName = active.querySelector('p').innerText;
    const data = charactersDB[charName];
    const area = document.getElementById('displayAreaPerso');

    area.innerHTML = `
        <div class="perso-fiche-originale">
            <h1 style="color:#a777e3; text-align:center;">${charName}</h1>
            <div class="fiche-content">${data.complete.replace(/\n/g, '<br>')}</div>
        </div>
    `;
};

// --- RESET ---
window.resetCharFilter = function() {
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    document.getElementById('displayAreaPerso').innerHTML = '<p class="empty-msg">Sélectionnez un personnage dans la galerie pour afficher ses informations.</p>';
    if(window.loadPending) window.loadPending(); // Recharge tout si la fonction existe
};