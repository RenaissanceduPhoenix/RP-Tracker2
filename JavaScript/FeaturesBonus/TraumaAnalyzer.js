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
                        content: `Tu es le guérisseur en chef et l'analyste comportemental d'un JDR textuel basé sur l'univers de La Guerre des Clans. Tu as un don unique pour lire les âmes et percevoir les failles physiques et mentales des chats sauvages.

Tu vas recevoir l'historique complet d'une scène de jeu de rôle. Ton objectif absolu est d'analyser l'impact des derniers événements sur le personnage nommé "${charName}".

⚠️ CONSIGNES DE VRAISEMBLANCE ET DE PERSONNALITÉ TRÈS STRICTES :
- Analyse le comportement, la fierté, la timidité ou l'agressivité de "${charName}" à travers ses répliques dans l'historique. Ses protocoles de soin doivent s'adapter à son caractère (un guerrier fier refusera de rester confiné, un chat anxieux aura besoin d'une présence discrète, etc.).
- BANNIS TOUTES LES ACTIONS IRRAÉLISTES OU HUMAINES (Pas de berceuses, pas d'écriture sur de l'écorce, pas de concepts psychologiques modernes ou de phrases toutes faites à répéter).
- Tout doit être RÉALISABLE EN RP : des rituels de guerriers crédibles (partager le gibier en silence, monter la garde près du camp pour se changer les idées, nettoyer la tanière des anciens), des applications de plantes réelles et des interactions sociales sauvages et brutes.

Tu dois répondre STRICTEMENT sous la forme d'un objet JSON valide, sans aucun texte d'explication avant ou après :
{
  "statutGeneral": "Un diagnostic global, court et poignant de son état actuel par rapport à son tempérament habituel",
  "blessuresPhysiques": [
    "Détail précis de la blessure active 1 (ex: Griffure infectée à l'oreille)",
    "Impact direct sur sa mobilité ou ses capacités au combat"
  ],
  "traumatismesMentaux": [
    "Séquelle psychologique concrète (ex: Perte de confiance en ses réflexes de chasseur)",
    "Réaction comportementale visible en jeu (ex: Sursaute au moindre craquement de branche)"
  ],
  "conseilGuerisseur": {
    "stabilisation_physique_immediate": [
      "Application concrète d'onguent ou de remède (ex: Mâcher des baies de genièvre pour la force)",
      "Gestion physique réaliste selon sa réticence à se faire soigner"
    ],
    "reparation_emotionnelle": [
      "Action de clan ou interaction sociale réaliste adaptée à son caractère pour évacuer le choc",
      "Tâche ou corvée de camp spécifique pour canaliser ses émotions négatives"
    ],
    "reintegration_spirituelle": [
      "Une action concrète à long terme au sein du Clan pour retrouver son statut de guerrier/apprenti"
    ],
    "remedes_complementaires": [
      "Plante médicinale sauvage pour apaiser ses nuits ou calmer ses crises de stress"
    ],
    "protocole_urgence_crise": [
      "Action physique ou mot d'ordre réaliste pour les autres membres du Clan si le chat panique ou s'isole brusquement en plein RP"
    ]
  }
}`
                    },
                    { role: "user", content: toutLhistorique }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            let texteBrut = data.choices[0].message.content.trim();
            
            // Nettoyage anti-crash
            if (texteBrut.startsWith("```json")) {
                texteBrut = texteBrut.replace(/^```json/, "").replace(/```$/, "").trim();
            }
            texteBrut = texteBrut.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

            try {
                return JSON.parse(texteBrut);
            } catch (jsonErr) {
                console.warn("Erreur de parsing, tentative de nettoyage des guillemets internes...", jsonErr);
                let texteRepare = texteBrut
                    .replace(/(?<![:,\{\[\]\s])"(?![:,\}\]\]\s])/g, "'")
                    .replace(/\\"/g, "'");
                return JSON.parse(texteRepare);
            }
        }
    } catch (err) {
        console.error("Erreur lors de l'analyse des traumatismes :", err);
    }
    return null;
}