/**
 * 🛰️ MODULE DE MÉMOIRE HIÉRARCHIQUE HYBRIDE (Firestore & Mistral API)
 * Système d'organisation autonome de la mémoire de contexte RP toutes les 5 répliques.
 */

import { db } from '../Firebase.js'; // Ajuste selon ton architecture Firebase
import { collection, doc, getDocs, query, updateDoc, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';


const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; // Idéalement récupérée de manière sécurisée ou depuis tes constantes

export async function initialiserEtTraiterMemoiresManquantes() {
    console.log("%c🧠 [Mémoire] Scan des salons en attente de résumé...", "color: #9b59b6; font-weight: bold;");
    try {
        const rpRef = collection(db, "rps_pending"); 
        const querySnapshot = await getDocs(query(rpRef));
        
        let documentsATraiter = [];
        
        // 🔄 1. On boucle sur tous les salons principaux
        for (const salonDoc of querySnapshot.docs) {
            const data = salonDoc.data();
            
            // On vérifie si ce salon n'a pas encore sa mémoire structurée
            if (!data.memoire_structuree) {
                
               // 🔍 ANATOMIE DE LA SOUS-COLLECTION SÉCURISÉE :
                // On pointe d'abord le document du salon, puis on cible sa sous-collection "messages"
                const salonDocRef = doc(db, "rps_pending", salonDoc.id);
                const sousCollectionMessagesRef = collection(salonDocRef, "messages");
                
                const messagesSnapshot = await getDocs(sousCollectionMessagesRef);
                
                let texteAssembleDuSalon = "";
                messagesSnapshot.forEach((msgDoc) => {
                    const msgData = msgDoc.data();
                    // On accumule tout le texte du salon (selon tes clés 'text' ou 'content')
                    let contenuMsg = msgData.text || msgData.content || "";
                    if (contenuMsg) {
                        texteAssembleDuSalon += `${contenuMsg}\n`;
                    }
                });

                // Si le salon contient du contenu textuel, on l'ajoute à notre file d'attente
                if (texteAssembleDuSalon.trim().length > 10) {
                    documentsATraiter.push({
                        id: salonDoc.id,
                        texte: texteAssembleDuSalon,
                        longueur: texteAssembleDuSalon.length
                    });
                }
            }
        }

        if (documentsATraiter.length === 0) {
            console.log("%c✅ Tous les salons possèdent une mémoire hiérarchique à jour !", "color: #2ecc71;");
            return;
        }

        // 📊 TRI PAR LONGUEUR DÉCROISSANTE (Priorité aux gros pavés)
        documentsATraiter.sort((a, b) => b.longueur - a.longueur);
        
        console.log(`🗂️ ${documentsATraiter.length} salons à résumer. Priorité au plus lourd : ID [${documentsATraiter[0].id}] (${documentsATraiter[0].longueur} caractères).`);

        // Lancement séquentiel du premier traitement
        console.log(`🔄 Lancement du traitement séquentiel pour ${documentsATraiter.length} salons...`);
        for (const docATraiter of documentsATraiter) {
            await genererEtEnregistrerMemoire(docATraiter.id, docATraiter.texte);
            // Petite pause de 5 secondes entre chaque salon pour laisser respirer l'API Mistral
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
    } catch (error) {
        console.error("Erreur lors de l'extraction des sous-collections :", error);
    }
}

/**
 * 🤖 2. GÉNÉRATION MISTRAL ET STRUCTURATION JSON (PIPELINE DUO DE CHOC)
 */
async function genererEtEnregistrerMemoire(docId, texteComplet) { 
    console.log(`🤖 Initialisation du traitement de mémoire pour : ${docId}`);
    
    let texteAAnalyser = texteComplet;

    // 🛰️ ÉTAPE 1 : PIPELINE DE SÉCURITÉ CONTEXTE (Mistral Large 3 s'occupe de la lecture de masse)
    if (texteComplet.length > 25000) {
        console.log(`⚠️ Salon très lourd (${texteComplet.length} caractères). Activation de Mistral Large 3 pour compression linéaire...`);
        try {
            const responseLarge = await fetch(MISTRAL_URL, {
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
                            content: "Tu es un compilateur de données RP ultra-précis. Compresse et résume de manière exhaustive et chronologique tout l'historique fourni. Ne perds AUCUN détail : liste toutes les actions des chats, l'état psychologique de chacun, les blessures contractées, les complots murmurés ou rumeurs de clans. Écris cela sous forme d'un journal de faits bruts extrêmement détaillé, sans fioritures littéraires, sans markdown et surtout SANS format JSON." 
                        },
                        { role: "user", content: texteComplet }
                    ],
                    temperature: 0.2
                })
            });

            if (responseLarge.ok) {
                const dataLarge = await responseLarge.json();
                texteAAnalyser = dataLarge.choices[0].message.content;
                console.log(`✅ Étape 1 réussie ! Mistral Large a condensé le salon à ${texteAAnalyser.length} caractères.`);
            } else {
                console.warn("Échec de l'étape 1 (Mistral Large), envoi direct du texte brut en mode dégradé.");
            }
        } catch (pipelineErr) {
            console.error("Erreur durant l'étape 1 du pipeline :", pipelineErr);
        }
    }
    
    // 🛰️ ÉTAPE 2 : STRUCTURATION ET RAISONNEMENT LOGIQUE (Codestral s'occupe de bâtir le JSON parfait)
    console.log("🤖 Transmission des données condensées à Codestral pour structuration JSON...");
    const promptSystem = `
Tu es l'analyste logique et le gestionnaire de mémoire vive autonome d'un univers Roleplay textuel de chats sauvages.
Ton but est d'analyser le texte condensé fourni et de le synthétiser dans un objet JSON strict.

--- DIRECTIVES LOGIQUES CRUCIALES (ANTI-PARESSE) ---
1. INTERDICTION DE COPIER-COLLER : Chaque champ et sous-champ JSON doit contenir des informations UNIQUES. Ne duplique jamais le même résumé ou la même phrase à travers plusieurs clés.
2. BANNIR LES BOUCLES GRAMMATICALES : N'utilise JAMAIS l'expression "est en train de". Privilégie le présent de l'indicatif direct (ex: "Nuage de Lynx grimpe" au lieu de "Nuage de Lynx est en train de grimper"). Varie tes verbes.
3. RIGUEUR ANALYTIQUE DES DIMENSIONS :
   - "memoire_scene" : Décrit exclusivement les actions physiques directes et immédiates observées.
   - "memoire_rp" : Identifie les enjeux de l'histoire à moyen/long terme.
   - "memoire_personnage" :
     * psychologie : Analyse l'état émotionnel interne, pas l'action en cours.
     * secrets : Déduis ce que le personnage cache, planifie en secret ou garde pour lui. Si aucun secret n'est détecté, écris "Aucun secret apparent". Ne remplace jamais par un résumé d'action !
     * blessures : Note les douleurs ou blessures physiques réelles acquises durant la scène.
   - "memoire_clan" : Analyse uniquement le macro-contexte. Quel est l'impact politique pour le Clan ? Quelles rumeurs naissent de cet événement ? (Ne décris pas l'action des chats ici, projette-toi sur les conséquences extérieures).

Organise la structure interne du JSON de manière optimisée pour TOI, mais nourris impérativement ces 4 clés de premier niveau :
{
  "memoire_scene": { ... },
  "memoire_rp": { ... },
  "memoire_personnage": { ... },
  "memoire_clan": { ... }
}

Renvoie UNIQUEMENT l'objet JSON brut. Pas de blabla, pas de commentaires, pas de balises markdown \`\`\`json.
`;

    try {
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "codestral-latest",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: promptSystem },
                    { role: "user", content: texteAAnalyser }
                ],
                temperature: 0.15
            })
        });

        if (!response.ok) throw new Error(`Erreur API Codestral: ${response.status}`);
        
        const data = await response.json();
        const memoireJSON = JSON.parse(data.choices[0].message.content);

        // 💾 SAUVEGARDE SÉCURISÉE DANS FIRESTORE
        const docRef = doc(db, "rps_pending", docId); 
        await updateDoc(docRef, {
            memoire_structuree: memoireJSON,
            derniereSyntheseAutomatique: new Date().toISOString()
        });

        console.log(`%c💾 [JSON Sauvegardé] Le pipeline a généré et injecté la mémoire hiérarchique avec succès pour ${docId} !`, "color: #2ecc71; font-weight: bold;");
        
    } catch (err) {
        console.error(`Échec de la structuration finale pour ${docId}:`, err);
        throw err; // On relance l'erreur pour la catcher dans l'interface utilisateur
    }
}

