const GROQ_API_KEY = "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";
let chatHistory = []; // Pour se souvenir de la discussion en cours


export async function askIaRP(userInstruction, isFirstMessage = false) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    if (isFirstMessage) {
        // On initialise l'historique avec le message système et le contexte du RP
        chatHistory = [
            { 
                role: "system", 
                content: "Tu es Ia_RP, un assistant expert en Roleplay. Ton but est d'aider l'utilisateur à rédiger des réponses immersives. Réponds toujours en français, de manière créative et stylée." 
            }
        ];
    }

    chatHistory.push({ role: "user", content: userInstruction });

    try {
        // ... (haut du fichier inchangé)

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                // CHANGEMENT ICI : llama3-70b-8192 est obsolète
                model: "llama-3.3-70b-versatile", 
                messages: chatHistory,
                temperature: 0.8
            })
        });

// ... (reste du fichier inchangé)

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiReply = data.choices[0].message.content;
        chatHistory.push({ role: "assistant", content: aiReply });
        return aiReply;

    } catch (error) {
        console.error("Erreur Ia_RP:", error);
        return "Désolé, j'ai eu un problème pour me connecter. Vérifie ta clé API ou ta connexion.";
    }
}

// Initialise l'interface de chat
window.initAiChat = async function() {
    const displayArea = document.querySelector(".rp-display-content");
    if (!displayArea) return;

    const context = displayArea.innerText;

    // Si le chat existe déjà, on ne le recrée pas
    if (!document.getElementById("ai-chat-container")) {
        const container = document.createElement("div");
        container.id = "ai-chat-container";
        container.style = "margin-top:20px; border-top: 2px solid #a777e3; padding-top:15px;";
        container.innerHTML = `
            <div id="ai-response-box" style="padding:15px; background:#f4f4ff; border-left:4px solid #a777e3; border-radius:4px; color:#333; font-size:0.95rem;">
                <strong>Ia_RP :</strong> <span id="ai-text">Analyse du texte en cours...</span>
            </div>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" id="ai-user-input" placeholder="Donne une consigne..." 
                       style="flex:1; padding:10px; border-radius:5px; border:1px solid #ccc; color:black !important; background:white !important;">
                <button id="btn-send-ai" style="width:auto; background:#a777e3; color:white; padding:10px 20px; border-radius:5px; border:none; cursor:pointer;">Envoyer</button>
            </div>
        `;
        displayArea.appendChild(container);

        // On lie l'événement clic au bouton
        document.getElementById("btn-send-ai").onclick = window.sendToAI;
        // Permettre d'envoyer avec la touche "Entrée"
        document.getElementById("ai-user-input").onkeypress = (e) => { if(e.key === 'Enter') window.sendToAI(); };
    }

    const firstPrompt = `Voici le RP actuel, propose-moi une suite : \n\n${context}`;
    const reply = await askIaRP(firstPrompt, true);
    document.getElementById("ai-text").innerHTML = reply.replace(/\n/g, "<br>");
};

window.sendToAI = async function() {
    const input = document.getElementById("ai-user-input");
    const textField = document.getElementById("ai-text");
    const instruction = input.value;
    
    if (!instruction) return;

    textField.innerHTML = "<em>Ia_RP réfléchit...</em>";
    input.value = "";

    const reply = await askIaRP(instruction);
    textField.innerHTML = reply.replace(/\n/g, "<br>");
};