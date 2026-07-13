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
import { executerConsidolationTotaleMemoire } from './MemoryManager.js';
import { initialiserEtTraiterMemoiresManquantes, verifierDeclenchementMemoire, reecrireMemoireModalParId  } from './memoireHierarchique.js';
import { nettoyerSyntaxeDialogue, autoApprendreEtEnrichirDico } from './Robot.js?v=2.1';
import { DICTIONNAIRE_INGREDIENTS_RP } from './IngredientsData.js';
import { genererMessagesMistral } from './Prompt.js?v=2.1';


// ⚠️ CONFIGURATION MISTRAL
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT";  
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

window.currentActiveRpId = null;
window.currentActiveCharName = null;
let dernierPromptJoueur = ""; // Sauvegarde le message ou contexte du joueur
// Variable globale pour garder une trace du salon actuellement affiché dans la modale
// ✅ Correct & Global : On attache les variables à window pour que le onclick du HTML puisse les lire !
window.currentActiveSalonId = null;
window.currentActiveSalonTexte = null;

// Rendre la fonction accessible au HTML globalement
window.reecrireMemoireModalParId = reecrireMemoireModalParId;

// ==========================================================================
// 🌡️ GESTION GLOBALE DE LA TEMPÉRATURE MISTRAL
// ==========================================================================
window.currentMistralTemperature = 0.7;

window.mettreAJourTemperature = function(nouvelleValeur) {
    const valeurNum = parseFloat(nouvelleValeur);
    window.currentMistralTemperature = valeurNum;
    
    // Mise à jour de l'affichage du texte à côté du slider
    const indicateur = document.getElementById("valeurTemperature");
    if (indicateur) {
        indicateur.innerText = valeurNum.toFixed(2);
    }
    console.log(`🌡️ [Température] Valeur mise à jour : ${valeurNum}`);
};

// ==========================================================================
// 🗂️ GESTION GLOBALE DU NOMBRE DE BLOCS DEMANDÉS
// ==========================================================================
window.currentNombreBlocsDemande = 4; // Valeur par défaut (ex: 4 blocs)

window.mettreAJourNombreBlocs = function(nouvelleValeur) {
    const valeurNum = parseInt(nouvelleValeur, 10);
    window.currentNombreBlocsDemande = valeurNum;
    
    // Mise à jour de l'affichage du texte à côté du slider
    const indicateur = document.getElementById("valeurNombreBlocs");
    if (indicateur) {
        indicateur.innerText = valeurNum;
    }
    console.log(`🗂️ [Structure] Nombre de blocs demandé mis à jour : ${valeurNum}`);
};

/* Fonctions d'enregistrement + écriture */

