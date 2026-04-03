
// ➜ Parser RP avancé avec ***gras+italique***
function parseRP(text) {
  const lines = text.split("\n");
  function parseInline(str) {
    // ***gras+italique***
    str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<span style="font-weight:bold;font-style:italic">$1</span>');
    // **gras**
    str = str.replace(/\*\*(.*?)\*\*/g, '<span class="rp-action">$1</span>');
    // *pensée*
    str = str.replace(/\*(.*?)\*/g, '<span class="rp-thought">$1</span>');
    return str;
  }
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="margin-bottom:12px"></div>';
    if (/^\*\*\*.*\*\*\*$/.test(trimmed)) return `<div style="font-weight:bold;font-style:italic;margin-bottom:12px">${trimmed.slice(3,-3)}</div>`;
    if (/^\*\*.*\*\*$/.test(trimmed)) return `<div class="rp-action" style="margin-bottom:12px">${trimmed.slice(2,-2)}</div>`;
    if (/^\*.*\*$/.test(trimmed)) return `<div class="rp-thought" style="margin-bottom:12px">${trimmed.slice(1,-1)}</div>`;
    if (/^>/.test(trimmed)) return `<div class="rp-dialogue" style="margin-bottom:12px">${parseInline(trimmed.replace(/^>\s?/,'</div>'))}</div>`;
    return `<div style="margin-bottom:12px">${parseInline(line)}</div>`;
  }).join("");
}

// ➜ Modal
window.openModal = function(content, title, meta) {
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalMeta").innerText = meta;
  document.getElementById("modalText").innerHTML = parseRP(content);
  document.getElementById("modal").style.display = "flex";
};
window.closeModal = function() { document.getElementById("modal").style.display = "none"; };