


// =========================================================================
// ⚖️ STRUCTURE D'ÉVALUATION DU SCORE FINAL (SUR 50)
// =========================================================================
export function evaluerResultatSocial50(scoreTotal) {
    if (scoreTotal <= 15) {
        return { texte: "Échec Critique 💀", couleur: "#ff3333", description: "L'action se retourne violemment contre le chat." };
    } else if (scoreTotal <= 28) {
        return { texte: "Échec Standard ❌", couleur: "#ff6666", description: "L'action échoue et crée un froid ou un quiproquo." };
    } else if (scoreTotal <= 38) {
        return { texte: "Réussite Partielle ⚖️", couleur: "#ffcc00", description: "Succès mitigé, l'interlocuteur accepte mais demande une contrepartie." };
    } else if (scoreTotal <= 47) {
        return { texte: "Réussite Standard 🎉", couleur: "#33cc33", description: "L'action est un succès complet et fluide." };
    } else {
        return { texte: "Réussite Critique 🌟", couleur: "#00ffff", description: "Succès légendaire, la cible est totalement subjuguée ou acquise à votre cause." };
    }
}




// Rattachement global pour l'interface
window.declencherJetSocialDirect = function(idAction) {
    const nomChatActif = window.currentActiveCharName || document.getElementById("char_sent")?.value;
    if (!nomChatActif) {
        alert("⚠️ Choisis d'abord un personnage !");
        return;
    }

    // Extraction sécurisée des traits depuis la base globale s'ils existent
    const chatTraits = window.fichesPersonnagesJDR?.[nomChatActif]?.traits || {};
    const rapport = executerLancerSocialPrecalcul(chatTraits, idAction);

    if (rapport) {
        alert(`🎲 Jet de ${rapport.nomAction} pour ${nomChatActif} :\n\n` +
              `• Résultat du Dé (D20) : ${rapport.de}\n` +
              `• Modificateur Psychologique : +${rapport.bonus}\n` +
              `• SCORE TOTAL : ${rapport.total} / 50\n\n` +
              `➔ VERDICT : ${rapport.verdict.texte}`);
    }
};

/**
 * DiceManager.js - Moteur de gestion et d'affichage des lancers de dés (Formule : D30 + 4 + SA)
 */

import { db } from '../Firebase.js'; 
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { dictionnaireActionsSociales, dictionnaireSynonymesCaractere, fichesPersonnagesJDR, executerLancerSocialPrecalcul } from './TraitsDictionnaire.js';

// ============================================================================
// ⚠️ VARIABLES GLOBALES DE SESSION POUR LES DÉS
// ============================================================================
let actionsSelectionneesPourIA = [];
let resultatsPreCalcules = {};

// 1. Base de données synchronisée sur les carrés noirs de tes fiches de personnages
export const baseFichesStats = {
    "Étincelle de Vie": { force: 3, endurance: 4, rapidite: 4, agilite: 7, constitution: 3, discretion: 4, vue: 4, odorat: 3, ouie: 3 },
    "Nuage de Lynx":    { force: 5, endurance: 4, rapidite: 3, agilite: 3, constitution: 4, discretion: 5, vue: 4, odorat: 4, ouie: 3 },
    "Nuage d'Anémone":  { force: 2, endurance: 3, rapidite: 4, agilite: 5, constitution: 3, discretion: 4, vue: 3, odorat: 5, ouie: 6 }
};

// 2. Dictionnaire qui associe chaque action JDR aux deux statistiques de la fiche
export const dictionnaireActionsErER = {
    // --- COMBAT ---
    "attaque_directe": { nom: "Attaque Directe", statA: "force", statB: "rapidite" },
    "esquive_parade":  { nom: "Esquive & Parade", statA: "agilite", statB: "rapidite" },
    "lutte_corps":     { nom: "Luttes & Prises", statA: "force", statB: "endurance" },
    "degagement":      { nom: "Dégagement d'urgence", statA: "force", statB: "agilite" },
    "encaisser":       { nom: "Encaisser un coup", statA: "constitution", statB: "endurance" },

    // --- CHASSE & MOUVEMENT ---
    "chasse_furtive":  { nom: "Chasse Furtive (Sol)", statA: "discretion", statB: "odorat" },
    "chasse_aerienne": { nom: "Chasse Aérienne (Canopée)", statA: "agilite", statB: "rapidite" },
    "course_poursuite":{ nom: "Course-poursuite", statA: "rapidite", statB: "endurance" },
    "ascension_saut":  { nom: "Ascension & Sauts", statA: "agilite", statB: "endurance" },

    // --- PERCEPTION & SURVIE ---
    "pistage":         { nom: "Pistage à la trace", statA: "odorat", statB: "vue" },
    "guet_vigilance":  { nom: "Guet & Vigilance", statA: "ouie", statB: "vue" },
    "recherche_plantes":{ nom: "Recherche de plantes", statA: "vue", statB: "odorat" },
    "resistance_maux": { nom: "Résistance (Maladie/Froid)", statA: "constitution", statB: "endurance" },
    "sang_froid":      { nom: "Sang-froid (Anti-Panique)", statA: "constitution", statB: "ouie" }
};

