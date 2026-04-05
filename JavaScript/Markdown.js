function parseInline(str) {
    // 1. Souligné + Gras + Italique (___***)
    str = str.replace(/__\*\*\*(.*?)\*\*\*__/g, '<span style="text-decoration:underline; font-weight:bold; font-style:italic">$1</span>');
    
    // 2. Souligné + Gras (__**)
    str = str.replace(/__\*\*(.*?)\*\*__/g, '<span style="text-decoration:underline; font-weight:bold">$1</span>');
    
    // 3. Souligné + Italique (__*)
    str = str.replace(/__\*(.*?)\*__/g, '<span style="text-decoration:underline; font-style:italic">$1</span>');
    
    // 4. Souligné SIMPLE (celui que tu as ajouté, placé ici pour la sécurité)
    str = str.replace(/__(.*?)__/g, '<span style="text-decoration:underline;">$1</span>');

    // 5. Gras + Italique (***)
    str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<span style="font-weight:bold; font-style:italic">$1</span>');
    
    // 6. Gras SIMPLE (**)
    str = str.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight:bold">$1</span>');
    
    // 7. Italique SIMPLE (*)
    str = str.replace(/\*(.*?)\*/g, '<span style="font-style:italic">$1</span>');

    return str;
}