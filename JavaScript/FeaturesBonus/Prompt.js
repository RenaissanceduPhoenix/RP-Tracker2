import { charactersDB, fiches } from './CharacterData.js';
import { catBehaviorKnowledge } from './CatBehaviorData.js?v=2';
import { db } from '../Firebase.js';
import { limit, collection, setDoc, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp, deleteDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js';
import { analyserSituationEtAppliquerMoods } from './MoodAnalyzer.js';
import { analyserImpactPhysiqueEtMental } from './TraumaAnalyzer.js';
import { fichesPersonnagesJDR, dictionnaireActionsSociales, executerLancerSocialPrecalcul } from './TraitsDictionnaire.js';
import { preparerEtInitialiserZoneDes, executerLancerDesErER, dictionnaireActionsErER} from './DiceManager.js';
import { executerConsidolationTotaleMemoire } from './MemoryManager.js';
import { initialiserEtTraiterMemoiresManquantes, verifierDeclenchementMemoire, reecrireMemoireModalParId  } from './memoireHierarchique.js';
import { DICTIONNAIRE_INGREDIENTS_RP } from './IngredientsData.js';

// =========================================================================
// ⚙️ PARTIE 1 : LOGIQUE, VARIABLES, FIREBASE ET DICTIONNAIRES
// =========================================================================

// ============================================================================
// ✨ CONSTRUCTEUR ET GESTIONNAIRE DYNAMIQUE DE LA BANQUE GÉANTE
// ============================================================================
(function() {
    // 💾 VARIABLE GLOBALE DE STOCKAGE TEMPORAIRE
    if (!window.ingrédientsSélectionnés) {
        window.ingrédientsSélectionnés = new Set();
    }

    window.initialiserModalIngredientsSecrets = function() {
        const modal = document.getElementById("modalIngredientsSecrets");
        const btnOuvrir = document.getElementById("btnOuvrirIngredients");
        const btnFermer = document.getElementById("btnFermerIngredients");
        const btnValider = document.getElementById("btnValiderIngredients");
        const grille = document.getElementById("grilleDynamiqueIngredients");
        const badge = document.getElementById("badgeIngredientsCompteur");
        const barreRecherche = document.getElementById("barreRechercheIngredients");

        if (!modal || !grille || !btnOuvrir) return;

        // Évite les doublons d'écouteurs d'événements si la fonction est ré-appelée
        if (btnOuvrir.getAttribute("data-initialise") === "true") return;
        btnOuvrir.setAttribute("data-initialise", "true");

        // 🔄 Fonction de rendu dynamique de la grille
        function genererGrilleIngredients(filtre = "") {
            let htmlContenu = "";
            const motCle = filtre.toLowerCase().trim();

            for (const [categorie, items] of Object.entries(DICTIONNAIRE_INGREDIENTS_RP)) {
                if (!items) continue;

                let itemsFiltrés = Object.entries(items).filter(([id, item]) => {
                    if (!item) return false;
                    if (!motCle) return true;
                    return id.toLowerCase().includes(motCle) || 
                           (item.label && item.label.toLowerCase().includes(motCle)) || 
                           (item.prompt && item.prompt.toLowerCase().includes(motCle));
                });

                if (itemsFiltrés.length > 0) {
                    htmlContenu += `
                        <div class="ingredient-category-header">
                            <span class="ingredient-category-title">
                                📁 ${categorie} (${itemsFiltrés.length})
                            </span>
                        </div>
                    `;

                    for (const [id, item] of itemsFiltrés) {
                        const isChecked = window.ingrédientsSélectionnés.has(id) ? "checked" : "";
                        // 🧼 NETTOYÉ : Tout le style en ligne et onmouseover/onmouseout ont été retirés
                        htmlContenu += `
                            <label class="ingredient-card">
                                <input type="checkbox" class="rp-ingredient ingredient-checkbox" data-id="${id}" ${isChecked}>
                                <div class="ingredient-info">
                                    <span class="ingredient-label">${item.label || id}</span>
                                    <span class="ingredient-prompt">${item.prompt || ''}</span>
                                </div>
                            </label>
                        `;
                    }
                }
            }

            if (!htmlContenu) {
                htmlContenu = `<div class="ingredient-empty">🔍 Aucun ingrédient RP ne correspond à votre recherche...</div>`;
            }

            grille.innerHTML = htmlContenu;

            document.querySelectorAll(".rp-ingredient").forEach(cb => {
                cb.addEventListener("change", (e) => {
                    const id = e.target.getAttribute("data-id");
                    if (e.target.checked) {
                        window.ingrédientsSélectionnés.add(id);
                    } else {
                        window.ingrédientsSélectionnés.delete(id);
                    }
                    majBadge();
                });
            });
            
            majBadge();
        }

        function majBadge() {
            const coches = window.ingrédientsSélectionnés ? window.ingrédientsSélectionnés.size : 0;
            if (badge) {
                badge.innerText = coches;
                // 🧼 NETTOYÉ : Bascule propre de la classe .has-count au lieu de manipuler style.background
                badge.classList.toggle("has-count", coches > 0);
            }
        }

        if (barreRecherche) {
            barreRecherche.addEventListener("input", (e) => {
                genererGrilleIngredients(e.target.value);
            });
        }

        btnOuvrir.addEventListener("click", () => {
            if (barreRecherche) barreRecherche.value = ""; 
            genererGrilleIngredients(""); 
            modal.style.display = "flex";
        });
        
        if (btnFermer) btnFermer.addEventListener("click", () => modal.style.display = "none");
        
        window.addEventListener("click", (e) => { 
            if (e.target === modal) modal.style.display = "none"; 
        });

        if (btnValider) {
            btnValider.addEventListener("click", () => {
                modal.style.display = "none";
                
                if (window.ingrédientsSélectionnés.size === 0) {
                    window.promptIngredientsPourIA = "";
                    return;
                }

                let instructions = "\n\n[CONSIGNES DE JEU DE RÔLE IMPÉRATIVES - Intègre subtilement ces comportements dans ton récit] :\n";
                
                window.ingrédientsSélectionnés.forEach(id => {
                    for (const cat of Object.values(DICTIONNAIRE_INGREDIENTS_RP)) {
                        if (cat && cat[id] && cat[id].prompt) {
                            instructions += `- ${cat[id].prompt}\n`;
                            break;
                        }
                    }
                });

                window.promptIngredientsPourIA = instructions;
            });
        }

        genererGrilleIngredients("");
    };

    // Sécurité d'exécution au chargement du DOM pour l'IIFE
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => window.initialiserModalIngredientsSecrets());
    } else {
        setTimeout(() => { window.initialiserModalIngredientsSecrets(); }, 50);
    }
})();
const outputDiv = document.getElementById("coWriteAiOutput");

