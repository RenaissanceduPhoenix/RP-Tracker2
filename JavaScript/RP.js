import { db } from './Firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';

let unsubscribePending = null;

// Ajouter RP envoyé (Stats)
window.addSent = async function() {
  const character = document.getElementById("char_sent").value;
  const server = document.getElementById("server_sent").value;
  if (!character || !server) { alert("Remplis tous les champs"); return; }
  await addDoc(collection(db, "rps_sent"), { character, server, createdAt: new Date() });
  document.getElementById("char_sent").value = "";
  document.getElementById("server_sent").value = "";
};

// Ajouter RP reçu (Pending)
window.addReceived = async function() {
  const title = document.getElementById("title").value;
  const character = document.getElementById("char_received").value;
  const server = document.getElementById("server_received").value;
  const content = document.getElementById("content").value;
  if (!title || !character || !server) { alert("Remplis tous les champs"); return; }
  await addDoc(collection(db, "rps_received"), { title, character, server, content, status: "pending", createdAt: new Date() });
  document.getElementById("title").value = "";
  document.getElementById("char_received").value = "";
  document.getElementById("server_received").value = "";
  document.getElementById("content").value = "";
};

// Charger la liste Pending
window.loadPending = function() {
  const q = query(collection(db, "rps_received"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
  
  if (unsubscribePending) unsubscribePending();

  unsubscribePending = onSnapshot(q, (snapshot) => {
    const list = document.getElementById("pendingList");
    list.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const rp = docSnap.data();
      const id = docSnap.id;
      const card = document.createElement("div"); // Correction de la variable div -> card
      card.className = "rp-card";
      
      const metaText = `${rp.character} — ${rp.server}`;

      card.onclick = () => window.openModal(rp.content, rp.title, metaText);

      card.innerHTML = `
        <div class="rp-info">
          <b>${rp.title}</b><br>
          <small>${metaText}</small>
        </div>
        <button class="btn-done" onclick="event.stopPropagation(); markDone('${id}')">Fait</button>
      `;
      list.appendChild(card);
    });
  });
};

// Marquer comme fait
window.markDone = async function(id) {
  await updateDoc(doc(db, "rps_received", id), { status: "done" });
};

// AFFICHAGE DU RP (Zone Blanche)
window.openModal = function(content, title, meta) {
    const displayArea = document.getElementById("displayArea");
    if (displayArea) {
        const formattedContent = parseRP(content || "");
        displayArea.innerHTML = `
            <div class="display-header">
                <span class="close-view" onclick="window.clearView()">×</span>
                <h3 style="margin:0; color:black;">${title}</h3>
                <small style="color:#666;">${meta}</small>
            </div>
            <hr style="border:0; border-top:1px solid #ccc; margin:15px 0;">
            <div class="rp-display-content">
                ${formattedContent}
            </div>
        `;
        displayArea.scrollTop = 0;
    }
};

// La Croix : vider l'affichage
window.clearView = function() {
    const displayArea = document.getElementById("displayArea");
    displayArea.innerHTML = `<p style="color: #666;">(Sélectionnez un RP dans la liste pour l'afficher ici)</p>`;
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    window.loadPending();
});