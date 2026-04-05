const GROQ_API_KEY = "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";

export async function generateRPResponse(context) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    const systemPrompt = `Tu es Ia_RP, un assistant expert en écriture de Roleplay. 
    Ton but est d'aider l'utilisateur à rédiger une suite cohérente. 
    Analyse le message reçu, respecte le ton et propose une réponse immersive, bien écrite, en français.
    Ne fais pas de blabla inutile, donne directement la proposition de réponse.`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192", // Le modèle le plus puissant
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Voici le RP auquel je dois répondre : \n\n ${context}` }
                ],
                temperature: 0.7 // Un peu de créativité mais reste cohérent
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Erreur IA:", error);
        return "Mince, Ia_RP a eu un bug... Vérifie ta connexion ou ta clé API.";
    }
}

// On attache la fonction au window pour qu'elle soit accessible partout
window.askAI = async function() {
    const displayArea = document.querySelector(".rp-display-content");
    if (!displayArea) return;

    const originalText = displayArea.innerText;
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-loading";
    loadingDiv.innerText = "Ia_RP réfléchit à une suite magistrale...";
    displayArea.appendChild(loadingDiv);

    const aiSuggestion = await generateRPResponse(originalText);
    
    loadingDiv.remove();
    
    // On affiche la suggestion dans un bloc spécial
    const aiBlock = document.createElement("div");
    aiBlock.style.marginTop = "20px";
    aiBlock.style.padding = "15px";
    aiBlock.style.background = "#f0f0ff";
    aiBlock.style.borderLeft = "4px solid #a777e3";
    aiBlock.style.borderRadius = "4px";
    aiBlock.innerHTML = `<strong>Suggestion de Ia_RP :</strong><br><br>${aiSuggestion.replace(/\n/g, "<br>")}`;
    
    displayArea.appendChild(aiBlock);
};