import { db } from './Firebase.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';
import { collection, updateDoc, doc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';

import { db } from './Firebase.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';

// --- AJOUT DES FONCTIONS POUR LE HTML ---

window.addSent = async function() {
    const char = document.getElementById("char_sent").value;
    const server = document.getElementById("server_sent").value;
    if (!char || !server) return alert("Remplis les champs !");

    try {
        await addDoc(collection(db, "rps_sent"), {
            character: char,
            server: server,
            createdAt: serverTimestamp()
        });
        alert("Stat ajoutée !");
        document.getElementById("char_sent").value = "";
        document.getElementById("server_sent").value = "";
        if(window.updateStats) window.updateStats();
    } catch (e) { console.error(e); }
};

window.addReceived = async function() {
    const title = document.getElementById("title").value;
    const char = document.getElementById("char_received").value;
    const server = document.getElementById("server_received").value;
    const content = document.getElementById("content").value;

    if (!title || !char || !server || !content) return alert("Remplis tout !");

    try {
        await addDoc(collection(db, "rps_received"), {
            title: title,
            character: char,
            server: server,
            content: content,
            status: "pending",
            createdAt: serverTimestamp()
        });
        alert("Ajouté au Pending !");
        // Reset des champs
        ["title", "char_received", "server_received", "content"].forEach(id => document.getElementById(id).value = "");
    } catch (e) { console.error(e); }
};

let unsubscribePending = null;

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
            </div>`;
    } catch (e) { console.error(e); }
};

// Chargement de la liste (Accepte un tableau de noms pour les failles)
window.loadPending = function(filterNames = null) {
    let q = query(collection(db, "rps_received"), where("status", "==", "pending"), orderBy("createdAt", "desc"));

    if (filterNames) {
        const namesToSearch = Array.isArray(filterNames) ? filterNames : [filterNames];
        q = query(
            collection(db, "rps_received"), 
            where("status", "==", "pending"), 
            where("character", "in", namesToSearch), 
            orderBy("createdAt", "desc")
        );
    }

    if (unsubscribePending) unsubscribePending();
    
    const list = document.getElementById("pendingList");
    unsubscribePending = onSnapshot(q, (snapshot) => {
        if (!list) return;
        list.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const rp = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement("div");
            card.className = "rp-card";
            card.onclick = () => window.openModal(rp.content, rp.title, `${rp.character} — ${rp.server}`);
            card.innerHTML = `
                <div style="flex:1;">
                    <b>${rp.title}</b> ${getUrgencyTag(rp.createdAt)}<br>
                    <small>${rp.character} — ${rp.server}</small>
                </div>
                <button class="btn-done" onclick="event.stopPropagation(); markDone('${id}')">Fait</button>
            `;
            list.appendChild(card);
        });
    }, (error) => { console.error(error); });
};

window.markDone = async function(id) {
    await updateDoc(doc(db, "rps_received", id), { status: "done" });
    window.updateStats();
};

window.clearView = function() {
    const displayArea = document.getElementById("displayArea");
    if (displayArea) { displayArea.innerHTML = ""; displayArea.style.display = "none"; }
};

window.openModal = function(content, title, meta) {
    const cleanContent = content.replace(/\(.*?\)/g, "").trim();
    const displayArea = document.getElementById("displayArea");
    if (displayArea) {
        displayArea.style.display = "block";
        displayArea.innerHTML = `
            <div style="padding:15px; background:#eee; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center;">
                <div><h3 style="margin:0; color:black;">${title}</h3><small style="color:#666;">${meta}</small></div>
                <span style="cursor:pointer; font-size:24px; color:#999;" onclick="window.clearView()">×</span>
            </div>
            <div class="rp-display-content" style="background:white; color:black; padding:20px; overflow-y:auto; max-height:70vh;">
                ${parseRP(cleanContent)}
            </div>
            <div style="padding: 10px 20px 20px 20px; background:white;">
                <button class="btn-ai" onclick="window.initAiChat()">✨ Discuter avec Ia_RP</button>
            </div>
        `;
    }
};

// Lancer le chargement initial
window.updateStats();
window.loadPending();