/**
 * Détermine la classe de réussite cloisonnée (Échelle ErER de 1 à 50)
 */

export function determinerClasseReussite(total, lancerDe) {
    // 🛑 1. INTERCEPTION STRICTE DES DÉS IMPOSÉS (Les 7 dés truqués)
    if (lancerDe === 1) {
        return { 
            texte: "Échec Critique 💀", 
            couleur: "#5f0de2", 
            description: "Un désastre total, l'action échoue lamentablement !", 
            code: 1 
        };
    }
    if (lancerDe === 12) {
        return { 
            texte: "Réussite Partielle ⚖️", 
            couleur: "#ffcc00", 
            description: "L'action est accomplie de manière standard.", 
            code: 3 
        };
    }
    if (lancerDe === 30) {
        return { 
            texte: "Réussite Critique ⭐", 
            couleur: "#00ffff", 
            description: "Un exploit légendaire et spectaculaire !", 
            code: 6 // Code 6 pour ta réussite critique !
        };
    }

    // 🎲 2. BAREME PAR DÉFAUT POUR LE HASARD (Les 7 dés normaux calculés via le Total)
    // S'ajuste automatiquement selon le score total (D30 + 4 + SA)
    if (total <= 10) {
        return { 
            texte: "Échec Critique 💀", 
            niveau: 1,
            couleur: "#5f0de2", 
            description: "Un désastre total, l'action échoue lamentablement !", 
        };
} else if (total >= 11 && total <= 20) {
        return { id: "echec_simple", texte: "Échec Standard ❌", niveau: 2, couleur: "#ff3333", description: "Échec simple : l'action est évitée." };
    } else if (total >= 21 && total <= 30) {
        return { id: "reussite_classique", texte: "Réussite Partielle ⚖️", niveau: 3, couleur: "#ffcc00", description: "L'action est accomplie de manière standard." };
    } else if (total >= 31 && total <= 40) {
        return { id: "tres_bonne_reussite", texte: "Très Bonne Réussite 🔥", niveau: 4, couleur: "#33cc33", description: "Inflige de grosses douleurs." };
    } else {
        return { id: "reussite_critique", texte: "Réussite Critique 🌟", niveau: 6, couleur: "#00ffff", description: "Un exploit légendaire et spectaculaire !" };
    }
}

/**
 * Calcule le jet mathématique pur
 */
// 🎲 1. Ta fonction synchrone d'origine (Requise en interne par preparerEtInitialiserZoneDes)
// 🎲 La fonction de calcul pure (synchrone, ultra rapide)
export function executerLancerDesErER(charName, idAction, deForce = null) {
    let cleanName = charName;
    if (charName === "Etincelle de Vie") cleanName = "Étincelle de Vie";

    const chatStats = baseFichesStats[cleanName] || baseFichesStats[charName];
    const actionConfig = dictionnaireActionsErER[idAction];

    if (!actionConfig) return null;

    const valA = chatStats ? (chatStats[actionConfig.statA] || 0) : 0;
    const valB = chatStats ? (chatStats[actionConfig.statB] || 0) : 0;
    const scoreAction = valA + valB;

    // 🎲 Si un dé est imposé, on le prend, sinon on lance un D30 classique
    const resultatD30 = deForce !== null ? deForce : (Math.floor(Math.random() * 30) + 1);
    // Dans executerLancerDesErER, vérifie bien cette ligne :
const grandTotal = resultatD30 + 4 + scoreAction;
const verdict = determinerClasseReussite(grandTotal, resultatD30); // 👈 On passe bien les deux !

    const resultat = {
        nomDuChat: charName,
        nomAction: actionConfig.nom,
        lancerDe: resultatD30,
        bonusFixe: 4,
        sa: scoreAction,
        statANom: actionConfig.statA,
        statBNom: actionConfig.statB,
        valStatA: valA,
        valStatB: valB,
        total: grandTotal,
        verdict: verdict
    };

    if (!resultatsPreCalcules) resultatsPreCalcules = {};
    resultatsPreCalcules[idAction] = resultat;
    window.resultatsPreCalculesGlobaux = resultatsPreCalcules;

    return resultat;
}
// 💾 2. La fonction Maîtresse asynchrone pour Firebase (Appelée par AICoachs.js)
export async function executerEtSauvegarderActionFirebase(charName, idAction, rpId, estCoche) {
    // On force un nouveau calcul propre via la fonction d'origine
    const res = executerLancerDesErER(charName, idAction);
    if (!res) return null;

    if (rpId) {
        try {
            const actionDocRef = doc(db, "rps_pending", rpId, "des", idAction);
            await setDoc(actionDocRef, {
                actionId: idAction,
                nom: res.nomAction,
                actif: estCoche,
                total: res.total,
                lancerDe: res.lancerDe,
                sa: res.sa,
                verdictTexte: res.verdict.texte,
                verdictCouleur: res.verdict.couleur,
                verdictDescription: res.verdict.description,
                timestamp: new Date()
            }, { merge: true });
            
            console.log(`✅ [Firebase] Action ${idAction} synchronisée avec un total de ${res.total}`);
        } catch (fsErr) {
            console.error("❌ Erreur d'écriture Firestore depuis DiceManager :", fsErr);
        }
    }
    return res;
}

