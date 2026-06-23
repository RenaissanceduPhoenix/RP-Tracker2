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

    // Déclenchement de l'analyse isolée dans le nouveau module !
    analyserSituationEtAppliquerMoods(charName);

// Tout en bas de la fonction openCoWriteModal, juste avant l'accolade de fermeture :
// 🎲 Étape 1 : Nettoyage et initialisation de base synchrone
// 🎲 Étape 1 : Initialisation synchrone
    if (typeof preparerEtInitialiserZoneDes === "function") {
        preparerEtInitialiserZoneDes();
    }

    // 🔥 Étape 2 : Construction de la répartition 7 truqués / 7 normaux
    const diceContainer = document.getElementById("diceActionsList");
    if (diceContainer && typeof dictionnaireActionsErER === "object") {
        // On vide d'abord complètement le conteneur pour éviter les doublons
        diceContainer.innerHTML = "";
        
        window.getActionsSelectionneesPourIA = [];

        const activeRpId = window.currentActiveRpId || rpId;
        const activeCharName = window.currentActiveCharName || charName;
        const listeIdActions = Object.keys(dictionnaireActionsErER);

        console.log("--------------------------------------------------");
        console.log("🚀 [DÉBUT SYNCHRO] Personnage :", activeCharName, " | RP ID :", activeRpId);

        // 🎯 1. Préparation des 6 premiers dés imposés
        let paquetDeDes = [
            1, 1,   // 2 Échecs Critiques (Classe 1)
            12, 12, // 2 Réussites Classiques (Classe 3)
            30, 30  // 2 Réussites Critiques (Classe 4)
        ];

        // 🎯 2. Ajout du 7ème dé mystère choisi au hasard parmi les trois classes (1, 12 ou 30)
        const choixPossibles = [1, 12, 30];
        const deMystere = choixPossibles[Math.floor(Math.random() * choixPossibles.length)];
        paquetDeDes.push(deMystere);
        console.log("🎲 [Config] Dé mystère sélectionné pour le paquet :", deMystere);

        // 🎯 3. Les 7 autres actions restent totalement normales (on met null)
        while (paquetDeDes.length < 14) {
            paquetDeDes.push(null);
        }

        // 🔄 4. Mélange du paquet (Fisher-Yates)
        for (let i = paquetDeDes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [paquetDeDes[i], paquetDeDes[j]] = [paquetDeDes[j], paquetDeDes[i]];
        }

        console.log("📦 [Config] Paquet de dés mélangé et prêt à être distribué :", paquetDeDes);
        console.log("--------------------------------------------------");

        try {
            // --- ⚙️ VARIABLE GLOBALE VITALE POUR L'AFFICHAGE ---
            window.resultatsPreCalcules = window.resultatsPreCalcules || {};

            // ====================================================================
            // ⚔️ ÉTAPE A.1 : CALCUL ET FIREBASE DES ACTIONS PHYSIQUES
            // ====================================================================
            for (let index = 0; index < listeIdActions.length; index++) {
                const idAction = listeIdActions[index];
                const action = dictionnaireActionsErER[idAction];
                const deForce = paquetDeDes[index];
                
                let res = null;
                if (typeof executerLancerDesErER === "function") {
                    res = executerLancerDesErER(activeCharName, idAction, deForce);
                    window.resultatsPreCalcules[idAction] = res; // On stocke pour l'affichage live
                }

                if (activeRpId && res) {
                    const actionDocRef = doc(db, "rps_pending", activeRpId, "des", idAction);
                    await setDoc(actionDocRef, {
                        actionId: idAction, nom: action.nom, actif: false,
                        total: Number(res.total) || 0, lancerDe: Number(res.lancerDe) || 0, sa: Number(res.sa) || 0,
                        verdictTexte: res.verdict ? res.verdict.texte : "Inconnu",
                        verdictCouleur: res.verdict ? res.verdict.couleur : "#aaa",
                        verdictDescription: res.verdict ? res.verdict.description : "",
                        timestamp: new Date()
                    }, { merge: true });
                }
            }

            // ====================================================================
            // 🎭 ÉTAPE A.2 : CALCUL ET FIREBASE DES ACTIONS SOCIALES
            // ====================================================================
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
                    await setDoc(actionDocRef, {
                        actionId: idAction, 
                        nom: action.nom,
                        actif: false,
                        total: Number(res.total) || 0, 
                        lancerDe: Number(res.de) || 0, 
                        sa: Number(res.bonus) || 0,    
                        verdictTexte: res.verdict ? res.verdict.texte : "Inconnu",
                        verdictCouleur: res.verdict ? res.verdict.couleur : "#aaa",
                        verdictDescription: res.verdict ? res.verdict.description : "",
                        timestamp: new Date(),
                        estSocial: true
                    }, { merge: true });
                }
            }

            // ====================================================================
            // 🎨 ÉTAPE B : CRÉATION DES BOUTONS GRAPHIQUES (UI)
            // ====================================================================
            
            // Fonction utilitaire pour générer un bouton graphique
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
                        divAction.style.background = `rgba(${couleurTheme}, 0.15)`; // ✅ Corrigé : couleurTheme
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

            // ✅ NETTOYAGE DU LOADER AVANT INJECTION DES BOUTONS
            diceContainer.innerHTML = "";

            // 1. Injection des boutons Physiques (Jaune)
            const titrePhysique = document.createElement("div");
            titrePhysique.innerHTML = `<strong style="color:#ffcc00; font-size:0.85rem; margin-top:5px; display:block;">⚔️ Actions Physiques :</strong>`;
            diceContainer.appendChild(titrePhysique);
            listeIdActions.forEach(id => {
                if (dictionnaireActionsErER[id]) {
                    diceContainer.appendChild(creerBoutonAction(id, dictionnaireActionsErER[id], "255, 204, 0"));
                }
            });

            // 2. Injection des boutons Sociaux (Violet)
            const titreSocial = document.createElement("div");
            titreSocial.innerHTML = `<strong style="color:#a777e3; font-size:0.85rem; margin-top:15px; display:block;">🎭 Actions Sociales (Sur 50) :</strong>`;
            diceContainer.appendChild(titreSocial);
            listeIdSociales.forEach(id => {
                if (dictionnaireActionsSociales[id]) {
                    diceContainer.appendChild(creerBoutonAction(id, dictionnaireActionsSociales[id], "167, 119, 227"));
                }
            });

        } catch (err) {
            console.error("❌ Erreur critique d'initialisation :", err);
            diceContainer.innerHTML = "<div style='color: #ff4a4a; padding: 10px;'>❌ Impossible d'initialiser le paquet de dés contrôlé.</div>";
        }
    }

    // 🔄 Forcer l'affichage immédiat des dés physiques et sociaux calculés à l'ouverture de la modale
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
            if (typeof loadOrCreateRpHistory === "function") {
                await loadOrCreateRpHistory(window.currentActiveRpId, window.currentActiveCharName);
            }

            

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
            if (!outputDiv || !currentActiveRpId) return;

            // 💾 SAUVEGARDE DU PROMPT ACTUEL POUR LE REROLL
