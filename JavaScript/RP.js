import { db } from './Firebase.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';

// Fonction d'ouverture des messages (Pending)
window.openModal = function(content, title, meta) {
    const area = document.getElementById('displayAreaPending');
    if(!area) return;
    
    area.innerHTML = `
        <div class="rp-reader">
            <div style="border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:#ffcc00;">${title}</h3>
                <small style="color:#888;">${meta}</small>
            </div>
            <div style="line-height:1.6; color:#ddd; font-style:italic;">
                ${content.replace(/\n/g, '<br>')}
            </div>
        </div>
    `;
};

// ... Reste des fonctions addSent, addReceived déjà fonctionnelles ...
// --- AJOUT RP ENVOYÉ ---
window.addSent = async function() {
    const charInput = document.getElementById("char_sent");
    const serverInput = document.getElementById("server_sent");
    const zone = document.querySelector(".zone-ajout");

    if (!charInput.value || !serverInput.value) {
        if (!charInput.value) showFeedback(charInput, true);
        if (!serverInput.value) showFeedback(serverInput, true);
        return;
    }

    try {
        await addDoc(collection(db, "rps_sent"), {
            character: charInput.value,
            server: serverInput.value,
            createdAt: serverTimestamp()
        });
        showFeedback(zone, false, "Stat enregistrée !");
        charInput.value = ""; serverInput.value = "";
        window.updateStats();
    } catch (e) { console.error(e); }
};

// --- AJOUT RP PENDING ---
window.addReceived = async function() {
    const inputs = {
        title: document.getElementById("title"),
        char: document.getElementById("char_received"),
        srv: document.getElementById("server_received"),
        cont: document.getElementById("content")
    };
    const zone = document.querySelector(".zone-ajout-pending");

    let hasError = false;
    for (let key in inputs) {
        if (!inputs[key].value) {
            showFeedback(inputs[key], true);
            hasError = true;
        }
    }
    if (hasError) return;

    try {
        await addDoc(collection(db, "rps_received"), {
            title: inputs.title.value,
            character: inputs.char.value,
            server: inputs.srv.value,
            content: inputs.cont.value,
            status: "pending",
            createdAt: serverTimestamp()
        });
        showFeedback(zone, false, "Ajouté au Pending !");
        for (let key in inputs) inputs[key].value = "";
    } catch (e) { console.error(e); }
};

// --- LE RESTE DU CODE (updateStats, loadPending, etc.) ---
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

window.loadPending = function(filterNames = null) {
    let q = query(collection(db, "rps_received"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    if (filterNames) {
        const namesToSearch = Array.isArray(filterNames) ? filterNames : [filterNames];
        q = query(collection(db, "rps_received"), where("status", "==", "pending"), where("character", "in", namesToSearch), orderBy("createdAt", "desc"));
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
                <button class="btn-done" onclick="event.stopPropagation(); window.markDone('${id}')">Fait</button>
            `;
            list.appendChild(card);
        });
    });
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

window.updateStats();
window.loadPending();