async function ExecuterSauvgarde() {
    
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
}

    async function EcrireIA() {
        
    
            // AJOUTE OU REMONTE CETTE LIGNE TOUT EN HAUT DU CLICK :
// On récupère en direct ce qui est écrit dans le champ des instructions / contexte
const instructions = document.getElementById("coWriteAiInstructions")?.value.trim() || "";
const outputDiv = document.getElementById("coWriteAiOutput");
if (!outputDiv) return;
// 1. On appelle la fonction de Prompt.js pour récupérer le gâteau tout préparé (systemPrompt + historique + note)
const messagesPrepares = await genererMessagesMistral();
const MaxTokensDina = ( window.currentNombreBlocsDemande || 4 ) * 1000;

// 2. Ton appel fetch existant à adapter avec "messagesPrepares" :
try {
    console.log(`Voici mes messages préparés : ${JSON.stringify(messagesPrepares, null, 2)}`);
const response = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
        model: "mistral-large-latest",
        messages: messagesPrepares, // 🌟 On injecte directement le tableau ici !
        temperature: window.currentMistralTemperature, // Utilise ton slider de température globale !
        max_tokens: MaxTokensDina
    })
});
        
    
if (!response.ok) throw new Error(`Code erreur API Mistral : ${response.status}`);

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
        let textAiRaw = data.choices[0].message.content;
        
        outputDiv.innerHTML = `<p style="color:#a777e3;" class="blink">🛡️ Analyse sémantique et sécurisation de la syntaxe en cours...</p>`;

        console.log(`${textAiRaw}`)
        
        let textAi = await nettoyerSyntaxeDialogue(textAiRaw);
        console.log(`${textAi}`)
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
        
                    // Exemple : totalMessages est le nombre de posts du salon actuel, derniersMessages est le tableau des textes
                    
        // await verifierDeclenchementMemoire(totalMessages, derniersMessages);
        
                    console.log("💾 Échange unique sauvegardé avec succès dans rps_pending !");
                } catch (dbErr) { 
                    console.error("Erreur d'écriture dans l'historique IA Firestore:", dbErr); 
                }
        
                //if (aiInstructionsElement) aiInstructionsElement.value = "";
        
                const textAiHTML = parseRP(textAi);

        // ============================================================================
                    // 9. RENDU HTML AVEC LA BARRE D'OUTILS ET LA NOUVELLE MODALE MÉDICALE DÉDIÉE
                    // ============================================================================
                    outputDiv.innerHTML = `
    <style>
        .rp-dialogue { margin: 12px 0; padding-left: 12px; border-left: 3px solid #dfb56c; line-height: 1.4; }
        .rp-speech { color: #dfb56c;  font-size: 1.4rem !important; }
        .rp-incise { font-weight: bold; color: #ffffff; font-size: 1.4rem !important; }
    </style>

    <div class="co-write-display" style="border-left: 3px solid #a777e3; padding: 10px; background: rgba(167,119,227,0.02); border-radius:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="color:#a777e3; font-weight:bold;">Suggéré pour ${currentActiveCharName} :</span>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
            </div>
        </div>
        <div style="color:#fff; font-size:1.2rem; line-height:1.4 !important; margin:0;">${textAiHTML}</div>
    </div>

    <div id="coWriteExclusiveModal" style="display: none; position: fixed; z-index: 100000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(5, 5, 8, 0.95); backdrop-filter: blur(8px); justify-content: center; align-items: center;">
        <div style="background: #121218; border: 1px solid #a777e3; box-shadow: 0 0 30px rgba(167, 119, 227, 0.2); width: calc(100vw - 400px); max-width: 1500px; height: 80vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; position: relative;">
            <div style="padding: 15px 20px; border-bottom: 1px solid rgba(167, 119, 227, 0.3); display: flex; justify-content: space-between; align-items: center; background: #161622;">
                <h3 style="margin: 0; color: #ffcc00;">📖 Visionnage Exclusif — ${currentActiveCharName}</h3>
                <button id="btnCloseExclusive" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
            </div>
            <div class="co-write-display" style="flex: 1; padding: 25px; overflow-y: auto; color: #f0f0f0; font-size: 1.4rem !important; line-height: 1.6; background: #0c0c10;">
                ${textAiHTML}
            </div>
        </div>
    </div>
`;
const texteApris = autoApprendreEtEnrichirDico(textAi)

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

