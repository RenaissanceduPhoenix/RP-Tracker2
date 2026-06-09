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

    // Gestion visuelle de la sélection multiple (Moods)
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("mood-btn")) {
        if (e.target.classList.contains("active")) {
            // Désactiver le bouton
            e.target.style.borderColor = "rgba(167, 119, 227, 0.4)";
            e.target.style.background = "#2c2c35";
            e.target.classList.remove("active");
        } else {
            // Activer le bouton (Changement de background pour bien le voir)
            e.target.style.borderColor = "#a777e3";
            e.target.style.background = "rgba(167, 119, 227, 0.2)";
            e.target.classList.add("active");
        }
    }
});

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

            // 🎯 DÉTERMINATION MULTIPLE DES TONS DIRECTEURS (MOODS)
const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
let moodInstruction = "";

if (activeMoodBtns.length > 0) {
    moodInstruction = "👉 CONFIGURATION DE L'AMBIANCE ET DU TON (Fusionne harmonieusement ces nuances dans le récit) :\n";
    
    // Dictionnaire des nuances comportementales félines
    const moodDictionary = {
        drague: "- DRAGUE : Le personnage montre un intérêt teinté de charme ou de malice. Regard insistant mais joueur, pas feutrés, port de tête fier, légers frôlements de queue ou de flancs, voix douce ou ronronnement discret.\n",
        romance: "- ROMANCE : Ton tendre, complice et intime. Gestes doux, oreilles tournées vers l'autre, queue qui s'enroule subtilement, regard confiant, réduction de la distance physique, contact de truffe ou coup de langue affectueux si la situation s'y prête.\n",
        combat: "- COMBAT / TENSION : Atmosphère hostile ou défensive. Griffes sorties, oreilles couchées, babines retroussées sur les crocs, feulements sourds, muscles bandés, posture basse prête à bondir. Phrases courtes et saccadées.\n",
        solennel: "- SOLENNEL : Ton digne, sérieux et protocolaire. Posture droite et immobile, regard fixe et pénétrant, voix claire, posée et mesurée. Les mouvements sont calmes, lents et dénués de panique, rappelant le respect du Code du Clan.\n",
        mystere: "- MYSTÈRE / SECRET : Ambiance méfiante et énigmatique. Regards en coin, oreilles pivotant au moindre bruit d'ambiance, voix basse, feutrée ou murmurée. Les mouvements sont discrets et calculés pour ne pas attirer l'attention.\n",
        tristesse: "- TRISTESSE : Ton abattu, lourd ou mélancolique. Regard fuyant ou ancré au sol, oreilles basses, queue traînant dans la poussière, mouvements lents, épaules voûtées. Soupirs ou voix brisée.\n",
        determination: "- DÉTERMINATION : Regard féroce et focalisé, mâchoire serrée, pas lourds et décidés ancrés dans le sol. Aucune hésitation dans les mouvements physiques, queue droite ou fouettant l'air avec fermeté.\n",
        bravoure: "- BRAVOURE : Attitude héroïque face au danger. Le personnage bombe le torse, ignore sa propre peur, fait face à la menace sans reculer, poils légèrement hérissés pour paraître plus grand et impressionnant.\n",
        courage: "- COURAGE : Force d'esprit et résilience. Le personnage surmonte ses doutes, garde une posture stable malgré l'adversité, montre un comportement protecteur envers ses alliés et reste maître de ses mouvements.\n"
    };

    activeMoodBtns.forEach(btn => {
        const moodKey = btn.getAttribute("data-mood");
        if (moodDictionary[moodKey]) {
            moodInstruction += moodDictionary[moodKey];
        }
    });
}

            outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">✍️ L'IA consulte la mémoire de la conversation et l'historique...</p>`;

            // 1. Récupération de la fiche du personnage
            const charData = charactersDB[currentActiveCharName] || {};
            const skillsText = charData.competences ? charData.competences.join(", ") : "Guerrier standard";
            
            let maFicheDetaillee = "Pas de fiche spécifique trouvée. Respecte le tempérament de base.";
            if (fiches) {
                for (const key in fiches) {
                    if (currentActiveCharName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(currentActiveCharName.toLowerCase())) {
                        maFicheDetaillee = (fiches[key].resume || "") + "\n" + (fiches[key].complete || "");
                        break;
                    }
                }
            }

            // 1.5 Génération du dictionnaire du comportement félin
            let catLorePrompt = "GUIDE COMPORTEMENTAL FÉLIN (À utiliser pour enrichir le langage corporel) :\n";
            if (typeof catBehaviorKnowledge === "object") {
                for (const category in catBehaviorKnowledge) {
                    for (const behavior in catBehaviorKnowledge[category]) {
                        catLorePrompt += `- ${behavior.replace(/_/g, ' ').toUpperCase()} : ${catBehaviorKnowledge[category][behavior]}\n`;
                    }
                }
            } else {
                catLorePrompt += "Comportement instinctif basé sur les sens, les oreilles, les feulements et les mouvements de queue.\n";
            }


            // 2. Construction du System Prompt de base (Optimisé pour l'écriture organique/humaine)
            let systemPrompt = `Tu es un coach d'écriture expert et un joueur d'élite pour un forum RPG écrit basé sur l'univers de La Guerre des Clans. 
Tu rédiges au nom du personnage suivant : ${currentActiveCharName}.

Fiche technique du personnage :
- Compétences et caractéristiques clés : ${skillsText}
- Profil psychologique & Histoire :
${maFicheDetaillee}

⚠️ DIRECTIVES DE SYNTAXE MARKDOWN IMPÉRATIVES (CRUCIAL POUR LE PARSEUR DU FORUM) :
Tu dois appliquer scrupuleusement la structure suivante, paragraphe par paragraphe. Ne mélange JAMAIS les styles d'astérisques au hasard.

1. PARAGRAPHES D'ACTIONS (En gras intégral) :
Tout paragraphe qui décrit un mouvement, un déplacement, un état physique ou une description environnementale DOIT commencer par "**" et se terminer par "**". Rien d'autre dans le paragraphe.
-> Exemple exact : **Étincelle de Vie sentit ses griffes s’enfoncer dans la mousse sans même qu’elle en ait conscience.**

2. PARAGRAPHES DE PENSÉES (En italique intégral) :
Tout paragraphe (ou phrase isolée sur sa propre ligne) représentant une pensée ou un monologue intérieur secret DOIT commencer par "*" et se terminer par "*".
-> Exemple exact : *Trop. C’est trop.*

3. DIALOGUES SIMPLES :
Toutes les répliques prononcées à haute voix doivent obligatoirement commencer par le chevron ">" suivi d'un espace simple au tout début de la ligne.
-> Exemple exact : > Oh, par le Clan.

4. DIALOGUES COMPLEXES AVEC INCISES NARRATIVES (RÈGLE CRUCIALE) :
Dans une ligne de dialogue commençant par "> ", si le personnage coupe sa parole pour faire une action ou si un verbe de parole est inséré (une incise), cette incise narrative DOIT être isolée en étant entourée de doubles astérisques (**). Le dialogue reprend ensuite normalement après l'incise sans répéter le ">".
-> Exemple exact à calquer : > Oh, par le Clan. **Sa voix claqua comme une branche sèche sous une patte.** Vous allez vraiment me faire ça aujourd’hui ?
-> Autre exemple exact : > Écoutez-moi bien, tous les deux. **Elle s’arrêta net, les pattes avant légèrement fléchies.** Ombre, tu arrêtes ton cinéma.



❌ INTERDICTIONS FORMELLES :
- Ne laisse jamais d'astérisques non fermés en fin de paragraphe.
- Ne commence jamais une action par un seul astérisque (*). L'action c'est toujours (**).
- Ne mets pas le symbole ">" au milieu d'un texte, uniquement tout au début de la ligne de dialogue.\n\n`;

            if (instructions) {
                systemPrompt += `👉 DIRECTIVE DE SCÉNARIO ET DE STYLE :
Tu dois impérativement adapter le récit, l'action ou le ton en fonction de cette demande de l'utilisateur : "${instructions}"
Attention : Cette demande doit être exécutée TOUT EN RESPECTANT STRICTEMENT le formatage Markdown et l'identité du personnage.\n\n`;
            }

            if (moodInstruction) {
    systemPrompt += `${moodInstruction}\n`;
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
            console.log("1. [SYSTEM] Instructions, Fiche personnage, Règles Markdown et Contexte RP injectés.");

            // 5. CHARGEMENT DE L'HISTORIQUE DE CONVERSATION (ai_history)
            console.log("%c=== 🧠 CHARGEMENT DE LA MÉMOIRE DE CONVERSATION (ai_history) ===", "color: #00bcd4; font-weight: bold;");
            try {
                const aiHistoryRef = collection(db, "rps_pending", currentActiveRpId, "ai_history");
                // 🌟 Synchronisation sur l'ordre chronologique des messages de l'IA
                const qAi = query(aiHistoryRef, orderBy("createdAt", "asc"));
                const snapAi = await getDocs(qAi);
                
                if (snapAi.empty) {
                    console.log("-> Aucune ancienne consigne en mémoire. Première interaction.");
                } else {
                    let compteurMessage = 1;
                    snapAi.forEach(d => {
                        const m = d.data();
                        // Validation et uniformisation des champs Firebase (text ou content)
                        const messageContent = m.content || m.text || "";
                        if (m.role && messageContent) {
                            mistralMessages.push({
                                role: m.role, // "user" ou "assistant"
                                content: messageContent
                            });
                            console.log(`   [Mémoire ${compteurMessage}] Rôle: %c${m.role}%c | Contenu : "${messageContent.substring(0, 60)}..."`, 
                                        m.role === "user" ? "color: #ffcc00;" : "color: #4caf50;", "color: inherit;");
                            compteurMessage++;
                        }
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
- Incarne EXCLUSIVEMENT "${currentActiveCharName}". Reste fidèle à sa fiche technique.
- Écris IMPÉRATIVEMENT à la 3ème personne du singulier.
- Respecte scrupuleusement la charte Markdown : Action entière entre (**), Pensée entière entre (*), Dialogue en (> ).
- Génère UNIQUEMENT le texte du RP, sans commentaires annexes.`;

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
                        temperature: 0.8 
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Code erreur API Mistral : ${response.status}`);
                }

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
                            content: instructions ? `[Consigne] : ${instructions}` : "[Demande de suite]",
                            createdAt: serverTimestamp()
                        });
                        
                        // Sauvegarde de ce que l'IA a répondu
                        await addDoc(aiHistoryRef, {
                            role: "assistant",
                            text: textAi,
                            content: textAi,
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
    <style>
        /* Le bloc entier de dialogue avec la bordure jaune à gauche */
/* 1. Le bloc entier qui sert de conteneur (gère la ligne jaune verticale) */
.rp-dialogue {
    margin: 12px 0;
    padding-left: 12px;
    border-left: 3px solid #dfb56c; /* 🌟 LA LIGNE JAUNE UNIQUE AU BORD */
    line-height: 1.4;
}

/* 2. Le style spécifique pour le texte des PAROLES */
.rp-speech {
    color: #dfb56c; /* 🌟 Le texte des paroles est jaune/doré */
    font-family: 'Times New Roman', Times, serif;
    font-size: 1.15rem;
    font-style: normal;
}

/* 3. Le style spécifique pour les INCISES NARRATIVES (les actions entre **) */
.rp-incise {
    font-weight: bold; /* 🌟 En gras */
    color: #ffffff; /* 🌟 En blanc pour couper le jaune */
    font-family: 'Segoe UI', Tahoma, sans-serif; /* Reprend la police du site */
    font-size: 1rem;
    font-style: normal;
}
    </style>

    <div class="co-write-display" style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
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
            <div class="co-write-display" style="flex: 1; padding: 25px; overflow-y: auto; color: #f0f0f0; font-family: Georgia, serif; font-size: 1.4rem !important; line-height: 1.6; background: #0c0c10;">
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