import { charactersDB, fiches } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js'; // 🛠️ Importation du parseur Markdown existant

// ⚠️ CONFIGURATION MISTRAL
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

let currentActiveRpId = null;
let currentActiveCharName = null;

/**
 * ============================================================================
 * 1. FONCTION : OUVERTURE DE LA MODALE
 * ============================================================================
 */
window.openCoWriteModal = async function(rpId, charName) {
    currentActiveRpId = rpId;
    currentActiveCharName = charName;
    
    const modal = document.getElementById("coWriteModal");
    const title = document.getElementById("coWriteModalTitle");
    const historyLog = document.getElementById("rpHistoryLog");
    const outputDiv = document.getElementById("coWriteAiOutput");
    const contextArea = document.getElementById("coWriteContext");
    const senderSelect = document.getElementById("coWriteSenderName");

    if (!modal) return;
    
    contextArea.value = "";
    outputDiv.innerHTML = "Prêt à rédiger avec l'aide de Mistral Large.";
    historyLog.innerHTML = "<span style='color: #aaa;'>Chargement des données du RP...</span>";
    
    modal.style.display = "flex";

    try {
        const pendingDocRef = doc(db, "rps_received", rpId);
        const pendingSnap = await getDoc(pendingDocRef);
        
        if (pendingSnap.exists()) {
            const pendingData = pendingSnap.data();
            title.innerHTML = `🖋️ Co-Écriture : <span style="color:#a777e3;">${pendingData.title || 'Sans titre'}</span> (${charName})`;

            if (senderSelect) {
                senderSelect.innerHTML = ""; 
                
                const optMe = document.createElement("option");
                optMe.value = charName;
                optMe.innerText = `${charName} (Moi)`;
                senderSelect.appendChild(optMe);

                const listParticipants = pendingData.participants || [];
                listParticipants.forEach(pName => {
                    if (pName.trim() !== "") {
                        const opt = document.createElement("option");
                        opt.value = pName.trim();
                        opt.innerText = pName.trim();
                        senderSelect.appendChild(opt);
                    }
                });
            }
        }
    } catch (err) {
        console.error("Erreur lors de la configuration de la modale :", err);
    }

    await loadOrCreateRpHistory(rpId, charName);
};

/**
 * ============================================================================
 * 2. FONCTION : FERMETURE DE LA MODALE
 * ============================================================================
 */
window.closeCoWriteModal = function() {
    const modal = document.getElementById("coWriteModal");
    if (modal) {
        modal.style.display = "none";
    }
};

/**
 * ============================================================================
 * 3. LOGIQUE ENTRÉE/SORTIE & RENDU DES MESSAGES (HISTORIQUE)
 * ============================================================================
 */
async function loadOrCreateRpHistory(rpId, charName) {
    const historyLog = document.getElementById("rpHistoryLog");
    if (!historyLog) return;

    try {
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        let snap = await getDocs(q);

        if (snap.empty) {
            const pendingDocRef = doc(db, "rps_received", rpId);
            const pendingSnap = await getDoc(pendingDocRef);

            if (pendingSnap.exists()) {
                const pendingData = pendingSnap.data();
                const initialContent = pendingData.content || "";
                const listParticipants = pendingData.participants || [];
                const premierAuteur = listParticipants[0] || "Partenaire En Face";

                if (initialContent.trim() !== "") {
                    await addDoc(messagesRef, {
                        sender: premierAuteur,
                        text: initialContent.trim(),
                        createdAt: serverTimestamp()
                    });
                    snap = await getDocs(q); 
                }
            }
        }

        if (snap.empty) {
            historyLog.innerHTML = "<span style='color: #777;'>Aucun texte historique. Enregistre une première réplique pour démarrer !</span>";
            return;
        }

        historyLog.innerHTML = "";
        
        // Parcours et application du Markdown sur chaque élément historique
        snap.forEach(docSnap => {
            const msg = docSnap.data();
            const isMe = msg.sender === charName;
            const badgeColor = isMe ? "#a777e3" : "#ffcc00";
            
            // 🛠️ Application de parseRP() pour transcrire le Markdown en HTML
            const textHTML = parseRP(msg.text);
            
            historyLog.innerHTML += `
                <div style="margin-bottom: 12px; border-bottom: 1px solid #1c1c24; padding-bottom: 8px;">
                    <div style="color: ${badgeColor}; font-weight: bold; margin-bottom: 3px;">[${msg.sender}] :</div>
                    <div style="color: #e0e0e0; font-size: 0.9rem; line-height: 1.4; font-family: Georgia, serif;">${textHTML}</div>
                </div>
            `;
        });
        
        historyLog.scrollTop = historyLog.scrollHeight;
    } catch (err) {
        console.error(err);
        historyLog.innerHTML = "<span style='color: #e74c3c;'>Erreur de traitement de l'historique.</span>";
    }
}

/**
 * ============================================================================
 * 4. INITIALISATION DES ACTIONS BOUTONS ET ENVOI DE PROMPT À L'IA
 * ============================================================================
 */
