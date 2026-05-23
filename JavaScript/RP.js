import { db } from './Firebase.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';
import { genererBadgesEtSelecteur, initialiserFiltrageTags } from './FeaturesBonus/Tags.js';

let unsubscribePending = null;

// --- OUVERTURE MODALE AVEC MARKDOWN ---
window.openModal = function(content, title, meta) {
    const area = document.getElementById('displayAreaPending');
    if(!area) return;
    area.innerHTML = `
        <div class="rp-reader">
            <div style="border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between;">
                <div>
                    <h3 style="margin:0; color:#ffcc00;">${title}</h3>
                    <small style="color:#888;">${meta}</small>
                </div>
                <button onclick="window.clearView()" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;">×</button>
            </div>
            <div class="rp-display-content">
                ${parseRP(content)}
            </div>
        </div>
    `;
};

// --- STATS ---
window.updateStats = async function() {
    const container = document.getElementById("statsContainer");
    if (!container) return;
    try {
        const s = await getAdvancedStats();
        container.innerHTML = `
            <div class="stat-grid">
                <div class="stat-card"><span class="stat-label">RP / Semaine</span><span class="stat-value">${s.totalSemaine || 0}</span></div>
                <div class="stat-card"><span class="stat-label">Moyenne / Jour</span><span class="stat-value">${s.moyenneJour || 0}</span></div>
                <div class="stat-card"><span class="stat-label">À répondre</span><span class="stat-value" style="color:#ffcc00">${s.pendingCount || 0}</span></div>
                <div class="stat-card"><span class="stat-label">Top Serveur</span><span class="stat-value" style="font-size:0.9rem">${s.topServer || 'Aucun'}</span></div>
            </div>`;
    } catch (e) { console.error(e); }
};

// --- AJOUT RP ENVOYÉ ---
window.addSent = async function() {
    const charInput = document.getElementById("char_sent");
    const serverInput = document.getElementById("server_sent");
    const contentInput = document.getElementById("content_sent"); 
    const zone = document.querySelector(".zone-ajout");

    if (!charInput || !charInput.value || !serverInput || !serverInput.value) {
        if (charInput && !charInput.value) showFeedback(charInput, true);
        if (serverInput && !serverInput.value) showFeedback(serverInput, true);
        return;
    }

    try {
        await addDoc(collection(db, "rps_sent"), {
            character: charInput.value,
            server: serverInput.value,
            content: contentInput ? contentInput.value : "", 
            createdAt: serverTimestamp()
        });
        showFeedback(zone, false, "Stat et XP enregistrées !");
        charInput.value = ""; 
        serverInput.value = "";
        if (contentInput) contentInput.value = ""; 
        window.updateStats();
        if(window.loadCharts) window.loadCharts();
    } catch (e) { console.error(e); }
};

// --- AJOUT RP PENDING (INTEGRATION DU TAG INITIAL) ---
window.addReceived = async function() {
    const inputs = {
        title: document.getElementById("title"),
        char: document.getElementById("char_received"),
        srv: document.getElementById("server_received"),
        cont: document.getElementById("content")
    };
    const initialTagInput = document.getElementById("initial_tag");
    const zone = document.querySelector(".zone-ajout-pending");

    let hasError = false;
    for (let key in inputs) {
        if (inputs[key] && !inputs[key].value) {
            showFeedback(inputs[key], true);
            hasError = true;
        }
    }
    if (hasError) return;

    // Récupération sécurisée du tag choisi dans le menu déroulant
    const tagChoisi = initialTagInput && initialTagInput.value ? [initialTagInput.value] : [];

    try {
        await addDoc(collection(db, "rps_received"), {
            title: inputs.title.value,
            character: inputs.char.value,
            server: inputs.srv.value,
            content: inputs.cont.value,
            status: "pending",
            tags: tagChoisi, 
            createdAt: serverTimestamp()
        });
        showFeedback(zone, false, "Ajouté au Pending !");
        for (let key in inputs) { if(inputs[key]) inputs[key].value = ""; }
        if (initialTagInput) initialTagInput.value = "";
    } catch (e) { console.error(e); }
};

