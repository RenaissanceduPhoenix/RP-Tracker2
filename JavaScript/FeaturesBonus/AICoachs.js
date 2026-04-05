import { charactersDB } from './CharacterData.js';
const GROQ_API_KEY = "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";
let chatHistory = []; 

export async function askIaRP(userInstruction, isFirstMessage = false, charName = "") {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    if (isFirstMessage) {
        const characterFiche = charactersDB[charName] || "Pas de fiche détaillée.";

        chatHistory = [
            { 
                role: "system", 
                content: `Tu es Ia_RP, un assistant expert en écriture de Roleplay. 
                Tu incarnes ce personnage : ${characterFiche}

                --- RÈGLES DE MISE EN FORME (MARKDOWN) ---
                1. ACTIONS : En **gras**. (Ex: **Il bondit sur la branche**)
                2. PENSÉES : En *italique*. (Ex: *Je ne devrais pas être ici...*)
                3. DIALOGUES : Commence TOUJOURS par "> — ". 
                   La tabulation est créée par le signe "> ".
                4. INCISES DE DIALOGUE : Les verbes de parole (ex: dit-il) doivent être en **gras** à l'intérieur du dialogue.
                   (Ex: > — Je m'en moque, **cracha-t-il violemment**.)
                5. NOMS PROPRES : Si un nom apparaît dans une pensée ou action, il doit être en ***gras et italique***.
                   (Ex: ***Ardeur du Lynx***)
                6. MISE EN VALEUR : Utilise le souligné __texte__ pour insister sur un mot précis.
                
                INTERDICTION : Ne mets jamais de texte entre parenthèses. Ne fais aucun commentaire hors RP.`
            }
        ];
    }

    chatHistory.push({ role: "user", content: userInstruction });

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: chatHistory,
                temperature: 0.7
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Erreur IA:", error);
        return "Erreur de connexion avec Ia_RP.";
    }
}

window.initAiChat = async function() {
    const displayArea = document.querySelector(".rp-display-content");
    if (!displayArea) return;

    // Nettoyage : On récupère le texte SANS les parenthèses pour l'envoyer à l'IA
    let context = displayArea.innerText.replace(/\(.*?\)/g, "").trim();

    const metaText = document.querySelector(".display-header small")?.innerText || "";
    const charName = metaText.split("—")[0].trim(); 

    if (!document.getElementById("ai-chat-container")) {
        const container = document.createElement("div");
        container.id = "ai-chat-container";
        container.style = "margin-top:20px; border-top: 1px solid #ccc; padding-top:15px;";
        container.innerHTML = `
            <div id="ai-response-box">
                <strong style="color:black;">Ia_RP :</strong><br>
                <span id="ai-text">Analyse en cours...</span>
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

    const reply = await askIaRP(`Voici le RP : ${context}`, true, charName);
    document.getElementById("ai-text").innerHTML = formatMarkdown(reply);
};

window.sendToAI = async function() {
    const input = document.getElementById("ai-user-input");
    const textField = document.getElementById("ai-text");
    const instruction = input.value;
    if (!instruction) return;

    textField.innerHTML = "<em>Ia_RP réfléchit...</em>";
    input.value = "";

    const reply = await askIaRP(instruction);
    textField.innerHTML = formatMarkdown(reply);
};

// Fonction pour transformer le Markdown en HTML propre pour ton affichage
function formatMarkdown(text) {
    return text
        .replace(/\n/g, "<br>")
        .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>") // Gras + Italique
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")             // Gras
        .replace(/\*(.*?)\*/g, "<em>$1</em>")                         // Italique
        .replace(/__(.*?)__/g, "<u>$1</u>")                            // Souligné
        .replace(/^> (.*)$/gm, "<blockquote style='margin-left:20px; border:none; color:black;'>$1</blockquote>"); // Tabulation
}