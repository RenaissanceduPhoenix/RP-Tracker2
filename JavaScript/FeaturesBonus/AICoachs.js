import { charactersDB, fiches } from './CharacterData.js';
import { catBehaviorKnowledge } from './CatBehaviorData.js';
import { db } from '../Firebase.js';
import { collection, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js'; // 🛠️ Importation du parseur Markdown existant

// ⚠️ CONFIGURATION MISTRAL
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

window.currentActiveRpId = null;
window.currentActiveCharName = null;

/**
 * ============================================================================
 * 1. FONCTION : OUVERTURE DE LA MODALE
 * ============================================================================
 */
window.openCoWriteModal = async function(rpId, charName) {
    window.currentActiveRpId = rpId;
    window.currentActiveCharName = charName;
    
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

        // 🌟 LE CONSOLE.LOG DE CONTRÔLE ICI :
        console.log(`%c📖 [Vérification] Collection 'messages' chargée : ${snap.size} réplique(s) de jeu récupérée(s) pour le RP [${rpId}].`, "color: #ffcc00; font-weight: bold;");

        if (snap.empty) {
            const pendingDocRef = doc(db, "rps_received", rpId);
            const pendingSnap = await getDoc(pendingDocRef);
            // ... reste de ton code initial ...

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
            
            if (!textInput || !textInput.value.trim() || !senderSelect || !senderSelect.value || !window.currentActiveRpId) {
                alert("Erreur : Remplis correctement le texte !");
                return;
            }

            try {
                const auteurDuMessage = senderSelect.value; // Le personnage sélectionné dans la liste déroulante

                const messagesRef = collection(db, "rps_pending", window.currentActiveRpId, "messages");
                await addDoc(messagesRef, {
                    sender: auteurDuMessage, 
                    text: textInput.value.trim(),
                    createdAt: serverTimestamp()
                });
                
                // 🌟 CONDITION EXCLUSIVE DE SÉCURITÉ :
                // On nettoie la mémoire IA UNIQUEMENT si l'auteur du message est TOI (ton perso actif)
                if (auteurDuMessage.toLowerCase() === window.currentActiveCharName.toLowerCase()) {
                    if (typeof window.clearAiHistory === "function") {
                        await window.clearAiHistory(window.currentActiveRpId);
                    }
                }

                textInput.value = "";
                await loadOrCreateRpHistory(window.currentActiveRpId, window.currentActiveCharName);
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

            outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">✍️ L'IA consulte la mémoire de la conversation et l'historique...</p>`;

            // 1. Récupération de la fiche du personnage
            let maFicheDetaillee = "Pas de fiche spécifique trouvée. Respecte le tempérament de base.";
            if (fiches) {
                for (const key in fiches) {
                    if (currentActiveCharName.toLowerCase().includes(key) || key.toLowerCase().includes(currentActiveCharName.toLowerCase())) {
                        maFicheDetaillee = fiches[key].resume + "\n" + (fiches[key].complete || "");
                        break;
                    }
                }
            }

            // 1.5 Génération du dictionnaire du comportement félin
            let catLorePrompt = "GUIDE COMPORTEMENTAL FÉLIN (À utiliser pour enrichir le langage corporel) :\n";
            for (const category in catBehaviorKnowledge) {
                for (const behavior in catBehaviorKnowledge[category]) {
                    catLorePrompt += `- ${behavior.replace(/_/g, ' ').toUpperCase()} : ${catBehaviorKnowledge[category][behavior]}\n`;
                }
            }

            // 2. Construction du System Prompt de base
            // 2. Construction du System Prompt de base (Optimisé pour l'écriture organique/humaine)
            let systemPrompt = `Tu es un auteur d'élite de RP textuel. Écris de façon très humaine, fluide et immersive.
Tu dois rédiger la suite du RP en incarnant EXCLUSIVEMENT le personnage du joueur : "${currentActiveCharName}".\n\n`;

            if (instructions) {
                systemPrompt += `👉 DIRECTIVE DE SCÉNARIO ET DE STYLE :
Tu dois impérativement adapter le récit, l'action ou le ton en fonction de cette demande de l'utilisateur : "${instructions}"
Attention : Cette demande doit être exécutée TOUT EN RESPECTANT STRICTEMENT le formatage, la personne grammaticale et l'identité du personnage décrits ci-dessous. Fusionne cette demande avec les règles du RP.\n\n`;
            }

            systemPrompt += `Consignes narratives et stylistiques absolues (Anti-Détection IA) :
1. RÈGLE D'OR : Écris TOUJOURS à la 3ème personne du singulier (Il, Elle, etc.). Ne dis JAMAIS "Je" ou "Tu".
2. LIMITE DU RÔLE : Tu joues UNIQUEMENT "${currentActiveCharName}". Tu ne dois JAMAIS faire parler, agir, réagir ou penser les personnages des autres partenaires. Reste centré sur mon personnage.
3. FORMATAGE TEXTE : Utilise intelligemment le formatage Markdown standard du RP (des astérisques pour l'italique lors des actions, du texte brut ou des guillemets pour les paroles).

5. MÉTRIQUES D'ÉCRITURE HUMAINE (BURSTINESS & PERPLEXITY) :
- VARIABILITÉ DU RYTHME : Alterne brutalement la structure et la longueur de tes phrases. Fais de longues descriptions poétiques, suivies immédiatement d'une phrase ultra-courte de deux ou trois mots pour marquer un impact, une hésitation ou une rupture. Ne garde JAMAIS le même rythme d'un paragraphe à l'autre.
- DÉVIATION DE PROBABILITÉ : Évite les structures de transition trop parfaites et répétitives au début de tes paragraphes (bannit les listes de "Puis, d'un geste...", "Soudain...", "Un frisson..."). Entre directement dans l'action, la pensée brute ou la sensation physique.
- IMPERFECTIONS NATURELLES : Incorpore des tics de langage corporel réalistes et parfois abrupts propres à l'univers félin (un miaulement étouffé, un coup de langue nerveux, un silence lourd, une hésitation dans le dialogue).
- CONCLUSION ORGANIQUE : Ne cherche pas à faire une "belle phrase de fin de chapitre" clichée. Termine sur un geste suspendu, un regard, ou une réplique directe.

🐱 NUANCES COMPORTEMENTALES (Interdiction d'utiliser des clichés humains comme 'embrasser'. Pioche obligatoirement dans ces descriptions physiques pour traduire l'émotion à l'écran) :
${catLorePrompt}

🔥 PROFIL PSYCHOLOGIQUE OBLIGATOIRE (À respecter à 100% dans le ton et les actions) :
<FICHE_PERSONNAGE>
${maFicheDetaillee}
</FICHE_PERSONNAGE>\n\n`;
            // 3. Récupération du contexte général du RP (les répliques du jeu)
            let historiqueContext = "Voici la discussion telle qu'elle s'est déroulée chronologiquement :\n";
            try {
                const messagesRef = collection(db, "rps_pending", currentActiveRpId, "messages");
                const q = query(messagesRef, orderBy("createdAt", "asc"));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const m = d.data();
                    historiqueContext += `[${m.sender}]: ${m.text}\n`;
                });
            } catch (e) { console.error(e); }

            systemPrompt += historiqueContext;

            // 4. PRÉPARATION DU TABLEAU DE MESSAGES POUR L'API (DÉBUT DES CONSOLE.LOG)
            console.log("%c=== 🚀 DÉBUT DE LA RECONSTRUCTION DU PROMPT MISTRAL ===", "color: #a777e3; font-weight: bold;");
            
            let mistralMessages = [
                { role: "system", content: systemPrompt }
            ];
            console.log("1. [SYSTEM] Instructions de base + Fiche personnage + Historique du RP injectés.");

            // 5. CHARGEMENT DE L'HISTORIQUE DE CONVERSATION (ai_history)
            console.log("%c=== 🧠 CHARGEMENT DE LA MÉMOIRE DE CONVERSATION (ai_history) ===", "color: #00bcd4; font-weight: bold;");
            try {
                const aiHistoryRef = collection(db, "rps_pending", currentActiveRpId, "ai_history");
                const qAi = query(aiHistoryRef, orderBy("createdAt", "asc"));
                const snapAi = await getDocs(qAi);
                
                if (snapAi.empty) {
                    console.log("-> Aucune ancienne consigne en mémoire. Première interaction avec l'IA pour ce RP.");
                } else {
                    let compteurMessage = 1;
                    snapAi.forEach(d => {
                        const m = d.data();
                        mistralMessages.push({
                            role: m.role, // "user" ou "assistant"
                            content: m.text
                        });
                        console.log(`   [Mémoire ${compteurMessage}] Rôle: %c${m.role}%c | Contenu : "${m.text.substring(0, 60)}..."`, 
                                    m.role === "user" ? "color: #ffcc00;" : "color: #4caf50;", "color: inherit;");
                        compteurMessage++;
                    });
                }
            } catch (e) { 
                console.error("❌ Erreur lors du chargement de l'historique IA:", e); 
            }

            // 6. DECORATION ET DEMANDE ACTUELLE (Le Prompt Courant - Recadrage Psychologique)
            let currentPrompt = "";
            if (textInput && textInput.value.trim()) {
                currentPrompt += `[Note ou action contextuelle récente transmise par le joueur] : ${textInput.value.trim()}\n`;
            }

            currentPrompt += `\nTu dois maintenant rédiger la réplique suivante pour mon personnage "${currentActiveCharName}".

⚠️ RAPPEL DES DIRECTIVES ABSOLUES POUR CETTE RÉPLIQUE :
- Incane EXCLUSIVEMENT "${currentActiveCharName}". Reste à 100% fidèle au caractère, au ton, à l'âge et à la mentalité décrits dans sa <FICHE_PERSONNAGE> ci-dessus. Ne le fais pas agir hors-caractère.
- Écris IMPÉRATIVEMENT à la 3ème personne du singulier (Pas de "Je", pas de "Tu").
- Applique le rythme HUMAIN (brise les phrases, pas de transitions clichées, fin ouverte suspendue).
- Génère UNIQUEMENT le texte du RP. Aucun commentaire hors-RP.`;

            mistralMessages.push({ role: "user", content: currentPrompt });
            
            console.log("%c=== 📝 AJOUT DE LA DEMANDE ACTUELLE ===", "color: #ff5722; font-weight: bold;");
            console.log(`2. [USER] Consigne envoyée : "${instructions ? instructions : 'Demande de suite simple'}"`);
            
            console.log("%c=== 📤 STRUCTURE FINALE ENVOYÉE À MISTRAL ===", "color: #a777e3; font-weight: bold;");
            console.table(mistralMessages); // Affiche le tableau d'analyse complet

            // 7. EXPÉDITION À L'API MISTRAL
            try {
                const response = await fetch(MISTRAL_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
                    body: JSON.stringify({ 
                        model: "mistral-large-latest", 
                        messages: mistralMessages, 
                        temperature: 0.9 
                    })
                });
                
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    let textAi = data.choices[0].message.content;
                    
                    // 8. ENREGISTREMENT DE LA SÉQUENCE DANS FIRESTORE
                    try {
                        const aiHistoryRef = collection(db, "rps_pending", currentActiveRpId, "ai_history");
                        
                        // Sauvegarde de ce que l'utilisateur a demandé
                        await addDoc(aiHistoryRef, {
                            role: "user",
                            text: instructions ? `[Consigne] : ${instructions}` : "[Demande de suite]",
                            createdAt: serverTimestamp()
                        });
                        
                        // Sauvegarde de ce que l'IA a répondu
                        await addDoc(aiHistoryRef, {
                            role: "assistant",
                            text: textAi,
                            createdAt: serverTimestamp()
                        });
                        console.log("💾 Échange sauvegardé avec succès dans l'historique Firebase !");
                    } catch (dbErr) { 
                        console.error("Erreur d'écriture dans l'historique IA Firestore:", dbErr); 
                    }

                    // Reset du champ consigne utilisateur pour la prochaine fois
                    if (aiInstructionsElement) aiInstructionsElement.value = "";

                    // 9. RENDU HTML DU MESSAGE ET AFFICHAGE DES MODALES ET BOUTONS
                    const textAiHTML = parseRP(textAi);

                    outputDiv.innerHTML = `
                        <div style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="color:#a777e3; font-weight:bold;">Suggéré pour ${currentActiveCharName} :</span>
                                <div style="display: flex; gap: 5px;">
                                    <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                                    <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                                </div>
                            </div>
                            <div style="color:#fff; font-size:1.2rem; font-family:Georgia, serif; line-height:1.4 !important; margin:0;">${textAiHTML}</div>
                        </div>

                        <div id="coWriteExclusiveModal" style="display: none; position: fixed; z-index: 100000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(5, 5, 8, 0.95); backdrop-filter: blur(8px); justify-content: center; align-items: center;">
                            <div style="background: #121218; border: 1px solid #a777e3; box-shadow: 0 0 30px rgba(167, 119, 227, 0.2); width: calc(100vw - 400px); max-width: 1500px; height: 80vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; position: relative;">
                                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(167, 119, 227, 0.3); display: flex; justify-content: space-between; align-items: center; background: #161622;">
                                    <h3 style="margin: 0; color: #ffcc00; font-family: 'Segoe UI', sans-serif;">📖 Visionnage Exclusif — ${currentActiveCharName}</h3>
                                    <button id="btnCloseExclusive" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
                                </div>
                                <div style="flex: 1; padding: 25px; overflow-y: auto; color: #f0f0f0; font-family: Georgia, serif; font-size: 1.4rem !important; line-height: 1.6; background: #0c0c10;">
                                    ${textAiHTML}
                                </div>
                            </div>
                        </div>
                    `;

                    // Lancement des écouteurs pour copier et visionner le texte en grand
                    document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                        navigator.clipboard.writeText(textAi);
                        this.innerText = "✓ Copié !";
                    });

                    document.getElementById("btnVoirCoWrite").addEventListener("click", function() {
                        const exclusiveModal = document.getElementById("coWriteExclusiveModal");
                        if (exclusiveModal) exclusiveModal.style.display = "flex";
                    });

                    document.getElementById("btnCloseExclusive").addEventListener("click", function() {
                        const exclusiveModal = document.getElementById("coWriteExclusiveModal");
                        if (exclusiveModal) exclusiveModal.style.display = "none";
                    });

                    document.getElementById("coWriteExclusiveModal").addEventListener("click", function(e) {
                        if (e.target === this) this.style.display = "none";
                    });
                }
            } catch (err) { 
                console.error("❌ Erreur de transmission API Mistral :", err);
                outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur de transmission API.</span>"; 
            }
        });
    }
});
/**
 * ============================================================================
 * 5. 🔥 SÉCURITÉ : NETTOYAGE STRATÉGIQUE DE LA MÉMOIRE IA
 * Déclenché uniquement quand le RP avance (statut changé ou pavé archivé) !
 * ============================================================================
 */
window.clearAiHistory = async function(rpId) {
    if (!rpId) return;
    try {
        const aiHistoryRef = collection(db, "rps_pending", rpId, "ai_history");
        // 🌟 Correction ici : On récupère tous les documents directement de la référence
        const snap = await getDocs(aiHistoryRef);
        
        if (!snap.empty) {
            const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);
            console.log(`%c🧹 [Sécurité IA] L'historique 'ai_history' du RP [${rpId}] a été nettoyé avec succès !`, "color: #2ecc71; font-weight: bold;");
        } else {
            console.log(`ℹ️ [Sécurité IA] L'historique 'ai_history' du RP [${rpId}] était déjà vide.`);
        }
    } catch (error) {
        console.error("❌ Erreur lors du nettoyage automatique de l'historique IA :", error);
    }
};