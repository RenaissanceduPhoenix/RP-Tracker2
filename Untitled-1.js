import { charactersDB, fiches } from './CharacterData.js';
import { catBehaviorKnowledge } from './CatBehaviorData.js';
import { db } from '../Firebase.js';
import { collection, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp, deleteDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from '../Markdown.js'; // 🛠️ Importation du parseur Markdown existant

// ⚠️ CONFIGURATION MISTRAL
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

window.currentActiveRpId = null;
window.currentActiveCharName = null;
let dernierPromptJoueur = ""; // Sauvegarde le message ou contexte du joueur

/**
 * ============================================================================
 * 1. DICTIONNAIRE ULTIME DES 77 MOODS ATOMIQUES & CLOISONNÉS
 * ============================================================================
 */
const GlobalMoodDictionary = {
    // ⚔️ COMBAT & PHYSIQUE (13)
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
    brutalite: "- BRUTALITÉ : Force brute disproportionnée, frappes lourdes, aucun soin du geste.\n",

    // 😡 HOSTILITÉ & DOMINATION (13)
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
    defiance: "- SÉQUENCE DE DÉFI : Posture provocatrice, regard ancré, refuse de plier le genou.\n",

    // 💧 SOUFFRANCE PSYCHOLOGIQUE (13)
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
    trauma: "- TRAUMATISÉ : Flashbacks psychologiques, sursauts nerveux incontrôlés au moindre bruit.\n",

    // 🧠 BLOCAGES, MALAISE & DISCRÉTION (13)
    gene: "- GÊNE : Trouble relationnel, mouvements gauches, attitude inconfortable, regard fuyant.\n",
    malaise: "- MALAISE : Tension palpable dans la pièce, silence lourd, inconfort situationnel flagrant.\n",
    hesitation: "- HÉSITATION : Posture indécise, flottement avant d'agir, gestes interrompus en plein élan.\n",
    honte: "- HONTE : Profil bas, oreilles plaquées par l'embarras, évitement systématique du regard.\n",
    mefiance: "- MÉFIANCE : Prudence extrême, observation suspicieuse, analyse des arrières-pensées.\n",
    mystere: "- MYSTÈRE : Comportement énigmatique, secrets gardés, non-dits volontaires.\n",
    folie: "- FOLIE : Regard erratique, instabilité mentale, incohérence comportementale.\n",
    crise: "- CRISE : Explosion émotionnelle, saturation nerveuse, perte de contrôle psychologique.\n",
    timidite: "- TIMIDITÉ : Posture réservée, effacement volontaire, hésitation à prendre la parole.\n",
    paranoia: "- PARANOÏA : Sentiment injustifié de persécution, voir des pièges ou des ennemis partout.\n",
    confusion: "- CONFUSION : Esprit embrouillé, désorientation intellectuelle, incompréhension des événements.\n",
    secret: "- SECRET : Rétention volontaire d'informations cruciales, dissimulation stratégique.\n",
    perplexite: "- PERPLEXITÉ : Sourcils froncés, incompréhension ou étonnement face à une situation illogique.\n",

    // 🤝 ATTACHEMENT & INTERACTIONS (12)
    amitie: "- AMITIÉ : Posture détendue, proximité fraternelle rassurante, ton ouvert.\n",
    complicite: "- COMPLICITÉ : Connexion immédiate, regards entendus, accord tacite sans paroles.\n",
    drague: "- DRAGUE : Intention de séduction, pas feutrés et circulaires, port de tête fier.\n",
    charme: "- CHARME : Charisme naturel envoûtant, magnétisme comportemental pour captiver.\n",
    romance: "- ROMANCE : Intimité amoureuse profonde, queue enlacée, réduction de l'espace vital.\n",
    tendresse: "- TENDRESSE : Gestes lents, contact physique affectueux, douceur, coup de truffe.\n",
    malice: "- MALICE : Regard taquin, comportement espiègle, envie de plaisanter ou de piéger gentiment.\n",
    respect: "- RESPECT : Déférence polie, maintien des distances requises, considération de la valeur.\n",
    empathie: "- EMPATHIE : Sensibilité partagée face à la douleur d'autrui, écoute attentive et bienveillante.\n",
    loyaute: "- LOYAUTÉ : Fidélité indéfectible, respect absolu de la parole donnée ou du Clan.\n",
    devoement: "- DÉVOUEMENT : Sacrifice de soi au profit d'une cause, d'une idée ou d'un individu.\n",
    pardon: "- PARDON : Abandon de la rancune, geste manifeste d'apaisement et main tendue.\n",

    // ⚖️ VERTUS & LOGIQUE MENTALE (13)
    solennel: "- SOLENNEL : Posture droite, respect rigide des rituels et des lois du Code.\n",
    determination: "- DÉTERMINATION : Mâchoire serrée, pas ancrés au sol, focus inébranlable vers un but.\n",
    focus: "- FOCUS : Concentration extrême sur une tâche ou cible précise, isolation sensorielle périphérique.\n",
    bravoure: "- BRAVOURE : Affronter le danger de face de manière héroïque, s'exposer visiblement pour protéger.\n",
    courage: "- COURAGE : Surmonter activement une trouille interne pour accomplir l'action nécessaire.\n",
    resilience: "- RÉSILIENCE : Capacité à encaisser les échecs physiques ou moraux et se remettre d'aplomb aussitôt.\n",
    fierte: "- FIERTÉ : Torse bombé, tête haute, refus catégorique de montrer ses vulnérabilités.\n",
    apathie: "- APATHIE : Indifférence clinique, absence totale de réaction ou de variation émotionnelle.\n",
    detachement: "- DÉTACHEMENT : Prendre de la distance intellectuelle, esprit visiblement ailleurs.\n",
    froideur: "- FROIDEUR : Logique pure, ton tranchant, absence totale d'empathie relationnelle.\n",
    sagesse: "- SAGESSE : Calme philosophique, recul stratégique et pondération avant toute parole.\n",
    ambition: "- AMBITION : Volonté de grandeur, soif de pouvoir ou d'élévation sociale, calcul opportuniste.\n",
    patience: "- PATIENCE : Calme parfait devant l'attente, maîtrise absolue du timing et du temps.\n"
};

/**
 * ===========================================================================
 * 2. FONCTION : OUVERTURE DE LA MODALE & GESTION DES ÉCOUTEURS DYNAMIQUES
 * ===========================================================================
 */
window.openCoWriteModal = async function(rpId, charName) {
    window.currentActiveRpId = rpId;
    window.currentActiveCharName = charName;
    
    const modal = document.getElementById("coWriteModal");
    const title = document.getElementById("coWriteModalTitle");
    const historyLog = document.getElementById("rpHistoryLog");
    
    if (!modal) return;
    
    modal.style.display = "flex";
    title.innerText = `🖋️ Co-Écriture : ${charName}`;
    if (historyLog) historyLog.innerHTML = "<p style='color:#888; text-align:center;'>Chargement de l'historique du RP...</p>";

    // 🧹 RESET SÉCURITÉ : Désélectionne tous les moods à chaque fois qu'on change de fiche/modale
    document.querySelectorAll(".mood-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    // 👁️ GESTION DU PANNEAU PLIABLE (AFFICHER / MASQUER)
    const btnToggle = document.getElementById("btnToggleMoods");
    const contentMoods = document.getElementById("moodSelectorContent");
    if (btnToggle && contentMoods) {
        contentMoods.style.display = "none"; // Masqué au départ
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

    // 🎛️ LOGIQUE DE SÉLECTION / DÉSÉLECTION ON-OFF AU CLIC
    document.querySelectorAll(".mood-btn").forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            this.classList.toggle("active"); // Gère l'allumage / extinction
        };
    });

    try {
        const rpRef = doc(db, "rps_pending", rpId);
        const rpSnap = await getDoc(rpRef);
        
        if (rpSnap.exists()) {
            const pendingData = rpSnap.data();
            
            title.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:20px;">
                    <span>🖋️ Co-Écriture : <span style="color:#a777e3;">${pendingData.title || 'Sans titre'}</span> (${charName})</span>
                    <button onclick="window.ouvrirSommaireHistorique('${rpId}')" style="background: rgba(255, 204, 0, 0.1); color: #ffcc00; border: 1px solid #ffcc00; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight:bold; display:flex; align-items:center; gap:6px; transition: all 0.2s; margin-right: 20px;">
                        📊 Consulter le Sommaire
                    </button>
                </div>
            `;

            if (historyLog) {
                if (pendingData.posts && pendingData.posts.length > 0) {
                    let logHTML = "";
                    pendingData.posts.forEach((post) => {
                        const parsedText = parseRP ? parseRP(post.text || "") : (post.text || "");
                        logHTML += `
                            <div style="margin-bottom:15px; background:#161622; padding:12px; border-radius:6px; border-left:4px solid #a777e3;">
                                <div style="font-weight:bold; color:#ffcc00; margin-bottom:5px; font-size:0.85rem;">📌 ${post.author || 'Inconnu'}</div>
                                <div style="color:#eee; font-size:0.9rem; line-height:1.5;">${parsedText}</div>
                            </div>
                        `;
                    });
                    historyLog.innerHTML = logHTML;
                    historyLog.scrollTop = historyLog.scrollHeight;
                } else {
                    historyLog.innerHTML = "<p style='color:#666; text-align:center;'>Aucun post enregistré dans l'historique de ce RP.</p>";
                }
            }

            const contextArea = document.getElementById("coWriteContext");
            if (contextArea) {
                contextArea.value = pendingData.context || "";
            }
        }
    } catch (err) {
        console.error("❌ Erreur lors de la récupération du RP :", err);
        if (historyLog) historyLog.innerHTML = "<p style='color:#e74c3c; text-align:center;'>Erreur de chargement du contexte de jeu.</p>";
    }
};

/**
 * ===========================================================================
 * 3. LOGIQUE D'ENVOI DU TEXTE À L'IA (BOUTON PRINCIPAL)
 * ===========================================================================
 */
document.addEventListener("DOMContentLoaded", function() {
    const btnAi = document.getElementById("btnAiCoWrite");
    if (btnAi) {
        btnAi.addEventListener("click", async function() {
            const contextValue = document.getElementById("coWriteContext")?.value || "";
            const instructionValue = document.getElementById("coWriteAiInstructions")?.value || "";
            const outputDiv = document.getElementById("coWriteAiOutput");
            
            if (!window.currentActiveRpId || !window.currentActiveCharName) {
                alert("Aucun RP ou personnage actif détecté.");
                return;
            }
            
            if (outputDiv) outputDiv.innerHTML = "<span style='color:#a777e3; font-weight:bold; display:flex; align-items:center; gap:8px;'><span class='spinner'></span> Rédaction en cours par l'entraîneur...</span>";
            
            let dataFiche = "";
            if (fiches && fiches[window.currentActiveCharName]) {
                const f = fiches[window.currentActiveCharName];
                dataFiche = `FICHE DE PERSONNAGE (${window.currentActiveCharName}) :\n- Clan : ${f.clan || 'Inconnu'}\n- Grade : ${f.grade || 'Inconnu'}\n- Physique : ${f.physique || 'Non spécifié'}\n- Mental/Caractère : ${f.mental || 'Non spécifié'}\n`;
            }
            
            let behaviorKnowledge = "";
            if (catBehaviorKnowledge) {
                behaviorKnowledge = `CONNAISSANCES FÉLINES REQUISES :\n${catBehaviorKnowledge}\n`;
            }

            // ⚠️ RÉCUPÉRATION STRICTE DES BOUTONS AYANT LA CLASSE .ACTIVE
            let moodInstruction = "";
            const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
            
            if (activeMoodBtns.length > 0) {
                moodInstruction = "👉 CONFIGURATION PSYCHOLOGIQUE STRICTE (CONSIGNE ABSOLUE : Chaque attribut sélectionné ci-dessous est totalement cloisonné et indépendant. Traite-les de manière brute, SANS JAMAIS lier les émotions ni faire de transition ou de compromis entre elles) :\n";
                activeMoodBtns.forEach(btn => {
                    const moodKey = btn.getAttribute("data-mood");
                    if (GlobalMoodDictionary[moodKey]) moodInstruction += GlobalMoodDictionary[moodKey];
                });
            }

            dernierPromptJoueur = `Tu es un assistant de jeu de rôle textuel. Aide-moi à rédiger le prochain paragraphe pour mon personnage : ${window.currentActiveCharName}.

${dataFiche}
${behaviorKnowledge}
${moodInstruction}

CONTEXTE DES DERNIERS MESSAGES DU RP :
${contextValue}

CONSIGNE SPÉCIFIQUE DU JOUEUR POUR CE TOUR :
${instructionValue}

DIRECTIVES DE RÉDACTION :
1. Rédige un texte immersif au présent ou passé simple, à la troisième personne (Il/Elle).
2. Adopte un vocabulaire riche, très axé sur le comportement félin (mouvements d'oreilles, queue, moustaches, odeurs).
3. Ne prends jamais de décision finale à la place des autres joueurs. Termine ton paragraphe sur une action ouverte ou une posture claire.
4. Génère UNIQUEMENT le texte du RP, pas de blabla, pas de salutations.`;

            try {
                const response = await fetch(MISTRAL_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${MISTRAL_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "mistral-small-latest",
                        messages: [{ role: "user", content: dernierPromptJoueur }],
                        temperature: 0.7
                    })
                });
                
                const data = await response.json();
                if (data.choices && data.choices[0]) {
                    const textAi = data.choices[0].message.content;
                    const textAiHTML = textAi.replace(/\n/g, "<br>");
                    
                    if (outputDiv) {
                        outputDiv.innerHTML = `
                        <div style="background: rgba(167, 119, 227, 0.05); border: 1px solid #a777e3; padding: 15px; border-radius: 6px; position: relative;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(167, 119, 227, 0.3); padding-bottom: 8px;">
                                <span style="color: #a777e3; font-weight: bold; font-size: 0.85rem;">🤖 Proposition de l'IA Coach :</span>
                                <div style="display: flex; gap: 5px;">
                                    <button id="btnRerollCoWrite" onclick="window.executerReroll()" style="background:#ffcc00; color:#000; border:none; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer; font-weight:bold;">🎲 Reroll</button>
                                    <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                                    <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                                </div>
                            </div>
                            <div style="color:#fff; font-size:1.15rem; font-family:Georgia, serif; line-height:1.5 !important; margin:0;">${textAiHTML}</div>
                        </div>
                        `;
                        
                        document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                            navigator.clipboard.writeText(textAi);
                            this.innerText = "✓ Copié !";
                        });
                        
                        document.getElementById("btnVoirCoWrite").addEventListener("click", function() {
                            const exModal = document.getElementById("coWriteExclusiveModal");
                            const exContent = document.getElementById("coWriteExclusiveContent");
                            if (exModal && exContent) {
                                exContent.innerHTML = textAiHTML;
                                exModal.style.display = "flex";
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("❌ Erreur de transmission API Mistral :", err);
                if (outputDiv) outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur de transmission API.</span>";
            }
        });
    }
});

/**
 * ===========================================================================
 * 4. FONCTION : REROLL DYNAMIQUE ET SÉCURISÉ
 * ===========================================================================
 */
window.executerReroll = async function() {
    const outputDiv = document.getElementById("coWriteAiOutput");
    if (outputDiv) outputDiv.innerHTML = "<span style='color:#ffcc00; font-weight:bold; display:flex; align-items:center; gap:8px;'><span class='spinner'></span> Relance des dés en cours...</span>";
    
    // Recalcul des moods au moment du reroll au cas où l'utilisateur les a changés
    let moodInstruction = "";
    const activeMoodBtns = document.querySelectorAll(".mood-btn.active");
    if (activeMoodBtns.length > 0) {
        moodInstruction = "👉 CONFIGURATION PSYCHOLOGIQUE STRICTE (CONSIGNE ABSOLUE : Chaque attribut sélectionné ci-dessous est totalement cloisonné et indépendant. Traite-les de manière brute, SANS JAMAIS lier les émotions) :\n";
        activeMoodBtns.forEach(btn => {
            const moodKey = btn.getAttribute("data-mood");
            if (GlobalMoodDictionary[moodKey]) moodInstruction += GlobalMoodDictionary[moodKey];
        });
    }

    try {
        const response = await fetch(MISTRAL_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "mistral-small-latest",
                messages: [{ role: "user", content: dernierPromptJoueur + "\n\n⚠️ ALERTE REROLL : Propose une alternative de rédaction en changeant les tournures, mais garde scrupuleusement le contexte et les exigences psychologiques." }],
                temperature: 0.85
            })
        });
        
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            const textAi = data.choices[0].message.content;
            const textAiHTML = textAi.replace(/\n/g, "<br>");
            
            if (outputDiv) {
                outputDiv.innerHTML = `
                <div style="background: rgba(167, 119, 227, 0.05); border: 1px solid #a777e3; padding: 15px; border-radius: 6px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(167, 119, 227, 0.3); padding-bottom: 8px;">
                        <span style="color: #ffcc00; font-weight: bold; font-size: 0.85rem;">🎲 Nouvelle proposition alternative :</span>
                        <div style="display: flex; gap: 5px;">
                            <button id="btnRerollCoWrite" onclick="window.executerReroll()" style="background:#ffcc00; color:#000; border:none; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer; font-weight:bold;">🎲 Reroll</button>
                            <button id="btnVoirCoWrite" style="background:#2c2c35; color:#fff; border:1px solid #a777e3; padding:3px 8px; font-size:0.7rem; border-radius:3px; cursor:pointer;">👁️ Voir</button>
                            <button id="btnCopierCoWrite" style="background:#a777e3; color:#fff; border:none; padding:3px 6px; font-size:0.7rem; border-radius:3px; cursor:pointer;">Copier</button>
                        </div>
                    </div>
                    <div style="color:#fff; font-size:1.15rem; font-family:Georgia, serif; line-height:1.5 !important; margin:0;">${textAiHTML}</div>
                </div>
                `;
                
                document.getElementById("btnCopierCoWrite").addEventListener("click", function() {
                    navigator.clipboard.writeText(textAi);
                    this.innerText = "✓ Copié !";
                });
                document.getElementById("btnVoirCoWrite").addEventListener("click", function() {
                    const exModal = document.getElementById("coWriteExclusiveModal");
                    const exContent = document.getElementById("coWriteExclusiveContent");
                    if (exModal && exContent) {
                        exContent.innerHTML = textAiHTML;
                        exModal.style.display = "flex";
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        if (outputDiv) outputDiv.innerHTML = "<span style='color:#e74c3c;'>Erreur lors du Reroll.</span>";
    }
};

window.clearAiHistory = async function(rpId) {
    if (!rpId) return;
    try {
        const aiHistoryRef = collection(db, "rps_pending", rpId, "ai_history");
        const snap = await getDocs(aiHistoryRef);
        
        if (!snap.empty) {
            const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);
            console.log(`%c🧹 [Sécurité IA] L'historique 'ai_history' du RP [${rpId}] a été nettoyé avec succès !`, "color: #2ecc71; bold warm;");
        }
    } catch (error) {
        console.error("❌ Erreur lors du nettoyage de l'historique IA :", error);
    }
};