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
        // 🧼 NETTOYÉ : Classe au lieu du color:red
        area.innerHTML = `<p class="empty-msg error-text">Données introuvables pour ce personnage.</p>`;
        return;
    }
    
    // Nettoyage du nom pour créer des IDs HTML valides (ex: "Frasques-du-Lynx")
    const idSecurise = charName.replace(/['\s]/g, '-');

    area.innerHTML = `
    <div class="perso-view">
        <h2 id="titre-profil-${idSecurise}" class="perso-profile-title">📊 Profil : ${charName}</h2>
        
        <div class="perso-summary-box">
            <h3 class="perso-summary-title">Résumé</h3>
            <p>${data.resume}</p>
            
            <div class="perso-summary-divider">
                <button class="btn-action btn-bapteme-trigger" onclick="document.getElementById('zone-bapteme-${idSecurise}').style.display = 'flex'">
                    ⚡ Baptiser / Évoluer le personnage
                </button>
            </div>

            <div id="zone-bapteme-${idSecurise}" class="bapteme-zone" style="display: none;">
                <label class="bapteme-label">Nouveau nom de baptême (Guerrier, Apprenti...) :</label>
                <div class="bapteme-controls">
                    <input type="text" id="input-bapteme-${idSecurise}" placeholder="Ex: Nuage de Lynx..." class="bapteme-input">
                    <button onclick="window.validerChangementNom(\`${charName.replace(/`/g, "\\`")}\`)" class="btn-bapteme-confirm">
                        OK
                    </button>
                    <button onclick="document.getElementById('zone-bapteme-${idSecurise}').style.display = 'none'" class="btn-bapteme-cancel">
                        Annuler
                    </button>
                </div>
            </div>
        </div>

        <div id="hist-container">
            <h3 class="perso-history-title">⏳ Derniers RP envoyés</h3>
            <p>Chargement de l'historique...</p>
        </div>
    </div>
`;


    // 🌟 RÉCUPÉRATION DU NOM DE BAPTÊME DEPUIS FIRESTORE
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(db, "characters", charName);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            // Si le personnage a un nom de baptême enregistré, on met à jour le H2 !
            if (firestoreData.nom_bapteme) {
                const titreH2 = document.getElementById(`titre-profil-${idSecurise}`);
                if (titreH2) {
                    // 🧼 NETTOYÉ : Classe au lieu du style en dur
                    titreH2.innerHTML = `📊 Profil : ${firestoreData.nom_bapteme} <small class="bapteme-original-name">(${charName})</small>`;
                }
            }
        }
    } catch (err) {
        console.error("Erreur lors de la récupération du nom de baptême :", err);
    }
    
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

        // 🧼 NETTOYÉ : Classe au lieu du style inline
        let html = '<ul class="perso-history-list">';
        // On limite aux 5 derniers
        let count = 0;
        snap.forEach(doc => {
            if(count >= 5) return;
            const d = doc.data();
            const date = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleDateString() : 'Date inconnue';
            // 🧼 NETTOYÉ : Classe au lieu du border-bottom inline
            html += `<li class="perso-history-item">📅 ${date} — <strong>${d.server || 'Serveur inconnu'}</strong></li>`;
            count++;
        });
        document.getElementById('hist-container').innerHTML += html + '</ul>';
    } catch(e) {
        console.error("Erreur historique perso: ", e);
        // 🧼 NETTOYÉ : Classe d'erreur réutilisable
        document.getElementById('hist-container').innerHTML += '<p class="error-text">Erreur Firestore (Index possiblement manquant).</p>';
    }
};

// --- FICHE (Texte complet) ---
window.openOriginalFiche = function() {
    const active = document.querySelector('.char-card.active');
    if(!active) return alert("Veuillez sélectionner un personnage dans la galerie.");
    
    const charName = active.getAttribute('data-name');
    const data = charactersDB[charName];
    const area = document.getElementById('displayAreaPerso');

    if (!data) {
        // 🧼 NETTOYÉ : Classe error-text
        area.innerHTML = `<p class="empty-msg error-text">Données introuvables pour ce personnage.</p>`;
        return;
    }

    area.innerHTML = `
        <div class="perso-fiche-originale">
            <h1 class="fiche-title">${charName}</h1>
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