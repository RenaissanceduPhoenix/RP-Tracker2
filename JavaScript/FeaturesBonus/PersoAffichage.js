import { db } from '../Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { charactersDB } from './CharacterData.js';

window.openFullPerso = async function() {
    // 1. On identifie quel perso est actuellement sélectionné dans la galerie
    const activeCard = document.querySelector('.char-card.active');
    if (!activeCard) {
        alert("Sélectionne d'abord un personnage dans la galerie !");
        return;
    }

    const charName = activeCard.querySelector('p').innerText;
    const currentFiche = charactersDB[charName];
    // On récupère tous les noms associés (ex: Petite Lynx, Nuage de Lynx...)
    const allAliases = Object.keys(charactersDB).filter(key => charactersDB[key] === currentFiche);

    // 2. Création de la structure de la page/modale
    const displayArea = document.getElementById("displayArea"); // On réutilise ta zone d'affichage
    displayArea.style.display = "block";
    displayArea.innerHTML = `
        <div class="perso-full-view">
            <div class="perso-header">
                <h2>${charName}</h2>
                <span class="close-perso" onclick="window.clearView()">×</span>
            </div>
            
            <div class="perso-content">
                <section class="perso-bio">
                    <h3>📜 Fiche de Personnage</h3>
                    <pre>${currentFiche || "Aucune fiche détaillée."}</pre>
                </section>

                <div class="perso-history-grid">
                    <section class="history-section">
                        <h3>📤 Historique Envoyés</h3>
                        <div id="hist-sent" class="hist-list">Chargement...</div>
                    </section>
                    <section class="history-section">
                        <h3>📥 Historique Reçus (Terminés)</h3>
                        <div id="hist-received" class="hist-list">Chargement...</div>
                    </section>
                </div>
            </div>
        </div>
    `;

    // 3. Récupération des données Firebase
    fetchHistory(allAliases);
};

async function fetchHistory(namesArray) {
    const sentList = document.getElementById('hist-sent');
    const receivedList = document.getElementById('hist-received');

    try {
        // Query pour les RP envoyés
        const qSent = query(collection(db, "rps_sent"), where("character", "in", namesArray), orderBy("createdAt", "desc"));
        const snapSent = await getDocs(qSent);
        
        sentList.innerHTML = snapSent.empty ? "Aucun RP envoyé." : "";
        snapSent.forEach(doc => {
            const d = doc.data();
            sentList.innerHTML += `<div class="hist-item">📍 ${d.server} <small>(${d.createdAt?.toDate().toLocaleDateString()})</small></div>`;
        });

        // Query pour les RP reçus/répondus
        const qRec = query(collection(db, "rps_received"), where("character", "in", namesArray), where("status", "==", "done"), orderBy("createdAt", "desc"));
        const snapRec = await getDocs(qRec);

        receivedList.innerHTML = snapRec.empty ? "Aucun RP terminé." : "";
        snapRec.forEach(doc => {
            const d = doc.data();
            receivedList.innerHTML += `<div class="hist-item">📖 <b>${d.title}</b> sur ${d.server}</div>`;
        });

    } catch (e) {
        console.error("Erreur historique:", e);
        sentList.innerHTML = "Erreur de chargement.";
    }
}