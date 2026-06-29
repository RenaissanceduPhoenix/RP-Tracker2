import { db } from '../Firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT";  
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/**
 * 🚫 BLACKLIST DES RELATIONS (ANTI-FANTÔMES)
 * Ajoute ici les noms des personnages morts, PNJ supprimés ou venus d'autres serveurs.
 * Le script les effacera automatiquement des fiches de relations.
 */
const PERSONNAGES_BANNIS = [
    "Pelage des Sables", 
    "Racine de Pissenlit",
    // Mets ici le nom exact du personnage que tu as dû dégager à la main
];

/**
 * 🗺️ DICTIONNAIRE DE CORRESPONDANCE DES DOCUMENTS FIRESTORE
 * Permet de lier le nom du personnage dans le RP à l'ID exact de son document Firestore.
 * Si un personnage a le même nom en RP et sur son doc, pas besoin de l'ajouter ici.
 */
const CORRESPONDANCE_DOCUMENTS = {
    "Nuage de Lynx": "Frasques du Lynx",
    // Tu pourras ajouter d'autres exceptions ici si besoin, ex:
    // "Nom En Jeu": "Nom_Fiche_Firestore"
};

/**
 * 🛠️ Récupère l'ID réel du document Firestore pour un personnage donné
 */
function obtenirIdDocumentFirestore(charName) {
    return CORRESPONDANCE_DOCUMENTS[charName] || charName;
}

/**
 * 📚 CAPTURE L'INTÉGRALITÉ TEXTUELLE DU SERVEUR SANS AUCUN FILTRE
 */
async function extraireHistoriqueCompletContenu(charName) {
    let tousLesPosts = [];
    
    try {
        console.log(`📡 [Aspiration] Récupération globale pour ${charName}...`);

        const snapReceived = await getDocs(collection(db, "rps_received"));
        snapReceived.forEach(docSnap => {
            const data = docSnap.data();
            const dateTri = data.createdAt?.seconds || data.timestamp?.seconds || data.date?.seconds || 0;
            if (data.content) {
                tousLesPosts.push({
                    type: `Archive Reçue [Titre: ${data.title || 'Sans titre'} | Contexte: ${data.character || 'Général'}]`,
                    texte: data.content,
                    date: dateTri
                });
            }
        });
        
        const snapSent = await getDocs(collection(db, "rps_sent"));
        snapSent.forEach(docSnap => {
            const data = docSnap.data();
            const dateTri = data.createdAt?.seconds || data.timestamp?.seconds || data.date?.seconds || 0;
            if (data.content) {
                tousLesPosts.push({
                    type: `Archive Envoyée [Titre: ${data.title || 'Sans titre'} | Auteur: ${data.character || 'Inconnu'}]`,
                    texte: data.content,
                    date: dateTri
                });
            }
        });

        const snapPending = await getDocs(collection(db, "rps_pending"));
        snapPending.forEach(docSnap => {
            const data = docSnap.data();
            const dateTri = data.createdAt?.seconds || data.timestamp?.seconds || data.date?.seconds || 0;
            if (data.content) {
                tousLesPosts.push({
                    type: `Fil Actif du Tableau [Titre: ${data.title || 'Sans Titre'} | Salon: ${data.server || 'Général'}]`,
                    texte: data.content,
                    date: dateTri
                });
            }
        });
        
        tousLesPosts.sort((a, b) => a.date - b.date);
        
        let historiqueTexte = `=== ANNALES CHRONOLOGIQUES POUR L'ANALYSE UNIQUE DE : ${charName} ===\n`;
        historiqueTexte += `CONSIGNE : Analyse uniquement les actions, états et interactions de ${charName}.\n\n`;
        
        tousLesPosts.forEach((post, index) => {
            historiqueTexte += `[CHRONIQUE N°${index + 1} - ${post.type}]\n`;
            historiqueTexte += `${post.texte}\n`;
            historiqueTexte += `---------------------------------------------------------------------------\n\n`;
        });
        
        return historiqueTexte;
        
    } catch (err) {
        console.error(`❌ Erreur lors de l'aspiration des chroniques :`, err);
        return "";
    }
}

/**
 * 🧠 MISTRAL LARGE - COMPILATION PSYCHOLOGIQUE SANS BRIDE
 */
/**
 * 🧠 MISTRAL LARGE - VERSION CORRIGÉE : RÉDACTION LITTÉRAIRE ET SANS RETOURS À LA LIGNE INTEMPÉSTIFS
 */
