/**
 * DiceManager.js - Moteur de gestion et d'affichage des lancers de dés (Formule : D30 + 4 + SA)
 */

import { db } from '../Firebase.js'; 
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
export function determinerClasseReussite(total) {
    if (total >= 1 && total <= 10) {
        return { id: "echec_critique", texte: "❌ Raté Critique (1)", niveau: 1, couleur: "#ff4a4a", description: "Échec critique : l'action échoue totalement." };
    } else if (total >= 11 && total <= 20) {
        return { id: "echec_simple", texte: "🍁 Raté Classique (2)", niveau: 2, couleur: "#ff9f43", description: "Échec simple : l'action est évitée." };
    } else if (total >= 21 && total <= 30) {
        return { id: "reussite_classique", texte: "🌿 Réussite Classique (3)", niveau: 3, couleur: "#1dd1a1", description: "Attaque/action réussie modérément." };
    } else if (total >= 31 && total <= 40) {
        return { id: "tres_bonne_reussite", texte: "🔥 Très Bonne Réussite (4)", niveau: 4, couleur: "#10ac84", description: "Inflige de grosses douleurs." };
    } else {
        return { id: "reussite_critique", texte: "⭐ Réussite Critique (6)", niveau: 6, couleur: "#feca57", description: "Réussite critique : exploit violent." };
    }
}

/**
 * Calcule le jet mathématique pur
 */
// 🎲 1. Ta fonction synchrone d'origine (Requise en interne par preparerEtInitialiserZoneDes)
// 🎲 La fonction de calcul pure (synchrone, ultra rapide)
export function executerLancerDesErER(charName, idAction) {
    // 🛠️ Nettoyage de la chaîne pour ignorer les problèmes d'accents majuscules (Étincelle vs Etincelle)
    let cleanName = charName;
    if (charName === "Etincelle de Vie") cleanName = "Étincelle de Vie";

    const chatStats = baseFichesStats[cleanName] || baseFichesStats[charName];
    const actionConfig = dictionnaireActionsErER[idAction];

    if (!actionConfig) return null;

    // Si le personnage n'a pas de fiches de stats, on met 0 par défaut partout pour ne pas bloquer Firebase
    const valA = chatStats ? (chatStats[actionConfig.statA] || 0) : 0;
    const valB = chatStats ? (chatStats[actionConfig.statB] || 0) : 0;
    const scoreAction = valA + valB;

    const resultatD30 = Math.floor(Math.random() * 30) + 1;
    const grandTotal = resultatD30 + 4 + scoreAction;
    const verdict = determinerClasseReussite(grandTotal);

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

            rafraichirAffichageResultatsCumules();
        };

        listeEl.appendChild(ligneAction);
    }
}

/**
 * Met à jour la zone #diceResultZone avec l'ensemble des actions sélectionnées
 */
// 🌟 Rendre la fonction accessible à la modale AICoachs
// 🌟 Fonction unifiée et accessible pour mettre à jour l'affichage des résultats en bas
window.mettreAJourAffichageDesPourIA = function() {
    const resultZone = document.getElementById("diceResultZone"); 
    if (!resultZone) return;

    // On récupère les IDs actuellement cochés par l'utilisateur
    const selectedIds = window.getActionsSelectionneesPourIA || [];

    if (selectedIds.length === 0) {
        resultZone.innerHTML = `<span style="color: #666; font-style: italic;">Aucune action sélectionnée pour ce tour.</span>`;
        return;
    }

    let htmlContenu = `<div style="width: 100%; display: flex; flex-direction: column; gap: 8px; text-align: left; font-size: 0.85rem;">`;
    htmlContenu += `<strong style="color: #ffcc00; border-bottom: 1px dashed rgba(255,204,0,0.2); padding-bottom: 4px; margin-bottom: 4px; display: block;">🎯 Actions sélectionnées pour l'IA (${selectedIds.length}) :</strong>`;

    selectedIds.forEach(idAction => {
        // On pioche directement dans l'objet des résultats calculés à l'ouverture
        const res = resultatsPreCalcules[idAction];
        if (!res) return;

        htmlContenu += `
            <div style="background: rgba(0,0,0,0.15); border-left: 3px solid ${res.verdict.couleur}; padding: 5px 8px; border-radius: 4px; margin-bottom: 2px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: #fff;">${res.nomAction}</span>
                    <span style="font-weight: bold; color: ${res.verdict.couleur}; font-size: 0.8rem;">
                        Total : ${res.total} (${res.verdict.texte})
                    </span>
                </div>
                <small style="color: #a0a0aa; font-style: italic; display: block; margin-top: 1px;">
                    ${res.verdict.description} <span style="color:#555a65;">(D30: ${res.lancerDe} + SA: +${res.sa})</span>
                </small>
            </div>
        `;
    });

    htmlContenu += `</div>`;
    resultZone.innerHTML = htmlContenu;
};