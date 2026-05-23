import { db } from '../Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { charactersDB } from './CharacterData.js';

// --- PROFIL (Résumé + Historique) ---
window.openFullPerso = async function() {
    const active = document.querySelector('.char-card.active');
    if(!active) return alert("Veuillez sélectionner un personnage dans la galerie.");
    
    // CORRECTION 4 : On récupère le nom via le nouvel attribut data-name
    const charName = active.getAttribute('data-name');
    const data = charactersDB[charName];
    const area = document.getElementById('displayAreaPerso');
    
    if (!data) {
        area.innerHTML = `<p class="empty-msg" style="color:red">Données introuvables pour ce personnage.</p>`;
        return;
    }
    
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
        const q = query(
            collection(db, "rps_sent"), 
            where("character", "==", charName),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        if(snap.empty) {
            document.getElementById('hist-container').innerHTML += '<p>Aucun RP enregistré.</p>';
            return;
        }
        let html = '<ul style="list-style:none; padding:0; margin:0;">';
        // On limite aux 5 derniers
        let count = 0;
        snap.forEach(doc => {
            if(count >= 5) return;
            const d = doc.data();
            const date = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleDateString() : 'Date inconnue';
            html += `<li style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1);">📅 ${date} — <strong>${d.server || 'Serveur inconnu'}</strong></li>`;
            count++;
        });
        document.getElementById('hist-container').innerHTML += html + '</ul>';
    } catch(e) {
        console.error("Erreur historique perso: ", e);
        document.getElementById('hist-container').innerHTML += '<p style="color:red">Erreur Firestore (Index possiblement manquant).</p>';
    }
};

// --- FICHE (Texte complet) ---
window.openOriginalFiche = function() {
    const active = document.querySelector('.char-card.active');
    if(!active) return alert("Veuillez sélectionner un personnage dans la galerie.");
    
    // CORRECTION 4 (suite) : Idem, on utilise data-name
    const charName = active.getAttribute('data-name');
    const data = charactersDB[charName];
    const area = document.getElementById('displayAreaPerso');

    if (!data) {
        area.innerHTML = `<p class="empty-msg" style="color:red">Données introuvables pour ce personnage.</p>`;
        return;
    }

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
    if (typeof window.loadPending === "function") window.loadPending();
};