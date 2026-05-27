import { charactersDB } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ METS TA CLÉ API MISTRAL (console.mistral.ai) ICI - PLAN EXPERIMENT 100% GRATUIT
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

let currentActiveRpId = null;
let currentActiveCharName = null;

/**
 * ============================================================================
 * 1. SECTION : SALON DE CO-ÉCRITURE MULTI-JOUEURS (MODALE)
 * ============================================================================
 */

/**
 * Ouvre la modale de co-écriture et configure l'environnement multi-joueurs
 * @param {string} rpId - L'UID du document Firestore du RP en attente (Pending)
 * @param {string} charName - Le nom du personnage associé à ce RP
 */
window.openCoWriteModal = async function(rpId, charName) {
    currentActiveRpId = rpId;
    currentActiveCharName = charName;
    
    const modal = document.getElementById("coWriteModal");
    const title = document.getElementById("coWriteModalTitle");
    const historyLog = document.getElementById("rpHistoryLog");
    const outputDiv = document.getElementById("coWriteAiOutput");
    const contextArea = document.getElementById("coWriteContext");
    const senderInput = document.getElementById("coWriteSenderName");

    if (!modal) return;
    
    title.innerText = `🖋️ Co-Écriture : ${charName}`;
    contextArea.value = "";
    outputDiv.innerHTML = "Prêt à rédiger avec l'aide de Mistral Large.";
    
    // Par défaut, on pré-remplit avec le nom de ton personnage actif
    if (senderInput) senderInput.value = charName; 
    
    historyLog.innerHTML = "<span style='color: #aaa;'>Chargement de l'historique depuis Firestore...</span>";
    modal.style.display = "flex";

    // Chargement de l'historique des messages du RP
    await loadRpHistory(rpId);
};

/**
 * Ferme la modale de co-écriture
 */
window.closeCoWriteModal = function() {
    const modal = document.getElementById("coWriteModal");
    if (modal) modal.style.display = "none";
};

/**
 * Récupère et affiche les répliques de la sous-collection Firestore "messages"
 * @param {string} rpId - L'UID du document RP parent
 */
async function loadRpHistory(rpId) {
    const historyLog = document.getElementById("rpHistoryLog");
    if (!historyLog) return;

    try {
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        // Tri chronologique ascendant pour respecter le fil de discussion
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            historyLog.innerHTML = "<span style='color: #777;'>Aucun message enregistré. Ajuste le nom de l'auteur, colle son texte et enregistre-le pour démarrer !</span>";
            return;
        }

        historyLog.innerHTML = "";
        snap.forEach(docSnap => {
            const msg = docSnap.data();
            
            // Code couleur : Violet pour ton personnage, jaune/or pour les autres partenaires
            const isMe = msg.sender === currentActiveCharName;
            const badgeColor = isMe ? "#a777e3" : "#ffcc00";
            
            historyLog.innerHTML += `
                <div style="margin-bottom: 8px; border-bottom: 1px solid #1c1c24; padding-bottom: 5px;">
                    <span style="color: ${badgeColor}; font-weight: bold;">[${msg.sender}] :</span>
                    <span style="color: #e0e0e0; font-size: 0.85rem;">${msg.text}</span>
                </div>
            `;
        });
        
        // Défilement automatique vers le bas du journal
        historyLog.scrollTop = historyLog.scrollHeight;

    } catch (err) {
        console.error("Erreur historique:", err);
        historyLog.innerHTML = "<span style='color: #e74c3c;'>Impossible de charger l'historique.</span>";
    }
}


/**
 * ============================================================================
 * 2. SECTION : COACH LITTÉRAIRE DE LA ZONE D'AJOUT PRINCIPALE
 * ============================================================================
 */

/**
 * Fonction historique du tableau de bord (Analyse de style, Idées d'intrigues, Compteur de mots)
 * @param {string} typeAction - 'rediger' | 'idees' | 'stats'
 */
