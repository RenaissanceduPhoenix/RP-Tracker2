import { charactersDB } from './CharacterData.js';
const GROQ_API_KEY = "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";
let chatHistory = []; // Pour se souvenir de la discussion en cours


export async function askIaRP(userInstruction, isFirstMessage = false, charName = "") {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    if (isFirstMessage) {
        // On récupère la fiche via l'alias (nom actuel dans le tracker)
        const characterFiche = charactersDB[charName] || "Pas de fiche détaillée.";

        chatHistory = [
            { 
                role: "system", 
                content: `Tu es Ia_RP, un assistant expert en écriture. 
                Tu dois aider l'utilisateur à répondre à un RP en incarnant ce personnage :
                ${characterFiche}
                
                Règles :
                - Garde le ton du personnage décrit.
                - Si c'est un chaton (ex: Petite Lynx), le langage est plus simple et naïf.
                - Si c'est une apprentie ou guerrière, adapte la maturité.`
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

    // 1. On récupère le texte du header (ex: "Nuage de Lynx — Clan de la Canopée")
    const metaText = document.querySelector(".display-header small")?.innerText || "";
    
    // 2. On extrait juste le nom (ce qui est avant le tiret) et on nettoie les espaces
    const charName = metaText.split("—")[0].trim(); 

    // 3. On cherche la fiche dans notre dictionnaire d'alias
    const charInfo = charactersDB[charName] || "Personnage inconnu. Reste cohérent avec le contexte du message.";

    // 4. Création de l'interface (si elle n'existe pas)
    if (!document.getElementById("ai-chat-container")) {
        const container = document.createElement("div");
        container.id = "ai-chat-container";
        container.style = "margin-top:20px; border-top: 2px dashed #a777e3; padding-top:15px;";
        container.innerHTML = `
            <div id="ai-response-box" style="padding:15px; background:#f4f4ff; border-left:4px solid #a777e3; border-radius:4px; color:#333;">
                <strong style="color:#6e8efb;">Ia_RP (${charName}) :</strong> <br>
                <span id="ai-text">Analyse de la fiche et du contexte...</span>
            </div>
            <div style="display:flex; gap:5px; margin-top:10px;">
                <input type="text" id="ai-user-input" placeholder="Consigne pour ${charName}..." 
                       style="flex:1; padding:10px; border-radius:5px; border:1px solid #ccc; color:black !important; background:white !important;">
                <button id="btn-send-ai" style="background:#a777e3; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">Envoyer</button>
            </div>
        `;
        displayArea.appendChild(container);
        document.getElementById("btn-send-ai").onclick = window.sendToAI;
    }

    const context = displayArea.innerText;

    // 5. On lance l'IA avec la fiche trouvée
    // On passe charName pour que askIaRP sache quelle fiche utiliser pour le system prompt
    const firstPrompt = `Voici le message de mon partenaire de RP, propose-moi une suite immersive : \n\n${context}`;
    const reply = await askIaRP(firstPrompt, true, charName); 
    
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