document.addEventListener("DOMContentLoaded", () => {
    const btnSave = document.getElementById("btnSaveContext");
    const btnAi = document.getElementById("btnAiCoWrite");

    if (btnSave) {
        btnSave.addEventListener("click", async () => {
            const textInput = document.getElementById("coWriteContext");
            const senderSelect = document.getElementById("coWriteSenderName");
            
            if (!textInput || !textInput.value.trim() || !senderSelect || !senderSelect.value || !currentActiveRpId) {
                alert("Erreur : Remplis correctement le texte !");
                return;
            }

            try {
                const messagesRef = collection(db, "rps_pending", currentActiveRpId, "messages");
                await addDoc(messagesRef, {
                    sender: senderSelect.value, 
                    text: textInput.value.trim(),
                    createdAt: serverTimestamp()
                });
                textInput.value = "";
                await loadOrCreateRpHistory(currentActiveRpId, currentActiveCharName);
            } catch (err) { console.error(err); }
        });
    }

    if (btnAi) {
        btnAi.addEventListener("click", async () => {
            const outputDiv = document.getElementById("coWriteAiOutput");
            const textInput = document.getElementById("coWriteContext");
            if (!outputDiv || !currentActiveRpId) return;

            // 🎯 RÉCUPÉRATION DE LA CONSIGNE D'AIGUILLAGE
            const aiInstructionsElement = document.getElementById("coWriteAiInstructions");
            const instructions = aiInstructionsElement ? aiInstructionsElement.value.trim() : "";

            outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">✍️ L'IA étudie la fiche et l'historique complet...</p>`;

            let maFicheDetaillee = "Pas de fiche spécifique trouvée. Respecte le tempérament de base.";
            if (fiches) {
                for (const key in fiches) {
                    if (currentActiveCharName.toLowerCase().includes(key) || key.toLowerCase().includes(currentActiveCharName.toLowerCase())) {
                        maFicheDetaillee = fiches[key].resume + "\n" + (fiches[key].complete || "");
                        break;
                    }
                }
            }

// ============================================================================
// MODIFICATION POUR SOUDER LES DIRECTIVES ET LES RÈGLES DE RP ENSEMBLE
// ============================================================================

            let systemPrompt = `Tu es un auteur d'élite de RP textuel. Écris de façon très humaine, fluide et immersive.
Tu dois rédiger la suite du RP en incarnant EXCLUSIVEMENT le personnage du joueur : "${currentActiveCharName}".\n\n`;

            if (instructions) {
                // Ici, on demande à l'IA d'intégrer l'ordre TOUT EN respectant les règles communautaires
                systemPrompt += `👉 DIRECTIVE DE SCÉNARIO ET DE STYLE :
Tu dois impérativement adapter le récit, l'action ou le ton en fonction de cette demande de l'utilisateur : "${instructions}"
Attention : Cette demande doit être exécutée TOUT EN RESPECTANT STRICTEMENT le formatage, la personne grammaticale et l'identité du personnage décrits ci-dessous. Fusionne cette demande avec les règles du RP.\n\n`;
            }

            systemPrompt += `Consignes narratives absolues :
1. RÈGLE D'OR : Écris TOUJOURS à la 3ème personne du singulier (Il, Elle, etc.). Ne dis JAMAIS "Je" ou "Tu".
2. LIMITE DU RÔLE : Tu joues UNIQUEMENT "${currentActiveCharName}". Tu ne dois JAMAIS faire parler, agir, réagir ou penser les personnages des autres partenaires. Reste centré sur mon personnage.
3. FORMATAGE TEXTE : Utilise intelligemment le formatage Markdown standard du RP (par exemple, des astérisques pour l'italique lors des actions, du texte brut ou des guillemets pour les paroles) si cela correspond aux habitudes de l'historique.
4. RESPECT DE LA FICHE : Tu dois scrupuleusement respecter l'âge, le caractère, le ton et l'historique de la fiche de mon personnage :
${maFicheDetaillee}
`;
            let historiqueContext = "Voici la discussion telle qu'elle s'est déroulée chronologiquement :\n";
            try {
                const messagesRef = collection(db, "rps_pending", currentActiveRpId, "messages");
                const q = query(messagesRef, orderBy("createdAt", "asc"));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const m = d.data();
                    historiqueContext += `[${m.sender}]: ${m.text}\n`;
                });
            } catch (e) {}

            if (textInput && textInput.value.trim()) {
                historiqueContext += `[Note ou action contextuelle récente] : ${textInput.value.trim()}\n`;
            }

            historiqueContext += `\nRédige la réplique ou l'action suivante pour mon personnage "${currentActiveCharName}". Applique la directive demandée tout en respectant scrupuleusement les contraintes de mise en page RP (3ème personne, style, Markdown). Ne fais aucun commentaire hors-RP avant ou après le texte généré.`;

            try {
                const response = await fetch(MISTRAL_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
                    body: JSON.stringify({ model: "mistral-large-latest", messages: [{role:"system", content:systemPrompt}, {role:"user", content:historiqueContext}], temperature: 0.90 })
                });
                
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    let textAi = data.choices[0].message.content;
                    
                    // 🛠️ Application de parseRP() pour traiter la réponse de l'IA avant affichage
                    const textAiHTML = parseRP(textAi);

                    outputDiv.innerHTML = `
                        <div style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="color:#a777e3; font-weight:bold;">Suggéré pour ${currentActiveCharName} :</span>
                                <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                            </div>
                            <div style="color:#fff; font-size:0.9rem; font-family:Georgia, serif; line-height:1.4; margin:0;">${textAiHTML}</div>
                        </div>
                    `;
                    
                    document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                        navigator.clipboard.writeText(textAi);
                        this.innerText = "✓ Copié !";
                    });
                }
            } catch (err) { 
                outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur de transmission API.</span>"; 
            }
        });
    }
});