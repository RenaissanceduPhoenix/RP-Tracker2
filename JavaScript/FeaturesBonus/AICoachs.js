import { charactersDB, fiches } from './CharacterData.js';
import { catBehaviorKnowledge } from './CatBehaviorData.js';
import { db } from '../Firebase.js';
import { collection, setDoc, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp, deleteDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js'; // 🛠️ Importation du parseur Markdown existant

// ⚠️ CONFIGURATION MISTRAL
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

window.currentActiveRpId = null;
window.currentActiveCharName = null;
let dernierPromptJoueur = ""; // Sauvegarde le message ou contexte du joueur

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
    const senderSelect = document.getElementById("coWriteSenderName")
    
    if (!modal) return;
    
    modal.style.display = "flex";
    title.innerText = `🖋️ Co-Écriture : ${charName}`;
    if (historyLog) historyLog.innerHTML = "<p style='color:#888; text-align:center;'>Chargement de l'historique du RP...</p>";

    // 🧼 RESET TOTAL ET SÉCURISÉ : Supprime la classe active de TOUS les boutons de moods
    document.querySelectorAll(".mood-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    // 👁️ GESTION DU PANNEAU PLIABLE
    const btnToggle = document.getElementById("btnToggleMoods");
    const contentMoods = document.getElementById("moodSelectorContent");
    
    if (btnToggle && contentMoods) {
        contentMoods.style.display = "none"; 
        btnToggle.innerText = "👁️ Afficher les Moods";
        
        btnToggle.onclick = function(e) {
            e.preventDefault();
            if (contentMoods.style.display === "none") {
                contentMoods.style.display = "flex";
                btnToggle.innerText = "🙈 Masquer les Moods";
            } else {
                contentMoods.style.display = "none";
                btnToggle.innerText = "👁️ Afficher les Moods";
            }
        };
    }

    // 🎛️ CORRECTION DU BUG ON/OFF : Utilisation d'un écouteur propre qui bascule correctement
    document.querySelectorAll(".mood-btn").forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Le toggle permet d'ajouter si absent, et d'enlever (annuler le clic) si présent
            this.classList.toggle("active"); 
        };
    });

        const contextArea = document.getElementById("coWriteContext");
        const outputDiv = document.getElementById("coWriteAiOutput");

    contextArea.value = "";
    outputDiv.innerHTML = "Prêt à rédiger avec l'aide de Mistral Large.";
    historyLog.innerHTML = "<span style='color: #aaa;'>Chargement des données du RP...</span>";
    
    modal.style.display = "flex";

    try {
        const pendingDocRef = doc(db, "rps_received", rpId);
        const pendingSnap = await getDoc(pendingDocRef);
        
        if (pendingSnap.exists()) {
            const pendingData = pendingSnap.data();
            title.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
        <span>🖋️ Co-Écriture : <span style="color:#a777e3;">${pendingData.title || 'Sans titre'}</span> (${charName})</span>
        <button onclick="window.ouvrirSommaireHistorique('${rpId}')" style="background: rgba(255, 204, 0, 0.1); color: #ffcc00; border: 1px solid #ffcc00; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight:bold; display:flex; align-items:center; gap:6px; transition: all 0.2s; margin-right: 20px;">
            📊 Consulter le Sommaire
        </button>
    </div>
`;

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

        console.log(`%c📖 [Vérification] Collection 'messages' chargée : ${snap.size} réplique(s) de jeu récupérée(s) pour le RP [${rpId}].`, "color: #ffcc00; font-weight: bold;");

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
        
        snap.forEach(docSnap => {
            const msg = docSnap.data();
            const isMe = msg.sender === charName;
            const badgeColor = isMe ? "#a777e3" : "#ffcc00";
            
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

// Assure-toi d'ajouter updateDoc et arrayUnion dans tes imports Firebase au début du fichier si besoin :
// import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * 🧠 1. ANALYSE ET ENRICHISSEMENT DYNAMIQUE (UNIQUEMENT ACTIONS ET DIALOGUES)
 * Enregistre et apprend les nouveaux verbes/mots de parole dans Firestore. Les pensées restent fixes.
 */
async function autoApprendreEtEnrichirDico(texteBrutIA) {
    try {
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${MISTRAL_API_KEY}` 
            },
            body: JSON.stringify({ 
                model: "mistral-large-latest", 
                messages: [
                    {
                        role: "system",
                        content: `Tu es un analyseur grammatical JDR. Extrais le lexique de ce texte.
Tu dois répondre STRICTEMENT avec un objet JSON valide (sans balises Markdown, sans blabla) contenant exactement 2 tableaux :
- "actions" : Verbes à la 3e personne (singulier/pluriel, présent/imparfait/passé) décrivant des mouvements, gestes, expressions, postures ou bruits physiques.
- "dialogues" : Pronoms (je, tu, moi, nous, vous...), déterminants (mon, ton, votre...) et verbes conjugués hors 3e personne du singulier (langage parlé direct).

Exemple :
{"actions":["pivota","ancrées","frémirent"],"dialogues":["tu","veux","parlez"]}`
                    },
                    { role: "user", content: texteBrutIA }
                ],
                temperature: 0.2
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        if (!data.choices || !data.choices[0]) return null;

        let cleanJson = data.choices[0].message.content.replace(/```json|```/g, "").trim();
        const lexiqueExtrait = JSON.parse(cleanJson);

        // Connexion à ton document Firestore existant
        const docRef = doc(db, "dictionnaires", "rpg_feline");
        const docSnap = await getDoc(docRef);

        let dicoFinal = { actions: [], dialogues: [] };

        if (docSnap.exists()) {
            const currentData = docSnap.data();
            
            // On isole uniquement les nouveaux mots pour optimiser les écritures Firebase
            const nouvellesActions = (lexiqueExtrait.actions || []).filter(m => !currentData.actions?.includes(m));
            const nouveauxDialogues = (lexiqueExtrait.dialogues || []).filter(m => !currentData.dialogues?.includes(m));

            // Si du nouveau vocabulaire est détecté, mise à jour instantanée en tâche de fond
            if (nouvellesActions.length > 0 || nouveauxDialogues.length > 0) {
                await updateDoc(docRef, {
                    actions: arrayUnion(...(lexiqueExtrait.actions || [])),
                    dialogues: arrayUnion(...(lexiqueExtrait.dialogues || []))
                });
                console.log("%c🔥 [Firestore] Apprentissage des actions & dialogues synchronisé !", "color: #e67e22; font-weight: bold;");
            }

            // Fusion de l'historique et des mots du post actuel pour le Robot Nettoyeur
            dicoFinal.actions = [...new Set([...(currentData.actions || []), ...(lexiqueExtrait.actions || [])])];
            dicoFinal.dialogues = [...new Set([...(currentData.dialogues || []), ...(lexiqueExtrait.dialogues || [])])];
        } else {
            console.warn("⚠️ Document 'rpg_feline' introuvable dans Firestore.");
            return lexiqueExtrait;
        }

        return dicoFinal;

    } catch (err) {
        console.error("❌ Erreur d'auto-apprentissage partiel Firestore :", err);
        return null;
    }
}

/**
 * 🛡️ 2. ROBOT NETTOYEUR SÉMANTIQUE (VERSION HYBRIDE ULTIME)
 * Actions & Dialogues = Firestore Auto-apprenant | Pensées = Dico Code Fixe Ultra-Solide
 */
export async function nettoyerSyntaxeDialogue(texteBrutIA) {
    if (!texteBrutIA) return "";

    // 1. Récupération des bases de données dynamiques (Actions & Dialogues) depuis Firestore
    const dicoComplet = await autoApprendreEtEnrichirDico(texteBrutIA);
    
    // Listes de secours par défaut au cas où Firebase a un ralentissement
    const verbesAction = dicoComplet?.actions?.join(", ") || "pivota, pivotait, fit, faisait, recula, s'avança, tourna, agita, roula, frémirent, s'enfoncer, atterrissant, tendirent";
    const marqueursParoles = dicoComplet?.dialogues?.join(", ") || "je, tu, moi, toi, nous, vous, me, te, mon, ton, ma, veux, fais, es, parlez, devez";
    
    // 🔒 LE DICO DES PENSÉES COMPLÈTEMENT SÉCURISÉ ET GRAVÉ EN DUR (Ultra-hermétique et étendu)
    const lexiquePenseesFixe = "Pourquoi, comment, trop, toujours, jamais, encore, si mal, ça brûle, non, impossible, j'aurais dû, si seulement, qu'ai-je fait, imbécile, lourd, amertume, regret, trop tard, déjà, sentait, s'entretuer, concerne, pion, dispute, mêmes, seule, instable, dangereuse, raison, plie, docile, jugeaient, importait, peu, l'ombre, voulaient, baisse, yeux, pensait, songea, croyait, imaginait, doutait, esprit, tête, conscience, flux, secret, fardeau, honte, peur, haine, colère, lâche, lâcheté, trahison, mensonge, vérité, espoir, désespoir, vide, pourquoi moi, qu'ils, s'ils, s'elle, qu'elle, s'il, qu'il, s'en, qu'en, tout ça, à quoi bon, finir, recommencer, fuir, faire face";

    try {
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${MISTRAL_API_KEY}` 
            },
            body: JSON.stringify({ 
                model: "mistral-large-latest", 
                messages: [
                    {
                        role: "system",
                        content: `Tu es un automate de restructuration syntaxique pour un parser RPG. Tu prends un texte de jeu de rôle mal formaté et tu en corriges les astérisques (* et **) en appliquant des règles sémantiques strictes et sans failles.

Voici tes dictionnaires de référence pour analyser la nature de chaque mot :

================================================================================
📚 DICO 1 : INCISES ET ACTIONS DE DIALOGUE (Dans les lignes "> ", sous doubles astérisques : **Texte**)
- Verbes physiques, mouvements, anatomies, descriptions d'états physiques et décors (Auto-appris depuis Firestore) :
${verbesAction}

================================================================================
📚 DICO 2 : LE LANGAGE PARLÉ DIRECT (Dans les lignes "> ", en TEXTE BRUT, SANS ÉTOILES)
- Marqueurs de dialogue direct, pronoms, questions et verbes hors 3e pers. (Auto-appris depuis Firestore) :
${marqueursParoles}

================================================================================
📚 DICO 3 : PENSÉES INTÉRIEURES ET FLUX DE CONSCIENCE (Sous un seul astérisque : *Texte*)
- Lexique IMMUABLE et STRICT du monologue intérieur secret, du doute, du regret, des questions existentielles ou du jugement mental personnel :
${lexiquePenseesFixe}

================================================================================
🧠 PROTOCOLE DE TRAITEMENT PARAGRAPHE PAR PARAGRAPHE :

1. 💬 SI LE PARAGRAPHE COMMENCE PAR ">" (Dialogue) :
   - Extrais le texte après "> ". Supprime TOUTES les étoiles qu'il contient pour avoir la phrase à nu.
   - Découpe la ligne en morceaux logiques.
   - Si un morceau utilise le DICO 2 (paroles prononcées, questions, "tu", "je", "moi") -> Laisse-le en TEXTE BRUT (ZÉRO ÉTOILE).
   - Pour TOUT autre morceau (descriptions, mouvements, voix qui vibre) -> Mets-le OBLIGATOIREMENT entre doubles étoiles (**Texte**).
   - Reconstruis la ligne sous la forme exacte : "> Paroles **Action** Paroles **Action**".
   - ⚠️ SÉCURITÉ DIALOGUE : Si une pensée (DICO 3) apparaît dans une ligne de dialogue (commençant par ">"), considère-la obligatoirement comme une action narrative / incise descriptive et englobe-la dans les doubles astérisques (**). Pas d'étoile simple ici.

2. 💭 SI LE PARAGRAPHE EST UNE PENSÉE GLOBALE (Pas de ">", mais contient des mots du DICO 3) :
   - Nettoie toutes les étoiles d'origine.
   - ⚠️ REGLE DE CASSURE GÉOMÉTRIQUE STRICTE : Si une action physique (DICO 1) se trouve au milieu ou à la fin de cette pensée, tu as l'INTERDICTION ABSOLUE d'imbriquer les étoiles. Tu dois fermer la pensée, AJOUTER UN RETOUR À LA LIGNE COMPLET (un saut de ligne), puis ouvrir le gras pour l'action afin d'en faire un paragraphe distinct.
   - Exemple requis : "*Texte de la pensée*\n\n**Action physique séparée**"

3. 🏃 SI LE PARAGRAPHE EST UNE ACTION GLOBALE / DESCRIPTION (Pas de ">" au début et aucun marqueur de pensée du DICO 3) :
   - ⚠️ BLINDAGE TOTAL : C'est une description pure hors-dialogue. Supprime TOUTES les étoiles intérieures sans exception. Encapsule l'INTÉGRALITÉ du paragraphe avec des doubles astérisques au début et à la fin (**Texte complet de l'action globale**). Il ne doit y avoir aucun trou de texte brut et aucune étoile simple au milieu.

⚠️ SÉCURITÉ DE PRODUCTION :
- Ne change, ne supprime et n'ajoute AUCUN mot ou virgule de l'histoire originale.
- Renvoie uniquement le texte final corrigé, sans commentaires ni balises de bloc Markdown.`
                    },
                    {
                        role: "user",
                        content: texteBrutIA
                    }
                ],
                temperature: 0.0 // Déterminisme informatique maximum (Zéro créativité).
            })
        });

        if (!response.ok) return texteBrutIA; 
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
            console.log("%c🛡️ [Robot Nettoyeur Hybride] Balisage et cassures géométriques validés !", "color: #2ecc71; font-weight:bold;");
            return data.choices[0].message.content;
        }
        return texteBrutIA;
    } catch (err) {
        console.error("Erreur lors du filtrage sémantique rigide :", err);
        return texteBrutIA;
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

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("mood-btn")) {
            if (e.target.classList.contains("active")) {
                e.target.style.borderColor = "rgba(167, 119, 227, 0.4)";
                e.target.style.background = "#2c2c35";
                e.target.classList.remove("active");
            } else {
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
                // 🎯 1. GÉNÉRATION DE L'ID UNIQUE À L'AVANCE (CÔTÉ CLIENT)
// On crée une référence de document vide dans la sous-collection "messages" pour obtenir un ID unique Firebase
const pendingDocRef = doc(db, "rps_pending", window.currentActiveRpId || currentActiveRpId);
const nouveauMessageRef = doc(collection(pendingDocRef, "messages"));
const uniqueMsgId = nouveauMessageRef.id; // Ex: "K8zYt93m..."

// On met cet ID dans une variable globale pour que ton script de publication finale puisse le récupérer
window.lastGeneratedMsgId = uniqueMsgId;

// 2. ENREGISTREMENT SÉCURISÉ ET UNIQUE DANS RPS_PENDING
try {
    // Force l'existence réelle du document parent rps_pending
    await setDoc(pendingDocRef, { 
        lastUpdated: serverTimestamp(),
        character: window.currentActiveCharName || "Inconnu"
    }, { merge: true });

    // Sauvegarde du prompt utilisateur dans "ai_history"
    await addDoc(collection(pendingDocRef, "ai_history"), {
        role: "user",
        text: instructions ? `[Consigne] : ${instructions}` : "[Demande de suite]",
        content: instructions || "[Demande de suite]",
        createdAt: serverTimestamp()
    });
    
    // Sauvegarde de la réponse IA dans "ai_history"
    await addDoc(collection(pendingDocRef, "ai_history"), {
        role: "assistant",
        text: textAi,
        content: textAi,
        createdAt: serverTimestamp()
    });

    // 🎯 SAUVEGARDE DU TEXTE NETTOYÉ DANS "messages" EN FORÇANT NOTRE ID UNIQUE !
    await setDoc(nouveauMessageRef, {
        id: uniqueMsgId, // On écrit l'ID à l'intérieur du document
        sender: window.currentActiveCharName || "Inconnu",
        text: textAi,     // C'est le texte propre reformaté par l'IA
        content: textAi,
        createdAt: serverTimestamp()
    });

    console.log(`💾 Version IA enregistrée dans rps_pending sous l'ID unique : ${uniqueMsgId}`);
} catch (dbErr) { 
    console.error("Erreur d'écriture dans l'historique Firestore:", dbErr); 
}
                
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

            // 💾 SAUVEGARDE DU PROMPT ACTUEL POUR LE REROLL
dernierPromptJoueur = textInput ? textInput.value.trim() : "";

            const aiInstructionsElement = document.getElementById("coWriteAiInstructions");
            const instructions = aiInstructionsElement ? aiInstructionsElement.value.trim() : "";

            const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
            let moodInstruction = "";

            if (activeMoodBtns.length > 0) {

                moodInstruction = "👉 CONFIGURATION DE L'AMBIANCE ET DU TON (CONSIGNE ABSOLUE : Chaque attribut ci-dessous est indépendant et cloisonné. Traite-les de manière brute, juxtaposée, SANS JAMAIS faire de compromis, de lien ou de fusion entre eux) :\n";

const moodDictionary = {
                    // ⚔️ COMBAT & PHYSIQUE (12)
                    combat: "- COMBAT : Actions physiques offensives, esquives, feintes, attaques directes.\n",
                    adrenaline: "- ADRENALINE : Réflexes accélérés, perception nerveuse aiguë, cœur battant la chamade.\n",
                    epuisement: "- ÉPUISEMENT : Muscles lourds, pattes flageolantes, souffle court, fatigue extrême.\n",
                    agonie: "- AGONIE : Souffrance physique limite, combat biologique instinctif pour rester conscient.\n",
                    douleur: "- DOULEUR : Réaction nerveuse à un coup, crispation physique immédiate, gémissement contenu.\n",
                    vitesse: "- VITESSE : Mouvements fulgurants, course rapide, bonds athlétiques explosifs.\n",
                    furtivite: "- FURTIVITÉ : Pas feutrés, corps au ras du sol, progression invisible et silencieuse.\n",
                    defense: "- DÉFENSE : Posture défensive, parades, interposition pour protéger.\n",
                    faiblesse: "- FAIBLESSE : Perte de force, tremblements, instabilité physique, baisse de régime.\n",
                    blessure: "- BLESSURE : Impact physique localisé, sang déversé, handicap moteur temporaire visible.\n",
                    reflexe: "- RÉFLEXE : Réaction corporelle involontaire et instantanée face à un stimulus soudain.\n",
                    endurance: "- ENDURANCE : Effort prolongé, résistance aux chocs répétés, refus physique de faiblir.\n",

                    // 😡 HOSTILITÉ & DOMINATION (12)
                    colere: "- COLÈRE : Poils dressés, voix forte, gestes brusques, regard noir.\n",
                    rage: "- RAGE : Fureur destructive, impulsivité aveugle, perte des manières courtoises.\n",
                    cruaute: "- CRUAUTÉ : Volonté malveillante de faire souffrir, absence totale de remords.\n",
                    sadisme: "- SADISME : Plaisir affiché devant le malheur d'autrui, sourire en coin pervers.\n",
                    provocation: "- PROVOCATION : Attitude insolente, gestes de défi provocateurs, bravade ouverte.\n",
                    mepris: "- MÉPRIS : Regard condescendant, dédain manifeste, ignorer délibérément l'interlocuteur.\n",
                    arrogance: "- ARROGANCE : Posture hautaine, assurance excessive, sentiment de supériorité flagrant.\n",
                    vengeance: "- VENGEANCE : Rendre le tort subi, focalisation obsessionnelle sur le châtiment.\n",
                    menace: "- MENACE : Posture d'intimidation, grognement sourd, promesse implicite de représailles.\n",
                    haine: "- HAINE : Animosité viscérale profonde, rancune destructrice, hostilité absolue.\n",
                    rivalite: "- RIVALITÉ : Esprit de compétition agressif, désir permanent de surpasser son vis-à-vis.\n",
                    tyrannie: "- TYRANNIE : Comportement autoritaire abusif, volonté d'imposer sa domination par la force.\n",

                    // 💧 SOUFFRANCE PSYCHOLOGIQUE (12)
                    tristesse: "- TRISTESSE : Regard bas, abattement postural, épaules affaissées, mouvements lents.\n",
                    deuil: "- DEUIL : Douleur morale liée à une perte affective, mélancolie lancinante.\n",
                    peur: "- PEUR : Instinct d'évitement, hypervigilance, tension interne face au danger.\n",
                    terreur: "- TERREUR : Sidération, pupilles dilatées au maximum, poils hérissés par l'effroi.\n",
                    angoisse: "- ANGOISSE : Pressentiment sombre, oppression mentale, sensation de danger imminent.\n",
                    regret: "- REGRET : Remords intérieurs, culpabilité, amertume face à une action passée.\n",
                    desespoir: "- DÉSESPOIR : Sentiment d'impuissance totale, abandon psychologique de la lutte.\n",
                    solitude: "- SOLITUDE : Sentiment d'isolement, repli sur soi, détachement social subi.\n",
                    culpabilite: "- CULPABILITÉ : Auto-accusation, poids moral écrasant, sentiment d'être le responsable.\n",
                    nostalgie: "- NOSTALGIE : Regret mélancolique d'une époque ou d'un bonheur révolu.\n",
                    abandon: "- ABANDON : Sensation de trahison affective, délaissement, détresse de se retrouver seul.\n",
                    detresse: "- DÉTRESSE : Appel à l'aide tacite, désemparé face à une situation insurmontable.\n",

                    // 🧠 BLOCAGES & DISCRÉTION (13)
                    gene: "- GÊNE : Trouble relationnel, mouvements gauches, attitude inconfortable.\n",
                    malaise: "- MALAISE : Tension palpable, silence lourd, embarras situationnel flagrant.\n",
                    hesitation: "- HÉSITATION : Posture indécise, flottement avant d'agir, gestes interrompus.\n",
                    honte: "- HONTE : Profil bas, oreilles plaquées, évitement systématique du regard.\n",
                    mefiance: "- MÉFIANCE : Prudence extrême, observation suspicieuse, analyse des arrières-pensées.\n",
                    mystere: "- MYSTÈRE : Comportement énigmatique, secrets gardés, non-dits volontaires.\n",
                    folie: "- FOLIE : Regard erratique, instabilité mentale, incohérence comportementale.\n",
                    crise: "- CRISE : Explosion émotionnelle, saturation nerveuse, perte de contrôle psychologique.\n",
                    timidite: "- TIMIDITÉ : Posture réservée, effacement volontaire, hésitation à prendre la parole.\n",
                    paranoia: "- PARANOÏA : Sentiment injustifié de persécution, voir des ennemis partout.\n",
                    confusion: "- CONFUSION : Esprit embrouillé, désorientation intellectuelle, incompréhension des événements.\n",
                    secret: "- SECRET : Rétention volontaire d'informations cruciales, dissimulation stratégique.\n",
                    obsessif: "- OBSESSIF : Idée fixe, comportement compulsif focalisé sur un détail unique.\n",

                    // 🤝 ATTACHEMENT & INTERACTIONS (12)
                    amitie: "- AMITIÉ : Posture détendue, proximité fraternelle rassurante, ton ouvert.\n",
                    complicite: "- COMPLICITÉ : Connexion immédiate, regards entendus, accord sans paroles.\n",
                    drague: "- DRAGUE : Intention de séduction, pas feutrés et port de tête fier.\n",
                    charme: "- CHARME : Charisme naturel envoûtant, magnétisme comportemental.\n",
                    romance: "- ROMANCE : Intimité amoureuse, queue enlacée, bulle de tendresse.\n",
                    tendresse: "- TENDRESSE : Gestes lents, contact physique affectueux, douceur.\n",
                    malice: "- MALICE : Regard taquin, comportement espiègle, envie de plaisanter.\n",
                    respect: "- RESPECT : Déférence polie, maintien des distances requises, considération.\n",
                    empathie: "- EMPATHIE : Sensibilité face à la douleur d'autrui, écoute attentive.\n",
                    loyaute: "- LOYAUTÉ : Fidélité indéfectible, respect absolu de la parole donnée.\n",
                    devoement: "- DÉVOUEMENT : Sacrifice de soi au profit d'une cause ou d'un individu.\n",
                    protection: "- PROTECTION : Posture défensive active pour abriter un allié du danger.\n",

                    // ⚖️ VERTUS & LOGIQUE MENTALE (14)
                    solennel: "- SOLENNEL : Posture droite, respect rigide des rituels et des lois du Code.\n",
                    determination: "- DÉTERMINATION : Mâchoire serrée, pas ancrés au sol, focus inébranlable.\n",
                    focus: "- FOCUS : Concentration extrême sur une tâche précise, isolation sensorielle.\n",
                    bravoure: "- BRAVOURE : Affronter le danger de face de manière héroïque et visible.\n",
                    courage: "- COURAGE : Surmonter activement une trouille interne pour accomplir l'action.\n",
                    resilience: "- RÉSILIENCE : Capacité à encaisser les échecs et se remettre d'aplomb aussitôt.\n",
                    fierte: "- FIERTÉ : Torse bombé, tête haute, refus de montrer ses vulnérabilités.\n",
                    apatie: "- APATHIE : Indifférence clinique, absence totale de réaction émotionnelle.\n",
                    detachement: "- DÉTACHEMENT : Prendre de la distance intellectuelle, esprit ailleurs.\n",
                    froideur: "- FROIDEUR : Logique pure, ton tranchant, absence totale d'empathie relationnelle.\n",
                    sagesse: "- SAGESSE : Calme philosophique, recul stratégique avant toute parole.\n",
                    ambition: "- AMBITION : Volonté de grandeur, soif de pouvoir, calcul opportuniste.\n",
                    neutralite: "- NEUTRALITÉ : Objectivité totale, refus de prendre parti dans le conflit.\n",
                    patience: "- PATIENCE : Calme devant l'attente, maîtrise du timing, acceptation sereine du temps.\n"
                };

                activeMoodBtns.forEach(btn => {

                    const moodKey = btn.getAttribute("data-mood");

                    if (moodDictionary[moodKey]) moodInstruction += moodDictionary[moodKey];

                });

            }

            outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">✍️ L'IA consulte la mémoire de la conversation et l'historique...</p>`;

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

            let systemPrompt = `Tu es un coach d'écriture expert et un joueur d'élite pour un forum RPG écrit basé sur l'univers de La Guerre des Clans. 
Tu rédiges au nom du personnage suivant : ${currentActiveCharName}.

Fiche technique du personnage :
- Compétences et caractéristiques clés : ${skillsText}
- Profil psychologique & Histoire :
${maFicheDetaillee}

<consignes_syntaxe_markdown>
⚠️ DIRECTIVES DE SYNTAXE IMPÉRATIVES (CRUCIAL POUR LE PARSEUR DU SITE) :
Tu dois appliquer scrupuleusement la structure suivante, paragraphe par paragraphe. Si tu ne respectes pas ces règles au caractère près, le site crash. Ne mélange JAMAIS les styles d'astérisques au hasard.

1. PARAGRAPHES D'ACTIONS (En gras intégral) :
Tout paragraphe qui décrit un mouvement, un déplacement, un état physique ou une description environnementale DOIT commencer par "**" et se terminer par "**". Rien d'autre dans le paragraphe.
-> Exemple exact : **Étincelle de Vie sentit ses griffes s’enfoncer dans la mousse sans même qu’elle en ait conscience.**

2. PARAGRAPHES DE PENSÉES (En italique intégral) :
Tout paragraphe (ou phrase isolée sur sa propre ligne) représentant une pensée ou un monologue intérieur secret DOIT commencer par "*" et se terminer par "*".
-> Exemple exact : *Trop. C’est trop.*

3. DIALOGUES SIMPLES :
Toutes les répliques prononcées à haute voix doivent obligatoirement commencer par le chevron ">" suivi d'un espace simple au tout début de la ligne. Le texte parlé doit être brut (SANS astérisques).
-> Exemple exact : > Oh, par le Clan.

4. DIALOGUES COMPLEXES AVEC INCISES NARRATIVES (RÈGLE CRUCIALE) :
Dans une ligne de dialogue commençant par "> ", si le personnage coupe sa parole pour faire une action ou si un verbe de parole est inséré (une incise), cette incise narrative DOIT être isolée en étant entourée de doubles astérisques (**). 
⚠️ INTERDICTION DE METTRE DES ASTÉRISQUES SUR LES PAROLES PARLÉES.
-> Exemple exact à calquer : > Oh, par le Clan. **Sa voix claqua comme une branche sèche sous une patte.** Vous allez vraiment me faire ça aujourd’hui ?
-> Autre exemple exact : > Écoutez-moi bien, tous les deux. **Elle s’arrêta net, les pattes avant légèrement fléchies.** Ombre, tu arrêtes ton cinéma.

❌ INTERDICTIONS FORMELLES :
- Ne mets JAMAIS d'astérisques (**) autour du texte parlé dans un dialogue. Le texte parlé est BRUT.
- Ne fais JAMAIS ceci : > **Bonjour !** **Elle sourit.** **Ça va ?** (C'est interdit et faux).
- Fais TOUJOURS ceci : > Bonjour ! **Elle sourit.** Ça va ?
- Ne laisse jamais d'astérisques non fermés en fin de paragraphe.
- Ne commence jamais une action par un seul astérisque (*). L'action c'est toujours (**).
- Ne mets pas le symbole ">" au milieu d'un texte, uniquement tout au début de la ligne de dialogue.
</consignes_syntaxe_markdown>

⚠️ RAPPEL DE FIN IMMÉDIAT (SÉCURITÉ ANTI-CRASH) :
Regarde ta ligne de dialogue avant de répondre. Si le texte parlé commence par "**", ta syntaxe est FAUSSE. Les astérisques servent UNIQUEMENT à encapsuler les actions au milieu du dialogue. Écris les paroles en texte normal après le "> ".`;

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
- VARIABILITÉ DU RYTHME : Alterne brutalement la structure et la longueur de tes phrases. Fais de longues descriptions poétiques, suivies immédiatement d'une phrase ultra-courte de deux ou trois mots pour marké un impact, une hésitation ou une rupture. Ne garde JAMAIS le même rythme d'un paragraphe à l'autre.
- DÉVIATION DE PROBABILITÉ : Évite les structures de transition trop parfaite et répétitives au début de tes paragraphes (bannit les listes de "Puis, d'un geste...", "Soudain...", "Un frisson..."). Entre directement dans l'action, la pensée brute ou la sensation physique.
- IMPERFECTIONS NATURELLES : Incorpore des tics de langage corporel réalistes et parfois abrupts propres à l'univers félin (un miaulement étouffé, un coup de langue nerveux, un silence lourd, une hésitation dans le dialogue).
- CONCLUSION ORGANIQUE : Ne cherche pas à faire une "belle phrase de fin de chapitre" clichée. Termine sur un geste suspendu, un regard, ou une réplique directe.

🐱 NUANCES COMPORTEMENTALES :
${catLorePrompt}

🔥 PROFIL PSYCHOLOGIQUE OBLIGATOIRE :
<FICHE_PERSONNAGE>
${maFicheDetaillee}
</FICHE_PERSONNAGE>\n\n`;

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

            console.log("%c=== 🚀 DÉBUT DE LA RECONSTRUCTION DU PROMPT MISTRAL ===", "color: #a777e3; font-weight: bold;");
            let mistralMessages = [
                { role: "system", content: systemPrompt }
            ];

            try {
                const aiHistoryRef = collection(db, "rps_pending", currentActiveRpId, "ai_history");
                const qAi = query(aiHistoryRef, orderBy("createdAt", "asc"));
                const snapAi = await getDocs(qAi);
                
                if (!snapAi.empty) {
                    snapAi.forEach(d => {
                        const m = d.data();
                        const messageContent = m.content || m.text || "";
                        if (m.role && messageContent) {
                            mistralMessages.push({
                                role: m.role,
                                content: messageContent
                            });
                        }
                    });
                }
            } catch (e) { 
                console.error("❌ Erreur lors du chargement de l'historique IA:", e); 
            }

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
    
    if (!response.ok) throw new Error(`Code erreur API Mistral : ${response.status}`);

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
        let textAiRaw = data.choices[0].message.content;
        
        outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">🛡️ Analyse sémantique et sécurisation de la syntaxe en cours...</p>`;
        
        let textAi = await nettoyerSyntaxeDialogue(textAiRaw);

        // 8. ENREGISTREMENT DE LA SÉQUENCE DANS FIRESTORE (SÉCURISÉ ET UNIQUE)
        try {
            // 🔒 SÉCURITÉ : Référence du document parent principal
            const pendingDocRef = doc(db, "rps_pending", window.currentActiveRpId || currentActiveRpId);

            // Force l'existence réelle du parent pour éviter le bug des "collections fantômes"
            await setDoc(pendingDocRef, { 
                lastUpdated: serverTimestamp(),
                character: window.currentActiveCharName || "Inconnu"
            }, { merge: true });

            // Référence vers la sous-collection ai_history
            const aiHistoryRef = collection(pendingDocRef, "ai_history");
            
            // Sauvegarde UNIQUE du prompt de l'utilisateur
            await addDoc(aiHistoryRef, {
                role: "user",
                text: instructions ? `[Consigne] : ${instructions}` : "[Demande de suite]",
                content: instructions || "[Demande de suite]",
                createdAt: serverTimestamp()
            });
            
            // Sauvegarde UNIQUE de la réponse de l'assistant IA
            await addDoc(aiHistoryRef, {
                role: "assistant",
                text: textAi,
                content: textAi,
                createdAt: serverTimestamp()
            });

            console.log("💾 Échange unique sauvegardé avec succès dans rps_pending !");
        } catch (dbErr) { 
            console.error("Erreur d'écriture dans l'historique IA Firestore:", dbErr); 
        }

        if (aiInstructionsElement) aiInstructionsElement.value = "";

        // 9. RENDU HTML FINAL DU MESSAGE
        const textAiHTML = parseRP(textAi);

                    outputDiv.innerHTML = `
    <style>
        .rp-dialogue {
            margin: 12px 0;
            padding-left: 12px;
            border-left: 3px solid #dfb56c;
            line-height: 1.4;
        }
        .rp-speech {
            color: #dfb56c;
            font-family: Georgia, serif;
            font-size: 1.4rem !important;
            font-style: normal;
        }
        .rp-incise {
            font-weight: bold;
            color: #ffffff;
            font-family: Georgia, serif;
            font-size: 1.4rem !important;
            font-style: normal;
        }
    </style>

    <div class="co-write-display" style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="color:#a777e3; font-weight:bold;">Suggéré pour ${currentActiveCharName} :</span>
            <div style="display: flex; gap: 5px;">
                <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                <button id="btnAiReroll" onclick="window.executerReroll()" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:8px 15px; border-radius:4px; cursor:pointer; margin-left: 10px;">🎲 Reroll (Ambiance active)</button>
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

window.clearAiHistory = async function(rpId) {
    if (!rpId) return;
    try {
        const aiHistoryRef = collection(db, "rps_pending", rpId, "ai_history");
        const snap = await getDocs(aiHistoryRef);
        
        if (!snap.empty) {
            const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);
            console.log(`%c🧹 [Sécurité IA] L'historique 'ai_history' du RP [${rpId}] a été nettoyé avec succès !`, "color: #2ecc71; bold;");
        }
    } catch (error) {
        console.error("❌ Erreur lors du nettoyage automatique de l'historique IA :", error);
    }
};

