export function parseRP(text) {
    if (!text) return "";
    const lines = text.split("\n");

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
        if (trimmed.startsWith(">")) {
            return `<div class="rp-dialogue">${parseInline(trimmed.substring(1).trim())}</div>`;
        }
        return `<div style="margin-bottom:8px">${parseInline(line)}</div>`;
    }).join("");
}