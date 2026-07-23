export function parseRP(text) {
    if (!text) return "";
    const lines = text.split("\n");

    // Convertit le gras, l'italique et le souligné de base de façon sécurisée
    function parseInline(str) {
        str = str.replace(/__\*\*\*(.*?)\*\*\*__/g, '<span class="M__1">$1</span>');
        str = str.replace(/__\*\*(.*?)\*\*__/g, '<span class="M__2">$1</span>');
        str = str.replace(/__\*(.*?)\*__/g, '<span class="M__3">$1</span>');
        str = str.replace(/__(.*?)__/g, '<span class="M__4">$1</span>');
        str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<span class="A__1">$1</span>');
        str = str.replace(/\*\*(.*?)\*\*/g, '<span class="A__2">$1</span>');
        str = str.replace(/\*(.*?)\*/g, '<span class="A__3">$1</span>');
        return str;
    }

    return lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div id="trimmed"></div>';
        
        // 🔥 DOUBLE DÉTECTION : Lignes commençant par > OU par un tiret (— ou -)
        const estUnDialogue = trimmed.startsWith(">") || trimmed.startsWith("—") || trimmed.startsWith("-");

        if (estUnDialogue) {
            // On nettoie le marqueur d'entrée pour ne pas polluer le texte final
            let dialogueText = trimmed;
            if (dialogueText.startsWith(">")) dialogueText = dialogueText.substring(1).trim();
            
            // On s'assure qu'il y a un beau tiret cadratin au début pour le style RP
            if (!dialogueText.startsWith("—")) {
                if (dialogueText.startsWith("-")) {
                    dialogueText = "— " + dialogueText.substring(1).trim();
                } else {
                    dialogueText = "— " + dialogueText;
                }
            }

            // S'il n'y a aucune étoile double, c'est que toute la ligne est du dialogue direct
            if (!dialogueText.includes("**")) {
                return `<div class="rp-dialogue"><span class="rp-speech">${parseInline(dialogueText)}</span></div>`;
            }

            dialogueText = dialogueText.replace(/\*\*\s*\*\*/g, "** **");
            const parts = dialogueText.split(/(\*\*[^*]+\*\*)/g);
            let constructedHtml = "";

            parts.forEach(part => {
                if (!part) return;
                const cleanPart = part.trim();
                if (!cleanPart) return;

                if (cleanPart.startsWith("**") && cleanPart.endsWith("**")) {
                    let inciseText = cleanPart.substring(2, cleanPart.length - 2).trim();
                    if (inciseText.length > 0) {
                        constructedHtml += `<span class="rp-incise">${parseInline(inciseText)}</span> `;
                    }
                } else {
                    constructedHtml += `<span class="rp-speech">${parseInline(cleanPart)}</span> `;
                }
            });

            return `<div class="rp-dialogue">${constructedHtml.trim()}</div>`;
        }
        
        // 💭 GESTION DES PENSÉES ISOLÉES
        if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
            return `<div id="if-trimmed">${parseInline(trimmed)}</div>`;
        }
        
        // 🏃 PARAGRAPHE NORMAL (Actions globales / Descriptions hors dialogue)
        return `<div id="not-trimmed">${parseInline(line)}</div>`;
    }).join("");
}