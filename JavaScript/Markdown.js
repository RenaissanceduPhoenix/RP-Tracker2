export function parseRP(text) {
    if (!text) return "";
    const lines = text.split("\n");

    function parseInline(str) {
        str = str.replace(/__\\*\\*\\*(.*?)\\*\\*\\*__/g, '<span style="text-decoration:underline; font-weight:bold; font-style:italic">$1</span>');
        str = str.replace(/__\\*\\*(.*?)\\*\\*__/g, '<span style="text-decoration:underline; font-weight:bold">$1</span>');
        str = str.replace(/__\\*(.*?)\\*__/g, '<span style="text-decoration:underline; font-style:italic">$1</span>');
        str = str.replace(/__(.*?)__/g, '<span style="text-decoration:underline;">$1</span>');
        str = str.replace(/\\*\\*\\*(.*?)\\*\\*\\*/g, '<span style="font-weight:bold; font-style:italic">$1</span>');
        str = str.replace(/\\*\\*(.*?)\\*\\*/g, '<span style="font-weight:bold">$1</span>');
        str = str.replace(/\\*(.*?)\\*/g, '<span style="font-style:italic">$1</span>');
        return str;
    }

    return lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div style="height:12px"></div>';
        
        // 💬 GESTION DES DIALOGUES (Lignes commençant par >)
        if (trimmed.startsWith(">")) {
            let dialogueText = trimmed.substring(1).trim();
            
            // 1. On applique d'abord le parseur inline classique
            let htmlParsed = parseInline(dialogueText);
            
            // 2. On transforme les balises de gras standard pour basculer vers la classe .rp-incise
            // On ferme le span de parole, on met l'incise, puis on réouvre le span de parole
            htmlParsed = htmlParsed.replace(/<span style="font-weight:bold">(.*?)<\/span>/g, '</span><span class="rp-incise">$1</span><span class="rp-speech">');
            
            // 3. On enveloppe le tout : le div gère la barre jaune, et on commence directement en mode "paroles jaunes"
            let finalOutput = `<div class="rp-dialogue"><span class="rp-speech">${htmlParsed}</span></div>`;
            
            // 4. Nettoyage de sécurité au cas où des balises vides se créent en fin ou début de ligne
            finalOutput = finalOutput.replace(/<span class="rp-speech"><\/span>/g, "");
            
            return finalOutput;
        }
        
        // Paragraphe normal (Actions globales / Descriptions)
        return `<div style="margin-bottom:8px">${parseInline(line)}</div>`;
    }).join("");
}