// ========================== GENERATION DU BLOC DE COPIE CHUNK DISCORD ==========================
        // 1. On nettoie TOUT le texte de l'IA en ne gardant que les vrais paragraphes de texte (on vire les vieux _ _)
        let lignesBrutes = textAi.split("\n");
        let paragraphesNettoyes = [];

        for (let ligne of lignesBrutes) {
            let lTrim = ligne.trim();
            // On ignore les lignes vides et les séparateurs existants pour tout reconstruire proprement
            if (lTrim.length === 0 || lTrim === "_ _") continue;
            paragraphesNettoyes.push(lTrim);
        }

        // 2. On reconstruit la structure géométrique parfaite avec UN SEUL "_ _" aux transitions
        let blocsFinauxAvecSeparateurs = [];
        for (let i = 0; i < paragraphesNettoyes.length; i++) {
            let pActuel = paragraphesNettoyes[i];
            blocsFinauxAvecSeparateurs.push(pActuel);

            // Si un paragraphe suit, on regarde si on doit mettre un séparateur
            if (i < paragraphesNettoyes.length - 1) {
                let pSuivant = paragraphesNettoyes[i + 1];
                
                let actuelEstDialogue = pActuel.startsWith(">");
                let suivantEstDialogue = pSuivant.startsWith(">");

                // ❌ EXCEPTION : Pas de séparateur entre deux dialogues qui se suivent
                if (actuelEstDialogue && suivantEstDialogue) {
                    // On ne met rien, ils resteront collés proprement
                } else {
                    // Pour tout le reste, on glisse un unique "_ _"
                    blocsFinauxAvecSeparateurs.push("_ _");
                }
            }
        }

        // 3. 🧮 L'ALGORITHME DE PARCELLISATION MATHÉMATIQUE (Max 1900 caractères)
        let morceauxDiscord = [];
        let paquetActuel = "";

        for (let element of blocsFinauxAvecSeparateurs) {
            // Un simple '\n' de jonction pour éviter les doubles sauts de ligne géants sur Discord !
            let jonction = paquetActuel.length > 0 ? "\n" : "";
            let tailleFuture = paquetActuel.length + jonction.length + element.length;

            if (tailleFuture < 1900) {
                // Ça passe sous la limite, on accumule
                paquetActuel += jonction + element;
            } else {
                // Ça déborde ! On valide le morceau en cours
                if (paquetActuel.trim().length > 0) {
                    morceauxDiscord.push(paquetActuel);
                }
                
                // Sécurité : Si le bloc de coupure est un "_ _", on ne commence pas le post suivant avec lui
                if (element === "_ _") {
                    paquetActuel = "";
                } else {
                    paquetActuel = element;
                }
            }
        }

        // On pousse le dernier morceau de texte restant
        if (paquetActuel.trim().length > 0) {
            morceauxDiscord.push(paquetActuel);
        }

        // 4. Gestion de la copie séquentielle sur ton bouton unique (btnCopierCoWrite)
        let indexBlocActuel = 0;
        const nouveauBtnCopier = document.getElementById("btnCopierCoWrite");

        if (nouveauBtnCopier && morceauxDiscord.length > 0) {
            if (morceauxDiscord.length > 1) {
                nouveauBtnCopier.innerText = `📋 Copier le bloc 1/${morceauxDiscord.length}`;
            } else {
                nouveauBtnCopier.innerText = `📋 Copier le bloc`;
            }

            // Purge radicale des anciens écouteurs (Anti-bégaiement du bouton)
            const clonerBouton = nouveauBtnCopier.cloneNode(true);
            nouveauBtnCopier.parentNode.replaceChild(clonerBouton, nouveauBtnCopier);

            clonerBouton.addEventListener("click", function() {
                if (indexBlocActuel < morceauxDiscord.length) {
                    let texteACopier = morceauxDiscord[indexBlocActuel];
                    
                    // Copie physique du texte purifié de moins de 1900 caractères
                    navigator.clipboard.writeText(texteACopier);
                    
                    indexBlocActuel++;

                    if (indexBlocActuel < morceauxDiscord.length) {
                        this.innerText = `📋 Bloc ${indexBlocActuel} OK ➔ Suivant: ${indexBlocActuel + 1}/${morceauxDiscord.length}`;
                        this.style.background = "#a777e3";
                        this.style.color = "#fff";
                    } else {
                        this.innerText = "🎉 Tout est copié !";
                        this.style.background = "#2ecc71";
                        this.style.color = "#fff";
                        indexBlocActuel = 0; // Reset automatique pour le prochain tour
                    }
                }
            });
        }
        // ===============================================================================================
    } 

            } catch (err) { 
                console.error("❌ Erreur de transmission API Mistral :", err);
                outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur de transmission API.</span>"; 
            }

        
    }

window.Enregistrer = async function() {
    console.log("Lancement de la procédure d'enregistrement");
    try {
        // ✅ Correction 1 : "function" entre guillemets
        if (typeof ExecuterSauvgarde === "function") {
            await ExecuterSauvgarde();
        } else {
            console.warn("Fonction Introuvable, procédure annulée");
        }
    } catch (error) { // ✅ Correction 2 : (error) avant l'accolade
        console.error("Erreur lors de l'exécution :", error);
    }
};

window.EcrireIA = async function() {
    console.log("Lancement de l'écriture");
    try {
        if (typeof EcrireIA === "function") {
            await EcrireIA();
        } else {
            console.warn("Fonction introuvable, écriture annulée")
        }
    } finally {}
}; 

// 🌟 GESTION DE LA SÉLECTION DES HUMEURS / INGRÉDIENTS À LA VOLÉE
window.basculerSelectionMood = function(element) {
    console.log("🎭 Clic détecté sur l'humeur :", element.innerText.trim());

    // CONDITION 1 : Détecté automatiquement par l'IA et actif
    if (element.classList.contains("active") && element.classList.contains("detected")) {
        element.classList.remove("active");
    } 
    // CONDITION 2 : Activé manuellement, on l'éteint
    else if (element.classList.contains("active")) {
        element.classList.remove("active");
    } 
    // CONDITION 3 : Éteint, on l'allume !
    else {
        element.classList.add("active");
    }
};

/**
 * ============================================================================
 * 1. FONCTION : OUVERTURE DE LA MODALE
 * ============================================================================
 */



