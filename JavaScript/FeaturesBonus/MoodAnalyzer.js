// ⚠️ CONFIGURATION MISTRAL (On reprend tes clés existantes)
const MISTRAL_API_KEY = "nVW87olvLqN1sMoh7oZfiA3xi3xKr2OT"; 
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/**
 * Analyse l'intégralité du RP et applique la classe .detected (orange) 
 * sur les moods correspondants au positionnement psychologique de ton personnage.
 * @param {string} charName - Le nom de ton personnage (ex: Nuage de Jais)
 */
export async function analyserSituationEtAppliquerMoods(charName) {
    const historyLog = document.getElementById("rpHistoryLog");
    if (!historyLog) return;

    // 1. Récupération de l'intégralité de l'historique de la scène de RP
    const toutLhistorique = historyLog.innerText;
    if (toutLhistorique.trim() === "") return;

    // 2. Récupérer la liste des moods disponibles dans l'interface
    const boutonsMoods = document.querySelectorAll(".mood-btn");
    const listeMoodsDisponibles = Array.from(boutonsMoods).map(btn => btn.getAttribute("data-mood") || btn.innerText.trim());

    // 3. Réinitialiser d'abord les détections orange précédentes
    boutonsMoods.forEach(btn => btn.classList.remove("detected"));

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
                        content: `Tu es un assistant d'analyse psychologique expert pour JDR basé sur l'univers de La Guerre des Clans.
Tu vas recevoir l'historique complet d'une scène de RP en cours.

Ton objectif est d'analyser la situation globale (ce qu'il se passe, l'ambiance), puis de te focaliser UNIQUEMENT sur le personnage nommé "${charName}".
Détermine son placement précis vis-à-vis de la situation, ses émotions actuelles et sa réaction psychologique face aux autres chats.

Sélectionne ensuite les émotions ou ambiances qui correspondent le mieux à SON ÉTAT dans cette liste exacte : [${listeMoodsDisponibles.join(", ")}].
Tu dois répondre STRICTEMENT sous la forme d'un objet JSON valide (sans aucun autre texte) contenant un tableau "moods", comme ceci :
{
  "moods": ["Colère", "Tristesse"]
}`
                    },
                    { role: "user", content: toutLhistorique }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) return;
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            let cleanJson = data.choices[0].message.content.replace(/```json|```/g, "").trim();
            const resultat = JSON.parse(cleanJson);
            const moodsDetectes = resultat.moods || [];

            // 4. Application des classes sur les boutons trouvés
            boutonsMoods.forEach(btn => {
                const moodNom = btn.getAttribute("data-mood") || btn.innerText.trim();
                if (moodsDetectes.includes(moodNom)) {
                    // On ajoute les deux classes !
                    btn.classList.add("detected", "active");
                    
                    // On nettoie les styles inline dorés pour laisser le CSS prendre le relais
                    btn.style.borderColor = "";
                    btn.style.background = "";
                }
            });
        }
    } catch (err) {
        console.error("Erreur lors de l'analyse globale des moods :", err);
    }
}