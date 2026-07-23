// ADMIN/admin-logic.js
import { db } from '../JavaScript/Firebase.js'; 
import { catBehaviorKnowledge } from '../JavaScript/FeaturesBonus/CatBehaviorData.js?v=2'; 
import { doc, collection, getDocs, getDoc, getCountFromServer, query, orderBy, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 📦 CACHE LOCAL
let cacheTousLesRps = [];
let cacheTousLesPersonnages = [];
let cacheEstCharge = false;

let dictionnaireActionsCache = [];
let dictionnaireDialoguesCache = [];

async function chargerArsenalDictionnaire() {
    try {
        // 🎯 Étape 1 : Cibler la collection globale des dictionnaires
        const collectionDicoRef = collection(db, "dictionnaires");
        
        // 🚀 La fonction miracle : Demande au serveur de compter à notre place
        const snapshotCompte = await getCountFromServer(collectionDicoRef);
        const totalDocuments = snapshotCompte.data().count;
        
        logConsoleRobot(`📊 [Robot.js] Nombre de documents dictionnaires trouvés sur Firebase : ${totalDocuments}`);

        // 🎯 Étape 2 : Récupérer le document spécifique pour hydrater ton cache local
        const dicoRef = doc(db, "dictionnaires", "rpg_feline");
        const docSnap = await getDoc(dicoRef);
        
        let totalMotsAction = 0;
        let totalMotsDialogues = 0;
        if (docSnap.exists() && docSnap.data().actions) {
            const actionsFirebase = docSnap.data().actions;

        
            
            // Calcul du total des mots présents dans ce dictionnaire spécifique
            totalMotsAction = actionsFirebase.length;
            logConsoleRobot(`📚 [Robot.js] Arsenal Firebase connecté ! ${totalMotsAction} mots d'actions détectés.`);
            
            // Injection propre dans ton cache local
            actionsFirebase.forEach(mot => {
                const motNet = mot.toLowerCase().trim();
                if (motNet && !dictionnaireActionsCache.includes(motNet)) {
                    dictionnaireActionsCache.push(motNet);
                }
            });
        }

        if (docSnap.exists() && docSnap.data().dialogues) {
            const dialoguesFirebase = docSnap.data().dialogues;
            totalMotsDialogues = dialoguesFirebase.length;
            logConsoleRobot(`📚 [Robot.js] Arsenal Firebase connecté ! ${totalMotsDialogues} mots de dialogues détectés.`)

            dialoguesFirebase.forEach(mot => {
                const motNetDialogues = mot.toLowerCase().trim();
                if (motNetDialogues && !dictionnaireDialoguesCache.includes(motNetDialogues)) {
                    dictionnaireDialoguesCache.push(motNetDialogues)
                }
            })
        }


        // Si tu as aussi ton dictionnaire local "catBehaviorKnowledge" chargé en parallèle :
        let totalMotsLocaux = 0;
        if (typeof catBehaviorKnowledge === 'object') {
            for (const cat in catBehaviorKnowledge) {
                totalMotsLocaux += Object.keys(catBehaviorKnowledge[cat]).length;
            }
        }

        // Affichage du grand total cumulé (Firebase + Code Local) dans ta console
        logConsoleRobot(`📈 [STATS ARSENAL] Total global : ${totalMotsAction + totalMotsLocaux + totalMotsDialogues} mots disponibles (${totalMotsAction} d'actions en ligne, ${totalMotsLocaux} d'actions locales et ${totalMotsDialogues} de dialogues en ligne).`);
        const Total = totalMotsAction + totalMotsLocaux + totalMotsDialogues;
        document.getElementById('admin-stat-total-mots').innerText = Total || "2282";
        document.getElementById('admin-stat-total-dialogues').innerText = `${totalMotsDialogues}`;
        document.getElementById('admin-stat-total-locaux').innerText = `${totalMotsLocaux}`;
        document.getElementById('admin-stat-total-ligne').innerText = `${totalMotsAction}`;
        document.getElementById('admin-stat-total-users').innerText = "1";
    } catch (error) {
        console.error("❌ [Robot.js] Impossible de charger ou de compter l'arsenal d'actions :", error);
    }
}


/**
 * 🚀 Initialisation du tableau de bord
 */
export async function initialiserDashboardAdmin() {
    console.log("📊 [Admin Logique] Initialisation du tableau de bord...");

    document.getElementById('btn-rafraichir-stats')?.addEventListener('click', async () => {
        await synchroniserEtChargerTout(true);
    });
    
    document.getElementById('btn-admin-clear-logs')?.addEventListener('click', purgerConsoleRobot);
    document.getElementById('admin-search-input')?.addEventListener('input', filtrerEtTrierTableauLocal);
    document.getElementById('admin-filter-select')?.addEventListener('change', filtrerEtTrierTableauLocal);

    await synchroniserEtChargerTout(false);
}

/**
 * 📡 Synchronisation avec Firebase
 */
async function synchroniserEtChargerTout(forcerMiseAJour = false) {
    const btnText = document.getElementById('btn-rafraichir-stats');
    if (btnText) btnText.innerText = "⚡ Aspiration des données...";

    try {
        const rpsCollection = collection(db, "rps_received");
        const charsCollection = collection(db, "characters");

        const [snapCountRps, snapCountChars] = await Promise.all([
            getCountFromServer(rpsCollection),
            getCountFromServer(charsCollection)
        ]);

        document.getElementById('admin-stat-total-personnages').innerText = snapCountChars.data().count;
        document.getElementById('admin-stat-total-messages').innerText = snapCountRps.data().count;

        chargerArsenalDictionnaire()

        if (!cacheEstCharge || forcerMiseAJour) {
            logConsoleRobot("[FIREBASE] Aspiration complète des tables en cours...");
            
            const [snapshotRps, snapshotChars] = await Promise.all([
                getDocs(rpsCollection),
                getDocs(charsCollection)
            ]);

            cacheTousLesRps = [];
            snapshotRps.forEach(docSnap => { cacheTousLesRps.push({ id: docSnap.id, ...docSnap.data() }); });

            cacheTousLesPersonnages = [];
            snapshotChars.forEach(docSnap => { cacheTousLesPersonnages.push({ id: docSnap.id, ...docSnap.data() }); });

            cacheEstCharge = true;
            logConsoleRobot(`[CACHE] Stockage local réussi : ${cacheTousLesRps.length} RPs et ${cacheTousLesPersonnages.length} Personnages mémorisés.`);
        } else {
            logConsoleRobot("[CACHE] Utilisation des données locales (0 requêtes Firebase).");
        }

        filtrerEtTrierTableauLocal();

    } catch (error) {
        console.error("❌ Échec Admin :", error);
        logConsoleRobot(`[ERROR] Panne de flux : ${error.message}`);
    } finally {
        if (btnText) btnText.innerText = "🔄 Synchroniser Firebase";
    }
}

/**
 * 🔍 TRI ET FILTRAGE EN MÉMOIRE
 */
function filtrerEtTrierTableauLocal() {
    const tbody = document.getElementById('admin-tbody-data-list');
    if (!tbody) return;

    const filtreCollection = document.getElementById('admin-filter-select')?.value || 'all';
    const rechercheTexte = document.getElementById('admin-search-input')?.value.toLowerCase().trim() || '';

    let donneesFiltrees = [];

    if (filtreCollection === 'all' || filtreCollection === 'rps') {
        donneesFiltrees = donneesFiltrees.concat(
            cacheTousLesRps.map(rp => ({ ...rp, typeDocument: 'Fil de RP', couleurType: '#a777e3' }))
        );
    }
    if (filtreCollection === 'all' || filtreCollection === 'characters') {
        donneesFiltrees = donneesFiltrees.concat(
            cacheTousLesPersonnages.map(char => ({ ...char, typeDocument: 'Personnage', couleurType: '#ffcc00' }))
        );
    }

    if (rechercheTexte !== '') {
        donneesFiltrees = donneesFiltrees.filter(item => {
            const idMatch = item.id.toLowerCase().includes(rechercheTexte);
            const titreMatch = item.title ? item.title.toLowerCase().includes(rechercheTexte) : false;
            const statutMatch = item.status ? item.status.toLowerCase().includes(rechercheTexte) : false;
            return idMatch || titreMatch || statutMatch;
        });
    }

    donneesFiltrees.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.id.localeCompare(b.id);
    });

    if (donneesFiltrees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px; font-style: italic;">Aucune entité ne correspond à la recherche.</td></tr>`;
        return;
    }

    let htmlLignes = "";
    donneesFiltrees.forEach(item => {
        const dateAffichage = item.updatedAt?.toMillis 
            ? new Date(item.updatedAt.toMillis()).toLocaleString() 
            : (item.typeDocument === 'Personnage' ? 'Statique (Fiche)' : 'Non spécifiée');

        const statutDoc = item.status || (item.typeDocument === 'Personnage' ? 'Actif' : 'pending');
        const couleurStatut = statutDoc === 'pending' ? '#ff4a4a' : '#2ecc71';
        const labelAffichage = item.title ? `${item.id.substring(0, 8)}... (${item.title})` : item.id;

        // 📥 Génération conditionnelle du bouton de téléchargement JSON si c'est un Personnage
        let boutonExportJson = "";
        if (item.typeDocument === 'Personnage') {
            boutonExportJson = `<button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8rem; margin: 0 4px 0 0; background: rgba(255, 204, 0, 0.1); border: 1px solid #ffcc00; color: #ffcc00;" onclick="window.exporterPersonnageEnJson('${item.id}')">📥 Extraire JSON</button>`;
        }

        htmlLignes += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                <td style="padding: 12px 16px; color: #fff;">${labelAffichage}</td>
                <td style="padding: 12px 16px; color: ${item.couleurType}; font-weight: 500;">📄 ${item.typeDocument}</td>
                <td style="padding: 12px 16px; color: #888;">${dateAffichage}</td>
                <td style="padding: 12px 16px;"><span style="color: ${couleurStatut}; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid ${couleurStatut}33;">${statutDoc}</span></td>
                <td style="padding: 12px 16px; text-align: right;">
                    ${boutonExportJson}
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8rem; margin: 0; background: rgba(255,255,255,0.03);" onclick="alert('Inspection ID : ${item.id}\\nStatut : ${statutDoc}')">Inspecter</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlLignes;
}

/**
 * 📦 FONCTION TECHNIQUE FINALE : Extraction Contextuelle Totale (Fiche, Mémoire Structurée & Dialogues)
 * @param {string} characterId L'identifiant/Nom du personnage à packager
 */
window.exporterPersonnageEnJson = async function(characterId) {
    logConsoleRobot(`📦 [Export Royal] Extraction complète demandée pour : ${characterId}`);
    
    // Importation dynamique de doc et getDoc pour l'aspiration fraîche
    const { doc, getDoc, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    // 1. Trouver la fiche du personnage dans le cache local
    const fichePersoBrute = cacheTousLesPersonnages.find(c => c.id === characterId);
    if (!fichePersoBrute) {
        alert(`❌ Impossible de trouver la fiche locale pour : ${characterId}`);
        return;
    }

    const profilFormate = {
        id: fichePersoBrute.id,
        evolution: {
            etat_physique: fichePersoBrute.evolution?.etat_physique || "",
            evenements_marquants: fichePersoBrute.evolution?.evenements_marquants || [],
            humeur_generale: fichePersoBrute.evolution?.humeur_generale || ""
        },
        level: fichePersoBrute.level || 0,
        relations: fichePersoBrute.relations || {},
        xp: fichePersoBrute.xp || 0
    };

    logConsoleRobot(`[SYSTEM] Début de l'aspiration en direct depuis Firestore pour ${characterId}...`);

    // 2. Filtrer tous les RPs associés dans le cache local pour obtenir les IDs
    const nomCible = characterId.toLowerCase().trim();
    const sansAccent = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
    const nomCibleNettoye = sansAccent(nomCible);

    const rpsCibles = cacheTousLesRps.filter(rp => {
        const personnageChamp = rp.character ? rp.character.toLowerCase().trim() : "";
        return personnageChamp === nomCible || sansAccent(personnageChamp) === nomCibleNettoye;
    });

    const listeRpsAvecDialogues = [];

    // 3. Boucler en allant chercher la donnée FRAICHE sur le serveur
    for (const rpMinime of rpsCibles) {
        try {
            // 🔥 FORCE LIVE FETCH: On télécharge le document complet pour récupérer "memoire_structuree" à coup sûr
            const docRef = doc(db, "rps_pending", rpMinime.id);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) continue;
            const rp = docSnap.data();
            rp.id = docSnap.id; // Garder l'ID

            // 🎯 Accès à la sous-collection "messages"
            const sousCollectionMessagesRef = collection(db, "rps_pending", rp.id, "messages");
            const snapshotMessages = await getDocs(sousCollectionMessagesRef);

            let historiqueDialoguesNettoyes = [];
            
            if (snapshotMessages && !snapshotMessages.empty) {
                snapshotMessages.forEach(docMsg => {
                    const msgData = docMsg.data();
                    
                    // On extrait le texte depuis 'text' (ton champ exact) ou 'content' par sécurité
                    const corpsTexte = msgData.text || msgData.content || "";
                    
                    // 🛑 FILTRE DES DÉS
                    const estUnLancerDeDes = msgData.type === 'dice' || 
                                             corpsTexte.includes("🎲") || 
                                             corpsTexte.includes("Résultat :");

                    if (!estUnLancerDeDes) {
                        const timestampBrut = msgData.createdAt?.toMillis 
                            ? msgData.createdAt.toMillis() 
                            : (msgData.createdAt?.seconds ? msgData.createdAt.seconds * 1000 : 0);

                        historiqueDialoguesNettoyes.push({
                            auteur: msgData.sender || "Inconnu",
                            texte: corpsTexte,
                            dateStr: msgData.createdAt?.toMillis ? new Date(msgData.createdAt.toMillis()).toLocaleString() : "Date inconnue",
                            _triTime: timestampBrut
                        });
                    }
                });

                // ⏳ TRI CHRONOLOGIQUE LOCAL
                historiqueDialoguesNettoyes.sort((a, b) => a._triTime - b._triTime);
                historiqueDialoguesNettoyes = historiqueDialoguesNettoyes.map(({ _triTime, ...reste }) => reste);
            }

            // Construction de la structure fidèle à ton arborescence Firestore
            listeRpsAvecDialogues.push({
                rpId: rp.id,
                titre: rp.title || "Sans titre",
                statut: rp.status || "pending",
                derniereMiseAJour: rp.lastUpdated?.toMillis 
                    ? new Date(rp.lastUpdated.toMillis()).toLocaleString() 
                    : "Non spécifiée",
                
                memoireModal: {
                    character: rp.character || characterId,
                    derniereSyntheseAutomatique: rp.derniereSyntheseAutomatique || null,
                    memoire_structuree: rp.memoire_structuree || {},
                    memoire_clan: rp.memoire_clan || {},
                    memoire_rp: rp.memoire_rp || {},
                    memoire_scene: rp.memoire_scene || {}
                },
                
                historiqueDialogues: historiqueDialoguesNettoyes
            });

        } catch (errSub) {
            console.warn(`⚠️ Impossible de lire les données Firestore pour le RP ${rpMinime.id}:`, errSub);
        }
    }

    // 4. Assemblage du Package final
    const packageDonnees = {
        exportMetadata: {
            application: "RP Tracker PRO",
            versionExport: "5.1.0 (Live Firebase Aspiration)",
            dateExport: new Date().toISOString(),
            personnageCible: characterId,
            totalRpsAnalyses: listeRpsAvecDialogues.length
        },
        profil: profilFormate,
        filsDeDiscussion: listeRpsAvecDialogues
    };

    // 5. Téléchargement du fichier
    try {
        const chaineJson = JSON.stringify(packageDonnees, null, 4);
        const blob = new Blob([chaineJson], { type: "application/json" });
        const urlBlob = URL.createObjectURL(blob);
        
        const linkExporte = document.createElement('a');
        linkExporte.href = urlBlob;
        linkExporte.download = `CONTEXTE_COMPLET_${characterId.replace(/\s+/g, '_')}.json`;
        
        document.body.appendChild(linkExporte);
        linkExporte.click();
        document.body.removeChild(linkExporte);
        URL.revokeObjectURL(urlBlob);

        logConsoleRobot(`[SUCCESS] Extraction Firebase Live réussie pour ${characterId}.`);
    } catch (err) {
        console.error("Erreur lors de la sérialisation :", err);
    }
};

/**
 * 🤖 Consoles & Logs utilitaires
 */
function logConsoleRobot(message) {
    const consoleDiv = document.getElementById('admin-robot-console');
    if (!consoleDiv) return;
    const horodatage = new Date().toLocaleTimeString();
    consoleDiv.innerHTML += `<br>[${horodatage}] ${message}`;
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function purgerConsoleRobot() {
    const consoleDiv = document.getElementById('admin-robot-console');
    if (consoleDiv) consoleDiv.innerHTML = `[SYSTEM] Terminal purgé. En attente...`;
}



const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT";

// Écouteur sur le bouton de fichier
document.getElementById('admin-input-verbs-json')?.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    logConsoleRobot("⏳ Début du traitement du fichier verbs.json...");
    
    const lecteur = new FileReader();
    lecteur.onload = async (e) => {
        try {
            const donneesBrutes = JSON.parse(e.target.result);
            
            // Aplatir tous les groupes en une seule liste de verbes à l'infinitif
            const tousLesVerbes = [
                ...(donneesBrutes.verbs?.first_group || []),
                ...(donneesBrutes.verbs?.second_group || []),
                ...(donneesBrutes.verbs?.third_group || [])
            ];
            
            logConsoleRobot(`📦 Fichier chargé : ${tousLesVerbes.length} verbes détectés.`);
            
            await trierConjuguerEtInjecterSecurise(tousLesVerbes);
            
        } catch (err) {
            logConsoleRobot(`❌ Erreur lors de la lecture du JSON : ${err.message}`);
        }
    };
    lecteur.readAsText(file);
});