// --- CHARGEMENT DU PENDING ---
window.loadPending = function(filterNames = null) {
    if (unsubscribePending) {
        unsubscribePending();
        unsubscribePending = null;
    }

    const list = document.getElementById('pending-list');
    if (!list) return;

    // Requête simplifiée pour éviter les erreurs d'index complexes au démarrage
    let q = query(
        collection(db, "rps_received"),
        where("status", "==", "pending")
    );

    if (filterNames && Array.isArray(filterNames) && filterNames.length > 0) {
        q = query(
            collection(db, "rps_received"),
            where("status", "==", "pending"),
            where("character", "in", filterNames)
        );
    }

    unsubscribePending = onSnapshot(q, (snap) => {
        list.innerHTML = "";
        if (snap.empty) {
            list.innerHTML = "<p style='color:#666; padding:10px;'>Aucun RP en attente.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const rp = docSnap.data();
            const id = docSnap.id;
            const tagsTab = Array.isArray(rp.tags) ? rp.tags : []; 

            const item = document.createElement('div');
            item.className = "pending-item";
            
            // Propriété essentielle lue par le script de filtrage
            item.setAttribute('data-tags', tagsTab.join(','));

            // Structure HTML segmentée : empêche la propagation du clic vers la liseuse
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div class="text-click-zone" style="flex-grow: 1; margin-right:10px; cursor:pointer;">
                        <b>${rp.title || 'Sans Titre'}</b> ${getUrgencyTag(rp.createdAt)}<br>
                        <small>${rp.character || 'Inconnu'} — ${rp.server || 'Sans Serveur'}</small>
                    </div>
                    <button class="btn-done" style="cursor:pointer;">Fait</button>
                </div>
                <div class="tags-action-zone">
                    ${genererBadgesEtSelecteur(id, tagsTab)}
                </div>
            `;

            // Clic sur le texte uniquement -> Ouvre la liseuse
            item.querySelector('.text-click-zone').addEventListener('click', () => {
                window.openModal(rp.content || "", rp.title || "RP", `${rp.character} — ${rp.server}`);
            });

            // Clic sur le bouton fait
            item.querySelector('.btn-done').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.markDone(id);
            });

            list.appendChild(item);
        });

        // Activation instantanée de la logique des tags et des boutons de filtrage du haut
        initialiserFiltrageTags();

    }, (err) => {
        console.error("Erreur d'écoute Firestore :", err);
    });
};

window.markDone = async function(id) {
    if(!confirm("Marquer ce RP comme terminé ?")) return;
    await updateDoc(doc(db, "rps_received", id), { status: "done" });
    window.updateStats();
};

window.clearView = function() {
    const displayArea = document.getElementById("displayArea");
    const displayAreaPending = document.getElementById("displayAreaPending");
    if (displayArea) { displayArea.innerHTML = ""; displayArea.style.display = "none"; }
    if (displayAreaPending) { displayAreaPending.innerHTML = ""; }
};

function showFeedback(element, isError = false, message = "") {
    if (!element) return;
    if (isError) {
        element.classList.add("shake-animation");
        element.style.borderColor = "red";
        setTimeout(() => {
            element.classList.remove("shake-animation");
            element.style.borderColor = "";
        }, 1000);
    } else {
        const feedbackMsg = document.createElement("div");
        feedbackMsg.className = "feedback-success";
        feedbackMsg.style.color = "#2ecc71";
        feedbackMsg.style.fontSize = "0.8rem";
        feedbackMsg.style.marginTop = "5px";
        feedbackMsg.innerText = "✅ " + message;
        element.parentElement.appendChild(feedbackMsg);
        setTimeout(() => feedbackMsg.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.loadPending();
    setTimeout(() => { window.updateStats(); }, 400); 
});