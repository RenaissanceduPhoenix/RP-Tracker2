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
    
    // Nettoyage du nom pour créer des IDs HTML valides (ex: "Frasques-du-Lynx")
    // Nettoyage du nom pour créer des IDs HTML valides (ex: "Frasques-du-Lynx")
    const idSecurise = charName.replace(/['\s]/g, '-');

    area.innerHTML = `
    <div class="perso-view">
        <h2 id="titre-profil-${idSecurise}" style="border:none">📊 Profil : ${charName}</h2>
        
        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:20px;">
            <h3 style="color:#ffcc00; margin-top:0;">Résumé</h3>
            <p>${data.resume}</p>
            
            <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
                <button class="btn-action" onclick="document.getElementById('zone-bapteme-${idSecurise}').style.display = 'flex'" style="background: #a777e3; color: white; border: none; padding: 5px 10px; font-size: 0.8rem; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ⚡ Baptiser / Évoluer le personnage
                </button>
            </div>

            <div id="zone-bapteme-${idSecurise}" style="display: none; gap: 8px; margin-top: 12px; flex-direction: column; background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 6px; border: 1px solid rgba(167, 119, 227, 0.3);">
                <label style="font-size: 0.8rem; color: #ffcc00; font-weight: 500;">Nouveau nom de baptême (Guerrier, Apprenti...) :</label>
                <div style="display: flex; gap: 6px; margin-top: 5px;">
                    <input type="text" id="input-bapteme-${idSecurise}" placeholder="Ex: Nuage de Lynx..." style="flex-grow: 1; background: #0c0c10; border: 1px solid #444; color: white; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px;">
                    <button onclick="window.validerChangementNom(\`${charName.replace(/`/g, "\\`")}\`)" style="background: #27ae60; color: white; border: none; padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        OK
                    </button>
                    <button onclick="document.getElementById('zone-bapteme-${idSecurise}').style.display = 'none'" style="background: #57534e; color: white; border: none; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; cursor: pointer;">
                        Annuler
                    </button>
                </div>
            </div>
        </div>

        <div id="hist-container">
            <h3 style="color:#a777e3">⏳ Derniers RP envoyés</h3>
            <p>Chargement de l'historique...</p>
        </div>
    </div>
`;

    // 🌟 RÉCUPÉRATION DU NOM DE BAPTÊME DEPUIS FIRESTORE
    // On profite du fait qu'on va chercher l'historique ou qu'on est connecté à Firebase pour lire le profil
    // 🌟 RÉCUPÉRATION DU NOM DE BAPTÊME DEPUIS FIRESTORE
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(db, "characters", charName);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            // Si le personnage a un nom de baptême enregistré, on met à jour le H2 en haut !
            if (firestoreData.nom_bapteme) {
                const titreH2 = document.getElementById(`titre-profil-${idSecurise}`);
                if (titreH2) {
                    titreH2.innerHTML = `📊 Profil : ${firestoreData.nom_bapteme} <small style="color:#78716c; font-size:0.9rem; font-weight:normal;">(${charName})</small>`;
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