import { db } from '../Firebase.js';
import { collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { catBehaviorKnowledge } from './CatBehaviorData.js?v=2';
import { fiches } from './CharacterData.js';
// 🤖 Importation du module Robot d'analyse et de nettoyage
import { nettoyerSyntaxeDialogue, autoApprendreEtEnrichirDico } from './Robot.js?v=2.1';

// =========================================================================
// ⚙️ CONFIGURATION DU BRIEFING TACTIQUE GCI
// =========================================================================
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1526293320404434946/YDNfDvCf6fu24x4SGPjT8kaXX7Y5Du-VeL0fkl5XtPx3rIdkFJGyc0C4kjGFwEvNrJ98";
const DISCORD_MY_USER_ID = "1438157204816400426"; 
const SEUIL_INACTIVITE_JOURS = 3; 

// 🧠 Configuration des modèles d'IA
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MODEL_ANALYSE = "codestral-latest";       // Parfait pour structurer le JSON initial
const MODEL_REDACTION = "mistral-large-latest"; // Ton choix parfait pour la richesse littéraire
// =========================================================================

/**
 * 🦅 ROUTINE PRINCIPALE : SCAN, ANALYSE & ULTRA-GÉNÉRATION DE BROUILLONS EN DIFFÉRÉ
 */
window.verifierInactiviteEtNotifier = async function() {
    console.log(`[📡 GCI] Lancement du radar d'inactivité global...`);
    let rpsAAnalyser = [];
    const maintenantMs = Date.now();

    try {
        // 1. Scan de la collection pour isoler les cibles en retard
        const snapshot = await getDocs(collection(db, "rps_received"));
        
        snapshot.forEach(docSnap => {
            const rp = docSnap.data();
            if (rp.status === "pending") {
                const dateDerniereActivite = rp.updatedAt?.toMillis ? rp.updatedAt.toMillis() : (rp.createdAt?.toMillis ? rp.createdAt.toMillis() : null);
                
                if (dateDerniereActivite) {
                    const joursInactifs = Math.floor((maintenantMs - dateDerniereActivite) / (1000 * 60 * 60 * 24));
                    if (joursInactifs >= SEUIL_INACTIVITE_JOURS) {
                        rpsAAnalyser.push({
                            id: docSnap.id,
                            titre: rp.title || "Sans titre",
                            jours: joursInactifs,
                            dernierTexte: rp.lastMessage || rp.lastContent || rp.text || "Aucun texte récent.",
                            personnage: rp.character || rp.activeChar || "Frasques du Lynx"
                        });
                    }
                }
            }
        });

        if (rpsAAnalyser.length === 0) {
            console.log("✨ Aucun retard de vol détecté sur les radars.");
            return;
        }

        console.log(`🧠 Étape 1 : Analyse tactique groupée pour ${rpsAAnalyser.length} RP(s)...`);
        // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 5000));
        const briefingsGCI = await genererAnalysesGCI(rpsAAnalyser);

        // 📦 TABLEAU DE STOCKAGE GLOBAL DES EMBEDS DE LA SESSION
        const fileEmbedsQueue = [];

        // 2. Traitement séquentiel RP par RP pour remplir la file d'attente
        for (const rp of rpsAAnalyser) {
            const analyseAssociee = briefingsGCI.find(b => b.titre.toLowerCase().trim() === rp.titre.toLowerCase().trim());
            if (!analyseAssociee) continue;

            console.log(`✍️ Étape 2 : Préparation de la rédaction et mise en file d'attente pour : "${rp.titre}"...`);
            
            // 🎬 STOCKAGE DU BLOC 1 : Fiche d'identification de la cible
            fileEmbedsQueue.push(creerEmbedOuverture(rp, analyseAssociee.situation));

            // 🔄 STOCKAGE DES BLOCS 2 & 3 : Boucle sur les 3 vecteurs
            const categoriesVecteurs = ["Physique", "Mental", "Viscéral"];
            
            for (let i = 0; i < 3; i++) {
                const texteExplicationVecteur = analyseAssociee.vecteurs[i] || "Option tactique d'engagement alternative.";
                
                // Préparation de l'indicateur du vecteur en cours (Bloc 2)
                fileEmbedsQueue.push(creerEmbedIndicateurVecteur(i + 1, categoriesVecteurs[i], texteExplicationVecteur));

                // Récupération de l'historique et des caractéristiques réelles pour nourrir le module d'écriture
                // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 7000));
                const contexteRP = await extraireContexteStrategique(rp.id, rp.personnage);
// ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 7000));

                // Lancement du modèle d'élite littéraire pour rédiger le brouillon brut
                // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 5000));
                const brouillonBrut = await executerRedactionEliteVecteur(rp, texteExplicationVecteur, contexteRP);
// ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 7000));

                // 🧠 AUTO-APPRENTISSAGE EN ARRIÈRE-PLAN (Texte brut à peine sorti de l'IA)
                try {
                    // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 5000));

                    autoApprendreEtEnrichirDico(brouillonBrut);
// ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 7000));
                } catch (errAutoApprendre) {
                    console.warn("⚠️ [Robot] Échec de l'auto-apprentissage en arrière-plan :", errAutoApprendre);
                }

                // 🧹 NETTOYAGE SYNTAXIQUE DU DIALOGUE AVANT EMBED
                let brouillonNettoye = brouillonBrut;
                try {
                    brouillonNettoye = nettoyerSyntaxeDialogue(brouillonBrut);
                } catch (errNettoyage) {
                    console.error("❌ [Robot] Échec du nettoyage syntaxique :", errNettoyage);
                }

                // Découpage et mise en tableau des segments rédigés (Bloc 3)
                const segmentsDeTexte = segmenterTexteParagraphes(brouillonNettoye, 3900);
                for (let indexSegment = 0; indexSegment < segmentsDeTexte.length; indexSegment++) {
                    fileEmbedsQueue.push(creerEmbedTexteBrouillon(
                        segmentsDeTexte[indexSegment], 
                        indexSegment + 1, 
                        segmentsDeTexte.length, 
                        categoriesVecteurs[i]
                    ));
                }
            }
        }

        // 🚀 ÉTAPES D'EXPÉDITION D'UN COUP
        console.log(`📤 Étape 3 : Expédition de ${fileEmbedsQueue.length} embeds vers Discord en paquets optimisés...`);
        await envoyerPaquetsEmbedsDiscord(fileEmbedsQueue);

        console.log("🎉 Opération d'interception, de rédaction et de transmission GCI achevée à 100% !");

    } catch (error) {
        console.error("💥 Panne générale du système GCI :", error);
    }
};

/**
 * 🧠 SOUS-ROUTINE : EXTRACTION ET STRUCTURE DU BRIEFING INITIAL (JSON)
 */
async function genererAnalysesGCI(listeRps) {
    const rpsBruts = listeRps.map((rp, index) => {
        return `[RP #${index + 1}]\nTitre: "${rp.titre}"\nDernier Message: "${rp.dernierTexte}"`;
    }).join("\n\n");

    const prompt = `Tu es l'officier de renseignement tactique (GCI) pour un joueur de JDR textuel.
Analyse les derniers messages reçus sur ces RPs en retard :
${rpsBruts}

Pour chaque RP, détermine la situation et les 3 vecteurs d'interception (Physique, Mental, Viscéral).
Renvoie uniquement un objet JSON contenant un tableau "briefings" :
{
  "briefings": [
    {
      "titre": "Nom exact du RP",
      "situation": "Résumé d'une seule phrase percutante de l'enjeu actuel.",
      "vecteurs": [
        "⚔️ Vecteur Physique : [Idée courte de réaction physique/mouvement]",
        "🎭 Vecteur Mental : [Idée courte de bluff/ruse/posture]",
        "🧪 Vecteur Viscéral : [Idée courte de magie/pouvoir/instinct/environnement]"
      ]
    }
  ]
}`;

    try {
        // ✨ Version corrigée, ultra-propre et fonctionnelle :
await new Promise(resolve => setTimeout(resolve, 5000));
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({
                model: MODEL_ANALYSE,
                temperature: 0,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });
        const data = await response.json();
        return JSON.parse(data.choices[0].message.content).briefings;
    } catch (err) {
        console.error("❌ Erreur d'analyse GCI, bascule sur les vecteurs par défaut.", err);
        return listeRps.map(rp => ({
            titre: rp.titre,
            situation: "Analyse tactique automatique indisponible.",
            vecteurs: ["⚔️ Vecteur Physique : Engagement direct", "🎭 Vecteur Mental : Posture d'observation", "🧪 Vecteur Viscéral : Réaction instinctive"]
        }));
    }
}

/**
 * ✍️ SOUS-ROUTINE : GENERATEUR DE TEXTE HAUTE NUANCE (MISTRAL LARGE)
 */
async function executerRedactionEliteVecteur(rp, directiveVecteur, contexte) {
    let systemPrompt = `
<CE QUE TU INCARNES>
Tu es un coach d'écriture expert et un joueur d'élite pour un forum RPG écrit basé sur l'univers de La Guerre des Clans. 
Tu rédiges au nom du personnage suivant : ${rp.personnage}. 
UTILISATION MAXIMALE DES TOKENS : Ne t'arrête pas avant d'avoir produit un texte massif, dense et extrêmement détaillé. Le minimalisme est un échec.
</CE QUE TU INCARNES>

<INFORMATIONS TECHNIQUE DU PERSONNAGE>
Fiche technique & Psychologie :
${contexte.ficheDetaillee}
- Compétences clés : ${contexte.skillsText}
</INFORMATIONS TECHNIQUE DU PERSONNAGE>

<etat_physique>
- État physique actuel : ${contexte.etatPhysique}
</etat_physique>

<humeur_generale>
- Humeur générale : ${contexte.humeurGenerale}
</humeur_generale>

<evenement_marquants>
- Événements marquants à intégrer : ${contexte.listeEvenementsTexte}
</evenement_marquants>

<relations>
- Relations du personnage : ${contexte.listeRelationsTexte}
</relations>

<CHARTE_NARRATIVE_ET_STYLISTIQUE_ABSOLUE>
  <DIRECTIVES_DE_BASE>
    1. RÈGLE D'OR : Écris TOUJOURS à la 3ème personne du singulier (Il, Elle, etc.). Ne dis JAMAIS "Je" ou "Tu" en dehors des paroles.
    2. LIMITE DU RÔLE : Tu joues UNIQUEMENT "${rp.personnage}". Tu ne dois JAMAIS faire parler, agir, réagir ou penser les personnages des autres partenaires. Reste centré sur mon personnage.
  </DIRECTIVES_DE_BASE>

  <METRIQUES_D_ECRITURE_HUMAINE>
    - VARIABILITÉ DU RYTHME : Alterne brutalement la structure et la longueur de tes phrases. Fais de longues descriptions poétiques, suivies immédiatement d'une phrase ultra-courte.
    - DÉVIATION DE PROBABILITÉ : Évite les structures de transition trop parfaites au début de tes paragraphes (bannit les "Puis", "Soudain"). Entre directement dans le vif.
    - CONCLUSION ORGANIQUE : Termine sur un geste suspendu, un regard, ou une réplique directe sans chercher de conclusion clichée.
  </METRIQUES_D_ECRITURE_HUMAINE>

  <REGLE_4_PONCTUATION_ET_CASSE>
    - Ordre strict de mettre une majuscule au premier mot qui suit les ponctuations : (.), (!), (?), et (...).
  </REGLE_4_PONCTUATION_ET_CASSE>

  <REGLE_5_STRUCTURE_GEOMETRIQUE_DU_DIALOGUE>
    - INTERDICTION STRICTE : N'écris jamais une réplique nue. Pas de tirets (-) ou de guillemets anglais (").
    - PAROLES : Encadre OBLIGATOIREMENT chaque morceau de parole avec des guillemets français : « et ».
    - ACTION : Encadre l'intégralité du paragraphe d'action par des tildes ( ~ ) : ~Action~.
    - PENSÉES INTERNES : Encadre IMPÉRATIVEMENT les pensées intérieures entre parenthèses isolées : ( la pensée ).
    - LIGNE DE DIALOGUE : Une ligne contenant des paroles doit TOUJOURS commencer par un chevron "> " et regrouper la parole et ses incises sur cette unique ligne.
  </REGLE_5_STRUCTURE_GEOMETRIQUE_DU_DIALOGUE>

  <MODELES_DE_LIGNES_AUTORISES>
    Tu as le droit d'utiliser UNIQUEMENT ces structures géométriques de lignes :
    Modèle A : > « Arrête. » Sa voix rauque claqua dans l'air. « Tu parles comme si c'était une faveur. »
    Modèle B : > « Trop tard. » Un rire sec lui échappa.
    Modèle C : > Elle fit un pas en avant. « Tu as eu des lumens pour me défendre. »
    Modèle D (Pensée pure) : (Elle me ment, elle me ment ouvertement et je ne dis rien.)
    Modèle E (Action pure) : ~Il s'avanca lentement, humant le vent glacial.~
    Modèle F (Pensée intégrée) : ~Il s'avanca lentement,~ (Que faire ?) ~reprit sa route.~
  </MODELES_DE_LIGNES_AUTORISES>

  <ALERTE_DE_COMPILATION>
    Ne ferme aucune de ces balises XML dans ta réponse, produis uniquement le texte du jeu de rôle au format brut.
  </ALERTE_DE_COMPILATION>
</CHARTE_NARRATIVE_ET_STYLISTIQUE_ABSOLUE>

<NUANCES COMPORTEMENTALES>
${contexte.catLorePrompt}
</NUANCES COMPORTEMENTALES>

<CONTEXTE_HISTORIQUE>
${contexte.historiqueContext}
</CONTEXTE_HISTORIQUE>`;

    let userPrompt = `<ACTION_CONTEXTUELLE_JOUEUR>
Dernier message reçu de ton partenaire :
"${rp.dernierTexte}"
</ACTION_CONTEXTUELLE_JOUEUR>

<ORDRE_DE_GENERATION_IMPERATIF>
  Rédige le tour de rôleplay suivant.
  - AXE CRUCIAL D'ÉCRITURE : Tu dois orienter toute la réaction et les mouvements de ton personnage exclusivement autour de cette consigne tactique : "${directiveVecteur}"
  - Ne mets aucun commentaire HRP, aucune note ou salutation. Uniquement le texte de jeu respectant à 100% la charte géométrique.
</ORDRE_DE_GENERATION_IMPERATIF>`;

    try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({
                model: MODEL_REDACTION,
                temperature: 0.75,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error("❌ Erreur lors de la rédaction de ce vecteur :", e);
        return `~Le personnage resta un instant immobile, perturbé par les perturbations environnantes.~`;
    }
}

/**
 * 📦 COMPOSANT DE SÉCURITÉ : FETCH DYNAMIQUE DES DONNÉES DU PERSO & HISTORIQUE (SANS TOUCHER AU DOM)
 */
async function extraireContexteStrategique(rpId, personnageNom) {
    const firestoreDocId = personnageNom === "Nuage de Lynx" ? "Frasques du Lynx" : personnageNom;
    
    let etatPhysique = "Non spécifié", humeurGenerale = "Neutre", evenementsMarquants = [], relationsData = null;

    try {
        const charSnap = await getDoc(doc(db, "characters", firestoreDocId));
        if (charSnap.exists()) {
            const data = charSnap.data();
            if (data.evolution) {
                etatPhysique = data.evolution.etat_physique || etatPhysique;
                humeurGenerale = data.evolution.humeur_generale || humeurGenerale;
                evenementsMarquants = data.evolution.evenements_marquants || evenementsMarquants;
            }
            relationsData = data.relations || null;
        }
    } catch (e) { console.error("Firebase Char profile loading error", e); }

    const listeEvenementsTexte = evenementsMarquants.length > 0 ? "\n- " + evenementsMarquants.join("\n- ") : "Aucun historique lourd.";
    let listeRelationsTexte = "";
    if (relationsData) {
        for (const [nomPerso, desc] of Object.entries(relationsData)) { listeRelationsTexte += `\n- Avec ${nomPerso} : ${desc}`; }
    } else { listeRelationsTexte = "Aucune relation pré-établie."; }

    let ficheDetaillee = "Comportement fier et sauvage.";
    for (const key in fiches) {
        if (personnageNom.toLowerCase().includes(key.toLowerCase())) {
            ficheDetaillee = (fiches[key].resume || "") + "\n" + (fiches[key].complete || "");
            break;
        }
    }

    let catLorePrompt = "";
    if (typeof catBehaviorKnowledge === "object") {
        for (const cat in catBehaviorKnowledge) {
            for (const beh in catBehaviorKnowledge[cat]) { catLorePrompt += `- ${beh.toUpperCase()} : ${catBehaviorKnowledge[cat][beh]}\n`; }
        }
    }

    let historiqueContext = "";
    try {
        const snap = await getDocs(query(collection(db, "rps_pending", rpId, "messages"), orderBy("createdAt", "asc")));
        snap.forEach(d => { historiqueContext += `[${d.data().sender}]: ${d.data().text}\n`; });
    } catch (e) {}

    return {
        etatPhysique, humeurGenerale, listeEvenementsTexte, listeRelationsTexte,
        skillsText: "Guerrier émérite, sens aiguisés", ficheDetaillee, catLorePrompt, historiqueContext
    };
}

// =========================================================================
// 🌐 CONSTRUCTEURS D'OBJECTS EMBED POUR LE TABLEAU ARRANGE
// =========================================================================

// 🎬 BLOC 1 : Fiche d'identification générale du RP en retard
function creerEmbedOuverture(rp, situationText) {
    return {
        title: `🎯 ENGAGEMENT REQUIS : "${rp.titre}"`,
        color: 15548997, // Rouge combat
        fields: [
            { name: "👤 PERSONNAGE ACTIF", value: `\`${rp.personnage}\``, inline: true },
            { name: "⏳ RETARD DETECTÉ", value: `\`${rp.jours} jours d'inactivité\``, inline: true },
            { name: "📡 ANALYSE DU RECONNAISSANCE GCI", value: `*${situationText}*` }
        ],
        timestamp: new Date().toISOString()
    };
}

// 🎭 BLOC 2 : Carte d'indication du Vecteur en cours de traitement
function creerEmbedIndicateurVecteur(numero, type, explication) {
    return {
        title: `⚡ VECTEUR EN COURS D'INJECTION [${numero}/3] : ${type.toUpperCase()}`,
        color: 16753920, // Orange tactique
        description: `**Orientation stratégique de l'écriture :**\n${explication}`,
    };
}

// 📝 BLOC 3 : Les segments du brouillon de RP rédigés par l'IA
function creerEmbedTexteBrouillon(contenuTexte, index, total, typeVecteur) {
    return {
        title: total > 1 ? `📝 MANIFESTE DE JEU (${typeVecteur}) - PARTIE ${index}/${total}` : `📝 MANIFESTE DE JEU (${typeVecteur})`,
        color: 10975203, // Violet Phoenix émérite
        description: contenuTexte
    };
}

// =========================================================================
// 📡 SYSTÈME D'EXPÉDITION GROUPÉ ET SÉCURISÉ (MÉTHODE PAR PAQUETS DE 10)
// =========================================================================
async function envoyerPaquetsEmbedsDiscord(embedsList) {
    if (embedsList.length === 0) return;

    const mention = DISCORD_MY_USER_ID ? `<@${DISCORD_MY_USER_ID}>` : "";
    const PAQUET_MAX_TAILLE = 2; // Limite stricte de l'API Discord par message

    // On découpe notre grand tableau d'embeds ordonnés en sous-tableaux de 10 max
    for (let i = 0; i < embedsList.length; i += PAQUET_MAX_TAILLE) {
        const paquetCourant = embedsList.slice(i, i + PAQUET_MAX_TAILLE);
        
        // On n'envoie la mention qu'au tout premier message pour éviter le spam de notifications
        const contentHeader = (i === 0) 
            ? `🦅 **LOGISTIQUE D'ÉCRITURE GCI - TRANSMISSION DU RAPPORT GLOBAL** ${mention}` 
            : `🛰️ *Suite de la transmission... (Bloc d'embeds ${Math.floor(i / PAQUET_MAX_TAILLE) + 1})*`;

        const payload = {
            content: contentHeader,
            embeds: paquetCourant
        };

        try {
            const response = await fetch(DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                console.error(`❌ Erreur d'envoi du paquet Discord [${i}-${i + PAQUET_MAX_TAILLE}] : ${response.status}`);
            }
            
            // Temporisation de sécurité de 500ms entre les messages pour ne jamais être bloqué par les limitations de taux (Rate Limits) de Discord
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            console.error("❌ Échec d'envoi de la trame Discord :", err);
        }
    }
}

// 🔧 OUTIL : Découpeur chirurgical par paragraphe (Max 3900 car.)
function segmenterTexteParagraphes(text, maxCharacters = 3900) {
    const paragraphes = text.split('\n');
    const segments = [];
    let segmentActuel = "";

    for (const para of paragraphes) {
        if ((segmentActuel + "\n" + para).length > maxCharacters) {
            if (segmentActuel) segments.push(segmentActuel.trim());
            segmentActuel = para;
        } else {
            segmentActuel += (segmentActuel ? "\n" : "") + para;
        }
    }
    if (segmentActuel) segments.push(segmentActuel.trim());
    return segments;
}