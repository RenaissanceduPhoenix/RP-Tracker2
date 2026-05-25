import { db } from './Firebase.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';
import { genererBadgesEtSelecteur, initialiserFiltrageTags } from './FeaturesBonus/Tags.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';

let unsubscribePending = null;

// =========================================================================
// 1. GESTION DE LA MODALE DE LECTURE (MARKDOWN)
// =========================================================================
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
            <div class="rp-display-content">${parseRP(content)}</div>
        </div>
    `;
};

window.clearView = function() {
    const displayArea = document.getElementById("displayArea");
    const displayAreaPending = document.getElementById("displayAreaPending");
    if (displayArea) { displayArea.innerHTML = ""; displayArea.style.display = "none"; }
    if (displayAreaPending) { displayAreaPending.innerHTML = ""; }
};

// =========================================================================
// 2. AJOUT D'UN RP ENVOYÉ (FORMULAIRE PRINCIPAL)
// =========================================================================
window.addSent = async function() {
    const charInput = document.getElementById("char_sent");
    const serverInput = document.getElementById("server_sent");
    const contentInput = document.getElementById("content_sent");

    if (!charInput || !serverInput || !contentInput) return;

    const character = charInput.value.trim();
    const server = serverInput.value.trim();
    const content = contentInput.value.trim();

    if (!character || !server || !content) {
        alert("❌ Tous les champs de l'envoi sont obligatoires !");
        return;
    }

    try {
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const xpGained = Math.floor(wordCount * 0.1);

        await addDoc(collection(db, "rps_sent"), {
            character: character,
            server: server,
            content: content,
            wordCount: wordCount,
            xp: xpGained,
            createdAt: serverTimestamp()
        });

        showFeedback(contentInput, false, `Enregistré ! +${xpGained} XP (${wordCount} mots)`);
        
        charInput.value = "";
        serverInput.value = "";
        contentInput.value = "";

        window.updateStats();
    } catch (err) {
        console.error("Erreur lors de l'ajout du RP envoyé :", err);
        showFeedback(contentInput, true);
    }
};

// =========================================================================
// 3. AJOUT D'UN NOUVEAU RP EN ATTENTE (PENDING)
// =========================================================================
window.addPending = async function() {
    const titleInput = document.getElementById("title");
    const charInput = document.getElementById("char_received");
    const serverInput = document.getElementById("server_received");
    const contentInput = document.getElementById("content");

    if (!titleInput || !charInput || !serverInput || !contentInput) return;

    const title = titleInput.value.trim();
    const character = charInput.value.trim();
    const server = serverInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !character || !server) {
        alert("❌ Le titre, le personnage et le serveur sont obligatoires !");
        return;
    }

    try {
        await addDoc(collection(db, "rps_received"), {
            title: title,
            character: character,
            server: server,
            content: content,
            status: "pending",
            tags: [],
            createdAt: serverTimestamp()
        });

        showFeedback(contentInput, false, "Ajouté aux pendings !");

        titleInput.value = "";
        charInput.value = "";
        serverInput.value = "";
        contentInput.value = "";
    } catch (err) {
        console.error("Erreur lors de l'ajout du RP reçu :", err);
        showFeedback(contentInput, true);
    }
};

// =========================================================================
// 4. ÉCOUTE EN TEMPS RÉEL DES RPs EN ATTENTE (FIRESTORE)
// =========================================================================
window.initPendingList = function() {
    // CORRECTION ICI : "pendingContainer" devient "pendingList" pour matcher avec l'index.html
    const container = document.getElementById("pendingList");
    if (!container) return;

    if (unsubscribePending) {
        unsubscribePending();
    }

    const q = query(
        collection(db, "rps_received"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );

    unsubscribePending = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<p class="empty-msg">Aucun RP en attente. À vous de jouer !</p>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const rp = docSnap.data();
            const id = docSnap.id;

            const title = rp.title || "Sans titre";
            const character = rp.character || "Inconnu";
            const server = rp.server || "Inconnu";
            const content = rp.content || "";
            const tags = rp.tags || [];

            // Calculer la pastille d'urgence temporelle (Vert / Orange / Rouge)
            const urgencyBadge = getUrgencyTag(rp.createdAt);

            // Génération dynamique des badges d'énergie (#Action, #Romance...) et de leur sélecteur
            const tagsHTML = genererBadgesEtSelecteur(id, tags);

            const metaText = `Perso : ${character} | Serveur : ${server}`;

            const card = document.createElement("div");
            card.className = "rp-card animate-fade-in";
            card.innerHTML = `
                <div class="rp-card-header">
                    <div>
                        <span class="rp-card-title">${title}</span>
                        <div class="rp-card-meta">${metaText}</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${urgencyBadge}
                        <button class="btn-action btn-read" title="Lire le RP">📖</button>
                        <button class="btn-action btn-done" title="Marquer comme répondu">✅</button>
                    </div>
                </div>
                <div class="rp-card-tags-area">
                    ${tagsHTML}
                </div>
            `;

            // Événement de lecture
            card.querySelector(".btn-read").addEventListener("click", () => {
                window.openModal(content, title, metaText);
            });

            // Événement de validation (marquer comme fait)
            card.querySelector(".btn-done").addEventListener("click", () => {
                window.markDone(id);
            });

            container.appendChild(card);
        });

        // Réinitialisation indispensable des écouteurs de tags
        initialiserFiltrageTags();
    }, (err) => {
        console.error("Erreur flux temps réel pendings :", err);
        container.innerHTML = `<p class="error-msg">Erreur de chargement : ${err.message}</p>`;
    });
};

// =========================================================================
// 5. CLÔTURE D'UN RP EN ATTENTE
// =========================================================================
window.markDone = async function(id) {
    if(!confirm("Voulez-vous marquer ce RP comme terminé ?")) return;
    try {
        await updateDoc(doc(db, "rps_received", id), { status: "done" });
        window.updateStats();
    } catch (err) {
        console.error("Erreur lors de la clôture du RP :", err);
    }
};

// =========================================================================
// 6. CALCUL ET AFFICHAGE EN TEMPS RÉEL DES STATISTIQUES
// =========================================================================
window.updateStats = async function() {
    const statsContainer = document.getElementById("statsContainer");
    if (!statsContainer) return;

    try {
        const stats = await getAdvancedStats();
        statsContainer.innerHTML = `
            <h2>Statistiques de l'Activité</h2>
            <div class="stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-top:15px;">
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; text-align:center;">
                    <div style="font-size:0.9rem; color:#888;">Total XP</div>
                    <div class="xp-counter" style="margin:5px 0 0 0;">${stats.totalXP || 0}</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; text-align:center;">
                    <div style="font-size:0.9rem; color:#888;">RPs Répondus</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:#2ecc71; margin-top:5px;">${stats.totalSent || 0}</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; text-align:center;">
                    <div style="font-size:0.9rem; color:#888;">Mots Écrits</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:#3498db; margin-top:5px;">${stats.totalWords || 0}</div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Erreur lors du calcul des statistiques :", err);
    }
};

// =========================================================================
// 7. RETROACTIONS VISUELLES (FEEDBACKS SUCCÈS/ERREUR)
// =========================================================================
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
        setTimeout(() => feedbackMsg.remove(), 4000);
    }
}

// =========================================================================
// 8. INITIALISATION AUTOMATIQUE DES SERVICES (SÉCURISÉE)
// =========================================================================
function lancerInitialisation() {
    if (typeof window.initPendingList === "function") {
        window.initPendingList();
    }
    if (typeof window.updateStats === "function") {
        window.updateStats();
    }
}

// Si le DOM est déjà prêt, on lance immédiatement, sinon on attend l'événement
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lancerInitialisation);
} else {
    lancerInitialisation();
}