/**
 * ⏳ 3. COMPTEUR DE RÉPLIQUES (DÉCLENCHEMENT TOUS LES 5 MESSAGES)
 * À appeler à chaque fois qu'un nouveau message est envoyé sur ton site !
 */
export async function verifierDeclenchementMemoire(totalMessagesCompteur, historiqueDerniersMessages) {
    if (totalMessagesCompteur > 0 && totalMessagesCompteur % 5 === 0) {
        console.log("%c🚨 [Alerte Répliques] Seuil des 5 messages atteint ! Consolidation de la mémoire vive.", "color: #e67e22; font-weight: bold;");
        
        let texteAssemble = historiqueDerniersMessages.map(m => `[${m.auteur}]: ${m.texte}`).join("\n\n");
        await genererEtEnregistrerMemoire("scene_courante_dynamique", texteAssemble);
    }
}

/**
 * 🔄 4. EXPORT POUR BOUTON MANUEL : REÉCRIRE LA MÉMOIRE D'UNE MODALE 
 * Cette fonction est appelée directement au clic sur le bouton de ton interface.
 */
export async function reecrireMemoireModalParId(salonId, salonTexte) {
    if (!salonId || !salonTexte) {
        console.error("⚠️ [Réécriture] Impossible de lancer le traitement : ID ou texte manquant.", { salonId, salonTexte });
        alert("Erreur : Les données du salon ne sont pas chargées correctement.");
        return;
    }

    console.log(`%c🧠 [Réécriture] Relancement manuel demandé pour le salon : ${salonId}`, "color: #ffcc00; font-weight: bold;");
    
    try {
        // Exécute le pipeline complet (Nettoyage éventuel Large + Structuration Codestral + Save)
        await genererEtEnregistrerMemoire(salonId, salonTexte);
        
        alert("✨ Succès ! La mémoire de la modale a été entièrement analysée, réécrite et sauvegardée dans la base de données !");
        
        // Optionnel : Tu peux appeler ici une fonction de rafraîchissement de ton UI pour afficher le nouveau JSON direct
    } catch (error) {
        console.error("❌ [Réécriture] Échec du traitement manuel :", error);
        alert("Une erreur est survenue lors de la réécriture par l'IA. Vérifie la console.");
    }
}