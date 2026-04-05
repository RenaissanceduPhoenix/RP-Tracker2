import { db } from './Firebase.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';

let unsubscribePending = null;

// Mise à jour des statistiques
window.updateStats = async function() {
    const statsContainer = document.getElementById("statsContainer");
    if (!statsContainer) return;
    try {
        const s = await getAdvancedStats();
        statsContainer.innerHTML = `
            <div class="stat-grid">
                <div class="stat-card"><span class="stat-label">RP / Semaine</span><span class="stat-value">${s.totalSemaine}</span></div>
                <div class="stat-card"><span class="stat-label">Moyenne / Jour</span><span class="stat-value">${s.moyenneJour}</span></div>
                <div class="stat-card"><span class="stat-label">À répondre</span><span class="stat-value" style="color:#ffcc00">${s.pendingCount}</span></div>
                <div class="stat-card"><span class="stat-label">Top Serveur</span><span class="stat-value" style="font-size:0.9rem">${s.topServer}</span></div>
                <div class="stat-card"><span class="stat-label">Top Perso</span><span class="stat-value" style="font-size:0.9rem">${s.topChar}</span></div>
            </div>`;
    } catch (e) { console.error("Erreur Stats:", e); }
};

// Ajouter un RP envoyé
window.addSent = async function() {
    const character = document.getElementById("char_sent").value;
    const server = document.getElementById("server_sent").value;
    if (!character || !server) return;
    await addDoc(collection(db, "rps_sent"), { character, server, createdAt: new Date() });
    document.getElementById("char_sent").value = "";
    document.getElementById("server_sent").value = "";
    window.updateStats();
};

// Ajouter un RP reçu (Pending)
window.addReceived = async function() {
    const title = document.getElementById("title").value;
    const character = document.getElementById("char_received").value;
    const server = document.getElementById("server_received").value;
    const content = document.getElementById("content").value;
    if (!title || !character || !server) return;
    await addDoc(collection(db, "rps_received"), { title, character, server, content, status: "pending", createdAt: new Date() });
    ["title", "char_received", "server_received", "content"].forEach(id => document.getElementById(id).value = "");
    window.updateStats();
};

// Charger la liste Pending avec la pastille
window.loadPending = function() {
    const list = document.getElementById("pendingList");
    const q = query(collection(db, "rps_received"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    
    if (unsubscribePending) unsubscribePending();

    unsubscribePending = onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        if (snapshot.empty) {
            list.innerHTML = "<p style='color:#666; text-align:center;'>Aucun RP en attente</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const rp = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement("div");
            card.className = "rp-card";
            
            card.onclick = () => window.openModal(rp.content, rp.title, `${rp.character} — ${rp.server}`);
            
            card.innerHTML = `
                <div style="flex:1;">
                    <b>${rp.title}</b> ${getUrgencyTag(rp.createdAt)}<br>
                    <small>${rp.character}</small>
                </div>
                <button class="btn-done" onclick="event.stopPropagation(); markDone('${id}')">Fait</button>
            `;
            list.appendChild(card);
        });
    }, (error) => {
        console.error("Erreur Liste:", error);
        list.innerHTML = `<p style="color:red; font-size:0.8rem;">Erreur d'index Firebase. Vérifie la console (F12).</p>`;
    });
};

window.markDone = async function(id) {
    await updateDoc(doc(db, "rps_received", id), { status: "done" });
    window.updateStats();
};

window.openModal = function(content, title, meta) {
    document.getElementById("displayArea").innerHTML = `
        <div style="padding:15px; background:#eee; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center;">
            <div><h3 style="margin:0; color:black;">${title}</h3><small style="color:#666;">${meta}</small></div>
            <span style="cursor:pointer; font-size:24px; color:#999;" onclick="window.clearView()">×</span>
        </div>
        <div class="rp-display-content">
            ${parseRP(content)}
        </div>
        <div style="padding: 0 20px 20px 20px;">
            <button class="btn-ai" onclick="window.askAI()">✨ Demander à Ia_RP</button>
        </div>`;
};

window.clearView = function() {
    document.getElementById("displayArea").innerHTML = `<p style="color:#999; text-align:center; margin-top:50px;">(Sélectionnez un RP)</p>`;
};

document.addEventListener('DOMContentLoaded', () => {
    window.loadPending();
    window.updateStats();
});