/**
 * ============================================================================
 * 5. FONCTION : REROLL DYNAMIQUE (PRIME LES MOODS ACTIFS AU CLIC)
 * ============================================================================
 */
window.executerReroll = async function() {
    const outputDiv = document.getElementById("coWriteAiOutput");
    const textInput = document.getElementById("coWriteContext");
    if (!outputDiv || !window.currentActiveRpId || !window.currentActiveCharName) {
        console.warn("⚠️ Impossible de relancer : contexte manquant.");
        return;
    }

    const aiInstructionsElement = document.getElementById("coWriteAiInstructions");
    const instructions = aiInstructionsElement ? aiInstructionsElement.value.trim() : "";

    // 🎛️ CAPTURE DES MOODS EN DIRECT (Lit les classes .active générées par ton code)
    const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
    let moodInstruction = "";

    if (activeMoodBtns.length > 0) {
        moodInstruction = "👉 CONFIGURATION DE L'AMBIANCE ET DU TON (CONSIGNE ABSOLUE : Chaque attribut sélectionné doit s'exprimer de façon brute, isolée et étanche, sans se diluer ni s'influencer mutuellement) :\n";
const moodDictionary = {
                    // ⚔️ COMBAT & PHYSIQUE (12)
                    combat: "- COMBAT : Actions physiques offensives, esquives, feintes, attaques directes.\n",
                    adrenaline: "- ADRENALINE : Réflexes accélérés, perception nerveuse aiguë, cœur battant la chamade.\n",
                    epuisement: "- ÉPUISEMENT : Muscles lourds, pattes flageolantes, souffle court, fatigue extrême.\n",
                    agonie: "- AGONIE : Souffrance physique limite, combat biologique instinctif pour rester conscient.\n",
                    douleur: "- DOULEUR : Réaction nerveuse à un coup, crispation physique immédiate, gémissement contenu.\n",
                    vitesse: "- VITESSE : Mouvements fulgurants, course rapide, bonds athlétiques explosifs.\n",
                    furtivite: "- FURTIVITÉ : Pas feutrés, corps au ras du sol, progression invisible et silencieuse.\n",
                    defense: "- DÉFENSE : Posture défensive, parades, interposition pour protéger.\n",
                    faiblesse: "- FAIBLESSE : Perte de force, tremblements, instabilité physique, baisse de régime.\n",
                    blessure: "- BLESSURE : Impact physique localisé, sang déversé, handicap moteur temporaire visible.\n",
                    reflexe: "- RÉFLEXE : Réaction corporelle involontaire et instantanée face à un stimulus soudain.\n",
                    endurance: "- ENDURANCE : Effort prolongé, résistance aux chocs répétés, refus physique de faiblir.\n",

                    // 😡 HOSTILITÉ & DOMINATION (12)
                    colere: "- COLÈRE : Poils dressés, voix forte, gestes brusques, regard noir.\n",
                    rage: "- RAGE : Fureur destructive, impulsivité aveugle, perte des manières courtoises.\n",
                    cruaute: "- CRUAUTÉ : Volonté malveillante de faire souffrir, absence totale de remords.\n",
                    sadisme: "- SADISME : Plaisir affiché devant le malheur d'autrui, sourire en coin pervers.\n",
                    provocation: "- PROVOCATION : Attitude insolente, gestes de défi provocateurs, bravade ouverte.\n",
                    mepris: "- MÉPRIS : Regard condescendant, dédain manifeste, ignorer délibérément l'interlocuteur.\n",
                    arrogance: "- ARROGANCE : Posture hautaine, assurance excessive, sentiment de supériorité flagrant.\n",
                    vengeance: "- VENGEANCE : Rendre le tort subi, focalisation obsessionnelle sur le châtiment.\n",
                    menace: "- MENACE : Posture d'intimidation, grognement sourd, promesse implicite de représailles.\n",
                    haine: "- HAINE : Animosité viscérale profonde, rancune destructrice, hostilité absolue.\n",
                    rivalite: "- RIVALITÉ : Esprit de compétition agressif, désir permanent de surpasser son vis-à-vis.\n",
                    tyrannie: "- TYRANNIE : Comportement autoritaire abusif, volonté d'imposer sa domination par la force.\n",

                    // 💧 SOUFFRANCE PSYCHOLOGIQUE (12)
                    tristesse: "- TRISTESSE : Regard bas, abattement postural, épaules affaissées, mouvements lents.\n",
                    deuil: "- DEUIL : Douleur morale liée à une perte affective, mélancolie lancinante.\n",
                    peur: "- PEUR : Instinct d'évitement, hypervigilance, tension interne face au danger.\n",
                    terreur: "- TERREUR : Sidération, pupilles dilatées au maximum, poils hérissés par l'effroi.\n",
                    angoisse: "- ANGOISSE : Pressentiment sombre, oppression mentale, sensation de danger imminent.\n",
                    regret: "- REGRET : Remords intérieurs, culpabilité, amertume face à une action passée.\n",
                    desespoir: "- DÉSESPOIR : Sentiment d'impuissance totale, abandon psychologique de la lutte.\n",
                    solitude: "- SOLITUDE : Sentiment d'isolement, repli sur soi, détachement social subi.\n",
                    culpabilite: "- CULPABILITÉ : Auto-accusation, poids moral écrasant, sentiment d'être le responsable.\n",
                    nostalgie: "- NOSTALGIE : Regret mélancolique d'une époque ou d'un bonheur révolu.\n",
                    abandon: "- ABANDON : Sensation de trahison affective, délaissement, détresse de se retrouver seul.\n",
                    detresse: "- DÉTRESSE : Appel à l'aide tacite, désemparé face à une situation insurmontable.\n",

                    // 🧠 BLOCAGES & DISCRÉTION (13)
                    gene: "- GÊNE : Trouble relationnel, mouvements gauches, attitude inconfortable.\n",
                    malaise: "- MALAISE : Tension palpable, silence lourd, embarras situationnel flagrant.\n",
                    hesitation: "- HÉSITATION : Posture indécise, flottement avant d'agir, gestes interrompus.\n",
                    honte: "- HONTE : Profil bas, oreilles plaquées, évitement systématique du regard.\n",
                    mefiance: "- MÉFIANCE : Prudence extrême, observation suspicieuse, analyse des arrières-pensées.\n",
                    mystere: "- MYSTÈRE : Comportement énigmatique, secrets gardés, non-dits volontaires.\n",
                    folie: "- FOLIE : Regard erratique, instabilité mentale, incohérence comportementale.\n",
                    crise: "- CRISE : Explosion émotionnelle, saturation nerveuse, perte de contrôle psychologique.\n",
                    timidite: "- TIMIDITÉ : Posture réservée, effacement volontaire, hésitation à prendre la parole.\n",
                    paranoia: "- PARANOÏA : Sentiment injustifié de persécution, voir des ennemis partout.\n",
                    confusion: "- CONFUSION : Esprit embrouillé, désorientation intellectuelle, incompréhension des événements.\n",
                    secret: "- SECRET : Rétention volontaire d'informations cruciales, dissimulation stratégique.\n",
                    obsessif: "- OBSESSIF : Idée fixe, comportement compulsif focalisé sur un détail unique.\n",

                    // 🤝 ATTACHEMENT & INTERACTIONS (12)
                    amitie: "- AMITIÉ : Posture détendue, proximité fraternelle rassurante, ton ouvert.\n",
                    complicite: "- COMPLICITÉ : Connexion immédiate, regards entendus, accord sans paroles.\n",
                    drague: "- DRAGUE : Intention de séduction, pas feutrés et port de tête fier.\n",
                    charme: "- CHARME : Charisme naturel envoûtant, magnétisme comportemental.\n",
                    romance: "- ROMANCE : Intimité amoureuse, queue enlacée, bulle de tendresse.\n",
                    tendresse: "- TENDRESSE : Gestes lents, contact physique affectueux, douceur.\n",
                    malice: "- MALICE : Regard taquin, comportement espiègle, envie de plaisanter.\n",
                    respect: "- RESPECT : Déférence polie, maintien des distances requises, considération.\n",
                    empathie: "- EMPATHIE : Sensibilité face à la douleur d'autrui, écoute attentive.\n",
                    loyaute: "- LOYAUTÉ : Fidélité indéfectible, respect absolu de la parole donnée.\n",
                    devoement: "- DÉVOUEMENT : Sacrifice de soi au profit d'une cause ou d'un individu.\n",
                    protection: "- PROTECTION : Posture défensive active pour abriter un allié du danger.\n",

                    // ⚖️ VERTUS & LOGIQUE MENTALE (14)
                    solennel: "- SOLENNEL : Posture droite, respect rigide des rituels et des lois du Code.\n",
                    determination: "- DÉTERMINATION : Mâchoire serrée, pas ancrés au sol, focus inébranlable.\n",
                    focus: "- FOCUS : Concentration extrême sur une tâche précise, isolation sensorielle.\n",
                    bravoure: "- BRAVOURE : Affronter le danger de face de manière héroïque et visible.\n",
                    courage: "- COURAGE : Surmonter activement une trouille interne pour accomplir l'action.\n",
                    resilience: "- RÉSILIENCE : Capacité à encaisser les échecs et se remettre d'aplomb aussitôt.\n",
                    fierte: "- FIERTÉ : Torse bombé, tête haute, refus de montrer ses vulnérabilités.\n",
                    apatie: "- APATHIE : Indifférence clinique, absence totale de réaction émotionnelle.\n",
                    detachement: "- DÉTACHEMENT : Prendre de la distance intellectuelle, esprit ailleurs.\n",
                    froideur: "- FROIDEUR : Logique pure, ton tranchant, absence totale d'empathie relationnelle.\n",
                    sagesse: "- SAGESSE : Calme philosophique, recul stratégique avant toute parole.\n",
                    ambition: "- AMBITION : Volonté de grandeur, soif de pouvoir, calcul opportuniste.\n",
                    neutralite: "- NEUTRALITÉ : Objectivité totale, refus de prendre parti dans le conflit.\n",
                    patience: "- PATIENCE : Calme devant l'attente, maîtrise du timing, acceptation sereine du temps.\n"
                };
        activeMoodBtns.forEach(btn => {
            const moodKey = btn.getAttribute("data-mood");
            if (moodDictionary[moodKey]) moodInstruction += moodDictionary[moodKey];
        });
    }

    outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">🎲 Reroll : L'IA recalcule une variante avec les nouveaux attributs d'ambiance...</p>`;

    // Récupération des fiches
    const charData = charactersDB[window.currentActiveCharName] || {};
    const skillsText = charData.competences ? charData.competences.join(", ") : "Guerrier standard";
    
    let maFicheDetaillee = "Pas de fiche spécifique trouvée. Respecte le tempérament de base.";
    if (fiches) {
        for (const key in fiches) {
            if (window.currentActiveCharName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(window.currentActiveCharName.toLowerCase())) {
                maFicheDetaillee = (fiches[key].resume || "") + "\n" + (fiches[key].complete || "");
                break;
            }
        }
    }

    let catLorePrompt = "GUIDE COMPORTEMENTAL FÉLIN (À utiliser pour enrichir le langage corporel) :\n";
    if (typeof catBehaviorKnowledge === "object") {
        for (const category in catBehaviorKnowledge) {
            for (const behavior in catBehaviorKnowledge[category]) {
                catLorePrompt += `- ${behavior.replace(/_/g, ' ').toUpperCase()} : ${catBehaviorKnowledge[category][behavior]}\n`;
            }
        }
    }

    // Reconstruction du prompt avec les instructions de base d'origine
    let systemPrompt = `Tu es un coach d'écriture expert et un joueur d'élite pour un forum RPG écrit basé sur l'univers de La Guerre des Clans. 
Tu rédiges au nom du personnage suivant : ${window.currentActiveCharName}.

Fiche technique du personnage :
- Compétences et caractéristiques clés : ${skillsText}
- Profil psychologique & Histoire :
${maFicheDetaillee}

<consignes_syntaxe_markdown>
[... Garde ici les consignes de syntaxe à l'identique de ton bouton principal pour économiser de la place ...]
</consignes_syntaxe_markdown>

⚠️ RAPPEL DE FIN IMMÉDIAT (SÉCURITÉ ANTI-CRASH) : Écris les paroles en texte normal après le "> ".`;

    if (instructions) {
        systemPrompt += `👉 DIRECTIVE DE SCÉNARIO ET DE STYLE : "${instructions}"\n\n`;
    }
    if (moodInstruction) {
        systemPrompt += `${moodInstruction}\n`;
    }

    systemPrompt += `Consignes narratives et stylistiques absolues (Anti-Détection IA) : 3ème personne du singulier, ne pas faire jouer les autres,Burstiness & Perplexity.\n\n`;

    // Rechargement historique des messages
    let historiqueContext = "Voici la discussion telle qu'elle s'est déroulée chronologiquement :\n";
    try {
        const messagesRef = collection(db, "rps_pending", window.currentActiveRpId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        snap.forEach(d => {
            const m = d.data();
            historiqueContext += `[${m.sender}]: ${m.text}\n`;
        });
    } catch (e) { console.error(e); }

    systemPrompt += historiqueContext;

    let mistralMessages = [{ role: "system", content: systemPrompt }];

    // Rechargement de l'historique de l'assistant IA
    try {
        const aiHistoryRef = collection(db, "rps_pending", window.currentActiveRpId, "ai_history");
        const qAi = query(aiHistoryRef, orderBy("createdAt", "asc"));
        const snapAi = await getDocs(qAi);
        if (!snapAi.empty) {
            snapAi.forEach(d => {
                const m = d.data();
                const messageContent = m.content || m.text || "";
                if (m.role && messageContent) {
                    mistralMessages.push({ role: m.role, content: messageContent });
                }
            });
        }
    } catch (e) { console.error(e); }

    let currentPrompt = "";
    if (dernierPromptJoueur) {
        currentPrompt += `[Note ou action contextuelle récente transmise par le joueur] : ${dernierPromptJoueur}\n`;
    }
    currentPrompt += `\nTu devez maintenant rédiger une VARIANTE de réplique pour mon personnage "${window.currentActiveCharName}". Respecte la charte Markdown.`;

    mistralMessages.push({ role: "user", content: currentPrompt });

    try {
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({ model: "mistral-large-latest", messages: mistralMessages, temperature: 0.85 }) // Légèrement plus haut pour forcer le changement créatif
        });
        
        if (!response.ok) throw new Error(`Code erreur API Mistral : ${response.status}`);
        const data = await response.json();

        if (data.choices && data.choices[0] && data.choices[0].message) {
            let textAiRaw = data.choices[0].message.content;
            outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">🛡️ Analyse sémantique et sécurisation de la syntaxe en cours...</p>`;
            
            let textAi = await nettoyerSyntaxeDialogue(textAiRaw);

            // Remplacer ou ajouter la vue exclusive HTML (Recopie la fin exacte de ton bouton d'origine pour générer le innerHTML et lier les 3 addEventListener des boutons de copie et de visionnage).
            const textAiHTML = parseRP(textAi);
            
            // On réinjecte le bloc d'affichage
            outputDiv.innerHTML = `
                <div class="co-write-display" style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="color:#a777e3; font-weight:bold;">Suggéré (Variante Reroll) pour ${window.currentActiveCharName} :</span>
                        <div style="display: flex; gap: 5px;">
                            <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                            <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                        </div>
                    </div>
                    <div style="color:#fff; font-size:1.2rem; font-family:Georgia, serif; line-height:1.4 !important; margin:0;">${textAiHTML}</div>
                </div>
                `;

            // Ré-attacher les écouteurs d'événements du nouveau HTML injecté
            document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                navigator.clipboard.writeText(textAi);
                this.innerText = "✓ Copié !";
            });
            document.getElementById("btnVoirCoWrite").addEventListener("click", function() {
                document.getElementById("coWriteExclusiveModal").style.display = "flex";
            });
            document.getElementById("btnCloseExclusive").addEventListener("click", function() {
                document.getElementById("coWriteExclusiveModal").style.display = "none";
            });
        }
    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur lors du Reroll.</span>";
    }
};

