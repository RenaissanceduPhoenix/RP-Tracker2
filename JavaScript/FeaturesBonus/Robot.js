import { db } from '../Firebase.js';
import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT";  
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

export let dictionnaireActionsCache = [];
export let dictionnaireDialoguesCache = [];

async function chargerArsenalDictionnaire() {
    try {
        // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 2000));
        const dicoRef = doc(db, "dictionnaires", "rpg_feline");
        const docSnap = await getDoc(dicoRef);
        if (docSnap.exists() && docSnap.data().actions) {
            const actionsFirebase = docSnap.data().actions;
            console.log(`📚 [Robot.js] Arsenal Firebase connecté ! ${actionsFirebase.length} mots d'actions injectés.`);
            actionsFirebase.forEach(mot => {
                const motNet = mot.toLowerCase().trim();
                if (motNet && !dictionnaireActionsCache.includes(motNet)) {
                    dictionnaireActionsCache.push(motNet);
                }
            });
        }
    } catch (error) {
        console.error("❌ [Robot.js] Impossible de charger l'arsenal d'actions :", error);
    }
}
chargerArsenalDictionnaire();

/**
 * Force la majuscule après un point (.), d'exclamation (!), d'interrogation (?) ou de suspension (...)
 */
function appliquerMajusculesApresPonctuation(texte) {
    if (!texte) return "";
    return texte.replace(/([\.\!\?]|\.\.\.)\s+([a-zà-öø-ÿ])/g, function(match, ponct, lettre) {
        return ponct + " " + lettre.toUpperCase();
    });
}

// ============================================================================
// 🔄 OPTION 1 : VERSION AVEC LE SYMBOLE TILDE ( ~ )
// ============================================================================
function formaterLigneHybrideOptionTilde(ligne) {
    let texte = ligne.trim();
    if (!texte) return "";

    // ------------------------------------------------------------------------
    // 🌲 MODÈLE ACTION PURE / MIXTE (Commence par ~ ou se termine par ~)
    // ------------------------------------------------------------------------
    if (texte.startsWith("~") || texte.endsWith("~")) {
        // On vire définitivement tous les tildes ~ de l'IA
        texte = texte.replace(/~/g, "").trim();

        // Découpage chirurgical pour isoler les pensées ( ... ) au milieu ou fin de l'action
        let morceauxAction = texte.split(/(\([^)]+\))/g);
        let ligneActionReconstruite = morceauxAction.map(morceau => {
            let m = morceau.trim();
            if (!m) return "";
            if (m.startsWith("(") && m.endsWith(")")) {
                return `*${m.slice(1, -1).trim()}*`; // La pensée passe en *italique* sans ses ()
            } else {
                return `**${m}**`; // Le reste de la description passe en **gras d'action**
            }
        }).filter(m => m.length > 0).join(" ");

        ligneActionReconstruite = appliquerMajusculesApresPonctuation(ligneActionReconstruite);
        return ligneActionReconstruite.replace(/\*\*\s+\*\*/g, " "); // Nettoie les balises de gras collées
    }

    // ------------------------------------------------------------------------
    // 🧠 MODÈLE D : Pensée pure isolée sur toute la ligne -> ( la pensée )
    // ------------------------------------------------------------------------
    if (texte.startsWith("(") && texte.endsWith(")")) {
        let corpsPensee = texte.slice(1, -1).trim();
        if (corpsPensee) {
            corpsPensee = corpsPensee.charAt(0).toUpperCase() + corpsPensee.slice(1);
            corpsPensee = appliquerMajusculesApresPonctuation(corpsPensee);
            return `*${corpsPensee}*`; // Uniquement l'italique pour la pensée isolée
        }
    }

    // ------------------------------------------------------------------------
    // 💬 MODÈLES A, B, C : Dialogues complexes avec incises et/ou pensées internes
    // ------------------------------------------------------------------------
    let estUnDialogue = texte.startsWith(">") || texte.includes("«") || texte.includes("»");
    texte = texte.replace(/[\*\_]+/g, "").replace(/^>\s*/, "").replace(/\s+/g, " ").trim();

    if (estUnDialogue) {
        // Regex robuste : capture les dialogues «...», les pensées (...) et le reste (les incises narratives)
        let regex = /(«[^»]+»|\([^)]+\)|[^«(]+)/g;
        let morceaux = texte.match(regex);
        if (!morceaux) return `**${texte}**`;

        let segmentsTraites = morceaux.map(morceau => {
            let m = morceau.trim();
            if (!m) return "";

            if (m.startsWith("«") && m.endsWith("»")) {
                // Paroles prononcées : on extrait le texte brut et on vire les « »
                let dialoguePur = m.replace(/^«\s*/, "").replace(/\s*»$/, "").trim();
                if (dialoguePur) {
                    dialoguePur = dialoguePur.charAt(0).toUpperCase() + dialoguePur.slice(1);
                }
                return dialoguePur; // Paroles nues
            } else if (m.startsWith("(") && m.endsWith(")")) {
                // Pensée interne détectée au milieu ou en fin de dialogue -> Passage en *italique*
                let penseePure = m.slice(1, -1).trim();
                if (penseePure) {
                    penseePure = penseePure.charAt(0).toUpperCase() + penseePure.slice(1);
                }
                return `*${penseePure}*`; // Sans parenthèses
            } else {
                // Incise narrative classique couplée au dialogue -> Passage en **Gras**
                m = m.charAt(0).toUpperCase() + m.slice(1);
                return `**${m}**`;
            }
        }).filter(m => m.length > 0);

        let ligneReconstruite = segmentsTraites.join(" ");
        ligneReconstruite = appliquerMajusculesApresPonctuation(ligneReconstruite);

        // Fusionne proprement les balises de gras qui se touchent
        ligneReconstruite = ligneReconstruite.replace(/\*\*\s+\*\*/g, " ");
        return `> ${ligneReconstruite}`;
    }

    // Sécurité garde-fou
    texte = texte.charAt(0).toUpperCase() + texte.slice(1);
    return `**${appliquerMajusculesApresPonctuation(texte)}**`;
}


