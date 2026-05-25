import { db } from './Firebase.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';
import { genererBadgesEtSelecteur, initialiserFiltrageTags } from './FeaturesBonus/Tags.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';

let unsubscribePending = null;

// --- OUVERTURE MODALE AVEC MARKDOWN ---
window.openModal = function(content, title, meta) {
    const area = document.getElementById('displayAreaPending');
    if(!area) return;
    area.innerHTML = `
        <div class="rp-reader">
            <div style="border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between;\">
                <div>
                    <h3 style="margin:0; color:#ffcc00;\">${title}</h3>
                    <small style="color:#888;\">${meta}</small>
                </div>
                <button onclick="window.clearView()" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;\">×</button>
            </div>
            <div class="rp-display-content">${parseRP(content)}</div>
        </div>
    `;
};

// --- CHARGEMENT DU PENDING (REFAIT STYLE EXTENSION AVEC URGENCE) ---
window.loadPending = function() {
    if (unsubscribePending) unsubscribePending();

    const q = query(
        collection(db, "rps_received"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );

    const container = document.getElementById("pendingList");
    if (!container) return;

    unsubscribePending = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = "<p class='empty-msg'>Aucun RP en attente ! 🎉</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const rp = docSnap.data();
            const id = docSnap.id;
            const meta = `👤 ${rp.character} | 🌐 ${rp.server}`;

            // 1. Génération de l'HTML des étiquettes d'urgence et du sélecteur intégré
            const tagsFooterHTML = genererBadgesEtSelecteur(id, rp.tags || []);

            // 2. Création de la carte (.rp-card) calquée sur l'extension
            const card = document.createElement("div");
            card.className = "rp-card";
            card.setAttribute("data-rpid", id);

            card.innerHTML = `
                <div class="rp-card-header">
                    <span>👤 ${rp.character}</span>
                    <span>🌐 ${rp.server}</span>
                </div>
                <div class="rp-card-title" style="cursor:pointer; text-decoration:underline;\">${rp.title}</div>
                <div class="rp-card-body" style="cursor:pointer;\">
                    ${rp.content ? rp.content.substring(0, 100) + '...' : '<i>Pas de contenu...</i>'}
                </div>
                ${tagsFooterHTML}
                <div style="margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;\">
                    <button class="action-btn" onclick="window.markDone('${id}')" style="background:#2ecc71; padding:3px 8px; font-size:0.75rem;\">Terminé</button>
                    <button class="action-btn" onclick="window.deleteRP('${id}')" style="background:#e74c3c; padding:3px 8px; font-size:0.75rem;\">Supprimer</button>
                </div>
            `;

            // Rendre la zone du titre et du corps cliquable pour ouvrir la modale de lecture
            const openAction = () => window.openModal(rp.content || "*Aucun texte*", rp.title, meta);
            card.querySelector(".rp-card-title").addEventListener("click", openAction);
            card.querySelector(".rp-card-body").addEventListener("click", openAction);

            container.appendChild(card);
        });

        // Ré-attacher l'interrupteur des sélecteurs de tags une fois le DOM prêt
        initialiserFiltrageTags();
    }, (err) => {
        console.error("Erreur flux en attente:", err);
    });
};

// --- AJOUT D'UN RP EN ATTENTE (PENDING) ---
window.addPending = async function() {
    const titleEl = document.getElementById("title");
    const charEl = document.getElementById("char_received");
    const serverEl = document.getElementById("server_received");
    const contentEl = document.getElementById("content");

    if (!titleEl || !charEl || !serverEl || !contentEl) return;

    const title = titleEl.value.trim();
    const character = charEl.value.trim();
    const server = serverEl.value.trim();
    const content = contentEl.value.trim();

    if (!title || !character || !server) {
        showFeedback(titleEl, true);
        showFeedback(charEl, true);
        showFeedback(serverEl, true);
        return;
    }

    try {
        await addDoc(collection(db, "rps_received"), {
            title,
            character,
            server,
            content,
            status: "pending",
            tags: [],
            createdAt: serverTimestamp()
        });

        titleEl.value = "";
        charEl.value = "";
        serverEl.value = "";
        contentEl.value = "";

        showFeedback(document.querySelector(".zone-ajout-pending button"), false, "RP ajouté à l'extension !");
        window.updateStats();
    } catch(err) {
        console.error(err);
    }
};

// --- AJOUT D'UN RP ENVOYÉ (STATS / XP) ---
window.addSent = async function() {
    const charEl = document.getElementById("char_sent");
    const serverEl = document.getElementById("server_sent");
    const contentEl = document.getElementById("content_sent");

    if (!charEl || !serverEl || !contentEl) return;

    const character = charEl.value.trim();
    const server = serverEl.value.trim();
    const content = contentEl.value.trim();

    if (!character || !server || !content) {
        showFeedback(charEl, true);
        showFeedback(serverEl, true);
        showFeedback(contentEl, true);
        return;
    }

    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const xpGained = words; 

    try {
        await addDoc(collection(db, "rps_sent"), {
            character,
            server,
            wordCount: words,
            xp: xpGained,
            createdAt: serverTimestamp()
        });

        charEl.value = "";
        serverEl.value = "";
        contentEl.value = "";

        showFeedback(document.querySelector(".zone-ajout button"), false, `${words} mots enregistrés (${xpGained} XP) !`);
        window.updateStats();
    } catch(err) {
        console.error(err);
    }
};

// --- SUPPRESSION & ACTION TERMINÉ ---
window.deleteRP = async function(id) {
    if(!confirm("Supprimer définitivement ce RP ?")) return;
    try {
        await updateDoc(doc(db, "rps_received", id), { status: "deleted" });
        window.updateStats();
    } catch (err) {
        console.error("Erreur suppression:", err);
    }
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

// --- STATS GLOBAL ---
window.updateStats = async function() {
    try {
        const stats = await getAdvancedStats();
        const container = document.getElementById("statsContainer");
        if (!container) return;

        container.innerHTML = `
            <h2>Statistiques de l'Activité</h2>
            <div class="stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-top:15px;\">
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; text-align:center;\">
                    <div style="font-size:0.9rem; color:#888;\">Total XP</div>
                    <div class="xp-counter" style="margin:5px 0 0 0;\">${stats.totalXP}</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; text-align:center;\">
                    <div style="font-size:0.9rem; color:#888;\">RPs Répondus</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:#2ecc71; margin-top:5px;\">${stats.totalSent}</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; text-align:center;\">
                    <div style="font-size:0.9rem; color:#888;\">Mots Écrits</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:#a777e3; margin-top:5px;\">${stats.totalWords}</div>
                </div>
            </div>
        `;
    } catch(err) {
        console.error("Erreur stats:", err);
    }
};

// INITIALISATION DU FLUX AU CHARGEMENT
document.addEventListener("DOMContentLoaded", () => {
    window.loadPending();
    window.updateStats();
});