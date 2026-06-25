import { charactersDB, fiches } from './CharacterData.js';
import { catBehaviorKnowledge } from './CatBehaviorData.js';
import { db } from '../Firebase.js';
import { limit, collection, setDoc, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp, deleteDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js'; // 🛠️ Importation du parseur Markdown existant
import { analyserSituationEtAppliquerMoods } from './MoodAnalyzer.js';
import { analyserImpactPhysiqueEtMental } from './TraumaAnalyzer.js';
// 🔄 Remplacer l'ancienne ligne par celle-ci :
import { fichesPersonnagesJDR, dictionnaireActionsSociales, executerLancerSocialPrecalcul } from './TraitsDictionnaire.js';
import { preparerEtInitialiserZoneDes, executerLancerDesErER, dictionnaireActionsErER} from './DiceManager.js';
// ⚠️ CONFIGURATION MISTRAL
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-lastest"

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
    const senderSelect = document.getElementById("coWriteSenderName");
   
    if (!modal) return;
   
    modal.style.display = "flex";
    if (title) {
        title.innerText = `🖋️ Co-Écriture : ${charName}`;
    }
    if (historyLog) {
        historyLog.innerHTML = "<p style='color:#888; text-align:center;'>Chargement de l'historique du RP...</p>";
    }

    // 🧼 RESET TOTAL ET SÉCURISÉ
    document.querySelectorAll(".mood-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    // 👁️ GESTION DU PANNEAU PLIABLE
    const btnToggleConfig = document.getElementById("btnToggleConfigGlobal");
    const configGlobalContent = document.getElementById("configGlobalContent");

    if (btnToggleConfig && configGlobalContent) {
        configGlobalContent.style.display = "none";
        btnToggleConfig.innerText = "⚙️ Afficher la Configuration des dés et des émotions";
        btnToggleConfig.style.background = "rgba(167, 119, 227, 0.1)";

        btnToggleConfig.onclick = function(e) {
            e.preventDefault();
            if (configGlobalContent.style.display === "none" || configGlobalContent.style.display === "") {
                configGlobalContent.style.display = "flex";
                btnToggleConfig.innerText = "⚙️ Masquer la Configuration des dés et des émotions";
                btnToggleConfig.style.background = "rgba(167, 119, 227, 0.2)";
            } else {
                configGlobalContent.style.display = "none";
                btnToggleConfig.innerText = "⚙️ Afficher la Configuration des dés et des émotions";
                btnToggleConfig.style.background = "rgba(167, 119, 227, 0.1)";
            }
        };
    }

    const contextArea = document.getElementById("coWriteContext");
    const outputDiv = document.getElementById("coWriteAiOutput");

    if (contextArea) contextArea.value = "";
    if (outputDiv) outputDiv.innerHTML = "Prêt à rédiger avec l'aide de Mistral Large.";
    if (historyLog) historyLog.innerHTML = "<span style='color: #aaa;'>Chargement des données du RP...</span>";

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

    // 🛡️ OPTIMISATION 1 : On lance l'analyseur de Moods en arrière-plan (sans "await") pour ne pas geler l'affichage
    if (typeof analyserSituationEtAppliquerMoods === "function") {
        analyserSituationEtAppliquerMoods(charName).catch(moodErr => {
            console.error("⚠️ MoodAnalyzer a crashé en arrière-plan :", moodErr);
        });
    }

    // 🎲 Étape 1 : Initialisation synchrone
    if (typeof preparerEtInitialiserZoneDes === "function") {
        preparerEtInitialiserZoneDes();
    }

    // 🔥 Étape 2 : Construction de la répartition 7 truqués / 7 normaux
    const diceContainer = document.getElementById("diceActionsList");
    if (diceContainer && typeof dictionnaireActionsErER === "object") {
        window.getActionsSelectionneesPourIA = [];

        const activeRpId = window.currentActiveRpId || rpId;
        const activeCharName = window.currentActiveCharName || charName;
        const listeIdActions = Object.keys(dictionnaireActionsErER);

        let paquetDeDes = [1, 1, 12, 12, 30, 30];
        const choixPossibles = [1, 12, 30];
        const deMystere = choixPossibles[Math.floor(Math.random() * choixPossibles.length)];
        paquetDeDes.push(deMystere);

        while (paquetDeDes.length < 14) {
            paquetDeDes.push(null);
        }

        for (let i = paquetDeDes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [paquetDeDes[i], paquetDeDes[j]] = [paquetDeDes[j], paquetDeDes[i]];
        }

        try {
            window.resultatsPreCalcules = window.resultatsPreCalcules || {};
            
            // Tableau pour stocker toutes nos promesses Firebase à envoyer en arrière-plan
            const firebaseUpdates = [];

            // ⚔️ ACTIONS PHYSIQUES (Calcul local instantané)
            for (let index = 0; index < listeIdActions.length; index++) {
                const idAction = listeIdActions[index];
                const action = dictionnaireActionsErER[idAction];
                const deForce = paquetDeDes[index];

                let res = null;
                if (typeof executerLancerDesErER === "function") {
                    res = executerLancerDesErER(activeCharName, idAction, deForce);
                    window.resultatsPreCalcules[idAction] = res;
                }

                if (activeRpId && res) {
                    const actionDocRef = doc(db, "rps_pending", activeRpId, "des", idAction);
                    // OPTIMISATION 2 : On retire le "await" et on pousse la promesse dans le tableau
                    firebaseUpdates.push(setDoc(actionDocRef, {
                        actionId: idAction, nom: action.nom, actif: false,
                        total: Number(res.total) || 0, lancerDe: Number(res.lancerDe) || 0, sa: Number(res.sa) || 0,
                        verdictTexte: res.verdict ? res.verdict.texte : "Inconnu",
                        verdictCouleur: res.verdict ? res.verdict.couleur : "#aaa",
                        verdictDescription: res.verdict ? res.verdict.description : "",
                        timestamp: new Date()
                    }, { merge: true }));
                }
            }

            // 🎭 ACTIONS SOCIALES (Calcul local instantané)
            const listeIdSociales = Object.keys(dictionnaireActionsSociales || {}).filter(id => id !== "qualites" && id !== "defauts");
            const chatTraits = window.fichesPersonnagesJDR?.[activeCharName]?.traits || {};

            for (const idAction of listeIdSociales) {
                const action = dictionnaireActionsSociales[idAction];
                if (!action || !action.nom) continue;

                let res = null;
                if (typeof executerLancerSocialPrecalcul === "function") {
                    res = executerLancerSocialPrecalcul(chatTraits, idAction);
                    window.resultatsPreCalcules[idAction] = res;
                }

                if (activeRpId && res) {
                    const actionDocRef = doc(db, "rps_pending", activeRpId, "des", idAction);
                    // OPTIMISATION 2 (Suite) : Pas de "await", ajout au tableau de fond
                    firebaseUpdates.push(setDoc(actionDocRef, {
                        actionId: idAction, nom: action.nom, actif: false,
                        total: Number(res.total) || 0, lancerDe: Number(res.de) || 0, sa: Number(res.bonus) || 0,
                        verdictTexte: res.verdict ? res.verdict.texte : "Inconnu",
                        verdictCouleur: res.verdict ? res.verdict.couleur : "#aaa",
                        verdictDescription: res.verdict ? res.verdict.description : "",
                        timestamp: new Date(), estSocial: true
                    }, { merge: true }));
                }
            }

            // 🎨 CRÉATION DES BOUTONS GRAPHIQUES (UI) - S'exécute DIRECTEMENT sans attendre Firebase !
            const creerBoutonAction = (idAction, actionData, couleurTheme) => {
                const divAction = document.createElement("div");
                divAction.style.cssText = "padding: 8px 10px; margin: 5px 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #b0b0b8; transition: all 0.2s ease;";
                divAction.setAttribute("data-action-id", idAction);

                divAction.innerHTML = `
                    <span style="font-weight: 500;">${actionData.nom}</span>
                    <span class="status-indicator" style="font-family: monospace; color: #444a5a; font-weight: bold;">[ ]</span>
                `;

                divAction.addEventListener("click", async () => {
                    const indicator = divAction.querySelector(".status-indicator");
                    const indexCoche = window.getActionsSelectionneesPourIA.indexOf(idAction);
                    let estCoche = false;

                    if (indexCoche === -1) {
                        window.getActionsSelectionneesPourIA.push(idAction);
                        estCoche = true;
                        divAction.style.background = `rgba(${couleurTheme}, 0.15)`;
                        divAction.style.borderColor = `rgb(${couleurTheme})`;
                        divAction.style.color = "#fff";
                        if (indicator) {
                            indicator.innerText = "[ COCHÉ ]";
                            indicator.style.color = `rgb(${couleurTheme})`;
                        }
                    } else {
                        window.getActionsSelectionneesPourIA.splice(indexCoche, 1);
                        estCoche = false;
                        divAction.style.background = "rgba(255,255,255,0.03)";
                        divAction.style.borderColor = "rgba(255,255,255,0.05)";
                        divAction.style.color = "#b0b0b8";
                        if (indicator) {
                            indicator.innerText = "[ ]";
                            indicator.style.color = "#444a5a";
                        }
                    }

                    if (activeRpId) {
                        const actionDocRef = doc(db, "rps_pending", activeRpId, "des", idAction);
                        await setDoc(actionDocRef, { actif: estCoche }, { merge: true });
                    }

                    if (typeof window.mettreAJourAffichageDesPourIA === "function") {
                        window.mettreAJourAffichageDesPourIA(window.getActionsSelectionneesPourIA);
                    }
                });
                return divAction;
            };

            diceContainer.innerHTML = "";

            const titrePhysique = document.createElement("div");
            titrePhysique.innerHTML = `<strong style="color:#ffcc00; font-size:0.85rem; margin-top:5px; display:block;">⚔️ Actions Physiques :</strong>`;
            diceContainer.appendChild(titrePhysique);
            listeIdActions.forEach(id => {
                if (dictionnaireActionsErER[id]) {
                    diceContainer.appendChild(creerBoutonAction(id, dictionnaireActionsErER[id], "255, 204, 0"));
                }
            });

            const titreSocial = document.createElement("div");
            titreSocial.innerHTML = `<strong style="color:#a777e3; font-size:0.85rem; margin-top:15px; display:block;">🎭 Actions Sociales (Sur 50) :</strong>`;
            diceContainer.appendChild(titreSocial);
            listeIdSociales.forEach(id => {
                if (dictionnaireActionsSociales[id]) {
                    diceContainer.appendChild(creerBoutonAction(id, dictionnaireActionsSociales[id], "167, 119, 227"));
                }
            });

            // OPTIMISATION 3 : On balance l'ensemble des écritures Firestore en une seule fois, en tâche de fond
            Promise.all(firebaseUpdates).then(() => {
                console.log("🎲 [Sync] Tous les lancers pré-calculés ont été synchronisés sur Firestore !");
            }).catch(err => {
                console.error("❌ Erreur lors de la synchronisation Firestore des dés :", err);
            });

        } catch (err) {
            console.error("❌ Erreur critique d'initialisation dés :", err);
            diceContainer.innerHTML = "<div style='color: #ff4a4a; padding: 10px;'>❌ Impossible d'initialiser le paquet de dés contrôlé.</div>";
        }
    }

    setTimeout(() => {
        const boutonsCoches = Array.from(document.querySelectorAll('.btn-action-des.selected, .btn-action-sociale.selected'))
            .map(btn => btn.getAttribute('data-id') || btn.id);
        if (boutonsCoches.length > 0 && typeof window.mettreAJourAffichageDesPourIA === 'function') {
            window.mettreAJourAffichageDesPourIA(boutonsCoches);
        }
    }, 150);
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

window.ouvrirModaleConsignes = function() {
    assurerExistenceModaleConsignes();
    document.getElementById("modalConsignes").style.display = "flex";
};

window.fermerModaleConsignes = function() {
    const modal = document.getElementById("modalConsignes");
    if (modal) modal.style.display = "none";
};

function assurerExistenceModaleConsignes() {
    if (document.getElementById("modalConsignes")) return;

    const modalHTML = `
    <div id="modalConsignes" style="display: none; position: fixed; z-index: 300000; left: 0; top: 0; width: 100vw; height: 100vh; background: rgba(5,5,8,0.85); backdrop-filter: blur(8px); justify-content: center; align-items: center; font-family:'Segoe UI', sans-serif;">
        <div style="background: #0c0c10; border: 1px solid #a777e3; box-shadow: 0 0 25px rgba(167, 119, 227, 0.2); width: 50vw; max-width: 600px; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; color: #fff;">
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(167, 119, 227, 0.2); display: flex; justify-content: space-between; align-items: center; background: #121218;">
                <h3 style="margin: 0; color: #a777e3; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">📝 Écriture des Consignes</h3>
                <button onclick="window.fermerModaleConsignes()" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
            </div>
            <div style="padding: 20px; background: #08080c; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 0.85rem; color: #aaa; font-weight: bold;">CONSIGNES DU SCÉNARIO :</label>
                    <button type="button" id="btnGenererIA" style="background: #2ecc71; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 8px rgba(46, 204, 113, 0.2);">
                        🤖 Écrire avec l'IA
                    </button>
                </div>
                <textarea id="textareaConsignes" placeholder="Écris tes consignes, contraintes ou contexte récent ici..." style="width: 100%; height: 200px; background: #121218; border: 1px solid #2a2a35; border-radius: 4px; color: #fff; padding: 10px; font-family: sans-serif; resize: none; box-sizing: border-box;"></textarea>
                <button type="button" onclick="window.fermerModaleConsignes()" style="background: #a777e3; color: #fff; border: none; padding: 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">
                    💾 ENREGISTRER ET QUITTER
                </button>
            </div>
        </div>
    </div>`;

    const range = document.createRange();
    const fragment = range.createContextualFragment(modalHTML);
    document.body.appendChild(fragment);

    brancherEvenementIAPilote();
}

function brancherEvenementIAPilote() {
    const btnModalIA = document.getElementById("btnGenererIA");
    const textareaModal = document.getElementById("textareaConsignes");

    const btnAiPrincipal = document.getElementById("btnAiCoWrite");
    const coWriteContextInput = document.getElementById("coWriteContext");
    const outputDivPrincipal = document.getElementById("coWriteAiOutput");

    if (!btnModalIA || !textareaModal) return;

    btnModalIA.addEventListener("click", async () => {
        if (!btnAiPrincipal) {
            alert("⚠️ Le module de co-écriture IA principal (btnAiCoWrite) est introuvable sur cette page.");
            return;
        }

        const texteOriginal = btnModalIA.innerHTML;
        btnModalIA.disabled = true;
        btnModalIA.style.background = "#7f8c8d";
        btnModalIA.innerHTML = `⏳ L'IA réfléchit...`;

        if (coWriteContextInput) {
            coWriteContextInput.value = textareaModal.value;
        }

        btnAiPrincipal.click();

        const verifierFinGeneration = setInterval(() => {
            const enCoursDeChargement = outputDivPrincipal && (
                outputDivPrincipal.innerHTML.includes("blink") || 
                outputDivPrincipal.innerHTML.includes("✍️") || 
                outputDivPrincipal.innerHTML.includes("🛡️")
            );

            if (!enCoursDeChargement) {
                clearInterval(verifierFinGeneration);
                textareaModal.value = "✨ [Génération Réussie] La réplique a été injectée avec succès ! Tu peux fermer cette fenêtre pour aller la lire.";
                btnModalIA.disabled = false;
                btnModalIA.style.background = "#2ecc71";
                btnModalIA.innerHTML = texteOriginal;
            }
        }, 500);
    });
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
        
        // CONDITION 1 : Le bouton a les DEUX classes (Orange IA actif)
        if (e.target.classList.contains("active") && e.target.classList.contains("detected")) {
            // On retire UNIQUEMENT la classe active (il devient orange "inactif")
            e.target.classList.remove("active");
        }
        
        // CONDITION 2 : Le bouton est Orange mais déjà désactivé, ou doré normal
        else if (e.target.classList.contains("active")) {
            // C'était un bouton doré manuel, on l'éteint complètement
            e.target.classList.remove("active");
        }
        
        // CONDITION 3 : Le bouton était éteint (ou orange inactif)
        else {
            // On l'allume ou le réactive en lui ajoutant la classe active
            e.target.classList.add("active");
        }
    }
});

    // 🛡️ SÉCURITÉ D'INJECTION POUR LA COLONNE DE BOUTONS
    let btnOuvrirConsignes = document.getElementById("btnOuvrirConsignes");
    
    if (!btnOuvrirConsignes && btnAi) {
        console.warn("⚠️ Bouton 'btnOuvrirConsignes' manquant dans le HTML d'origine. Injection dynamique lancée.");
        
        btnOuvrirConsignes = document.createElement("button");
        btnOuvrirConsignes.type = "button";
        btnOuvrirConsignes.id = "btnOuvrirConsignes";
        btnOuvrirConsignes.style.cssText = "background: #a777e3; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; white-space: nowrap;";
        btnOuvrirConsignes.innerHTML = "📝 Rédiger les Consignes";
        
        // On l'injecte juste au-dessus du bouton "Écrire avec l'IA"
        btnAi.parentNode.insertBefore(btnOuvrirConsignes, btnAi);
    }

    if (btnOuvrirConsignes) {
        btnOuvrirConsignes.addEventListener("click", () => {
            window.ouvrirModaleConsignes();
        });
    }

    if (btnSave) {
    btnSave.addEventListener("click", async () => {
        const textInput = document.getElementById("coWriteContext");
        const senderSelect = document.getElementById("coWriteSenderName");
        
        // 1. Récupération des valeurs
        const texteSaisi = textInput ? textInput.value.trim() : "";
        const auteurDuMessage = senderSelect ? senderSelect.value : "";

        // 2. Sécurité : On vérifie qu'on a bien un texte, un auteur et un RP actif
        if (!texteSaisi || !auteurDuMessage || !window.currentActiveRpId) {
            alert("Erreur : Sélectionne l'auteur du message et colle son texte !");
            return;
        }

        try {
            // 🎯 3. GÉNÉRATION DE L'ID UNIQUE Firebase pour ce message
            const pendingDocRef = doc(db, "rps_pending", window.currentActiveRpId);
            const nouveauMessageRef = doc(collection(pendingDocRef, "messages"));
            const uniqueMsgId = nouveauMessageRef.id;

            window.lastGeneratedMsgId = uniqueMsgId;

            // 4. On s'assure que le document parent existe (sans écraser le reste grâce à merge: true)
            await setDoc(pendingDocRef, { 
                lastUpdated: serverTimestamp()
            }, { merge: true });

            // 🎯 5. SAUVEGARDE DE LA RÉPLIQUE DANS L'HISTORIQUE 'messages'
            await setDoc(nouveauMessageRef, {
                id: uniqueMsgId,         // ID unique du message
                sender: auteurDuMessage, // Le nom du personnage sélectionné (ex: l'autre joueur)
                text: texteSaisi,        // Son texte brut
                content: texteSaisi,     // Doublon de sécurité pour ton parseur
                createdAt: serverTimestamp() // Horodatage précis pour l'ordre chronologique
            });

            console.log(`💾 Réplique de [${auteurDuMessage}] ajoutée à l'historique du RP. ID : ${uniqueMsgId}`);

            // 6. Si l'auteur du message enregistré est TON personnage, on nettoie l'historique de l'IA
            if (window.currentActiveCharName && auteurDuMessage.toLowerCase() === window.currentActiveCharName.toLowerCase()) {
                if (typeof window.clearAiHistory === "function") {
                    await window.clearAiHistory(window.currentActiveRpId);
                }
            }

            // 7. Nettoyage de l'interface et mise à jour visuelle
            textInput.value = "";
            
            // On recharge le composant visuel de l'historique pour voir la réplique apparaître
            /**if (typeof loadOrCreateRpHistory === "function") {
                await loadOrCreateRpHistory(window.currentActiveRpId, window.currentActiveCharName);
            }**/

            

        } catch (err) { 
            console.error("Erreur lors de l'enregistrement de la réplique externe :", err); 
            alert("❌ Erreur lors de l'enregistrement dans Firestore.");
        }
    });
}



