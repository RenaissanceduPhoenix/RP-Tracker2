// On ajoute "export" ici pour que RP.js puisse la voir
export function parseRP(text) {
  if (!text) return "";
  const lines = text.split("\n");

  // Cette fonction est utilisée seulement ici, pas besoin d'export
  function parseInline(str) {
    // 1. Souligné + Gras + Italique (___***)
    str = str.replace(/__\*\*\*(.*?)\*\*\*__/g, '<span style="text-decoration:underline; font-weight:bold; font-style:italic">$1</span>');
    
    // 2. Souligné + Gras (__**)
    str = str.replace(/__\*\*(.*?)\*\*__/g, '<span style="text-decoration:underline; font-weight:bold">$1</span>');
    
    // 3. Souligné + Italique (__*)
    str = str.replace(/__\*(.*?)\*__/g, '<span style="text-decoration:underline; font-style:italic">$1</span>');
    
    // 4. Souligné SIMPLE (__)
    str = str.replace(/__(.*?)__/g, '<span style="text-decoration:underline;">$1</span>');

    // 5. Gras + Italique (***)
    str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<span style="font-weight:bold; font-style:italic">$1</span>');
    
    // 6. Gras SIMPLE (**)
    str = str.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight:bold">$1</span>');
    
    // 7. Italique SIMPLE (*)
    str = str.replace(/\*(.*?)\*/g, '<span style="font-style:italic">$1</span>');

    return str;
  }

  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height:12px"></div>';

    // Gestion de la tabulation (symbole >)
    if (trimmed.startsWith(">")) {
      const content = trimmed.substring(1).trim();
      return `<div class="rp-dialogue">${parseInline(content)}</div>`;
    }

    return `<div style="margin-bottom:8px">${parseInline(line)}</div>`;
  }).join("");
}