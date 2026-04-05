const GROQ_API_KEY = "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";
let chatHistory = []; // Pour se souvenir de la discussion en cours

export async function askIaRP(userInstruction, isFirstMessage = false) {
    const url = "https://api.groq.com/oneweight/v1/chat/completions";
    
    if (isFirstMessage) {
        chatHistory = [
            { role: "system", content: "Tu es Ia_RP, un assistant expert en Roleplay. Aide l'utilisateur à rédiger. Sois immersif, créatif et réponds en français." }
        ];
    }

    chatHistory.push({ role: "user", content: userInstruction });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: chatHistory,
                temperature: 0.7
            })
        });

        const data = await response.json();
        const aiReply = data.choices[0].message.content;
        
        chatHistory.push({ role: "assistant", content: aiReply });
        return aiReply;
    } catch (error) {
        console.error("Erreur IA:", error);
        return "Erreur de communication avec Ia_RP.";
    }
}

// Fonction appelée quand on clique sur le bouton magique
window.initAiChat = async function() {
    const displayArea = document.querySelector(".rp-display-content");
    const context = displayArea.innerText;

    // Créer l'interface de chat si elle n'existe pas
    if (!document.getElementById("ai-chat-container")) {
        const container = document.createElement("div");
        container.id = "ai-chat-container";
        container.innerHTML = `
            <div id="ai-response-box" style="margin-top:20px; padding:15px; background:#f0f0ff; border-left:4px solid #a777e3; border-radius:4px; color:#333;">
                <strong>Ia_RP :</strong> <span id="ai-text">Analyse du RP en cours...</span>
            </div>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" id="ai-user-input" placeholder="Donne une consigne (ex: 'plus sombre', 'fais le pleurer'...)" 
                       style="flex:1; padding:8px; border-radius:4px; border:1px solid #ccc; color: black !important; background: white !important;">
                <button onclick="window.sendToAI()" style="width:auto; background:#a777e3; color:white; padding:8px 15px;">Envoyer</button>
            </div>
        `;
        displayArea.appendChild(container);
    }

    const reply = await askIaRP(`Voici le RP : ${context}`, true);
    document.getElementById("ai-text").innerHTML = reply.replace(/\n/g, "<br>");
};

window.sendToAI = async function() {
    const input = document.getElementById("ai-user-input");
    const textField = document.getElementById("ai-text");
    const instruction = input.value;
    if (!instruction) return;

    textField.innerText = "Ia_RP réfléchit...";
    input.value = "";

    const reply = await askIaRP(instruction);
    textField.innerHTML = reply.replace(/\n/g, "<br>");
};