if (btnAi) {
    btnAi.addEventListener("click", async () => {
        const outputDiv = document.getElementById("coWriteAiOutput");
        const textInput = document.getElementById("coWriteContext");

            // ============================================================================
// MODIFICATION : TABLEAU PIPELINE ETAPES AVEC TES PROMPTS ORIGINAUX ET LES TEMPÉRATURES ADAPTÉES
// À remplacer entièrement dans ton code.
// ============================================================================

const pipelineEtapes = [
    // ==========================================
    // SECTION 1 : ANALYSES DE SITUATION (Étapes 1 à 4)
    // ==========================================
    {
        id: 1,
        nom: "Analyse globale de l'historique de la scène",
        temperature: 0.05, // Ultra-factuel et clinique
        prompt: `Analyse avec une rigueur absolue la TOTALITÉ de l'historique textuel fourni de la scène [HISTORIQUE DE LA SCÈNE]. 
Ton objectif est de dresser une cartographie factuelle et chronologique de la situation.
1. Détermine le fil conducteur précis : quel est l'événement déclencheur et comment la confrontation ou l'interaction a progressé de message en message.
2. Évalue l'évolution psychologique de TOUS les personnages en présence : analyse leurs changements de ton, leur réactivité émotionnelle, leurs postures physiques récurrentes et les glissements dans leur comportement du premier au dernier post.
3. Caractérise précisément l'atmosphère générale (froide, hostile, étouffante, mélancolique, tendue) et liste les facteurs environnementaux actifs.
4. Identifie le lieu exact de l'action, sa topographie immédiate, les obstacles spatiaux, la luminosité et la temporalité (aube, nuit, intempéries).
5. Extrais les thématiques majeures abordées (trahison, survie, domination, alliance secrète, deuil).
Rends un résumé clinique, analytique, profond et purement chronologique de la situation globale.
Interdiction absolue d'inventer, d'anticiper la suite, d'extrapoler ou de supposer des événements non écrits. 
Ne produis aucun blabla d'introduction, commence directement par l'analyse factuelle.`
    },
    {
        id: 2,
        nom: "Focalisation sur le point d'ancrage immédiat",
        temperature: 0.05, // Précision chirurgicale et millimétrique
        prompt: `Isole et décortique de manière chirurgicale UNIQUEMENT et exclusivement le tout dernier message écrit par ton interlocuteur dans l'historique. 
Ce post constitue ta seule et unique balise mécanique d'entrée pour la suite du récit.
1. Détermine la position physique exacte de l'interlocuteur à la demi-seconde près à la fin de son action (est-il debout, couché, en suspens, à quelle distance exacte se trouve-t-il de ton personnage ?).
2. Analyse la dynamique de son mouvement : s'agit-il d'une action interrompue, d'une posture figée ou d'une charge cinétique ?
3. Extrais ses toutes dernières paroles prononcées, son intonation exacte (vibrante, brisée, impérieuse) et le sens littéral de sa réplique.
4. Repère et liste ses micro-expressions faciales, le positionnement de son regard, de ses oreilles ou de ses membres à la milliseconde où son post se termine.
Tu dois formuler un rapport de situation spatial et temporel d'une précision millimétrique.
Règle absolue : Ce point d'ancrage est le seul point de départ autorisé pour ta future réaction physique et verbale. 
Tu as l'interdiction formelle de modifier, d'ignorer ou de décaler l'état final décrit par l'interlocuteur.`
    },
    {
        id: 3,
        nom: "Analyse de la fiche du personnage concerné",
        temperature: 0.05, // Moteur physique et psychologique rigide
        prompt: `Prends la fiche technique complète et exhaustive du personnage que tu incarnes.
Exécute une analyse de compatibilité physique et sociale avec la situation actuelle.
1. Extrais ses forces physiques brutes (puissance musculaire, agilité, endurance) et confronte-les aux contraintes du décor de l'Étape 1.
2. Identifie ses faiblesses physiques et psychologiques actuelles, ses blessures ouvertes, sa fatigue ou ses limitations sensorielles.
3. Prends en compte son grade au sein du clan (novice, guerrier, lieutenant, guérisseur, chef) et l'autorité ou la soumission mécanique que ce statut implique face à l'interlocuteur.
4. Analyse son tempérament global, ses traits de caractère dominants et ses schémas de pensée automatiques.
Formule une synthèse stricte définissant ce que ce personnage est techniquement et biologiquement capable ou incapable de faire ou de dire dans cette situation précise.
Règle éliminatoire : Tu dois te comporter comme un moteur physique et psychologique rigide. Un novice ne peut pas manifester l'aisance martiale d'un vétéran, et un personnage blessé aux pattes ne peut pas accomplir un bond prodigieux sans en payer le prix narratif.`
    },
    {
        id: 4,
        nom: "Récupération et décodage des humeurs/moods",
        temperature: 0.30, // Analyse technique des micro-signaux physiques
        prompt: `Analyse la liste des boutons de 'Humeurs/Moods' actifs et détectés qui te sont fournis pour cette scène.
Chaque humeur/mood sélectionné est une contrainte émotionnelle majeure qui doit saturer l'atmosphère et modifier la physiologie du personnage.
1. Pour chaque humeur/mood actif, définis une liste de 3 à 5 micro-comportements ou altérations physiques involontaires et réalistes (ex: accélération du rythme cardiaque, crispation invisible des mâchoires, dilatation ou rétractation brutale des pupilles, frémissement de la base de la queue, aplatissement des oreilles, sudation des coussinets).
2. Décode l'impact de ces émotions sur la perception sensorielle du personnage (vision tunnel, hypersensibilité aux bruits, odeurs perçues avec plus d'intensité).
3. Détermine comment ces humeurs influencent la posture passive du personnage (tension musculaire générale, tremblement des membres, rigidité de la nuque).
Traduis des concepts émotionnels abstraits en manifestations physiques concrètes, observables et purement animales. 
Ne produis aucun texte de RP, rends une liste technique de micro-signaux physiques liés aux humeurs/moods.`
    },

    // ==========================================
    // SECTION 2 : LOGIQUE ET RÉFLEXIONS (Étapes 5 à 9)
    // ==========================================
    {
        id: 5,
        nom: "Réflexion sur la réaction psychologique",
        temperature: 0.10, // Planification émotionnelle stable, sans action physique
        prompt: `En te basant impérativement sur l'analyse de l'historique global (Étape 1) et du point d'ancrage immédiat (Étape 2), détermine l'impact émotionnel instantané sur ton personnage.
Tu dois analyser ce qu'il ressent à la milliseconde exacte où le message de l'interlocuteur se termine, avant même qu'un muscle ne bouge ou qu'une parole ne soit prononcée.
1. Quelle est l'émotion primaire provoquée (peur panique, colère sourde, sidération, soulagement, méfiance absolue) ?
2. Comment son passif, ses traumatismes et ses relations antérieures avec cet interlocuteur influencent-ils cette réaction psychologique ?
3. Identifie le conflit interne immédiat : ce qu'il ressent au plus profond de lui vs ce qu'il veut laisser paraître.
4. Analyse le traitement cognitif de l'information : comprend-il la portée des paroles de l'autre ou est-il dans l'incompréhension ?
Reste d'une cohérence psychologique inflexible avec l'historique.
Interdiction formelle d'anticiper la suite de la scène, d'engager une action physique ou de formuler un dialogue. Concentre-toi uniquement sur le flux psychologique interne brut.`
    },
    {
        id: 6,
        nom: "Intentions sur les actions physiques",
        temperature: 0.10, // Planification géométrique et morphologique stricte
        prompt: `Planifie et décris avec précision les mouvements physiques macroscopiques que ton personnage va accomplir en réponse directe et immédiate au point d'ancrage (Étape 2).
Cette planification doit être 100% réaliste, biologique et conforme à la morphologie stricte d'un félin sauvage (anatomie, poids, centre de gravité, équilibre).
1. Décris la répartition de ses appuis au sol : quelles pattes se contractent, comment ses griffes s'ancrent dans la terre ou la roche, comment sa colonne vertébrale fléchit ou se détend.
2. Spécifie l'orientation exacte de son corps, de ses épaules, de sa tête et de son axe de vision par rapport à l'interlocuteur.
3. Détermine ses déplacements prévus dans l'espace : recul de sécurité, contournement stratégique, rapprochement intimidant, ou immobilité défensive totale.
4. Justifie l'énergie et la vitesse cinétique appliquées au mouvement (lenteur calculée, explosion de rapidité, tremblement de tension).
Règle géométrique : L'action doit s'insérer parfaitement sans téléportation ni incohérence spatiale par rapport aux positions établies à l'Étape 2. 
Ne rédige pas encore le texte littéraire, formule uniquement des intentions de mouvements claires et séquencées.`
    },
    {
        id: 7,
        nom: "Intentions sur les dialogues",
        temperature: 0.55, // Stratégique, équilibre entre logique et ton sauvage
        prompt: `Détermine de manière hautement stratégique l'intention sémantique et psychologique derrière les prochaines paroles de ton personnage.
Chaque mot prononcé doit être une arme, un bouclier ou un outil de manipulation sociale au sein du clan.
1. Quel est le but exact, unique et précis de sa réplique (intimider l'autre, rassurer un subordonné, fuir une question compromettante, avouer un secret douloureux, poser un ultimatum) ?
2. Choisis le ton exact et les nuances vocales : voix saccadée, murmure feutré, grognement guttural à peine audible, miaulement impérieux.
3. Définis la structure du langage : interdiction formelle d'utiliser des phrases longues, pompeuses, poétiques ou de type humain civilisé. Pense exclusivement 'sauvage, direct, félin et percutant'.
4. Détermine la longueur de la prise de parole : un mot unique, une phrase courte, ou un silence lourd de sens qui coupe la parole.
Formule l'intention sous-jacente et les mots-clés conceptuels qui devront être verbalisés. 
Ne rédige pas de réplique définitive ici, valide uniquement la stratégie de communication.`
    },
    {
        id: 8,
        nom: "Intention sur les pensées",
        temperature: 0.55, // Profondeur psychologique et réflexion intime
        prompt: `Isole avec une étanchéité absolue ce que le personnage va garder secret au plus profond de son esprit.
Il s'agit du flux de conscience intime qui ne doit JAMAIS transparaître dans ses actes physiques ni dans ses paroles à haute voix face à son interlocuteur.
1. Quelle est la vérité crue, le doute toxique ou la peur viscérale qu'il se cache à lui-même ou qu'il refuse catégoriquement de verbaliser dans cette scène précise ?
2. Analyse ses jugements silencieux et secrets sur l'interlocuteur en face de lui (mépris caché, admiration inavouable, désir de vengeance).
3. Formule ses calculs mentaux à court terme : ce qu'il prévoit de faire au message suivant, ses plans de secours si la situation dégénère.
4. Détermine la charge émotionnelle de cette pensée (souffrance contenue, ironie mordante, panique interne refoulée).
Ce monologue intérieur doit apporter une profondeur psychologique abyssale au personnage.
Règle stricte : La pensée doit être en contraste ou en tension directe avec le dialogue planifié à l'Étape 7.`
    },
    {
        id: 9,
        nom: "Récupération des dés et contraintes JDR",
        temperature: 0.20, // Strict respect logique des contraintes du verdict du dé
        prompt: `Prends connaissance de la TOTALITÉ des dés JDR lancés pour cette action, de leurs scores numériques exacts et de leurs verdicts mécaniques impératifs (Échec Critique, Échec, Réussite Partielle, Réussite, Réussite Critique).
Tu dois analyser comment cette contrainte aléatoire du système de jeu brise, altère, magnifie ou valide les intentions physiques initiales du personnage (Étape 6).
1. Si le dé indique un Échec ou Échec Critique : détermine la cause physique ou environnementale brutale de ce raté (glissade, faiblesse de la patte blessée, réflexe fulgurant de l'adversaire). L'intention du personnage doit s'effondrer de manière dramatique.
2. Si le dé indique une Réussite Partielle : trouve le compromis exact. L'action réussit mais implique un coût majeur, une blessure légère, une perte d'équilibre ou une concession tactique.
3. Si le dé indique une Réussite ou Réussite Critique : détermine comment l'action s'exécute à la perfection, démontrant la pleine puissance ou la chance insolente du félin.
Formule l'impact mécanique strict des dés sur le scénario physique. 
Interdiction de rédiger le texte final, pose les jalons logiques de la résolution du jet.`
    },

    // ==========================================
    // SECTION 3 : RÉDACTION, INTÉGRATION ET VÉRIFICATIONS (Étapes 10 à 23)
    // ==========================================
    {
        id: 10,
        nom: "Première Rédaction brute",
        temperature: 0.40, // Assemblage et logique de structure narrative
        prompt: `Rédige un premier jet brut de la scène de RP en combinant de manière chronologique et logique l'ensemble des réflexions et des intentions validées précédemment.
Tu dois assembler la réaction psychologique (Étape 5), les mouvements physiques (Étape 6), les intentions de dialogues (Étape 7) et le flux des pensées (Étape 8).
1. Respecte une structure narrative linéaire : l'impact émotionnel d'abord, le mouvement corporel qui s'ensuit, puis la parole ou le silence, entrecoupés par les réflexions internes.
2. Ne cherche pas le style parfait, l'élégance littéraire ou les métaphores complexes pour le moment.
3. Concentre-toi à 100% sur la solidité de la structure, l'enchaînement logique des causes et des effets, et le respect absolu de la géométrie de la scène.
4. Assure-toi que chaque intention se traduit par un fait narratif concret dans le texte.
Rends un texte brut, complet, fonctionnel et parfaitement structuré, sans sauter aucun élément de réflexion préalable.`
    },
    {
        id: 11,
        nom: "Injection des humeurs/moods dans le premier jet",
        temperature: 0.55, // Équilibre pour disperser subtilement l'ambiance émotionnelle
        prompt: `Prends la Première Rédaction brute (Étape 10) et injecte de manière subtile, organique et chirurgicale à l'intérieur du récit les micro-comportements et altérations physiques identifiés à l'Étape 4.
L'ambiance émotionnelle ne doit pas être expliquée de manière théorique au lecteur, elle doit transparaître à travers les réactions corporelles inconscientes et viscérales du chat sauvage.
1. Remplace les déclarations abstraites (ex: 'il était en colère') par des descriptions biologiques d'injection d'humeur/mood (ex: 'le poil de son échine se hérissa, une onde de chaleur sauvage remontant le long de sa colonne vertébrale').
2. Disperse ces micro-signaux au cœur des actions physiques et entre les répliques de dialogue pour hacher le rythme de la scène.
3. Veille à ce que l'intensité des manifestations physiques soit proportionnelle à la situation de crise vécue.
Le texte obtenu doit devenir charnel, biologique et lourdement chargé de la tension nerveuse des émotions actives.`
    },
    {
        id: 12,
        nom: "Seconde Rédaction littéraire",
        temperature: 0.85, // Rédaction créative poussée pour l'immersion sensorielle et lexicale
        prompt: `Réécris l'ensemble du texte obtenu à l'étape précédente en élevant radicalement sa qualité stylistique, poétique et immersive.
Tu dois lui donner une dimension littéraire profonde et une texture organique brute.
1. Améliore la métrique des phrases : alterne judicieusement phrases courtes et percutantes pour les moments de tension, et phrases plus denses pour les descriptions d'états internes.
2. Enrichis et varie le vocabulaire : banni les verbes ternes (faire, dire, voir, aller, être, avoir) et remplace-les par un lexique précis, viscéral, tellurique et sensoriel.
3. Supprime impitoyablement toutes les répétitions de mots, les lourdeurs syntaxiques et les tournures de phrases passives ou impersonnelles.
4. Donne une atmosphère immersive profonde au récit : le texte doit vibrer d'un réalisme animal total, où chaque description évoque la texture du sol, l'odeur du sang, du sanglot ou du vent, et la rudesse de la vie sauvage.
Le récit final doit être captivant, fluide, d'une grande élégance stylistique tout en conservant sa férocité originelle.`
    },
    {
        id: 13,
        nom: "Intégration narrative de l'impact des dés",
        temperature: 0.55, // Transition fluide et narrative de la fatalité du dé
        prompt: `Prends la Seconde Rédaction littéraire (Étape 12) et modifie de force, mais de manière fluide et narrative, l'axe de l'histoire pour y intégrer l'impact des dés analysé à l'Étape 9.
Le destin dicté par les dés doit briser ou valider le fil du récit littéraire initial.
1. Si le jet est un échec, réécris la séquence de mouvement : le personnage entame son action comme prévu à l'Étape 12, mais celle-ci dérape, rate sa cible ou se retourne contre lui de façon logique et immédiate au milieu du paragraphe.
2. Si le jet est une réussite partielle, insère la notion d'effort douloureux ou de sacrifice physique immédiat au moment de l'impact de l'action.
3. Ajuste les réactions psychologiques internes du personnage en temps réel face à la réussite ou au fiasco de son mouvement physique.
Le texte obtenu doit fondre ensemble la fatalité des règles mécaniques du JDR et la beauté de la narration, sans que le lecteur ne ressente de coupure artificielle.`
    },
    {
        id: 14,
        nom: "Troisième Rédaction (Fusion)",
        temperature: 0.75, // Harmonisation fluide et lissage du rythme dramatique
        prompt: `Fusionne, harmonise et réadapte l'ensemble des paragraphes obtenus pour obtenir un texte d'une fluidité absolue et sans couture.
La narration littéraire de haut niveau et les verdicts impitoyables des dés doivent désormais former un seul et unique récit cohérent, haletant et parfaitement unifié.
1. Lisse les transitions entre les moments de pensée intime, les mouvements physiques réussis ou avortés, et les prises de parole.
2. Élimine les ruptures de ton ou les phrases magiques qui tenteraient de justifier artificiellement le résultat d'un dé. Tout doit couler de source.
3. Accentue le rythme dramatique de la scène en veillant à ce que l'enchaînement des actions physiques et des réactions verbales soit viscéral et logique.
Rends un texte d'une cohérence narrative parfaite, prêt à subir la phase d'auto-critique et de nettoyage.`
    },
    {
        id: 15,
        nom: "Vérification de la continuité historique",
        temperature: 0.10, // Auto-critique rigoureuse pour traquer les hallucinations spatio-temporelles
        prompt: `Effectue une auto-critique et une correction d'une rigueur absolue concernant la continuité historique et spatiale de la scène.
Compare méthodiquement ton texte actuel avec l'historique global (Étape 1) et le point d'ancrage (Étape 2).
1. Est-ce qu'un élément matériel, topographique, spatial, temporel ou logique se contredit entre ton texte et les posts précédents ? (ex: un objet changé de place, une météo oubliée, une distance incohérente).
2. Vérifie minutieusement qu'aucun personnage absent n'a été inventé ou mentionné par erreur au détour d'une phrase.
3. Supprime impitoyablement toute tournure de phrase évoquant un événement magique, extravagant, surhumain ou hors du réalisme de l'univers des chats sauvages.
Si une incohérence ou une hallucination est détectée, réajuste et modifie le paragraphe concerné pour restaurer la vérité stricte de l'historique.`
    },
    {
        id: 16,
        nom: "Vérification des actions physiques",
        temperature: 0.30, // Relecture technique du poids et du réalisme physique
        prompt: `Effectue une auto-critique technique centrée exclusivement sur les actions physiques de ton personnage.
Vérifie si les mouvements planifiés à l'Étape 6 et altérés par les dés à l'Étape 13 ont été exécutés avec un réalisme corporel irréprochable.
1. Traque et élimine toute mollesse narrative, imprécision spatiale ou omission de mouvement félin.
2. Assure-toi que la sensation de poids, d'impact, de friction avec le sol et de tension musculaire transparaît dans chaque geste décrit.
3. Vérifie que le personnage n'accomplit pas deux actions complexes simultanées qui briseraient le réalisme physique de la scène.
Corrige et dynamise la description des mouvements pour garantir un impact visuel et biologique maximum.`
    },
    {
        id: 17,
        nom: "Vérification des dialogues sauvages",
        temperature: 0.40, // Épuration des structures et polissage du ton de clan sauvage
        prompt: `Effectue une auto-critique stylistique inflexible sur la totalité des répliques de dialogue prononcées par ton personnage.
1. Relis chaque réplique à haute voix virtuellement. Est-ce que le chat parle trop comme un être humain civilisé, moderne ou courtois ? Si oui, détruis ces structures.
2. Est-ce trop bavard, théâtral, explicatif ou pompeux ? Supprime les tirades artificielles.
3. Raccourcis, épure et densifie le langage : ne garde que l'essence brute, sauvage, instinctive et percutante du dialogue de clan. Un chat sauvage utilise des phrases courtes, des métaphores liées à la nature, et ponctue ses paroles de signaux sonores (grognements, feulements).
Remplace le vocabulaire humain résiduel par des structures de communication féline sauvage.`
    },
    {
        id: 18,
        nom: "Vérification du dosage des pensées",
        temperature: 0.55, // Équilibre dramatique et mystère psychologique du flux intérieur
        prompt: `Effectue une auto-critique sur le traitement du monologue intérieur et du flux de pensées intimes de ton personnage.
1. Assure-toi avec certitude que les pensées secrètes apportent une véritable profondeur psychologique, un éclairage nouveau ou une tension dramatique à la scène.
2. Vérifie qu'elles ne se contentent pas de répéter de manière redondante ce qui est déjà parfaitement visible et explicite dans l'action physique ou dans les dialogues.
3. Ajuste leur dosage avec précision : trop de pensées alourdissent le rythme de l'action, pas assez de pensées transforment le personnage en coquille vide.
Trouve l'équilibre parfait pour préserver le mystère du personnage tout en révélant sa complexité interne.`
    },
    {
        id: 19,
        nom: "Vérification de la cohérence du caractère",
        temperature: 0.30, // Alignement strict avec l'historique et la fiche technique
        prompt: `Effectue une auto-critique psychologique comparative entre le comportement du personnage dans ton texte et les traits de caractère fondamentaux gravés dans sa fiche technique (Étape 3).
1. Vérifie qu'il n'y a aucun glissement de personnalité injustifié. Un chat peureux, soumis ou timide ne doit pas agir avec une bravoure insolente ou un ton arrogant sans un élément déclencheur externe d'une puissance extrême écrit dans l'historique.
2. Un chef de clan fier ne doit pas s'humilier ou céder du terrain sans un conflit intérieur violent et visible.
Ajuste les nuances comportementales, les réactions orgueilleuses, les hésitations ou les élans d'agressivité pour que le personnage reste fidèle à lui-même du premier au dernier mot.`
    },
    {
        id: 20,
        nom: "Vérification du respect des peurs",
        temperature: 0.20, // Modélisation stricte des stigmates et blocages traumatiques
        prompt: `Effectue une auto-critique ciblée sur la gestion des traumatismes, des phobies et des peurs viscérales inscrites dans la fiche de ton personnage.
1. Si la situation actuelle, le décor (ex: feu, eau profonde, espace clos) ou les paroles de l'interlocuteur touchent de près ou de loin à l'une des peurs intimes du personnage, le texte doit impérativement en montrer les stigmates narratifs.
2. Traque l'absence de réaction face à un déclencheur traumatique : le texte doit montrer des signes de blocage psychologique, de ralentissement de l'action, de panique interne refoulée ou de stress physique violent (pupilles figées, souffle court).
Ajuste les paragraphes pour honorer la vulnérabilité mécanique et narrative du personnage.`
    },
    {
        id: 21,
        nom: "Vérification des nuances relationnelles",
        temperature: 0.30, // Fidélité envers le passif social et émotionnel commun
        prompt: `Effectue une auto-critique centrée sur l'historique relationnel et le passif social existant entre ton personnage et son interlocuteur.
1. Le ton employé, le choix des mots, la distance physique maintenue et l'intensité des regards sont-ils parfaitement cohérents avec leur passé commun (rivalité féroce, respect fraternel, amour interdit, méfiance politique, passif de trahison) ?
2. Élimine toute familiarité excessive si les personnages se détestent, ou toute froideur artificielle s'ils partagent un lien intime et secret.
Rectifie les nuances comportementales pour que chaque interaction transpire de la vérité historique de leur relation.`
    },
    {
        id: 22,
        nom: "Vérification et application du dictionnaire félin",
        temperature: 0.10, // Élimination éliminatoire de tout geste anthropomorphe
        prompt: `Effectue une auto-critique sémantique et anatomique radicale et éliminatoire.
Tu dois traquer et éradiquer jusqu'au dernier les tics comportementaux ou expressions corporelles anthropomorphes (humaines) qui se seraient glissés dans le texte.
1. Remplace impérativement et sans aucune exception les expressions humaines résiduelles telles que 'il sourit', 'elle haussa les épaules', 'il hocha la tête', 'elle croisa les bras', 'il soupira', 'elle fronça les sourcils' par leurs équivalents anatomiques 100% félins et sauvages.
2. Injecte à la place des expressions corporelles réalistes de félins : mouvements millimétriques des oreilles (rabattues, orientées vers l'arrière, frémissantes), frémissement des moustaches (vibrisses tendues en avant ou plaquées contre les joues), battements, ondulations ou saccades de la queue, allomarquage, retroussement des babines, dévoilement des crocs, plissement des yeux, ou léchage nerveux d'une épaule.
Le texte final doit être purgé de toute humanité gestuelle pour devenir purement animal.`
    },
    {
        id: 23,
        nom: "Génération finale du texte structuré et balisé",
        temperature: 0.95, // Rédaction ultime : créativité maximale, formatage rigide et style haut de gamme
        prompt: `Rédige maintenant le post de RP final complet, parfait, magnifié et définitif au présent de l'indicatif en combinant et en appliquant l'ensemble des analyses, rédactions et auto-critiques validées au cours du pipeline.
Tu dois respecter une continuité géométrique, temporelle et narrative parfaite avec la fin de l'historique global et l'action immédiate.

⚠️ DIRECTIVE GÉOMÉTRIQUE ET SYNTAXIQUE STRICTE (RÈGLE ÉLIMINATOIRE DE PRODUCTION) :
1. Chaque paragraphe ou ligne qui contient un dialogue, une parole dite, un feulement articulé ou une réplique prononcée à haute voix DOIT IMPÉRATIVEMENT commencer dès le tout premier caractère de la ligne par le chevron '> ' suivi d'un espace et d'un tiret cadratin '— ' et se terminer de manière classique.
Exemple strict à appliquer : > — Bonjour, murmura-t-elle en inclinant ses oreilles vers l'avant.
2. Ne mets ABSOLUMENT AUCUN astérisque (* ou **) autour des actions ou des descriptions dans ce post final. Écris les actions, descriptions du décor et expressions passives sous la forme de paragraphes textuels normaux, standards, sans aucun chevron de début de ligne.
3. Il est formellement et strictement interdit d'inclure une introduction, une conclusion, des salutations, des notes techniques, des titres d'étapes, des excuses ou des commentaires hors-RP. 
Renvoie UNIQUEMENT et exclusivement le récit textuel pur, balisé et formaté selon ces deux règles géométriques. Rien d'autre.`
    }
];

        const moodDictionary = {
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

        if (!outputDiv || !currentActiveRpId) return;

        outputDiv.innerHTML = `
            <div style="padding:15px; text-align:center;">
                <span class='blink' style='color:#ffcc00; font-weight:bold;'>🗄️ Extraction de l'historique global...</span>
            </div>
        `;

        try {
            // ─── GÉNÉRATION DU HORODATAGE DE L'APPEL ───
            const maintenant = new Date();
            const dateAppelFormatee = maintenant.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const heureAppelFormatee = maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const labelSession = `Appel du ${dateAppelFormatee} à ${heureAppelFormatee}`;

            // ─── LECTURE ET ADAPTATION DE L'HISTORIQUE DEPUIS FIREBASE ───
            let toutLhistorique = "";
            let historiqueLogsIA = "Aucun historique d'IA enregistré pour ce RP.\n";

            if (typeof db !== "undefined" && currentActiveRpId) {
                // A. Messages du RP
                const messagesRef = collection(db, "rps_pending", currentActiveRpId, "messages");
                const qMessages = query(messagesRef, orderBy("date", "asc"));
                const messagesSnapshot = await getDocs(qMessages);

                if (!messagesSnapshot.empty) {
                    messagesSnapshot.forEach(docMsg => {
                        const msgData = docMsg.data();
                        const auteur = msgData.auteur || msgData.author || "Auteur Inconnu";
                        const texte = msgData.texte || msgData.text || "";
                        toutLhistorique += `[${auteur}] : ${texte}\n\n`;
                    });
                } else {
                    toutLhistorique = "Aucun message trouvé dans l'historique de ce RP.\n";
                }

                // B. Lecture adaptée et récursive de l'historique IA
                const aiHistoryRef = collection(db, "rps_pending", currentActiveRpId, "ai_history");
                const qAi = query(aiHistoryRef, orderBy("timestampRef", "desc"), limit(3));
                const aiSnapshot = await getDocs(qAi);

                if (!aiSnapshot.empty) {
                    historiqueLogsIA = "";
                    for (const docAi of aiSnapshot.docs) {
                        const aiData = docAi.data();
                        historiqueLogsIA += `--- ${aiData.labelSession || "ESSAI ANCIEN"} ---\n`;
                        historiqueLogsIA += `Prompt Joueur : ${aiData.promptEntreeJoueur || "Aucun"}\n`;
                        
                        try {
                            const subEtapesRef = collection(db, "rps_pending", currentActiveRpId, "ai_history", docAi.id, "etapes_run");
                            const subEtapesSnapshot = await getDocs(query(subEtapesRef, orderBy("etapeId", "asc")));
                            if (!subEtapesSnapshot.empty) {
                                historiqueLogsIA += `[Raisonnement de cet appel] :\n`;
                                subEtapesSnapshot.forEach(subDoc => {
                                    const subData = subDoc.data();
                                    historiqueLogsIA += `  -> Étape ${subData.etapeId} (${subData.etapeNom}) : ${subData.resultat.substring(0, 120)}...\n`;
                                });
                            }
                        } catch (subErr) {
                            console.warn("Erreur lecture sous-étapes passées :", subErr);
                        }
                        historiqueLogsIA += `Réponse finale : ${aiData.reponseBruteIA || "Aucune"}\n\n`;
                    }
                }
            }

            // Capture des données et paramètres globaux du DOM
            const dernierPromptJoueur = textInput ? textInput.value.trim() : "";
            const aiInstructionsElement = document.getElementById("coWriteAiInstructions");
            const instructions = aiInstructionsElement ? aiInstructionsElement.value.trim() : "";
            const charData = charactersDB[window.currentActiveCharName] || { complete: "Fiche indisponible." };
            const dictionnaireFelinBrut = JSON.stringify(catBehaviorKnowledge, null, 2);

            // Capture dynamique des Moods
            let moodInstruction = "";
            const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
            activeMoodBtns.forEach(btn => {
                const moodKey = btn.getAttribute("data-mood");
                if (moodDictionary[moodKey]) {
                    moodInstruction += moodDictionary[moodKey];
                }
            });
            if (!moodInstruction) moodInstruction = "Aucun mood spécifique sélectionné (Ton standard).\n";

            // Capture des Dés JDR
            let contrainteDeDesPrompt = "";
            if (window.getActionsSelectionneesPourIA && Array.isArray(window.getActionsSelectionneesPourIA) && window.getActionsSelectionneesPourIA.length > 0) {
                window.getActionsSelectionneesPourIA.forEach(action => {
                    let verdictTexte = action.verdict && typeof action.verdict === "object" ? action.verdict.texte : action.verdict;
                    contrainteDeDesPrompt += `- Action tentée : ${action.nom}\n   ↳ Dé : D50 [Jet : ${action.valeurDe}] |\n   Score Total : ${action.total || action.scoreTotal}\n   ↳ VERDICT IMPÉRATIF : ${verdictTexte || "Résultat Standard"}\n\n`;
                });
            } else {
                contrainteDeDesPrompt = "Aucun dé JDR n'impacte ce tour. L'action est libre.\n";
            }

            // ─── CRÉATION DE LA RÉFÉRENCE DE DOCUMENT POUR CET APPEL PRÉCIS ───
            let currentAiHistoryRef = null;
            if (typeof db !== "undefined" && currentActiveRpId) {
                const idUniqueSession = `Session_${maintenant.toISOString().replace(/[:.]/g, "-")}`;
                currentAiHistoryRef = doc(db, "rps_pending", currentActiveRpId, "ai_history", idUniqueSession);
            }

            // ─── INITIALISATION SÉCURISÉE DU WEB WORKER ───
            const workerCode = `(${workerPipelineLogic.toString()})();`;
            const blob = new Blob([workerCode], { type: "application/javascript" });
            const workerUrl = URL.createObjectURL(blob);
            const pipelineWorker = new Worker(workerUrl);

            pipelineWorker.postMessage({
                historique: toutLhistorique,
                historiqueLogsIA: historiqueLogsIA,
                currentActiveCharName: window.currentActiveCharName,
                instructions: instructions,
                dernierPromptJoueur: dernierPromptJoueur,
                charDataComplete: charData.complete,
                contrainteDeDesPrompt: contrainteDeDesPrompt,
                moodInstruction: moodInstruction,
                dictionnaireFelinBrut: dictionnaireFelinBrut,
                pipelineEtapes: pipelineEtapes,
                apiKey: MISTRAL_API_KEY,
                apiUrl: MISTRAL_URL,
                apiModel: MISTRAL_MODEL

            });

            let memoireCollectiveFinale = "";

            // ─── ÉCOUTE DES COMMUNICATIONS DU WORKER ───
            pipelineWorker.onmessage = async (e) => {
                const { type, etapeId, etapeNom, totalEtapes, progress, text, memoireEtape, memoireCumulative, err } = e.data;

                if (type === "PROGRESS") {
                    outputDiv.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:12px; padding:15px; background:rgba(167, 119, 227, 0.05); border:1px solid rgba(167, 119, 227, 0.2); border-radius:8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class='blink' style='color:#a777e3; font-weight:bold; font-size:1.1em;'>🔮 Pensée du Clan en cours...</span>
                                <span style='color:#888; font-size:0.9em;'>Étape ${etapeId} / ${totalEtapes}</span>
                            </div>
                            <div style="color:#f0f0f0; font-size:0.95em; background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; border-left:3px solid #a777e3;">
                                Action actuelle : <strong>${etapeNom}</strong>
                            </div>
                            <div style="width:100%; background:#222; height:8px; border-radius:4px; overflow:hidden; border:1px solid #333;">
                                <div style="width:${progress}%; background:linear-gradient(90deg, #a777e3, #e74c3c); height:100%; transition: width 0.4s ease;"></div>
                            </div>
                            <small style="color:#666; text-align:center; font-style:italic;">Vous pouvez changer d'onglet, le traitement est géré par un Worker isolé à 100%.</small>
                        </div>
                    `;
                }
                else if (type === "STEP_DONE") {
                    console.log(`📥 [Firebase Sync] Étape ${etapeId} finalisée. Archivage dans la session...`);
                    try {
    if (currentAiHistoryRef) {
        // 🔄 MODIFICATION : On formate l'id sur 2 chiffres (ex: 1 devient "01", 10 reste "10")
        const etapeIdFormate = String(etapeId).padStart(2, '0');
        
        const etapeDocRef = doc(
            collection(db, "rps_pending", currentActiveRpId, "ai_history", currentAiHistoryRef.id, "etapes_run"), 
            `etape_${etapeIdFormate}` // <-- Utilise la version formatée ici pour le nom du doc
        );
        
        await setDoc(etapeDocRef, {
            etapeId: etapeId, // On garde le chiffre brut à l'intérieur pour tes statistiques ou tris numériques
            etapeNom: etapeNom,
            date: new Date().toISOString(),
            resultat: memoireEtape
        });
    }
} catch (fsErr) {
                        console.error(`⚠️ Impossible d'enregistrer l'étape ${etapeId} :`, fsErr);
                    }
                }
                else if (type === "SUCCESS") {
                    let texteBalisé = text;
                    memoireCollectiveFinale = memoireCumulative;

                    if (typeof nettoyerSyntaxeDialogue === "function") {
                        texteBalisé = await nettoyerSyntaxeDialogue(texteBalisé);
                    }

                    const parseurMarkdown = window.parseRP || parseRP;
                    if (typeof parseurMarkdown === "function") {
                        outputDiv.innerHTML = parseurMarkdown(texteBalisé);
                    } else {
                        outputDiv.innerHTML = `<div style="white-space: pre-wrap; color:#f0f0f0;">${texteBalisé}</div>`;
                    }

                    try {
                        if (currentAiHistoryRef) {
                            await setDoc(currentAiHistoryRef, {
                                timestampRef: maintenant.getTime(),
                                labelSession: labelSession,
                                date: maintenant.toISOString(),
                                promptEntreeJoueur: dernierPromptJoueur,
                                consignesAide: instructions,
                                memoireCompletePipeline: memoireCollectiveFinale,
                                reponseBruteIA: text,
                                reponseNettoyeelARobot: texteBalisé
                            });
                            console.log("💾 [Firebase] Session d'appel close et archivée ! ID :", currentAiHistoryRef.id);
                        }
                    } catch (firebaseErr) {
                        console.error("⚠️ Échec de l'archivage de la session dans ai_history :", firebaseErr);
                    }

                    pipelineWorker.terminate();
                    URL.revokeObjectURL(workerUrl);
                    console.log("🚀 [Worker] Libération de la mémoire système effectuée.");
                }
                else if (type === "ERROR") {
                    outputDiv.innerHTML = `
                        <div style="padding:15px; border:1px solid #e74c3c; background:rgba(231, 76, 60, 0.1); border-radius:8px; color:#e74c3c;">
                            <strong>❌ Le pipeline a échoué :</strong><br><small>${err}</small>
                        </div>
                    `;
                    pipelineWorker.terminate();
                    URL.revokeObjectURL(workerUrl);
                }
            };

            console.log("✨ Moteur de Worker paré et synchronisé.");
        } catch (err) {
            console.error("Erreur dans le déroulement du pipeline :", err);
            outputDiv.innerHTML = `<span style='color:#e74c3c;'>❌ Erreur critique lors de l'exécution : ${err.message}</span>`;
        }
    });
}
    // ============================================================================
    // GESTION DE LA MODALE EXCLUSIVE DE TRAUMATISMES (VERSION FINALE CORRIGÉE)
    // ============================================================================
    document.addEventListener("click", async function(e) {
        // Détection du clic sur le bouton d'analyse dans la sidebar
        const btnDiagnostic = e.target.closest("#btnDiagnosticTraumaSidebar");
        
        if (btnDiagnostic) {
            e.preventDefault();
            
            // Étape A : Trouver la modale exclusive
            const traumaModal = document.getElementById("traumaExclusiveModal");
            if (!traumaModal) {
                console.error("La modale #traumaExclusiveModal est introuvable dans la page HTML !");
                return;
            }

            // Étape B : Forcer l'affichage avec flex
            traumaModal.style.setProperty("display", "flex", "important");
            
            // Préparer les zones de chargement
            const traumaLoading = document.getElementById("traumaModalLoading");
            const traumaResultBody = document.getElementById("traumaModalContent");

            if (traumaLoading) {
                traumaLoading.style.display = "block"; // Corrigé ici (plus de .style.style !)
                traumaLoading.innerText = "⚡ Le Clan des Étoiles analyse les blessures...";
            }
            if (traumaResultBody) {
                traumaResultBody.style.display = "none";
            }

            // Étape C : Récupérer le nom du personnage actif
            const charName = window.currentActiveCharName || "ton personnage";

            try {
                // Lancer l'analyse de l'IA (TraumaAnalyzer.js)
                const bilan = await analyserImpactPhysiqueEtMental(charName);

                if (traumaLoading) traumaLoading.style.display = "none";

                if (bilan) {
                    const statusEl = document.getElementById("traumaModalStatus");
                    const physicalEl = document.getElementById("physicalWoundsList");
                    const mentalEl = document.getElementById("mentalTraumaList");
                    const guerisseurEl = document.getElementById("guerisseurText");

                    if (statusEl) statusEl.innerText = `Bilan actuel pour : ${charName} (${bilan.statutGeneral})`;
                    if (physicalEl) physicalEl.innerHTML = bilan.blessuresPhysiques.map(w => `<li>${w}</li>`).join("");
                    if (mentalEl) mentalEl.innerHTML = bilan.traumatismesMentaux.map(t => `<li>${t}</li>`).join("");
                    if (guerisseurEl) guerisseurEl.innerText = bilan.conseilGuerisseur;
                    
                    if (traumaResultBody) traumaResultBody.style.display = "block";
                } else {
                    if (traumaLoading) {
                        traumaLoading.style.display = "block";
                        traumaLoading.innerText = "❌ L'historique du RP semble vide ou indisponible pour ce personnage.";
                    }
                }
            } catch (err) {
                console.error("Erreur IA Trauma :", err);
                if (traumaLoading) {
                    traumaLoading.style.display = "block";
                    traumaLoading.innerText = "❌ Erreur technique lors de l'analyse.";
                }
            }
        }
    });

    // Gestion de la fermeture en cliquant à côté ou sur le bouton fermer
    document.addEventListener("click", function(e) {
        const traumaModal = document.getElementById("traumaExclusiveModal");
        if (!traumaModal) return;

        // Si clic sur la croix ou en dehors du cadre
        if (e.target.closest("#btnCloseTraumaExclusive") || e.target === traumaModal) {
            traumaModal.style.setProperty("display", "none", "important");
        }
    });

    // Gestion de la fermeture en cliquant à côté ou sur le bouton fermer
    document.addEventListener("click", function(e) {
        const traumaModal = document.getElementById("traumaExclusiveModal");
        if (!traumaModal) return;

        // Si clic sur la croix ou en dehors du cadre
        if (e.target.closest("#btnCloseTraumaExclusive") || e.target === traumaModal) {
            traumaModal.style.setProperty("display", "none", "important");
        }
    });

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
// 🎬 FONCTION DE RÉSUMÉ DE SCÈNE TACTIQUE
window.relireLaScene = async function() {
    const outputDiv = document.getElementById("coWriteAiOutput");
    const rpId = window.currentActiveRpId; // On récupère le RP en cours

    if (!rpId) {
        alert("❌ Aucun RP actif sélectionné pour analyser la scène !");
        return;
    }

    if (outputDiv) {
        outputDiv.innerHTML = "⏳ L'IA examine les dernières répliques pour reconstituer la scène...";
    }

    try {
        // 1. Récupérer les derniers messages de la sous-collection (on limite à 5 pour le résumé serré)
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "desc"), limit(50));
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

        const promptSysteme = `Tu es un assistant de jeu de rôle textuel expert. Ta tâche est de faire un résumé court, percutant et ultra-précis de la scène en cours basé sur les dernières répliques fournies.
        Tu dois obligatoirement lister de façon claire :
        - Les personnages présents (qui est là ?).
        - Ce qu'ils font ou l'action cruciale qui vient de se passer.
        - Les informations obtenus sur les diffèrent personnages et les plans engagés (exactions, opération coup de poing, ect...).
        - Le placemnt des personnage vis à vis de la situation et des politiques menées par les cheffes.
        - L'état psychologique ou l'ambiance immédiate (tension, peur, calme, secret).
        Sois concis (maximum 45 phrases), va droit au but, pas de formules de politesse ni d'introduction.`;

        // 4. 🎯 APPEL DIRECT À L'API MISTRAL (Plus de ReferenceError !)
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${MISTRAL_API_KEY}` 
            },
            body: JSON.stringify({ 
                model: "mistral-large-latest", 
                messages: [
                    { role: "system", content: promptSysteme },
                    { role: "user", content: contexteBrut }
                ],
                temperature: 0.5 // Un peu plus bas pour être très factuel sur le résumé
            })
        });

        if (!response.ok) throw new Error(`Code erreur API Mistral : ${response.status}`);
        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const resumeIa = data.choices[0].message.content;

            // 5. Affichage du résultat stylisé dans ton interface
            if (outputDiv) {
                let reponsePropre = await parseRP(resumeIa)
                outputDiv.innerHTML = `
                    <div style="background: rgba(167, 119, 227, 0.1); border-left: 3px solid #a777e3; padding: 12px; margin-top: 10px; border-radius: 4px; color: #e0e0e0; font-size: 0.9rem; line-height: 1.5;">
                        <strong style="color: #a777e3; display: block; margin-bottom: 6px;">🎬 Brief de situation (Relecture) :</strong>
                        <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                        <button id="btnCopierResume" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                        ${reponsePropre}
                    </div>

                    <div id="coWriteExclusiveModal" style="display: none; position: fixed; z-index: 100000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(5, 5, 8, 0.95); backdrop-filter: blur(8px); justify-content: center; align-items: center;">
        <div style="background: #121218; border: 1px solid #a777e3; box-shadow: 0 0 30px rgba(167, 119, 227, 0.2); width: calc(100vw - 400px); max-width: 1500px; height: 80vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; position: relative;">
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(167, 119, 227, 0.3); display: flex; justify-content: space-between; align-items: center; background: #161622;">
                <h3 style="margin: 0; color: #ffcc00; font-family: 'Segoe UI', sans-serif;">📖 Visionnage Résumé</h3>
                <button id="btnCloseExclusive" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
                
                </div>
            <div class="co-write-display" style="flex: 1; padding: 25px; overflow-y: auto; color: #f0f0f0; font-family: Georgia, serif; font-size: 1.4rem !important; line-height: 1.6; background: #0c0c10;">
                ${reponsePropre}
            </div>
        </div>
    </div>
                `;

                    document.getElementById("btnVoirCoWrite").addEventListener("click", function() {
                        const exclusiveModal = document.getElementById("coWriteExclusiveModal");
                        if (exclusiveModal) exclusiveModal.style.display = "flex";
                    });

                     document.getElementById("btnCloseExclusive").addEventListener("click", function() {
                        const exclusiveModal = document.getElementById("coWriteExclusiveModal");
                        if (exclusiveModal) exclusiveModal.style.display = "none";
                    });

                    document.getElementById("btnCopierResume").addEventListener("click", function() {
                        navigator.clipboard.writeText(resumeIa);
                        this.innerText = "✓ Copié !";
                    });

            }
        } else {
            throw new Error("Réponse Mistral vide ou mal formatée");
        }

    } catch (err) {
        console.error("Erreur lors de la relecture de la scène :", err);
        if (outputDiv) outputDiv.innerHTML = "❌ Erreur lors de la génération du résumé de scène.";
    }
};

// ============================================================================
// PATCH DE SECOURS ISOLÉ POUR LA MODALE DE TRAUMATISMES (CORRECTION TECHNIQUE DES ESPACES)
// ============================================================================
(function() {
    document.addEventListener("click", async function(e) {
        const btn = e.target.closest("#btnDiagnosticTraumaSidebar");
        if (!btn) return; 
        
        e.preventDefault();

        // Constantes d'affichage par ID
        const modal = document.getElementById("traumaExclusiveModal");
        const loading = document.getElementById("traumaModalLoading");
        const content = document.getElementById("traumaModalContent");
        
        const statusEl = document.getElementById("traumaModalStatus");
        const physicalEl = document.getElementById("physicalWoundsList");
        const mentalEl = document.getElementById("mentalTraumaList");
        const guerisseurEl = document.getElementById("guerisseurText");

        if (!modal) return;

        // Ouvrir la modale
        modal.style.setProperty("display", "flex", "important");

        if (loading) {
            loading.style.setProperty("display", "block", "important");
            loading.innerText = "⚡ Le Clan des Étoiles consulte les souvenirs de la scène...";
        }
        if (content) content.style.setProperty("display", "none", "important");

        const charName = window.currentActiveCharName || "ton personnage";

        try {
            if (typeof analyserImpactPhysiqueEtMental === "function") {
                const bilan = await analyserImpactPhysiqueEtMental(charName);
                
                if (loading) loading.style.setProperty("display", "none", "important");

                if (bilan) {
                    // 1. Statut Général
                    if (statusEl) statusEl.innerText = `⚡ Bilan actuel pour : ${charName} (${bilan.statutGeneral || 'État stable'})`;
                    
                    // --- RECONSTRUCTION DES FONCTIONS DE RENDU ---
                    function genererStructureHtml(donnee) {
                        if (typeof donnee === "string" || typeof donnee === "number") {
                            return `<p style="margin: 4px 0; line-height: 1.6; color: #e0e0e0; font-size: 1.1rem;">${donnee}</p>`;
                        }
                        if (Array.isArray(donnee)) {
                            return `<ul style="margin: 6px 0; padding-left: 20px; list-style-type: '🌿 '; line-height: 1.6; color: #e0e0e0;">` +
                                donnee.map(item => `<li style="margin-bottom: 6px;">${genererStructureHtml(item)}</li>`).join("") +
                            `</ul>`;
                        }
                        if (typeof donnee === "object" && donnee !== null) {
                            let sousBloc = `<div style="display: flex; flex-direction: column; gap: 8px; padding-left: 10px; margin-top: 5px;">`;
                            for (const [cle, valeur] of Object.entries(donnee)) {
                                const cleAvecEspaces = cle.replace(/_/g, ' ');
                                const titreCle = cleAvecEspaces.charAt(0).toUpperCase() + cleAvecEspaces.slice(1);
                                
                                if (typeof valeur === "object" && valeur !== null) {
                                    sousBloc += `<div style="margin-top: 10px; border-left: 2px dashed rgba(255, 204, 0, 0.3); padding-left: 15px;">
                                        <strong style="color: #ffcc00; font-size: 1.1rem;">🐾 ${titreCle}</strong>
                                        ${genererStructureHtml(valeur)}
                                    </div>`;
                                } else {
                                    sousBloc += `<p style="margin: 3px 0; line-height: 1.5; color: #e0e0e0;">
                                        <strong style="color: #ffcc00;">✨ ${titreCle} :</strong> ${valeur}
                                    </p>`;
                                }
                            }
                            sousBloc += `</div>`;
                            return sousBloc;
                        }
                        return "";
                    }

                    // 2. Rendu des Blessures Physiques (Protégé contre les objets)
                    if (physicalEl) {
                        physicalEl.innerHTML = (bilan.blessuresPhysiques)
                            ? genererStructureHtml(bilan.blessuresPhysiques)
                            : `<p style="color:#aaa;">Aucune blessure physique apparente détectée.</p>`;
                    }
                    
                    // 3. Rendu des Séquelles Mentales (Protégé contre les objets)
                    if (mentalEl) {
                        mentalEl.innerHTML = (bilan.traumatismesMentaux)
                            ? genererStructureHtml(bilan.traumatismesMentaux)
                            : `<p style="color:#aaa;">Esprit serein. Aucun traumatisme psychologique à signaler.</p>`;
                    }
                    
                    // 4. RENDU VISUEL AVANCÉ DU CONSEIL GUÉRISSEUR
                    if (guerisseurEl) {
                        let htmlResultat = "";

                        if (typeof bilan.conseilGuerisseur === "object" && bilan.conseilGuerisseur !== null && !Array.isArray(bilan.conseilGuerisseur)) {
                            htmlResultat = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 10px;">`;
                            for (const [section, contenu] of Object.entries(bilan.conseilGuerisseur)) {
                                const sectionAvecEspaces = section.replace(/_/g, ' ');
                                const titreSection = sectionAvecEspaces.toUpperCase();
                                htmlResultat += `
                                    <div style="background: rgba(255, 204, 0, 0.03); border: 1px solid rgba(255, 204, 0, 0.15); border-radius: 6px; padding: 15px; box-shadow: inset 0 0 10px rgba(0,0,0,0.3);">
                                        <h4 style="margin: 0 0 10px 0; color: #ffcc00; font-size: 1.1rem; border-bottom: 1px dashed rgba(255,204,0,0.2); padding-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                                            🌿 ${titreSection}
                                        </h4>
                                        ${genererStructureHtml(contenu)}
                                    </div>`;
                            }
                            htmlResultat += `</div>`;
                        } else {
                            htmlResultat = genererStructureHtml(bilan.conseilGuerisseur);
                        }

                        // Nettoyage final anti-[object Object] au cas où
                        if (htmlResultat.includes("[object Object]")) htmlResultat = htmlResultat.replace(/\[object Object\]/g, "");
                        
                        guerisseurEl.innerHTML = htmlResultat;
                    }

                    // Forcer l'affichage global
                    if (content) content.style.setProperty("display", "block", "important");

                } else {
                    if (loading) {
                        loading.style.setProperty("display", "block", "important");
                        loading.innerText = "❌ Le Clan des Étoiles n'a pas pu structurer son message. Réessaye l'analyse.";
                    }
                }
            } else {
                if (loading) {
                    loading.style.setProperty("display", "block", "important");
                    loading.innerText = "❌ Erreur : La fonction d'analyse est indisponible.";
                }
            }
        } catch (err) {
            console.error("Erreur durant l'analyse :", err);
            if (loading) {
                loading.style.setProperty("display", "block", "important");
                loading.innerText = "❌ Une erreur technique est survenue.";
            }
        }
    });

    // Gestion de la fermeture isolée
    document.addEventListener("click", function(e) {
        const modal = document.getElementById("traumaExclusiveModal");
        if (!modal) return;

        if (e.target.closest("#btnCloseTraumaExclusive") || e.target === modal) {
            modal.style.setProperty("display", "none", "important");
        }
    });
})();