export async function genererMessagesMistral() {
    const textInput = document.getElementById("coWriteContext");
    if (!outputDiv || !currentActiveRpId) return;

    // 💾 SAUVEGARDE DU PROMPT ACTUEL POUR LE REROLL
    let dernierPromptJoueur = textInput ? textInput.value.trim() : "";

    const aiInstructionsElement = document.getElementById("coWriteAiInstructions");
    const instructions = aiInstructionsElement ? aiInstructionsElement.value.trim() : "";

    const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
    let moodInstruction = "";

    // 1. Récupération du nombre d'unités de blocs demandées par le slider (ex: 3, 4, 5...)
    const unitesBlocs = window.currentNombreBlocsDemande || 4;

    // 2. Calcul mathématique de la longueur totale attendue (1 unité = 1900 caractères)
    const longueurTotaleCaracteres = unitesBlocs * 1900;

    // 1. Récupération des contraintes volumétriques et ingrédients
    const blocsVoulus = parseInt(document.getElementById("rangeNombreBlocs")?.value || "4");
    const casesCochees = document.querySelectorAll(".rp-ingredient:checked");
    let ingredientsSelectionnes = [];

    // On traduit chaque case cochée en son texte descriptif complet en cherchant dans les sous-catégories
    casesCochees.forEach(cb => {
        const key = cb.getAttribute("data-id") || cb.value;
        
        // On cherche l'ingrédient là où il se trouve de manière sécurisée
        const detail = DICTIONNAIRE_INGREDIENTS_RP?.dialogues?.[key] 
                     || DICTIONNAIRE_INGREDIENTS_RP?.actions?.[key] 
                     || DICTIONNAIRE_INGREDIENTS_RP?.introspection?.[key];
                     
        if (detail && detail.prompt && !ingredientsSelectionnes.includes(detail.prompt)) {
            ingredientsSelectionnes.push(detail.prompt);
        }
    });

    // 2. Fabrication de la liste textuelle pour le prompt (Uniquement avec ce qui est coché !)
    let directivesIngredientsPrompt = "";
    ingredientsSelectionnes.forEach((ing, index) => {
        directivesIngredientsPrompt += `- INGRÉDIENT OBLIGATOIRE N°${index + 1} : ${ing}\n`;
    });

    // On prépare le bloc de texte à insérer
    let texteIngredientsInstructions = "";
    if (ingredientsSelectionnes.length > 0) {
        texteIngredientsInstructions = `
⚠️ CONSIGNES IMPÉRATIVES DE STYLE (INGRÉDIENTS JDR COCHÉS) :
Tu dois impérativement incorporer de manière fluide, naturelle et subtile les contraintes et actions physiques/mentales suivantes au cours du récit. Gère leur ordre d'apparition librement selon le rythme de la scène :
${ingredientsSelectionnes.join("\n")}
`;
    }

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

        activeMoodBtns.forEach(btn => {
            const moodKey = btn.getAttribute("data-mood");
            if (moodDictionary[moodKey]) moodInstruction += moodDictionary[moodKey];
        });
    }

    outputDiv.innerHTML = `<p id="HistoriqueLecture" class="blink">✍️ L'IA consulte la mémoire de la conversation et l'historique...</p>`;

    const CORRESPONDANCE = { "Nuage de Lynx": "Frasques du Lynx" };
    const firestoreDocId = CORRESPONDANCE[window.currentActiveCharName] || window.currentActiveCharName;

    let etatPhysique = "Non spécifié";
    let humeurGenerale = "Neutre";
    let evenementsMarquants = []; 
    let relationsData = null;     

    try {
        const charDocRef = doc(db, "characters", firestoreDocId);
        const charSnap = await getDoc(charDocRef);
        
        if (charSnap.exists()) {
            const charData = charSnap.data();
            
            if (charData.evolution) {
                if (charData.evolution.etat_physique) {
                    etatPhysique = charData.evolution.etat_physique;
                }
                if (charData.evolution.humeur_generale) {
                    humeurGenerale = charData.evolution.humeur_generale;
                }
                if (charData.evolution.evenements_marquants) {
                    evenementsMarquants = charData.evolution.evenements_marquants;
                }
            }

            if (charData.relations) {
                relationsData = charData.relations;
            }
            
            console.log("✅ Variables individuelles chargées :", { etatPhysique, humeurGenerale, evenementsMarquants, relationsData });
        } else {
            console.warn(`⚠️ Le document "${firestoreDocId}" n'existe pas.`);
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'appel Firebase :", error);
    }

    const listeEvenementsTexte = evenementsMarquants.length > 0 
        ? "\n- " + evenementsMarquants.join("\n- ") 
        : "Aucun événement marquant enregistré pour le moment.";

    let listeRelationsTexte = "";
    if (relationsData && Object.keys(relationsData).length > 0) {
        for (const [nomPerso, descriptionLien] of Object.entries(relationsData)) {
            listeRelationsTexte += `\n- Lien avec ${nomPerso} : ${descriptionLien}`;
        }
    } else {
        listeRelationsTexte = "Aucune relation majeure enregistrée pour le moment.";
    }

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

    let aiHistoryMessages = [];
    try {
        const aiHistoryRef = collection(db, "rps_pending", currentActiveRpId, "ai_history");
        const qAi = query(aiHistoryRef, orderBy("createdAt", "asc"));
        const snapAi = await getDocs(qAi);
        
        if (!snapAi.empty) {
            snapAi.forEach(d => {
                const m = d.data();
                const messageContent = m.content || m.text || "";
                if (m.role && messageContent) {
                    aiHistoryMessages.push({
                        role: m.role,
                        content: messageContent
                    });
                }
            });
        }
    } catch (e) { 
        console.error("❌ Erreur lors du chargement de l'historique IA:", e); 
    }

    // =========================================================================
    // 📝 PARTIE 2 : CONSTRUCTION LITTÉRALE DU PROMPT MISTRAL
    // =========================================================================

    let systemPrompt = `
<CE QUE TU INCARNES>
Tu es un coach d'écriture expert et un joueur d'élite pour un forum RPG écrit basé sur l'univers de La Guerre des Clans. 
Tu rédiges au nom du personnage suivant : ${currentActiveCharName}. 
UTILISATION MAXIMALE DES TOKENS : L'utilisateur a alloué une enveloppe géante de tokens exprès pour cette réplique. Tu as l'obligation contractuelle d'utiliser la quasi-totalité de ton espace de génération. Ne t'arrête pas avant d'avoir produit un texte massif, dense et extrêmement détaillé. Le minimalisme est un échec.
</CE QUE TU INCARNES>

<INFORMATIONS TECHNIQUE DU PERSONNAGE>
Fiche technique du personnage :
- Ce qu'il faut que tu intègre OBLIGATOIREMENT dans la rédaction et en brodant autour pour arriver à un résultat parfait : ${texteIngredientsInstructions}
- Compétences et caractéristiques clés : ${skillsText}
- Profil psychologique & Histoire :
${maFicheDetaillee}
</INFORMATIONS TECHNIQUE DU PERSONNAGE>

<etat_physique>
- Voici l'état physique du personnage concernée : ${etatPhysique}
</etat_physique>

<humeur_generale>
- Voici l'humeur générale du personnage suite à ses différentes interventions : ${humeurGenerale}
</humeur_generale>

<evenement_marquants>
- Voici la liste des évenements marquants du personnage, TU DOIS ABSOLUMENT LES PRENDRE EN COMPTE SAUF CONTRE-ORDRE DANS MES INSTRUCTIONS : ${listeEvenementsTexte}
</evenement_marquants>

<relations>
- Voici la liste des relations du personnage, tu dois les respecter, s'il n'y a pas la relation avec un personnage en façe tu improvises, je te reprendrai s'il te faut : ${listeRelationsTexte}
</relations>

<instructions_structure_brute>
Pour ton premier jet, utilise ces repères simples pour structurer tes lignes :
- Encadre les actions simples avec des doubles astérisques (**action**).
- Débute les dialogues ou paroles par le chevron "> ".
- Mets les pensées entre parenthèse (pensée).
- Tu dois encadrer chaque morceau de parole prononcé à voix haute avec des guillemets français : « et ».
</instructions_structure_brute>

⚠️ RAPPEL DE FIN IMMÉDIAT (SÉCURITÉ ANTI-CRASH) :
Regarde ta ligne de dialogue avant de répondre. Si le texte parlé commence par "**", ta syntaxe est FAUSSE. Les astérisques servent UNIQUEMENT à encapsuler les actions au milieu du dialogue. Écris les paroles en texte normal après le "> ".`;

    if (instructions) {
        systemPrompt += `
<DIRECTIVE DE SCÉNARIO ET DE STYLE>
Tu dois impérativement adapter le récit, l'action ou le ton en fonction de cette demande de l'utilisateur : "${instructions}"
Attention : Cette demande doit être exécutée TOUT EN RESPECTANT STRICTEMENT le formatage Markdown et l'identité du personnage.\n\n
</DIRECTIVE DE SCÉNARIO ET DE STYLE>`;
    }

    if (contrainteDeDesPrompt) {
        systemPrompt += `${contrainteDeDesPrompt}\n`;
    }

    if (moodInstruction) {
        systemPrompt += `${moodInstruction}\n`;
    }

    systemPrompt += `
<CHARTE_NARRATIVE_ET_STYLISTIQUE_ABSOLUE>
  <DIRECTIVES_DE_BASE>
    1. RÈGLE D'OR : Écris TOUJOURS à la 3ème personne du singulier (Il, Elle, etc.). Ne dis JAMAIS "Je" ou "Tu" en dehors des paroles.
    2. LIMITE DU RÔLE : Tu joues UNIQUEMENT "${currentActiveCharName}". Tu ne dois JAMAIS faire parler, agir, réagir ou penser les personnages des autres partenaires. Reste centré sur mon personnage.
  </DIRECTIVES_DE_BASE>

  <METRIQUES_D_ECRITURE_HUMAINE>
    - VARIABILITÉ DU RYTHME : Alterne brutalement la structure et la longueur de tes phrases. Fais de longues descriptions poétiques, suivies immédiatement d'une phrase ultra-courte de deux ou trois mots pour marquer un impact, une hésitation ou une rupture. Ne garde JAMAIS le même rythme d'un paragraphe à l'autre.
    - DÉVIATION DE PROBABILITÉ : Évite les structures de transition trop parfaite et répétitives au début de tes paragraphes (bannit les listes de "Puis, d'un geste...", "Soudain...", "Un frisson..."). Entre directement dans l'action, la pensée brute ou la sensation physique.
    - IMPERFECTIONS NATURELLES : Incorpore des tics de langage corporel réalistes et parfois abrupts propres à l'univers félin (un miaulement étouffé, un coup de langue nerveux, un silence lourd, une hésitation dans le dialogue).
    - CONCLUSION ORGANIQUE : Ne cherche pas à faire une "belle phrase de fin de chapitre" clichée. Termine sur un geste suspendu, un regard, ou une réplique directe.
  </METRIQUES_D_ECRITURE_HUMAINE>

  <REGLE_4_PONCTUATION_ET_CASSE>
    - Tu as l'ORDRE STRICT de mettre une majuscule au premier mot qui suit les ponctuations suivantes : le point (.), le point d'exclamation (!), le point d'interrogation (?), et les points de suspension (...).
    - Les seules exceptions qui tolèrent une minuscule après elles sont la virgule (,) et le point-virgule (;).
    - Même si la grammaire française classique autorise une minuscule après des points de suspension au milieu d'une réplique, tu as l'ORDRE STRICT de mettre une majuscule si le mot qui suit change de nature (ex: passage de paroles brutes à une incise de description).
    - EXEMPLE EXIGÉ : "> Tu… Sa voix était un murmure. Tu n'as jamais parlé ainsi."
  </REGLE_4_PONCTUATION_ET_CASSE>

  <REGLE_5_STRUCTURE_GEOMETRIQUE_DU_DIALOGUE>
    - INTERDICTION STRICTE : N'écris jamais une réplique nue. N'utilise jamais de tirets (-) ou de guillemets anglais (").
    - PAROLES : Encadre OBLIGATOIREMENT chaque morceau de parole prononcé à voix haute avec des guillemets français : « et ».
    - ACTION : Encadre l'intégralité du paragraphe d'action par des tildes ( ~ ) : ~Action~.
    - PENSÉES INTERNES : Encadre IMPÉRATIVEMENT les pensées intérieures entre parenthèses isolées : ( la pensée ). Une pensée pure doit former sa propre ligne.
    - INCISES : Si une description ou une action (incise) coupe ou suit la parole, elle doit être écrite DIRECTEMENT sur la même ligne, SANS étoiles ou balises Markdown (le Robot s'en chargera).
    - LIGNE DE DIALOGUE : Une ligne contenant des paroles doit TOUJOURS commencer par un chevron "> " et regrouper la parole et ses incises sur cette unique ligne.
  </REGLE_5_STRUCTURE_GEOMETRIQUE_DU_DIALOGUE>

  <MODELES_DE_LIGNES_AUTORISES>
    Tu as le droit d'utiliser UNIQUEMENT et EXCLUSIVEMENT ces 6 structures mathématiques de lignes :
    
    Modèle A (Incise au milieu) : > « Arrête. » Sa voix rauque claqua dans l'air. « Tu parles comme si c'était une faveur. »
    Modèle B (Incise à la fin)   : > « Trop tard. » Un rire sec lui échappa, plus amer que la sève des pins.
    Modèle C (Incise au début)   : > Elle fit un pas en avant, les pattes ancrées dans le métal. « Tu as eu des lunes pour me défendre. »
    Modèle D (Pensée pure)       : (Elle me ment, elle me ment ouvertement et je ne dis rien, je suis faible.)
    Modèle E (Action pure)       : ~Nuage de Lynx avanca.~
    Modèle F (Pensée dans une action pure)       : ~Nuage de Lynx avanca,~ (Que vais-je faire ?) ~Elle reprit sa route.~
  </MODELES_DE_LIGNES_AUTORISES>

  <ALERTE_DE_COMPILATION>
    Tout texte généré ne respectant pas l'un de ces quatre modèles géométriques brisera le système. Sois d'une rigueur mathématique absolue. Ne ferme aucune de ces balises XML dans ta réponse, produis uniquement le texte du jeu de rôle au format brut.
  </ALERTE_DE_COMPILATION>
</CHARTE_NARRATIVE_ET_STYLISTIQUE_ABSOLUE>

<NUANCES COMPORTEMENTALES>
${catLorePrompt}
</NUANCES COMPORTEMENTALES>

🔥 PROFIL PSYCHOLOGIQUE OBLIGATOIRE :
<FICHE_PERSONNAGE>
${maFicheDetaillee}
</FICHE_PERSONNAGE>\n\n`;

    systemPrompt += `
<CONTEXTE_HISTORIQUE>
${historiqueContext}
</CONTEXTE_HISTORIQUE>`;

    console.log("%c=== 🚀 DÉBUT DE LA RECONSTRUCTION DU PROMPT MISTRAL ===", "color: #a777e3; font-weight: bold;");

    let currentPrompt = "";
    if (textInput && textInput.value.trim()) {
        currentPrompt += `<ACTION_CONTEXTUELLE_JOUEUR>\n${textInput.value.trim()}\n</ACTION_CONTEXTUELLE_JOUEUR>\n\n`;
    }

    currentPrompt += `<ORDRE_DE_GENERATION_IMPERATIF>
  Tu dois maintenant rédiger la réplique suivante pour mon personnage "${currentActiveCharName}".

  <DIRECTIVES_ABSOLUES>
    - INCARNATION : Incarne EXCLUSIVEMENT "${currentActiveCharName}". Reste fidèle à sa fiche technique et à sa psychologie félé.
    - SYNTAXE : Écris IMPÉRATIVEMENT à la 3ème personne du singulier (Il, Elle).
    - EFFET DIRECT : Génère UNIQUEMENT le texte du RP. Tu as l'INTERDICTION STRICTE d'ajouter des commentaires annexes, des notes hors-jeu (HRP), des salutations ou des explications de fin.
  </DIRECTIVES_ABSOLUES>

  <CALIBRAGE_TOKENS_ET_DENSITE>
    - L'utilisateur a alloué une enveloppe géante de tokens exprès pour cette réplique. 
    - Tu as l'OBLIGATION CONTRACTUELLE d'utiliser la quasi-totalité de ton espace de génération. 
    - Ne t'arrête pas avant d'avoir produit un texte massif, dense, viscéral et extrêmement détaillé. Le minimalisme est un échec.
  </CALIBRAGE_TOKENS_ET_DENSITE>

  <EXECUTION_CHARTE_GEOMETRIQUE>
    - Tu dois appliquer au millimètre près la <CHARTE_NARRATIVE_ET_STYLISTIQUE_ABSOLUE> fournie précédemment.
    - Chaque ligne produite doit correspondre mathématiquement au Modèle A, B, C (lignes de dialogue commençant par > ) ou au Modèle D (pensée pure entre parenthèses).
    - Ne ferme aucune balise XML dans ton rendu de texte final. Rends le flux brut.
  </EXECUTION_CHARTE_GEOMETRIQUE>
</ORDRE_DE_GENERATION_IMPERATIF>`;

    // 🌟 C'est ici qu'on renvoie TOUT le gâteau préparé à AICoachs.js
    return [
        { role: "system", content: systemPrompt },
        ...aiHistoryMessages,
        { role: "user", content: currentPrompt }
    ];

     // Nettoyage après envoi réussi
    if (window.ingrédientsSélectionnés) {
        window.ingrédientsSélectionnés.clear();
    }
    window.promptIngredientsPourIA = "";

    const badge = document.getElementById("badgeIngredientsCompteur");
    if (badge) badge.innerText = "0";
}