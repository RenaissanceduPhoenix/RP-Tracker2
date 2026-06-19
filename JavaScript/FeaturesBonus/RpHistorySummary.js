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
    charactersListDiv.innerHTML = "<p class='blink' style='color:#a777e3;'>Calcul de l'ordre d'entrée...</p>";
    timelineTimelineDiv.innerHTML = "<p class='blink' style='color:#a777e3;'>Chargement de la chronologie...</p>";
    readerDiv.innerHTML = "<p style='color:#777; text-align:center; font-style:italic; margin-top:50px;'>Sélectionnez une réplique ou un personnage dans le sommaire pour lire le RP en grand.</p>";

    try {
        // 2. Requête Firestore ordonnée du plus VIEUX au plus RÉCENT
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            charactersListDiv.innerHTML = "<span style='color:#777;'>Aucun joueur.</span>";
            timelineTimelineDiv.innerHTML = "<span style='color:#777;'>Historique vide.</span>";
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
            charactersListDiv.innerHTML += `
                <div class="summary-char-badge" onclick="window.filtrerHistoriqueParPerso('${nomPerso}')" style="background: #1c1c24; border: 1px solid #ffcc00; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                    <span style="color:#ffcc00; font-weight:bold;">#${index + 1} ${nomPerso}</span>
                    <span style="background:#2c2c35; color:#aaa; font-size:0.7rem; padding: 2px 5px; border-radius:3px;">${totalPosts} post(s)</span>
                </div>
            `;
        });

        // 4. Rendu de la frise chronologique
        window.afficherTouteLaTimeline();

    } catch (err) {
        console.error("Erreur Sommaire :", err);
        timelineTimelineDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur au chargement du sommaire.</span>";
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
        const couleurBordure = estNouveau ? "#2ecc71" : "#a777e3";
        const couleurTitre = estNouveau ? "#2ecc71" : "#a777e3";

        timelineTimelineDiv.innerHTML += `
            <div class="summary-timeline-item ${classeLueur}" onclick="window.chargerPostDansLeLecteur('${msg.id}')" style="padding: 10px; background: #161622; border-left: 3px solid ${couleurBordure}; border-radius: 0 4px 4px 0; cursor: pointer; margin-bottom: 8px; font-size: 0.85rem; transition: background 0.2s;">
                <div style="display:flex; justify-content:space-between; color:${couleurTitre}; font-weight:bold; margin-bottom:2px; align-items:center;">
                    <span>Post n°${index + 1} ${badgeHtml}</span>
                    <span style="color:#777; font-size:0.75rem;">${msg.date}</span>
                </div>
                <div style="color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
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

    readerDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,204,0,0.3); padding-bottom:10px; margin-bottom:15px;">
            <h2 style="margin:0; color:#ffcc00;">📚 Compilation des écrits de [${nomPerso}]</h2>
            <button onclick="window.afficherTouteLaTimeline();" style="background:#2c2c35; color:#fff; border:1px solid #aaa; padding:4px 8px; font-size:0.8rem; border-radius:3px; cursor:pointer;">Réinitialiser la vue</button>
        </div>
    `;

    filtrés.forEach((msg, index) => {
        const parsedHTML = parseRP(msg.text);
        readerDiv.innerHTML += `
            <div style="margin-bottom: 30px; background:#121218; padding:15px; border-radius:6px; border:1px solid #1c1c24;">
                <div style="color:#a777e3; font-size:0.8rem; font-weight:bold; margin-bottom:8px; border-bottom:1px dotted #2c2c35; padding-bottom:4px;">RÉPLIQUE N°${index + 1} — Ajoutée le ${msg.date}</div>
                <div style="color:#f0f0f0; font-family:Georgia, serif; font-size:1.25rem; line-height:1.5;">${parsedHTML}</div>
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

    readerDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%;">
            <div style="border-bottom:1px solid rgba(167,119,227,0.3); padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:#777; font-size:0.8rem;">AUTEUR DE LA RÉPLIQUE</span>
                    <h2 style="margin:0; color:#ffcc00; font-family:'Segoe UI', sans-serif; font-size:1.3rem;">${nomAuteur}</h2>
                </div>
                <div style="text-align:right;">
                    <span style="color:#777; font-size:0.8rem;">DATE DU POST</span>
                    <div style="color:#aaa; font-size:0.9rem; font-weight:bold;">${msgBase.date || "Inconnue"}</div>
                </div>
            </div>
            <div class="rp-post-content" style="flex:1; overflow-y:auto; padding-right:10px; color:#f0f0f0; font-family:Georgia, serif; font-size:1.35rem; line-height:1.6;">
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

    const styleElement = document.createElement("style");
    styleElement.innerHTML = `
        .badge-nouveau {
            display: inline-block !important;
            background-color: #2ecc71 !important;
            color: #fff !important;
            font-size: 0.65rem !important;
            font-weight: bold !important;
            padding: 2px 5px !important;
            border-radius: 3px !important;
            margin-left: 6px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            box-shadow: 0 0 6px #2ecc71 !important;
            animation: lueurPulsation 2s infinite ease-in-out !important;
        }
        .post-sommaire-nouveau {
            box-shadow: inset 4px 0 10px rgba(46, 204, 113, 0.12) !important;
        }
        @keyframes lueurPulsation {
            0% { box-shadow: 0 0 4px #2ecc71; opacity: 0.8; }
            50% { box-shadow: 0 0 12px #2ecc71; opacity: 1; }
            100% { box-shadow: 0 0 4px #2ecc71; opacity: 0.8; }
        }
    `;
    document.head.appendChild(styleElement);

    const modalHTML = `
    <div id="rpSummaryModal" style="display: none; position: fixed; z-index: 200000; left: 0; top: 0; width: 100vw; height: 100vh; background: rgba(5,5,8,0.95); backdrop-filter: blur(10px); justify-content: center; align-items: center; font-family:'Segoe UI', sans-serif;">
        <div style="background: #0c0c10; border: 1px solid #ffcc00; box-shadow: 0 0 35px rgba(255, 204, 0, 0.15); width: 95vw; height: 90vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden;">
            
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255, 204, 0, 0.2); display: flex; justify-content: space-between; align-items: center; background: #121218;">
                <div style="display:flex; align-items:center; gap:15px;">
                    <h3 style="margin: 0; color: #ffcc00; font-size:1.2rem; display:flex; align-items:center; gap:8px;">📊 Sommaire Tactique & Historique de Guerre</h3>
                </div>
                <button onclick="document.getElementById('rpSummaryModal').style.display='none'" style="background: none; border: none; color: #fff; font-size: 28px; cursor: pointer; line-height: 1;">&times;</button>
            </div>

            <div style="flex: 1; display: flex; overflow: hidden; background:#08080c;">
                
                <div style="width: 250px; border-right: 1px solid #1c1c24; display: flex; flex-direction: column; background:#0c0c12;">
                    <div style="padding:10px; font-size:0.75rem; color:#777; font-weight:bold; letter-spacing:1px; border-bottom:1px solid #1c1c24;">ORDRE D'ENTRÉE DES PERSOS</div>
                    <div id="summaryCharactersList" style="flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;"></div>
                </div>

                <div style="width: 320px; border-right: 1px solid #1c1c24; display: flex; flex-direction: column; background:#0e0e16;">
                    <div style="padding:10px; font-size:0.75rem; color:#777; font-weight:bold; letter-spacing:1px; border-bottom:1px solid #1c1c24;">CHRONOLOGIE DES POSTS</div>
                    <div id="summaryTimelineTracks" style="flex:1; overflow-y:auto; padding:10px;"></div>
                </div>

                <div id="summaryPostReader" style="flex: 1; padding: 25px; overflow-y: auto; background: #06060a;"></div>

            </div>
        </div>
    </div>`;

    const range = document.createRange();
    const fragment = range.createContextualFragment(modalHTML);
    document.body.appendChild(fragment);
}