/**
 * Compilateur géométrique qui sécurise l'imbrication des balises et gère les séparateurs _ _
 */
function compilerEtSecuriserFlux(paragraphes) {
    let fluxFinal = [];
    for (let i = 0; i < paragraphes.length; i++) {
        let p = paragraphes[i];
        if (!p.text) continue;

        let ligne = p.text;
        
        let countGras = (ligne.match(/\*\*/g) || []).length;
        if (countGras % 2 !== 0) ligne += "**";
        
        let countItalique = (ligne.replace(/\*\*/g, "").match(/\*/g) || []).length;
        if (countItalique % 2 !== 0) ligne += "*";

        fluxFinal.push(ligne);

        if (i < paragraphes.length - 1) {
            let prochainP = paragraphes[i + 1];
            if (prochainP && prochainP.text) {
                if (p.type !== prochainP.type) {
                    fluxFinal.push("_ _");
                } else {
                    fluxFinal.push("");
                }
            }
        }
    }
    return fluxFinal.join("\n");
}

/**
 * ============================================================================
 * 🚀 ORCHESTRATEUR PRINCIPAL
 * ============================================================================
 */
export function nettoyerSyntaxeDialogue(texteBrutIA) {
    if (!texteBrutIA) return "";

    console.log("🎯 [Robot.js] Filtrage géométrique chirurgical actif...");

    let lignes = texteBrutIA.split(/\n+/);
    let paragraphesIdentifies = [];

    lignes.forEach(rawLigne => {
        let ligneNettoyee = rawLigne.trim();
        if (!ligneNettoyee) return;

        let estDialoguePur = (ligneNettoyee.includes("«") || ligneNettoyee.includes("»")) && !ligneNettoyee.replace(/«[^»]+»/g, "").trim();
        let typeParagraphe = estDialoguePur ? "dialogue" : "action";

        // 🛠️ CHOIX DE L'OPTION DE COMPILATION :
        // Remplace par "formaterLigneHybrideOptionGuillemetsDroits" si tu choisis le symbole " plutôt que ~
        let texteFormate = formaterLigneHybrideOptionTilde(ligneNettoyee);
        
        if (texteFormate) {
            paragraphesIdentifies.push({ type: typeParagraphe, text: texteFormate });
        }
    });

    let resultatRendu = compilerEtSecuriserFlux(paragraphesIdentifies);

    setTimeout(() => {
        autoApprendreEtEnrichirDico(texteBrutIA).catch(err => console.warn(err));
    }, 60);

    return resultatRendu;
}

export async function autoApprendreEtEnrichirDico(texteBrut) {
    // Reste identique...
    if (!texteBrut) return;
    try {
        // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${MISTRAL_API_KEY}` 
            },
            body: JSON.stringify({ 
                model: "mistral-large-latest", 
                response_format: { type: "json_object" }, 
                messages: [
                    {
                        role: "system",
                        content: `Tu es un analyseur syntaxique JDR félé. Extrais le lexique strict d'action du texte sous format JSON avec exactement un tableau :\n- "actions" : Verbes à la 3e personne, mouvements physiques, anatomies felines (pattes, queue, griffes, babines, regard, oreilles, larmes, sanglots).\n\nFormat attendu:\n{\n  "actions": []\n}`
                    },
                    { role: "user", content: texteBrut }
                ]
            })
        });

        const data = await response.json();
        const jsonContent = JSON.parse(data.choices[0].message.content);

        if (jsonContent.actions && jsonContent.actions.length > 0) {
            jsonContent.actions.forEach(mot => {
                const motNet = mot.toLowerCase().trim();
                if (!dictionnaireActionsCache.includes(motNet)) {
                    dictionnaireActionsCache.push(motNet);
                }
            });

            const dicoRef = doc(db, "dictionnaires", "rpg_feline");
            await updateDoc(dicoRef, {
                actions: arrayUnion(...jsonContent.actions)
            });
        }
    } catch (e) {
        console.error("❌ [Apprentissage] Échec de l'enrichissement :", e);
    }
}