// 🕒 Petite fonction utilitaire pour forcer une pause
const attendre = ms => new Promise(resolve => setTimeout(resolve, ms));

async function trierConjuguerEtInjecterSecurise(listeInfinitifs) {
    try {
        let infinitifsParoleGlobaux = [];
        const tailleMorceauIA = 100;
        
        for (let i = 0; i < listeInfinitifs.length; i += tailleMorceauIA) {
            const morceauVerbes = listeInfinitifs.slice(i, i + tailleMorceauIA);
            
            logConsoleRobot(`🧠 [Codestral] Analyse : Mots ${i} à ${Math.min(i + tailleMorceauIA, listeInfinitifs.length)} / ${listeInfinitifs.length}...`);

            const promptMistral = `Tu es un assistant expert en linguistique française. Voici une liste de verbes : ${JSON.stringify(morceauVerbes)}.
            Extrais UNIQUEMENT les verbes qui servent de verbes de parole, de dialogue ou d'incises de narration (exemples: dire, feuler, murmurer, crier, répliquer, s'exclamer, grommeler, assurer, etc.). Ignore totalement tous les autres verbes d'action pure.
            
            CRITICAL REQUIREMENT: Renvoie un objet JSON contenant une propriété qui est un tableau de chaînes de caractères, exemple: {"verbes_de_parole": ["dire", "répliquer"]}. Ne mets aucun texte explicatif avant ou après, pas de markdown (pas de blocs \`\`\`json).`;

            const reponseMistral = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${MISTRAL_API_KEY}`
                },
                body: JSON.stringify({
                    model: "codestral-latest", 
                    messages: [{ role: "user", content: promptMistral }],
                    temperature: 0,
                    response_format: { type: "json_object" }
                })
            });

            const resultatJson = await reponseMistral.json();
            let texteReponse = resultatJson.choices[0].message.content.trim();
            
            try {
                let objetJson = JSON.parse(texteReponse);
                
                // 🎯 Extraction intelligente : On cherche n'importe quel tableau caché dans l'objet de Codestral
                let extraits = [];
                if (Array.isArray(objetJson)) {
                    extraits = objetJson;
                } else if (typeof objetJson === 'object' && objetJson !== null) {
                    const cleTableau = Object.keys(objetJson).find(k => Array.isArray(objetJson[k]));
                    if (cleTableau) {
                        extraits = objetJson[cleTableau];
                    }
                }

                if (extraits.length > 0) {
                    infinitifsParoleGlobaux.push(...extraits);
                }
            } catch (e) {
                logConsoleRobot(`⚠️ Échec de parsing JSON sur ce paquet de 100.`);
            }

            await attendre(300); // Micro-pause de sécurité
        }
        
        logConsoleRobot(`✨ Analyse Codestral achevée. Total de ${infinitifsParoleGlobaux.length} verbes de parole isolés.`);

        // --- 2ÈME ÉTAPE : CONJUGAISON AUTOMATIQUE À LA 3ÈME DU SINGULIER ---
        logConsoleRobot("⚙️ Conjugaison géométrique aux temps du JDR (Infinitif + Présent, Imparfait, Passé Simple)...");
        
        function genererConjugaisons(verbe) {
            let formes = [verbe]; 
            const estPronominal = verbe.startsWith("s'") || verbe.startsWith("se ");
            const verbeNet = verbe.replace(/^s'|^se /, "").trim().toLowerCase();

            if (verbeNet.endsWith("er")) {
                const radical = verbeNet.slice(0, -2);
                const radicalC = radical.endsWith("c") ? radical.slice(0, -1) + "ç" : radical;
                
                const radicalG_Imparfait = radical.endsWith("g") ? radical + "e" : radical;
                const radicalG_PasseSimple = radical.endsWith("g") ? radical + "e" : radicalC;

                formes.push(radical + "e", radicalG_Imparfait + "ait", radicalG_PasseSimple + "a");
            }
            else if (verbeNet.endsWith("ir") && !verbeNet.endsWith("ouvrir") && !verbeNet.endsWith("courir")) {
                const radical = verbeNet.slice(0, -2);
                formes.push(radical + "it", radical + "issait", radical + "it");
            }
            else {
                if (verbeNet === "dire") formes.push("dit", "disait");
                else if (verbeNet === "répondre") formes.push("répond", "répondait", "répondit");
                else if (verbeNet === "reprendre") formes.push("reprend", "reprenait", "reprit");
            }

            if (estPronominal) {
                const pronom = verbe.startsWith("s'") ? "s'" : "se ";
                formes = formes.map((f, idx) => idx === 0 ? f : `${pronom}${f}`);
            }
            return formes;
        }

        // Dédoublonnage Dialogues
        let motsParoleFinaux = [];
        infinitifsParoleGlobaux.forEach(v => motsParoleFinaux.push(...genererConjugaisons(v)));
        motsParoleFinaux = [...new Set(motsParoleFinaux.map(m => m.trim().toLowerCase()))];

        // Isolation mécanique du Reste (Actions)
        logConsoleRobot("⚔️ Tri automatique de l'arsenal restant pour la section Actions...");
        const infinitifsActions = listeInfinitifs.filter(v => !infinitifsParoleGlobaux.includes(v));
        
        let motsActionsFinaux = [];
        infinitifsActions.forEach(v => motsActionsFinaux.push(...genererConjugaisons(v)));
        motsActionsFinaux = [...new Set(motsActionsFinaux.map(m => m.trim().toLowerCase()))];

        // --- 3ÈME ÉTAPE : SAUVEGARDE FIREBASE ---
        logConsoleRobot("🛰️ Transmission des dialogues vers Firebase...");
        const docRef = doc(db, "dictionnaires", "rpg_feline");

        if (motsParoleFinaux.length > 0) {
            await updateDoc(docRef, {
                dialogues: arrayUnion(...motsParoleFinaux)
            });
            logConsoleRobot(`✅ Dictionnaire Dialogues mis à jour (+${motsParoleFinaux.length} formes).`);
        } else {
            logConsoleRobot(`ℹ️ Aucun verbe de parole à injecter.`);
        }

        logConsoleRobot("🛰️ Transmission des actions vers Firebase (par paquets de 400)...");
        const taillePaquetFirebase = 400;
        for (let i = 0; i < motsActionsFinaux.length; i += taillePaquetFirebase) {
            const paquet = motsActionsFinaux.slice(i, i + taillePaquetFirebase);
            await updateDoc(docRef, {
                actions: arrayUnion(...paquet)
            });
        }
        
        logConsoleRobot(`🏆 TRANSFORMATION DU DICTIONNAIRE TERMINÉE ! +${motsActionsFinaux.length} formes injectées dans Actions.`);

    } catch (error) {
        logConsoleRobot(`❌ Défaillance lors du script : ${error.message}`);
        console.error(error);
    }
}

window.mettreAJourStatsAdmin = () => synchroniserEtChargerTout(false);