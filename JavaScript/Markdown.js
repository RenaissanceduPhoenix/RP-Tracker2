export function parseRP(text) {
    if (!text) return "";
    const lines = text.split("\n");

    // Convertit le gras, l'italique et le souligné de base de façon sécurisée
    function parseInline(str) {
        str = str.replace(/__\*\*\*(.*?)\*\*\*__/g, '<span style="text-decoration:underline; font-weight:bold; font-style:italic">$1</span>');
        str = str.replace(/__\*\*(.*?)\*\*__/g, '<span style="text-decoration:underline; font-weight:bold">$1</span>');
        str = str.replace(/__\*(.*?)\*__/g, '<span style="text-decoration:underline; font-style:italic">$1</span>');
        str = str.replace(/__(.*?)__/g, '<span style="text-decoration:underline;">$1</span>');
        str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<span style="font-weight:bold; font-style:italic">$1</span>');
        str = str.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight:bold">$1</span>');
        str = str.replace(/\*(.*?)\*/g, '<span style="font-style:italic">$1</span>');
        return str;
    }

    return lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div style="height:12px"></div>';
        
        // 💬 GESTION DES DIALOGUES (Lignes commençant par >)
        if (trimmed.startsWith(">")) {
            let dialogueText = trimmed.substring(1).trim();
            
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
            return `<div style="margin-bottom:8px; font-style:italic; color:#bbb;">${parseInline(trimmed)}</div>`;
        }
        
        // 🏃 PARAGRAPHE NORMAL (Actions globales / Descriptions hors dialogue)
        return `<div style="margin-bottom:8px;">${parseInline(line)}</div>`;
    }).join("");
}