// 🎬 FONCTION DE RÉSUMÉ DE SCÈNE TACTIQUE
window.relireLaScene = async function() {
    const outputDiv = document.getElementById("coWriteAiOutput");
    const rpId = window.currentActiveRpId; // On récupère le RP en cours

    if (!rpId) {
        alert("❌ Aucun RP actif sélectionné pour analyser la scène !");
        return;
    }

    if (outputDiv) {
        outputDiv.innerHTML = "⏳ *L'IA examine les dernières répliques pour reconstituer la scène...*";
    }

    try {
        // 1. Récupérer les 5 derniers messages de la sous-collection
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "desc"), limit(5));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            if (outputDiv) outputDiv.innerHTML = "📭 Aucun historique de message trouvé pour ce RP.";
            return;
        }

        // 2. On remet les messages dans le bon ordre chronologique
        let derniersMessages = [];
        querySnapshot.forEach(docSnap => {
            derniersMessages.unshift(docSnap.data());
        });

        // 3. On construit le prompt textuel pour l'IA
        let contexteBrut = derniersMessages.map(m => `[${m.sender || "Inconnu"}]: ${m.text || m.content}`).join("\n\n");

        const promptSysteme = `Tu es un assistant de jeu de rôle textuel. Ta tâche est de faire un résumé court, percutant et ultra-précis de la scène en cours basé sur les 5 dernières répliques fournies. 
        Tu dois obligatoirement lister :
        - Les personnages présents (qui est là ?).
        - Ce qu'ils font ou l'action cruciale qui vient de se passer (faits récents).
        - L'état psychologique ou l'ambiance immédiate (tension, peur, calme).
        Sois concis (maximum 4-5 phrases), va droit au but, pas de blabla d'introduction.`;

        // 4. Appel à ton API de génération IA (Adapte cette ligne avec ta fonction d'appel IA existante !)
        // Exemple type si tu as une fonction appelée appelerMonIA(systemPrompt, userText) :
        const resumeIa = await appelerMonIA(promptSysteme, contexteBrut); 

        // 5. Affichage du résultat stylisé dans ton interface
        if (outputDiv) {
            outputDiv.innerHTML = `
                <div style="background: rgba(167, 119, 227, 0.1); border-left: 3px solid #a777e3; padding: 12px; margin-top: 10px; border-radius: 4px; color: #e0e0e0; font-size: 0.9rem; line-height: 1.5;">
                    <strong style="color: #a777e3; display: block; margin-bottom: 6px;">🎬 Brief de situation (Relecture) :</strong>
                    ${resumeIa.replace(/\n/g, "<br>")}
                </div>
            `;
        }

    } catch (err) {
        console.error("Erreur lors de la relecture de la scène :", err);
        if (outputDiv) outputDiv.innerHTML = "❌ Erreur lors de la génération du résumé de scène.";
    }
};