async function compilerHistoriqueAvecIA(charName, historiqueGlobal, memoireActuelle = "") {
    if (!historiqueGlobal || historiqueGlobal.trim() === "") return null;

    try {
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
                        content: `Tu es l'Archiveur Sacré d'un JDR littéraire de haute qualité. Ta mission est d'extraire l'évolution factuelle complète du personnage demandé à partir des textes historiques fournis.

Tu dois impérativement renvoyer cette structure JSON exacte :
{
  "evolution": {
    "evenements_marquants": [
      "Fait historique 1",
      "Ajoute autant d'événements que nécessaire. TU AS L'INTERDICTION DE LIMITER CET ARRAY. S'il y a 10, 15 ou 20 événements importants ou discours dans l'historique, liste-les TOUS de manière chronologique."
    ],
    "etat_physique": "Statut corporel déduit de manière certaine (ex: Début de gestation, fatigue physique suite aux discours, blessures)",
    "humeur_generale": "Psychologie intime, fierté, stress ou endurcissement suite aux événements"
  },
  "relations": {
    "NomDuPerso1": "Analyse du lien (Max 1 ou 2 phrases fluides).",
    "NomDuPerso2": "Analyse du lien (Max 1 ou 2 phrases fluides)."
  }
}

⚠️ DIRECTIVES DE RÉDACTION ULTRA-STRICTES (ANTI-HACHAGE) :
1. PAS DE RETOURS À LA LIGNE : Chaque élément de texte (chaque chaîne dans 'evenements_marquants', 'etat_physique', 'humeur_generale' ou les valeurs de 'relations') doit être écrit sur UNE SEULE ET UNIQUE LIGNE CONTINUE. Il est formellement interdit d'insérer des caractères de retour à la ligne (\\n) à l'intérieur d'une phrase. Une idée = une ligne droite.
2. RESPECT DES DIALOGUES ET DE LA PONCTUATION : Si tu cites un échange, conserve précieusement l'esthétique littéraire : garde les points de suspension (...) pour marquer les hésitations ou les silences, respecte les guillemets ou les tirets de dialogue, et ne tronque pas les expressions.
3. COMPACTE LES RELATIONS : Limite-toi uniquement aux 3 ou 4 personnages MAJEURS avec qui ${charName} interagit ou a un lien fort (ex: Ombre Audacieuse, Court Pensée). Rend le texte fluide, sans coupures mécaniques.
4. SÉCURITÉ : N'invente jamais de liens de parenté imaginaires (ex: Étincelle n'est pas la sœur de Lynx). Analyse uniquement ce qui concerne directement ${charName} de façon factuelle.`
                    },
                    {
                        role: "user",
                        content: `MÉMOIRE ANCIENNE DE SÉCURITÉ : ${JSON.stringify(memoireActuelle)}
                        
                        FRESQUE TEXTUELLE CHRONOLOGIQUE :
                        ${historiqueGlobal}`
                    }
                ],
                temperature: 0.0 // Maintient une structure logique stricte
            })
        });

        if (!response.ok) throw new Error("Erreur de l'API Mistral.");
        const resData = await response.json();
        return JSON.parse(resData.choices[0].message.content);

    } catch (err) {
        console.error(`❌ Erreur d'analyse IA pour ${charName}:`, err);
        return null;
    }
}
/**
 * 🚀 ACTIONNÉ VIA LE BOUTON DANS LA MODALE CO-WRITE
 */
/**
 * 🚀 ACTIONNÉ VIA LE BOUTON DANS LA MODALE CO-WRITE
 */
export async function executerConsidolationTotaleMemoire() {
    const charName = window.currentActiveCharName;
    if (!charName) return;

    const firestoreDocId = obtenirIdDocumentFirestore(charName);
    console.log(`⚡ [Chroniqueur] Rectification lancée pour en jeu: "${charName}" -> Firestore: "${firestoreDocId}"`);
    
    try {
        const docRef = doc(db, "characters", firestoreDocId);
        const snap = await getDoc(docRef);
        const currentData = snap.exists() ? snap.data() : {};

        const historiqueGlobal = await extraireHistoriqueCompletContenu(charName);
        const miseAJourProfonde = await compilerHistoriqueAvecIA(charName, historiqueGlobal, currentData.evolution || {});
        
        if (miseAJourProfonde) {
            
            // 🌟 TRI CHRONOLOGIQUE AUTOMATIQUE DU TABLEAU DES ÉVÉNEMENTS
            if (miseAJourProfonde.evolution && miseAJourProfonde.evolution.evenements_marquants) {
                miseAJourProfonde.evolution.evenements_marquants.sort((a, b) => {
                    // On extrait le premier nombre trouvé après "POST N°" ou juste le nombre dans la phrase
                    const matchA = a.match(/POST N°\s*(\d+)/i) || a.match(/(\d+)/);
                    const matchB = b.match(/POST N°\s*(\d+)/i) || b.match(/(\d+)/);
                    
                    const numA = matchA ? parseInt(matchA[1], 10) : 0;
                    const numB = matchB ? parseInt(matchB[1], 10) : 0;
                    
                    return numA - numB; // Trie du plus petit numéro de post au plus grand
                });
            }

            // 🌟 NETTOYAGE DES RELATIONS (Supprime les fantômes et les hors-sujets)
if (miseAJourProfonde.relations) {
    for (const nom of Object.keys(miseAJourProfonde.relations)) {
        if (PERSONNAGES_BANNIS.includes(nom)) {
            console.log(`🧹 [Nettoyage] Suppression automatique de la relation bannie : ${nom}`);
            delete miseAJourProfonde.relations[nom];
        }
    }
}

            // Sauvegarde dans le bon document Firestore avec le tableau parfaitement ordonné
            await updateDoc(docRef, {
                evolution: miseAJourProfonde.evolution || {},
                relations: miseAJourProfonde.relations || {}
            });
            
            console.log(`✅ [Mémoire Globale] Enregistrement chronologique réussi dans "${firestoreDocId}" !`);
            alert(`🧠 La mémoire globale de ${charName} a été synchronisée et rangée par ordre chronologique dans sa fiche !`);
        }
    } catch(e) {
        console.error("Erreur lors de la sauvegarde ciblée :", e);
    }
}
window.executerConsidolationTotaleMemoire = executerConsidolationTotaleMemoire;