window.demanderLeCoachIA = async function(typeAction) {
    const textArea = document.getElementById("content_sent");
    const outputDiv = document.getElementById("ai-coach-output");
    
    if (!textArea || !outputDiv) return;

    // Trouver le personnage sélectionné dans la galerie
    const activeCard = document.querySelector('.char-card.active');
    if (!activeCard) {
        outputDiv.innerHTML = `<p style="color:#e74c3c;">⚠️ S'il te plaît, sélectionne d'abord un personnage dans la galerie !</p>`;
        return;
    }
    const charName = activeCard.getAttribute('data-name');
    const charData = charactersDB[charName];

    // Calcul local instantané des statistiques
    const texteSaisi = textArea.value.trim();
    const nbCaracteres = texteSaisi.length;
    const nbMots = texteSaisi ? texteSaisi.split(/\s+/).length : 0;

    // Rendu immédiat si l'action demande uniquement les statistiques
    if (typeAction === 'stats') {
        outputDiv.innerHTML = `
            <div style="border: 1px solid #2ecc71; padding: 12px; border-radius: 6px; background: rgba(46, 204, 113, 0.05); text-align: left;">
                <h4 style="margin:0; color:#2ecc71;">📊 Analyse de Saisie :</h4>
                <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #e0e0e0; line-height: 1.4;">
                    • <strong>Nombre de mots :</strong> ${nbMots}<br>
                    • <strong>Nombre de caractères (avec espaces) :</strong> ${nbCaracteres}
                </p>
            </div>
        `;
        return;
    }

    // Préparation des directives Système de base pour Mistral
    let systemPrompt = `Tu es un auteur de jeu de rôle (RPG) textuel littéraire de haut niveau et un assistant de co-écriture. `;
    systemPrompt += `Tu écris et penses exactement comme un joueur humain passionné. Évite absolument les phrases de robot ou d'IA du style "En tant qu'intelligence artificielle..." ou "Voici une proposition...". Passe directement au texte.\n\n`;
    systemPrompt += `Tu es l'interprète, l'écrivain et le gardien du personnage nommé "${charName}".\n`;
    
    if (charData) {
        systemPrompt += `Tu maîtrises absolument par cœur sa fiche technique complète, son passé, son caractère et ses secrets. Tu dois impérativement les respecter :\n`;
        systemPrompt += `--- FICHE DE CONTEXTE ET LORE ---\n`;
        if (charData.resume) systemPrompt += `Résumé : ${charData.resume}\n`;
        if (charData.complete) systemPrompt += `Détails complets : ${charData.complete}\n`;
        systemPrompt += `---------------------------------\n\n`;
    }

    systemPrompt += `Directives d'écriture littéraire :\n`;
    systemPrompt += `- Adopte un style d'écriture immersif, fluide, profondément humain, axé sur les descriptions physiques, l'environnement et les pensées intérieures.\n`;
    systemPrompt += `- Respecte la psychologie du personnage (ses peurs, sa façon de parler, ses tics ou ses blocages relationnels).\n`;
    systemPrompt += `- Ne fais aucune transition méta, donne directement le texte brut du RP rédigé pour qu'il soit copiable sans retouche.`;

    let userPrompt = "";

    if (typeAction === 'rediger') {
        if (!texteSaisi) {
            outputDiv.innerHTML = `<p style="color:#ffcc00;">⚠️ Pour que je rédige la suite du RP, colle d'abord la dernière réponse de ton partenaire (ou ton début de texte) dans la zone de texte ci-dessus.</p>`;
            return;
        }
        userPrompt = `Voici la situation actuelle du RP (cela peut être le message de mon partenaire ou mon ébauche) :\n"""\n${texteSaisi}\n"""\n\n`;
        userPrompt += `Rédige la suite directe et logique de ce RP en incarnant pleinement mon personnage "${charName}". Fais une réponse complète d'environ 2 à 4 paragraphes très immersifs, bien structurés et prêts à être postés.`;
    } 
    else if (typeAction === 'idees') {
        userPrompt = `En te basant sur l'ensemble de la fiche de mon personnage "${charName}" (ses peurs, ses relations, son lore), invente 3 propositions d'idées de RP originales, de rencontres inattendues ou de dilemmes dramatiques que je pourrais proposer à d'autres joueurs pour le faire évoluer. Sois percutant et créatif.`;
    }

    outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">✍/ Mistral étudie la fiche de ${charName} et prend sa plume...</p>`;

    // Appel API Standard
    try {
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.75
            })
        });

        const data = await response.json();
        if (data.choices && data.choices[0].message.content) {
            let reponseIA = data.choices[0].message.content;
            let reponseHtml = reponseIA.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

            outputDiv.innerHTML = `
                <div style="border-left: 3px solid #a777e3; padding-left: 15px; background: rgba(167,119,227,0.02); padding: 15px; border-radius: 6px; text-align: left; max-height: 400px; overflow-y: auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <h4 style="margin:0; color:#a777e3;">🎭 Proposition du Co-Pilote :</h4>
                        <button id="btnCopierReponse" style="background:#a777e3; color:#fff; border:none; padding:4px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:600;">Copier le texte</button>
                    </div>
                    <p style="font-size:0.95rem; line-height:1.5; color:#e0e0e0; font-family: 'Georgia', serif;">${reponseHtml}</p>
                </div>
            `;

            document.getElementById("btnCopierReponse").addEventListener("click", function() {
                navigator.clipboard.writeText(reponseIA);
                this.innerText = "✓ Copié !";
            });
        } else {
            outputDiv.innerHTML = `<p style="color:#e74c3c;">❌ Erreur : Impossible de décoder la réponse de Mistral.</p>`;
        }
    } catch (error) {
        console.error(error);
        outputDiv.innerHTML = `<p style="color:#e74c3c;">❌ Erreur lors de la communication avec Mistral AI.</p>`;
    }
};