// Rendre la fonction disponible globalement au cas où
window.executerEtSauvegarderActionFirebase = executerEtSauvegarderActionFirebase;

/**
 * Fonction maîtresse appelée À L'OUVERTURE de la modale.
 */
export async function preparerEtInitialiserZoneDes(charName, currentRpId) {
    // 🔍 1. On injecte de force les IDs manquants sur les conteneurs de l'index.html
    const bruteList = document.querySelector(".dice-list");
    const bruteResult = document.querySelector(".dice-result");

    if (bruteList && !bruteList.id) bruteList.id = "diceActionsList";
    if (bruteResult && !bruteResult.id) bruteResult.id = "diceResultZone";

    // 🔍 2. Maintenant on peut faire notre ciblage officiel par ID sans risque !
    const listeEl = document.getElementById("diceActionsList");
    const resultZone = document.getElementById("diceResultZone");
    
    if (!listeEl) {
        console.error("[DiceManager] ID 'diceActionsList' introuvable.");
        return;
    }

    // Réinitialisation des tableaux de session
    actionsSelectionneesPourIA = [];
    resultatsPreCalcules = {};
    window.dernierJetDeDesContexte = null; 
    
    if (resultZone) resultZone.innerHTML = "Aucune action sélectionnée pour ce tour.";
    listeEl.innerHTML = ""; 

    // Calcul automatique de toutes les possibilités de dés
    for (const [idAction, config] of Object.entries(dictionnaireActionsErER)) {
        const res = executerLancerDesErER(charName, idAction);
        if (!res) continue;

        resultatsPreCalcules[idAction] = res;

        // Synchronisation Firestore par action
        if (currentRpId) {
            try {
                const actionDocRef = doc(db, "RPs", currentRpId, "ActionsDes", idAction);
                await setDoc(actionDocRef, {
                    nomAction: res.nomAction,
                    idAction: idAction,
                    nomDuChat: res.nomDuChat,
                    total: res.total,
                    lancerDe: res.lancerDe,
                    sa: res.sa,
                    verdictTexte: res.verdict.texte,
                    verdictNiveau: res.verdict.niveau,
                    verdictDescription: res.verdict.description,
                    timestamp: new Date()
                }, { merge: true });
            } catch (e) {
                console.error(`[Firestore Error] ${idAction}:`, e);
            }
        }
        
        // Construction des lignes épurées interactives
        const ligneAction = document.createElement("div");
        ligneAction.id = `line-select-${idAction}`;
        ligneAction.style.cssText = `
            padding: 6px 10px;
            font-size: 0.85rem;
            color: #b0b0b8;
            cursor: pointer;
            transition: all 0.2s ease;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            background: rgba(255, 255, 255, 0.01);
            margin-bottom: 2px;
            border-radius: 4px;
        `;

        ligneAction.innerHTML = `
            <span>${config.nom}</span>
            <span class="status-indicator" style="font-size: 0.75rem; color: #444a5a; font-weight: bold;">[ ]</span>
        `;

        ligneAction.onmouseover = () => { 
            if (!actionsSelectionneesPourIA.includes(idAction)) {
                ligneAction.style.background = "rgba(255, 255, 255, 0.04)";
                ligneAction.style.color = "#ffffff";
            }
        };
        ligneAction.onmouseout = () => { 
            if (!actionsSelectionneesPourIA.includes(idAction)) {
                ligneAction.style.background = "rgba(255, 255, 255, 0.01)";
                ligneAction.style.color = "#b0b0b8";
            }
        };

        ligneAction.onclick = () => {
    const idx = actionsSelectionneesPourIA.indexOf(idAction);
    const indicator = ligneAction.querySelector(".status-indicator");

    if (idx === -1) {
        actionsSelectionneesPourIA.push(idAction);
        ligneAction.style.color = "#ffcc00";
        ligneAction.style.background = "rgba(255, 204, 0, 0.08)";
        if (indicator) {
            indicator.innerText = "[ COCHÉ ]";
            indicator.style.color = "#ffcc00";
        }
    } else {
        actionsSelectionneesPourIA.splice(idx, 1);
        ligneAction.style.color = "#b0b0b8";
        ligneAction.style.background = "rgba(255, 255, 255, 0.01)";
        if (indicator) {
            indicator.innerText = "[ ]";
            indicator.style.color = "#444a5a";
        }
    }

    // ✅ Correction : On appelle la bonne fonction globale avec les bons IDs
    if (typeof window.mettreAJourAffichageDesPourIA === "function") {
        window.mettreAJourAffichageDesPourIA(actionsSelectionneesPourIA);
    }
};

        listeEl.appendChild(ligneAction);
    }
}

