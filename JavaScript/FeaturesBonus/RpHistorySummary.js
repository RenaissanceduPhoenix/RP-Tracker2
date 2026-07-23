import { db } from '../Firebase.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js'; 

/**
 * ============================================================================
 * MODALE : SOMMAIRE & VISIONNAGE HISTORIQUE CHRONOLOGIQUE
 * ============================================================================
 */

// Stocke l'intégralité des messages récupérés pour le visionnage dynamique
let cacheMessagesRp = [];

/**
 * 🚀 Fonction principale : Génère et ouvre le sommaire d'un RP spécifique
 */
window.ouvrirSommaireHistorique = async function(rpId) {
    if (!rpId) return;

    // 1. Créer ou récupérer les conteneurs de la modale dans le DOM
    assurerExistenceModaleSommaire();
    
    const modal = document.getElementById("rpSummaryModal");
    const charactersListDiv = document.getElementById("summaryCharactersList");
    const timelineTimelineDiv = document.getElementById("summaryTimelineTracks");
    const readerDiv = document.getElementById("summaryPostReader");

    // Reset des affichages
    modal.style.display = "flex";
    charactersListDiv.innerHTML = "<p class='blink'>Calcul de l'ordre d'entrée...</p>";
    timelineTimelineDiv.innerHTML = "<p class='blink'>Chargement de la chronologie...</p>";
    readerDiv.innerHTML = "<p id='Reader'>Sélectionnez une réplique ou un personnage dans le sommaire pour lire le RP en grand.</p>";

   try {
        // 2. Requête Firestore ordonnée du plus VIEUX au plus RÉCENT
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            charactersListDiv.innerHTML = "<span class='C777'>Aucun joueur.</span>";
            timelineTimelineDiv.innerHTML = "<span class='C777'>Historique vide.</span>";
            return;
        }

        // Remplissage du cache global local
        cacheMessagesRp = [];
        let ordrePersonnages = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            
            // 🎯 CORRECTION STRICTE DU TIMESTAMP DE FIREBASE (en millisecondes)
            let msgTimestamp = Date.now(); 
            if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
                msgTimestamp = data.createdAt.toMillis();
            } else if (data.createdAt && data.createdAt.seconds) {
                msgTimestamp = data.createdAt.seconds * 1000;
            }

            const msgObj = {
                id: docSnap.id,
                sender: data.sender || "Inconnu",
                text: data.text || "",
                date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString("fr-FR") : "En cours...",
                timestamp: msgTimestamp // Sauvegarde propre en millisecondes
            };
            cacheMessagesRp.push(msgObj);

            if (!ordrePersonnages.includes(msgObj.sender)) {
                ordrePersonnages.push(msgObj.sender);
            }
        });

        // 3. Rendu du Sommaire des Personnages
        charactersListDiv.innerHTML = "";
        ordrePersonnages.forEach((nomPerso, index) => {
            const totalPosts = cacheMessagesRp.filter(m => m.sender === nomPerso).length;
            
            // 🧼 NETTOYÉ : Classes CSS explicites
            charactersListDiv.innerHTML += `
                <div class="summary-char-badge" onclick="window.filtrerHistoriqueParPerso('${nomPerso}')">
                    <span class="summary-char-name">#${index + 1} ${nomPerso}</span>
                    <span class="summary-char-count">${totalPosts} post(s)</span>
                </div>
            `;
        });

        // 4. Rendu de la frise chronologique
        window.afficherTouteLaTimeline();

    } catch (err) {
        console.error("Erreur Sommaire :", err);
        // 🧼 NETTOYÉ : Classe au lieu du color inline
        timelineTimelineDiv.innerHTML = "<span class='timeline-error'>Erreur au chargement du sommaire.</span>";
    }
};

/**
 * 📊 Affiche toutes les répliques dans l'ordre chronologique dans la barre latérale
 */
window.afficherTouteLaTimeline = function() {
    const timelineTimelineDiv = document.getElementById("summaryTimelineTracks");
    timelineTimelineDiv.innerHTML = "";

    // Calcul de la limite exacte (48 heures en millisecondes)
    const deuxJoursEnMillisecondes = 2 * 24 * 60 * 60 * 1000;
    const limiteNouveau = Date.now() - deuxJoursEnMillisecondes;

    cacheMessagesRp.forEach((msg, index) => {
        // Vérification mathématique par rapport à l'âge du post
        const estNouveau = msg.timestamp > limiteNouveau;
        
        // Assignation des indicateurs visuels
        const badgeHtml = estNouveau ? `<span class="badge-nouveau">Nouveau</span>` : "";
        const classeLueur = estNouveau ? "post-sommaire-nouveau" : "";
        const couleurAccentuations = estNouveau ? "#2ecc71" : "#a777e3";

        // 🧼 NETTOYÉ : Emploi de la variable CSS --item-accent et des classes dédiées
        timelineTimelineDiv.innerHTML += `
            <div class="summary-timeline-item ${classeLueur}" onclick="window.chargerPostDansLeLecteur('${msg.id}')" style="--item-accent: ${couleurAccentuations};">
                <div class="summary-item-header">
                    <span>Post n°${index + 1} ${badgeHtml}</span>
                    <span class="summary-item-date">${msg.date}</span>
                </div>
                <div class="summary-item-body">
                    <strong>${msg.sender}</strong> : ${msg.text.substring(0, 45)}...
                </div>
            </div>
        `;
    });
};