dernierPromptJoueur = textInput ? textInput.value.trim() : "";

            const aiInstructionsElement = document.getElementById("coWriteAiInstructions");
            const instructions = aiInstructionsElement ? aiInstructionsElement.value.trim() : "";

            const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
            let moodInstruction = "";

// 🎲 1. RÉCUPÉRATION DU CONTEXTE DES DÉS MULTIPLES (ErER)
 let contrainteDeDesPrompt = "";

    if (window.getActionsSelectionneesPourIA && Array.isArray(window.getActionsSelectionneesPourIA) && window.getActionsSelectionneesPourIA.length > 0) {
        contrainteDeDesPrompt = `\n[CONTRAINTES DE JEU - ACTIONS ET DÉS MULTIPLES]\n`;
        contrainteDeDesPrompt += `Durant ce tour, le personnage réalise les actions JDR suivantes. Tu DOIS impérativement intégrer et romancer TOUTES ces actions dans ton récit en respectant rigoureusement leur niveau de réussite :\n`;

        window.getActionsSelectionneesPourIA.forEach(idAction => {
            // 🔍 On récupère les données pré-calculées correspondantes à l'ID
            const res = window.resultatsPreCalcules?.[idAction];
            
            if (!res) {
                console.warn(`⚠️ L'action [${idAction}] est cochée mais aucun résultat n'a été trouvé.`);
                return; // On passe à la suivante sans crasher
            }

            // 🛡️ Extraction ultra-sécurisée du verdict (physique ou social)
            let vTexte = "Réussite";
            let vDesc = "";
            
            if (res.verdict && typeof res.verdict === "object") {
                vTexte = res.verdict.texte || "Calculé";
                vDesc = res.verdict.description || "";
            } else if (res.verdictTexte) {
                vTexte = res.verdictTexte;
                vDesc = res.verdictDescription || "";
            }

            const nomActionAffichee = res.nom || idAction;
            const scoreTotal = res.total || 0;

            // ✍️ Injection propre dans le prompt sans risque de crash
            contrainteDeDesPrompt += `- Action tentée : ${nomActionAffichee}\n`;
            contrainteDeDesPrompt += `  Score obtenu : ${scoreTotal} / 50\n`;
            contrainteDeDesPrompt += `  Verdict du Clan : ${vTexte}\n`;
            contrainteDeDesPrompt += `  Effet requis : ${vDesc}\n\n`;
        });

        contrainteDeDesPrompt += `CONSIGNE NARRATIVE CRUCIALE :
        Insère ces réussites ou ces échecs de manière fluide, sauvage et immersive. Tu ne dois JAMAIS afficher de chiffres, de calculs ou de termes techniques de JDR (bannis les expressions comme "score", "total", "dés", "SA", "échec", "réussite"). Traduis ces données uniquement par des descriptions physiques (ex: un coup qui dévie, une douleur fulgurante, une maladresse, un exploit agile), les ressentis du chat ou des répliques.`;
    }

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

            if (contrainteDeDesPrompt) {
    systemPrompt += `${contrainteDeDesPrompt}\n`;
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

        // 🧹 NETTOYAGE DES DÉS SELECTIONNÉS
    window.getActionsSelectionneesPourIA = [];

    const lignesDes = document.querySelectorAll("#diceActionsList > div");
    lignesDes.forEach(ligne => {
        ligne.style.color = "#b0b0b8";
        ligne.style.background = "rgba(255, 255, 255, 0.01)";
        const indicator = ligne.querySelector(".status-indicator");
        if (indicator) {
            indicator.innerText = "[ ]";
            indicator.style.color = "#444a5a";
        }
    });

    const zoneResultatDes = document.getElementById("diceResultZone");
    if (zoneResultatDes) {
        zoneResultatDes.innerHTML = "Aucune action sélectionnée pour ce tour.";
    }

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

        const textAiHTML = parseRP(textAi);

        


                    // ============================================================================
                    // 9. RENDU HTML AVEC LA BARRE D'OUTILS ET LA NOUVELLE MODALE MÉDICALE DÉDIÉE
                    // ============================================================================
                    outputDiv.innerHTML = `
    <style>
        .rp-dialogue { margin: 12px 0; padding-left: 12px; border-left: 3px solid #dfb56c; line-height: 1.4; }
        .rp-speech { color: #dfb56c; font-family: Georgia, serif; font-size: 1.4rem !important; }
        .rp-incise { font-weight: bold; color: #ffffff; font-family: Georgia, serif; font-size: 1.4rem !important; }
    </style>

    <div class="co-write-display" style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="color:#a777e3; font-weight:bold;">Suggéré pour ${currentActiveCharName} :</span>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
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
                    
                    document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                        navigator.clipboard.writeText(textAi);
                        this.innerText = "✓ Copié !";
                    });

                }
            } catch (err) { 
                console.error("❌ Erreur de transmission API Mistral :", err);
                outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur de transmission API.</span>"; 
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