/**
 * Met à jour la zone #diceResultZone avec l'ensemble des actions sélectionnées
 */
// 🌟 Rendre la fonction accessible à la modale AICoachs
// 🌟 Fonction unifiée et accessible pour mettre à jour l'affichage des résultats en bas
window.mettreAJourAffichageDesPourIA = function(selectedIds) {
    if (!selectedIds) return;

    const resultZone = document.getElementById("diceResultZone");
    if (!resultZone) return; 

    let htmlContenu = `<div style="width: 100%; display: flex; flex-direction: column; gap: 8px; text-align: left; font-size: 0.85rem;">`;
    htmlContenu += `<strong style="color: #ffcc00; border-bottom: 1px dashed rgba(255,204,0,0.2); padding-bottom: 4px; margin-bottom: 4px; display: block;">🎯 Actions sélectionnées pour l'IA (${selectedIds.length}) :</strong>`;

    selectedIds.forEach(idAction => {
        if (!idAction) return;
        
        const cleanId = idAction.trim().toLowerCase();
        let res = window.resultatsPreCalcules?.[idAction] || window.resultatsPreCalcules?.[cleanId];

        if (!res) return;

        // Détection du type d'action
        const estSocial = ["persuasion", "bluff", "protection_sociale", "education", "apprentissage"].includes(cleanId) || res.estSocial;

        // 🔄 HARMONISATION STRICTE DES VARIABLES
        const nomActionAffichee = res.nomAction || res.nom || idAction;
        
        // Extraction du dé (gère 'de' et 'lancerDe')
        const valeurDe = res.de !== undefined ? res.de : (res.lancerDe !== undefined ? res.lancerDe : 0);
        
        // Extraction du bonus (gère 'bonus' et 'sa')
        const valeurBonus = res.bonus !== undefined ? res.bonus : (res.sa !== undefined ? res.sa : 0);
        
        const texteDe = estSocial ? "D20" : "D30";
        const texteBonus = estSocial ? "Psy" : "SA";

        // Extraction du verdict de manière ultra-sécurisée
        let vTexte = "Calculé";
        let vCouleur = "#aaa";
        let vDescription = "";

        if (res.verdict) {
            if (typeof res.verdict === "object") {
                vTexte = res.verdict.texte || "Calculé";
                vCouleur = res.verdict.couleur || "#aaa";
                vDescription = res.verdict.description || "";
            } else if (typeof res.verdict === "string") {
                vTexte = res.verdict;
                vCouleur = res.verdictCouleur || "#aaa";
                vDescription = res.verdictDescription || "";
            }
        }

        htmlContenu += `
            <div style="background: rgba(0,0,0,0.15); border-left: 3px solid ${vCouleur}; padding: 5px 8px; border-radius: 4px; margin-bottom: 2px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: #fff;">${nomActionAffichee}</span>
                    <span style="font-weight: bold; color: ${vCouleur}; font-size: 0.8rem;">
                        Total : ${res.total || 0} (${vTexte})
                    </span>
                </div>
                <small style="color: #a0a0aa; font-style: italic; display: block; margin-top: 1px;">
                    ${vDescription} <span style="color:#a777e3;">(Jet : ${texteDe}[${valeurDe}] + ${texteBonus}[${valeurBonus}])</span>
                </small>
            </div>
        `;
    });

    htmlContenu += `</div>`;
    resultZone.innerHTML = htmlContenu;
};