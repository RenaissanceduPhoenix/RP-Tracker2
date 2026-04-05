import { db } from './Firebase.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js'; // Vérifie bien le nom du fichier ici !

let unsubscribePending = null;

// Fonctions globales pour le HTML
window.addSent = async function() {
    const character = document.getElementById("char_sent").value;
    const server = document.getElementById("server_sent").value;
    if (!character || !server) return;
    await addDoc(collection(db, "rps_sent"), { character, server, createdAt: new Date() });
    document.getElementById("char_sent").value = "";
    document.getElementById("server_sent").value = "";
};

window.addReceived = async function() {
    const title = document.getElementById("title").value;
    const character = document.getElementById("char_received").value;
    const server = document.getElementById("server_received").value;
    const content = document.getElementById("content").value;
    if (!title || !character || !server) return;
    await addDoc(collection(db, "rps_received"), { title, character, server, content, status: "pending", createdAt: new Date() });
    document.getElementById("title").value = "";
    document.getElementById("char_received").value = "";
    document.getElementById("server_received").value = "";
    document.getElementById("content").value = "";
};

window.loadPending = function() {
    const q = query(collection(db, "rps_received"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    if (unsubscribePending) unsubscribePending();

    unsubscribePending = onSnapshot(q, (snapshot) => {
        const list = document.getElementById("pendingList");
        if (!list) return;
        list.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const rp = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement("div");
            card.className = "rp-card";
            const metaText = `${rp.character} — ${rp.server}`;
            card.onclick = () => window.openModal(rp.content, rp.title, metaText);
            card.innerHTML = `
                <div><b>${rp.title}</b><br><small>${metaText}</small></div>
                <button class="btn-done" onclick="event.stopPropagation(); markDone('${id}')">Fait</button>
            `;
            list.appendChild(card);
        });
    });
};

window.markDone = async function(id) {
    await updateDoc(doc(db, "rps_received", id), { status: "done" });
};

window.openModal = function(content, title, meta) {
    const displayArea = document.getElementById("displayArea");
    if (displayArea) {
        displayArea.innerHTML = `
            <div class="display-header">
                <span class="close-view" onclick="window.clearView()">×</span>
                <h3 style="color:black; margin:0;">${title}</h3>
                <small style="color:#666;">${meta}</small>
            </div>
            <hr style="margin:15px 0; border:0; border-top:1px solid #ccc;">
            <div class="rp-display-content">${parseRP(content)}</div>
        `;
    }
};

window.clearView = function() {
    document.getElementById("displayArea").innerHTML = `<p style="color:#999;">(Sélectionnez un RP)</p>`;
};

// Lancement
document.addEventListener('DOMContentLoaded', () => {
    window.loadPending();
});