/**
 * ============================================================================
 * 3. SECTION : ÉCOUTEURS ET LOGIQUE D'ÉVÉNEMENTS (DOM)
 * ============================================================================
 */
document.addEventListener("DOMContentLoaded", () => {
    const btnSave = document.getElementById("btnSaveContext");
    const btnAi = document.getElementById("btnAiCoWrite");

    // Bouton : Enregistrer le message saisi dans la sous-collection Firestore
    if (btnSave) {
        btnSave.addEventListener("click", async () => {
            const textInput = document.getElementById("coWriteContext");
            const senderInput = document.getElementById("coWriteSenderName");
            
            if (!textInput || !textInput.value.trim() || !senderInput || !senderInput.value.trim() || !currentActiveRpId) {
                alert("Erreur : Assure-toi d'indiquer l'auteur du texte ainsi qu'un contenu valide.");
                return;
            }

            try {
                const messagesRef = collection(db, "rps_pending", currentActiveRpId, "messages");
                await addDoc(messagesRef, {
                    sender: senderInput.value.trim(), // Enregistre dynamiquement le nom spécifié
                    text: textInput.value.trim(),
                    createdAt: serverTimestamp() // Indexé sur l'horloge officielle de Firebase
                });
                
                textInput.value = "";
                await loadRpHistory(currentActiveRpId); // Actualise la vue
            } catch (err) {
                console.error("Erreur d'écriture sous-collection:", err);
                alert("Erreur lors du traitement et de l'enregistrement du message.");
            }
        });
    }

    // Bouton : Faire réfléchir l'IA sur l'historique complet de la modale
    if (btnAi) {
        btnAi.addEventListener("click", async () => {
            const outputDiv = document.getElementById("coWriteAiOutput");
            const textInput = document.getElementById("coWriteContext");
            if (!outputDiv || !currentActiveRpId) return;

            outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">✍️ Mistral examine le fil du RP et prépare ta réplique...</p>`;

            // Identité littéraire
            const charData = charactersDB[currentActiveCharName];
            let systemPrompt = `Tu es un auteur de jeu de rôle textuel littéraire d'élite. Tu écris comme un humain.\n`;
            systemPrompt += `Tu incarnes actuellement le personnage nommé "${currentActiveCharName}".\n`;
            if (charData) {
                systemPrompt += `Rappel de son identité et de son lore à respecter : ${charData.resume} ${charData.complete || ''}\n`;
            }

            // Extraction chronologique de tous les messages de la sous-collection
            let historiqueContext = "Voici l'ordre exact des derniers messages postés dans le RP à suivre pour ta continuité :\n";
            try {
                const messagesRef = collection(db, "rps_pending", currentActiveRpId, "messages");
                const q = query(messagesRef, orderBy("createdAt", "asc"));
                const snap = await getDocs(q);
                
                snap.forEach(docSnap => {
                    const msg = docSnap.data();
                    historiqueContext += `[${msg.sender}]: ${msg.text}\n`;
                });
            } catch (e) {
                console.warn("Échec de la récupération de la sous-collection pour le contexte IA.");
            }

            // Intégrer un début de paragraphe ou une note non enregistrée si présente
            if (textInput && textInput.value.trim()) {
                historiqueContext += `[Élément ou action supplémentaire à intégrer immédiatement]: ${textInput.value.trim()}\n`;
            }

            historiqueContext += `\nRédige la réplique suivante pour mon personnage "${currentActiveCharName}". Produis directement un texte brut immersif (2 à 3 paragraphes), sans aucun commentaire méta autour.`;

            // Envoi de la structure complète à Mistral Large
            try {
                const response = await fetch(MISTRAL_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": `Bearer ${MISTRAL_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "mistral-large-latest",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: historiqueContext }
                        ],
                        temperature: 0.75
                    })
                });

                const data = await response.json();
                if (data.choices && data.choices[0].message.content) {
                    let textAi = data.choices[0].message.content;
                    let textHtml = textAi.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\"/g, "<strong>$1</strong>");

                    outputDiv.innerHTML = `
                        <div style="border-left: 3px solid #a777e3; padding-left: 12px; background: rgba(167,119,227,0.02); padding: 10px; border-radius: 4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <span style="color:#a777e3; font-weight:bold;">Réponse suggérée :</span>
                                <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                            </div>
                            <p style="color:#fff; font-size:0.9rem; font-family:Georgia, serif; line-height:1.4; margin:0;">${textHtml}</p>
                        </div>
                    `;

                    document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                        navigator.clipboard.writeText(textAi);
                        this.innerText = "✓ Copié !";
                    });
                } else {
                    outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur lors de la génération automatique.</span>";
                }
            } catch (err) {
                outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur réseau détectée avec l'API Mistral.</span>";
            }
        });
    }
});

// Rend les fonctions accessibles depuis le HTML global
window.openCoWriteModal = openCoWriteModal;
window.closeCoWriteModal = closeCoWriteModal;