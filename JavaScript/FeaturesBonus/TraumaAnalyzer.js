// CONFIGURATION MISTRAL (On réutilise tes clés)
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/**
 * Analyse la scène de RP pour générer des blessures physiques et des séquelles psychologiques/traumatismes
 * @param {string} charName - Le nom du personnage concerné
 * @returns {Promise<Object|null>} - Un objet contenant les blessures et traumatismes détectés
 */
export async function analyserImpactPhysiqueEtMental(charName) {
    const historyLog = document.getElementById("rpHistoryLog");
    if (!historyLog) return null;

    const toutLhistorique = historyLog.innerText;
    if (toutLhistorique.trim() === "") return null;

    try {
        const response = await fetch(MISTRAL_URL, {
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
                        content: `Tu es le plus grand guérisseur et analyste psychologique de l'univers de La Guerre des Clans. Tu as un don unique pour lire les âmes, décrypter l'inconscient et percevoir les moindres failles physiques et mentales d'un chat sauvage.

Tu vas recevoir l'historique complet d'une scène de jeu de rôle (RP). Ton objectif absolu est d'analyser avec une profondeur chirurgicale ce qui arrive au personnage nommé "${charName}". Va chercher les détails cachés entre les lignes.

Analyse minutieusement ces 4 dimensions :
1. 🩸 L'IMPACT PHYSIQUE ABSOLU : Ne te limite pas aux blessures évidentes. Évalue l'état des muscles, l'épuisement cellulaire, les micro-déchirures, les infections latentes, la douleur sourde, l'impact de la météo (froid, humidité) sur ses anciennes cicatrices et sa capacité motrice immédiate.
2. 🧠 LA PSYCHÉ PROFONDE & LES FAILLES DE L'ÂME : Analyse son inconscient. Quels traumatismes ancrés se réveillent ? Est-il en état de dissociation, de paranoïa, de deuil bloqué, de culpabilité du survivant, ou de rupture de confiance envers ses proches ou son Clan ? Détecte les chocs émotionnels invisibles.
3. 🌀 L'ÉVOLUTION ET LA SYNCHRONICITÉ : Comment cette scène transforme-t-elle sa vision du monde ? Devient-il plus sauvage, soumis, terrifié, ou obsédé par la vengeance ?
4. 🌿 LA SAGESSE DU GUÉRISSEUR : Propose un protocole de soin immersif (remèdes complexes à base de plantes, isolement, rituels de paroles ou repos spirituel) pour tenter de réparer ce qui a été brisé.

Tu dois répondre STRICTEMENT sous la forme d'un objet JSON valide, sans aucun texte d'explication avant ou après. Le format doit être exactement le suivant :
{
  "statutGeneral": "Un diagnostic global et poignant de son état (ex: Coquille vide, rongée par la fièvre et la trahison)",
  "blessuresPhysiques": [
    "Détail précis de la blessure active 1 (ex: Entorse sévère à la patte avant droite avec gonflement critique - nécessite une immobilisation)",
    "Détail des séquelles invisibles (ex: Épuisement total des réserves physiques, tremblements dus au choc hypothermique)"
  ],
  "traumatismesMentaux": [
    "Traumatisme psychologique majeur (ex: Syndrome de stress post-traumatique lié à l'effondrement de la tanière, peur panique de l'obscurité)",
    "Altération de la psyché (ex: Paranoïa aiguë envers ses camarades de patrouille, sentiment d'abandon par le Clan des Étoiles)"
  ],
  "conseilGuerisseur": "Le protocole de soins médicaux et spirituels (ex: Application de bile de souris pour les tiques de stress, cataplasme de souci et de racine de glouteron, suivi d'une veille silencieuse sous la garde d'un ancien)"
}`
                    },
                    { role: "user", content: toutLhistorique }
                ],
                temperature: 0.5
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            let cleanJson = data.choices[0].message.content.replace(/```json|```/g, "").trim();
            return JSON.parse(cleanJson);
        }
    } catch (err) {
        console.error("Erreur lors de l'analyse des traumatismes :", err);
    }
    return null;
}