/**
 * 🔍 Filtre la timeline pour n'afficher que les écrits d'un seul personnage en grand
 */
window.filtrerHistoriqueParPerso = function(nomPerso) {
    const readerDiv = document.getElementById("summaryPostReader");
    const filtrés = cacheMessagesRp.filter(m => m.sender === nomPerso);

    if (filtrés.length === 0) return;

    // 🧼 NETTOYÉ : Emploi des classes CSS reader-filter-*
    readerDiv.innerHTML = `
        <div class="reader-filter-header">
            <h2 class="reader-filter-title">📚 Compilation des écrits de [${nomPerso}]</h2>
            <button onclick="window.afficherTouteLaTimeline();" class="btn-reset-view">Réinitialiser la vue</button>
        </div>
    `;

    filtrés.forEach((msg, index) => {
        const parsedHTML = parseRP(msg.text);
        // 🧼 NETTOYÉ : Classes pour les répliques individuelles
        readerDiv.innerHTML += `
            <div class="reader-post-card">
                <div class="reader-post-meta">RÉPLIQUE N°${index + 1} — Ajoutée le ${msg.date}</div>
                <div class="reader-post-text">${parsedHTML}</div>
            </div>
        `;
    });
    readerDiv.scrollTop = 0;
};

/**
 * 📖 Charge un post précis de la frise chronologique dans le panneau principal en grand
 */
window.chargerPostDansLeLecteur = async function(msgId) {
    const readerDiv = document.getElementById("summaryPostReader");
    if (!readerDiv) return; 
    
    const indexPost = cacheMessagesRp.findIndex(m => m.id === msgId);
    const msgBase = cacheMessagesRp[indexPost];
    
    if (!msgBase) return;

    let texteAUtiliser = msgBase.text || msgBase.content || "";
    let nomAuteur = msgBase.sender || "Inconnu";

    try {
        if (window.currentActiveRpId) {
            const pendingMessagesRef = collection(db, "rps_pending", window.currentActiveRpId, "messages");
            const q = query(pendingMessagesRef, orderBy("createdAt", "asc"));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                let listePending = [];
                querySnapshot.forEach(docSnap => {
                    listePending.push({ idFirebase: docSnap.id, ...docSnap.data() });
                });

                let msgPendingTrouve = listePending.find(m => m.idFirebase === msgId || m.id === msgId);

                if (!msgPendingTrouve && indexPost !== -1 && listePending[indexPost]) {
                    msgPendingTrouve = listePending[indexPost];
                }

                if (msgPendingTrouve) {
                    texteAUtiliser = msgPendingTrouve.text || msgPendingTrouve.content || texteAUtiliser;
                    nomAuteur = msgPendingTrouve.sender || msgPendingTrouve.character || nomAuteur;
                }
            }
        }
    } catch (err) {
        console.warn("⚠️ Erreur rps_pending, version brute affichée :", err);
    }

    const parsedHTML = parseRP(texteAUtiliser);

    // 🧼 NETTOYÉ : Structure du lecteur nettoyée avec des classes CSS dédiées
    readerDiv.innerHTML = `
        <div class="reader-single-container">
            <div class="reader-single-header">
                <div>
                    <span class="reader-author-label">AUTEUR DE LA RÉPLIQUE</span>
                    <h2 class="reader-author-name">${nomAuteur}</h2>
                </div>
                <div style="text-align:right;">
                    <span class="reader-date-label">DATE DU POST</span>
                    <div class="reader-date-value">${msgBase.date || "Inconnue"}</div>
                </div>
            </div>
            <div class="rp-post-content reader-single-body">
                ${parsedHTML}
            </div>
        </div>
    `;
};

/**
 * 🧱 Injection automatique de la structure HTML de la modale Sommaire
 */
function assurerExistenceModaleSommaire() {
    if (document.getElementById("rpSummaryModal")) return;

    // 🧼 NETTOYÉ : Plus d'injection de la balise <style> en JS ! Tout est dans theme-dark.css.
    const modalHTML = `
    <div id="rpSummaryModal" class="rp-modal-overlay">
        <div class="rp-modal-window">
            
            <div class="rp-modal-header">
                <h3><h3 class="rp-modal-title">📊 Sommaire Tactique & Historique de Guerre</h3></h3>
                <button onclick="document.getElementById('rpSummaryModal').style.display='none'" class="rp-modal-close">&times;</button>
            </div>

            <div class="rp-modal-body">
                
                <div class="rp-sidebar-chars">
                    <div class="rp-sidebar-title">ORDRE D'ENTRÉE DES PERSOS</div>
                    <div id="summaryCharactersList" class="rp-sidebar-chars-list"></div>
                </div>

                <div class="rp-sidebar-timeline">
                    <div class="rp-sidebar-title">CHRONOLOGIE DES POSTS</div>
                    <div id="summaryTimelineTracks" class="rp-sidebar-timeline-tracks"></div>
                </div>

                <div id="summaryPostReader" class="rp-main-reader"></div>

            </div>
        </div>
    </div>`;

    const range = document.createRange();
    const fragment = range.createContextualFragment(modalHTML);
    document.body.appendChild(fragment);
}