// ============================================================================
// LOGIQUE COMPLÈTE DU WORKER DU CLAN DES ÉTOILES (MULTI-THREAD ARRIÈRE-PLAN)
// ============================================================================
function workerPipelineLogic() {
    self.onmessage = async function (e) {
        const { 
            historique, historiqueLogsIA, currentActiveCharName, instructions, 
            dernierPromptJoueur, charDataComplete, contrainteDeDesPrompt, 
            moodInstruction, dictionnaireFelinBrut, pipelineEtapes, apiKey, apiUrl 
        } = e.data;

        // On rebâtit proprement la mémoire collective à l'intérieur du thread isolé
        let memoirePipeline = `
[CONTEXTE DE LA SESSION ACTUELLE]
- Personnage joué : ${currentActiveCharName || "Inconnu"}
- Consignes spécifiques : ${instructions}
- TON PROMPT D'ENTRÉE ACTUEL (À APPLIQUER) : ${dernierPromptJoueur}

===========================================================================
📚 HISTORIQUE DES ESSAIS IA PRÉCÉDENTS (SOUS-COLLECTION ai_history)
===========================================================================
${historiqueLogsIA}

===========================================================================
📖 HISTORIQUE DES MESSAGES DU RP (SOUS-COLLECTION messages)
===========================================================================
${historique}

===========================================================================
FICHE TECHNIQUE ET CONTRAINTES (Perso, Dés, Comportements)
===========================================================================
- Fiche Perso : ${charDataComplete}
- Dés JDR : ${contrainteDeDesPrompt}
- Configuration Psychologique (Moods) : ${moodInstruction}
- Comportements Félins : ${dictionnaireFelinBrut}
`;

        try {
            for (const etape of pipelineEtapes) {
                // 📢 1. On avertit le site que l'étape commence (pour la barre de progression)
                self.postMessage({
                    type: "PROGRESS",
                    etapeId: etape.id,
                    etapeNom: etape.nom,
                    totalEtapes: pipelineEtapes.length,
                    progress: (etape.id / pipelineEtapes.length) * 100
                });

                const promptEtape = `
Tu es un moteur d'écriture de JDR textuel haut de gamme.
Tu opères à l'étape suivante du pipeline de réflexion :
[ÉTAPE ACTUELLE] : Étape ${etape.id} - ${etape.nom}

[CONSIGNE IMPÉRATIVE POUR CETTE ÉTAPE] :
${etape.prompt}

Voici toute la mémoire accumulée jusqu'ici :
===========================================================================
${memoirePipeline}
===========================================================================
Génère ton analyse ou ta production pour cette étape. Reste concis, précis et factuel.
`;

                let reponseMistralOk = false;
                let tentative = 0;
                const maxTentatives = 5;
                let resultatEtape = "";

                while (!reponseMistralOk && tentative < maxTentatives) {
                    try {
                        tentative++;
                        const response = await fetch(apiUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: "mistral-large-latest",
                                messages: [
                                    { role: "system", content: "Tu es un assistant de co-écriture strict. Tu gères le jeu au présent de l'indicatif sans jamais extrapoler de faits passés." },
                                    { role: "user", content: promptEtape }
                                ],
                                temperature: etape.id === pipelineEtapes.length ? 0.99 : 0.05
                            })
                        });

                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                        const data = await response.json();
                        resultatEtape = data.choices[0].message.content.trim();
                        reponseMistralOk = true;

                    } catch (fetchErr) {
                        if (tentative >= maxTentatives) {
                            throw new Error(`Échec de connexion API à l'étape ${etape.id} (${etape.nom}) : ${fetchErr.message}`);
                        }
                        await new Promise(res => setTimeout(res, 4000));
                    }
                }

                // On ajoute le résultat de cette étape à la mémoire interne du Worker
                memoirePipeline += `\n\n[RÉSULTAT ÉTAPE ${etape.id} - ${etape.nom}]\n${resultatEtape}\n`;

                // 📢 2. On envoie le résultat brut au script principal pour qu'il l'ajoute direct dans Firebase 'etapes_run'
                self.postMessage({
                    type: "STEP_DONE",
                    etapeId: etape.id,
                    etapeNom: etape.nom,
                    memoireEtape: resultatEtape
                });

                // 📢 3. Si c'est l'étape 23, on clôture tout et on transmet le bloc final rédigé
                if (etape.id === pipelineEtapes.length) {
                    self.postMessage({
                        type: "SUCCESS",
                        text: resultatEtape,
                        memoireCumulative: memoirePipeline
                    });
                }
            }
        } catch (globalErr) {
            self.postMessage({ type: "ERROR", err: globalErr.message });
        }
    };
}