window.openCoWriteModal = async function(rpId, charName) {
    window.currentActiveRpId = rpId;
    window.currentActiveCharName = charName;
    // 🌟 Sauvegarde globale de l'ID
    window.currentActiveSalonId = rpId; 
    window.currentActiveSalonTexte = ""; 

    console.log(`📂 [Modale] Ouverture pour le salon (RpID) : ${rpId} (Personnage : ${charName})`);
    
    try {
        const messagesRef = collection(db, "rps_pending", rpId, "messages");
        const messagesSnapshot = await getDocs(messagesRef);
        
        let texteAssemble = "";
        messagesSnapshot.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            let contenuMsg = msgData.text || msgData.content || "";
            if (contenuMsg) {
                texteAssemble += `${contenuMsg}\n`;
            }
        });

        // 🌟 Sauvegarde globale du texte complet
        window.currentActiveSalonTexte = texteAssemble;
        console.log(`📖 [Modale] Historique extrait avec succès : ${texteAssemble.length} caractères récupérés.`);

    } catch (error) {
        console.error("❌ Erreur lors de l'extraction de l'historique pour la modale :", error);
    }
   
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
        <button onclick="window.executerConsidolationTotaleMemoire()" style="background: rgba(255, 204, 0, 0.1); color: #ffcc00; border: 1px solid #ffcc00; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight:bold; display:flex; align-items:center; gap:6px; transition: all 0.2s; margin-right: 20px;">
            Réécrire la mémoire
        </button>
        <button onclick="window.reecrireMemoireModalParId(window.currentActiveSalonId, window.currentActiveSalonTexte)" style="background: rgba(255, 204, 0, 0.1); color: #ffcc00; border: 1px solid #ffcc00; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight:bold; display:flex; align-items:center; gap:6px; transition: all 0.2s; margin-right: 20px;">
    Réécrire la mémoire de la Modal
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
                    <span class="status-indicator" style="color: #444a5a; font-weight: bold;">[ ]</span>
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
                    <div style="color: #e0e0e0; font-size: 0.9rem; line-height: 1.4;">${textHTML}</div>
                </div>
            `;
        });
        
        historyLog.scrollTop = historyLog.scrollHeight;
    } catch (err) {
        console.error(err);
        historyLog.innerHTML = "<span style='color: #e74c3c;'>Erreur de traitement de l'historique.</span>";
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
    <div id="modalConsignes" style="display: none; position: fixed; z-index: 300000; left: 0; top: 0; width: 100vw; height: 100vh; background: rgba(5,5,8,0.85); backdrop-filter: blur(8px); justify-content: center; align-items: center;">
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
                <textarea id="textareaConsignes" placeholder="Écris tes consignes, contraintes ou contexte récent ici..." style="width: 100%; height: 200px; background: #121218; border: 1px solid #2a2a35; border-radius: 4px; color: #fff; padding: 10px; resize: none; box-sizing: border-box;"></textarea>
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
    // Lance l'analyse et la génération des mémoires manquantes de la plus longue à la plus courte
initialiserEtTraiterMemoiresManquantes();

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

});




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
;

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
                    <div style="color:#fff; font-size:1.2rem; line-height:1.4 !important; margin:0;">${textAiHTML}</div>
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
                <h3 style="margin: 0; color: #ffcc00;">📖 Visionnage Résumé</h3>
                <button id="btnCloseExclusive" style="background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
                
                </div>
            <div class="co-write-display" style="flex: 1; padding: 25px; overflow-y: auto; color: #f0f0f0; font-size: 1.4rem !important; line-height: 1.6; background: #0c0c10;">
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

/**
 * ⏰ ROUTINE DE CONSOLIDATION HORAIRE (00h00 & 12h00)
 * Scanne l'intégralité du site à chaque changement de créneau horaire
 */
async function verifierEtLancerRoutineHoraire() {
    const maintenant = new Date();
    const heureActuelle = maintenant.getHours();
    
    // Déterminer le créneau cible (00h ou 12h)
    let cibleDerniereRoutine = "";
    if (heureActuelle >= 12) {
        cibleDerniereRoutine = `${maintenant.toLocaleDateString()}-12h`;
    } else {
        cibleDerniereRoutine = `${maintenant.toLocaleDateString()}-00h`;
    }

    // Si la routine globale a déjà tourné pour ce créneau, on s'arrête
    if (localStorage.getItem("derniereRoutineMemoire") === cibleDerniereRoutine) {
        return; 
    }

    // 🌟 APPEL DE LA MÉMOIRE GLOBALE POUR TOUT LE MONDE
    await executerConsidolationTotaleMemoire();

    // Enregistrer que le créneau est validé
    localStorage.setItem("derniereRoutineMemoire", cibleDerniereRoutine);
}

// Lancement automatique à l'ouverture du tableau de bord
verifierEtLancerRoutineHoraire();