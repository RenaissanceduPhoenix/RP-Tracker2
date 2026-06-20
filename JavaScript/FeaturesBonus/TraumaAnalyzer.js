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
                        content: `Tu es un expert en narration et en psychologie pour un JDR textuel basé sur l'univers de La Guerre des Clans.
Tu vas recevoir l'historique complet d'un RP. Ton objectif est d'analyser ce qui arrive au personnage nommé "${charName}".

Évalue avec précision l'impact direct des derniers événements sur lui au niveau physique (blessures, fatigue) et psychologique (traumatismes mentaux, peurs, chocs émotionnels, paranoïa, culpabilité).
Sois immersif, utilise le vocabulaire des chats sauvages (remède de guérisseur, le Clan des Étoiles, etc.).

Tu dois répondre STRICTEMENT sous la forme d'un objet JSON valide, sans aucun texte d'explication avant ou après. Le format doit être exactement le suivant :
{
  "statutGeneral": "Un court résumé de l'état du chat (ex: Choqué et ensanglanté)",
  "blessuresPhysiques": [
    "Détail de la blessure 1 (ex: Profonde griffure à l'épaule gauche - risque d'infection)",
    "Détail de la blessure 2"
  ],
  "traumatismesMentaux": [
    "Détail du trauma 1 (ex: Phobie soudaine du feu suite à l'incendie)",
    "Détail du trauma 2 (ex: Syndrome de l'imposteur - se sent coupable d'avoir survécu)"
  ],
  "conseilGuerisseur": "Le remède ou l'action recommandée (ex: Appliquer de la pulpe de souci et forcer le chat au repos complet dans la tanière)"
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