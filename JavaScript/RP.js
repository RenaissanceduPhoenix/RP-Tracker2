import { db } from './Firebase.js';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getAdvancedStats } from './DataService.js';
import { genererBadgesEtSelecteur, initialiserFiltrageTags } from './FeaturesBonus/Tags.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';

let unsubscribePending = null;
let rpsActifsCache = []; // Stocke les RPs (actifs et répondus) pour l'auto-remplissage et les transitions de statut

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

// FONCTION AUTOMATIQUE : Remplit les persos si le titre est connu
window.autoRemplirParticipants = function(titreSaisi) {
    const charInput = document.getElementById("char_received");
    const partInput = document.getElementById("rp_participants");
    const serverInput = document.getElementById("server_received");

    const rpTrouve = rpsActifsCache.find(rp => rp.title.toLowerCase() === titreSaisi.toLowerCase().trim());
    
    if (rpTrouve) {
        if (charInput) charInput.value = rpTrouve.character || "";
        if (partInput) partInput.value = (rpTrouve.participants || []).join(", ");
        if (serverInput) serverInput.value = rpTrouve.server || "";
    }
};

// AJOUT OU MISE À JOUR D'UN PENDING
window.addPending = async function() {
    const titleInput = document.getElementById("title");
    const charInput = document.getElementById("char_received");
    const partInput = document.getElementById("rp_participants");
    const serverInput = document.getElementById("server_received");
    const contentInput = document.getElementById("content");

    if (!titleInput || !charInput || !serverInput || !contentInput) return;

    const title = titleInput.value.trim();
    const character = charInput.value.trim();
    const server = serverInput.value.trim();
    const content = contentInput.value.trim() || "";
    
    const participantsRaw = partInput ? partInput.value.trim() : "";
    const participantsArray = participantsRaw ? participantsRaw.split(",").map(p => p.trim()).filter(Boolean) : [];

    if (!title || !character || !server) {
        alert("❌ Le titre, le personnage et le serveur sont obligatoires !");
        return;
    }

    const rpExistant = rpsActifsCache.find(rp => rp.title.toLowerCase() === title.toLowerCase());

    try {
        if (rpExistant) {
            const updateData = {
                character: character,
                participants: participantsArray,
                server: server,
                status: "pending", 
                updatedAt: serverTimestamp()
            };
            
            if (content !== "") {
                updateData.content = content;
            }

            await updateDoc(doc(db, "rps_received", rpExistant.id), updateData);
            showFeedback(contentInput, false, "Le RP est de retour en attente !");
        } else {
            await addDoc(collection(db, "rps_received"), {
                title: title,
                character: character,
                participants: participantsArray, 
                server: server,
                content: content,
                status: "pending",
                tags: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            showFeedback(contentInput, false, "Nouveau RP ajouté aux pendings !");
        }

        titleInput.value = "";
        charInput.value = "";
        if(partInput) partInput.value = "";
        serverInput.value = "";
        contentInput.value = "";
    } catch (err) {
        console.error("Erreur lors de la sauvegarde du pending :", err);
        showFeedback(contentInput, true);
    }
};

// ÉCOUTE ET SYNCHRONISATION
window.initPendingList = function() {
    const container = document.getElementById("pendingList");
    const datalist = document.getElementById("titresExistants");
    if (!container) return;

    if (unsubscribePending) unsubscribePending();

    unsubscribePending = onSnapshot(collection(db, "rps_received"), (snapshot) => {
        container.innerHTML = "";
        if (datalist) datalist.innerHTML = ""; 
        rpsActifsCache = []; 

        const titresUniques = new Set();
        let listeRpsAfficher = [];

        snapshot.forEach((docSnap) => {
            const rp = docSnap.data();
            rp.id = docSnap.id;
            
            if (rp.status !== "done") {
                rpsActifsCache.push(rp);
                
                const title = rp.title || "Sans titre";
                if (!titresUniques.has(title.toLowerCase())) {
                    titresUniques.add(title.toLowerCase());
                    if (datalist) {
                        const option = document.createElement("option");
                        option.value = title;
                        datalist.appendChild(option);
                    }
                }
            }

            if (rp.status === "pending") {
                listeRpsAfficher.push(rp);
            }
        });

        if (listeRpsAfficher.length === 0) {
            container.innerHTML = `<p class="empty-msg">Aucun RP en attente. À vous de jouer !</p>`;
            return;
        }

        // TRI CHRONOLOGIQUE
        listeRpsAfficher.sort((a, b) => {
            const dateA = (a.updatedAt || a.createdAt)?.toMillis() || 0;
            const dateB = (b.updatedAt || b.createdAt)?.toMillis() || 0;
            return dateA - dateB;
        });

        // Génération visuelle des cartes
        listeRpsAfficher.forEach((rp) => {
            const id = rp.id;
            const title = rp.title || "Sans titre";
            const character = rp.character || "Inconnu";
            const server = rp.server || "Inconnu";
            const content = rp.content || "";
            const tags = rp.tags || [];

            // Récupère la structure HTML du badge (géré dynamiquement par UrgencyTags.js)
            const urgencyBadge = getUrgencyTag(rp.updatedAt || rp.createdAt);

            const tagsHTML = genererBadgesEtSelecteur(id, tags);
            const metaText = `Perso : ${character} | Serveur : ${server}`;

            const card = document.createElement("div");
            card.className = "rp-card animate-fade-in";

            // Structure avec alignement Flexbox pour jeter le badge à droite
            card.innerHTML = `
                <div class="rp-card-header" style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:20px;">
                    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 15px;">
                            <span class="rp-card-title" style="margin: 0; word-break: break-word;">${title}</span>
                            <div style="flex-shrink: 0; display: flex; align-items: center;">${urgencyBadge}</div>
                        </div>
                        <div class="rp-card-meta" style="display:flex; flex-direction:column; gap:2px; margin-top: 2px;">
                            <div style="font-size:0.85rem; font-weight:600; color:#cbd5e1;">
                                🎭 Perso : ${character}
                            </div>
                            <div style="font-size:0.78rem; color:#78716c; font-style:italic; padding-left:2px;">
                                🌐 Serveur : ${server}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        <button class="btn-action btn-read" title="Lire le RP">📖</button>
                        <button class="btn-action btn-done" title="Marquer comme Répondu (Faire Disparaître)" style="background:#27ae60;">✅</button>
                        <button class="btn-action btn-archive" title="Terminer le RP (Archiver)" style="background:#c0392b;">🛑</button>
                        <button class="btn-action btn-clean-ai" title="🧹 Forcer le nettoyage de la mémoire IA" style="background:#34495e;">🧹</button>
                        <button class="btn-pending" onclick="window.openCoWriteModal('${id}', '${character.replace(/'/g, "\\'")}')" title="Co-Écriture" style="background: none; border: none; font-size: 1.1rem; cursor: pointer;">🖋️</button>
                    </div>
                </div>
                <div class="rp-card-tags-area" style="margin-top: 8px;">${tagsHTML}</div>
            `;

            card.querySelector(".btn-read").addEventListener("click", () => window.openModal(content, title, metaText));
            card.querySelector(".btn-done").addEventListener("click", () => window.markStatus(id, "repondu"));
            card.querySelector(".btn-archive").addEventListener("click", () => window.markStatus(id, "done"));

            card.querySelector(".btn-clean-ai").addEventListener("click", async function() {
    if (confirm(`Voulez-vous vider la mémoire IA du RP "${title}" pour corriger les bugs ?`)) {
        if (typeof window.clearAiHistory === "function") {
            this.innerText = "⏳";
            await window.clearAiHistory(id);
            this.innerText = "✨";
            this.style.background = "#2ecc71";
            setTimeout(() => { this.innerText = "🧹"; this.style.background = "#34495e"; }, 2000);
        }
    }
});

            container.appendChild(card);
        });

        initialiserFiltrageTags();
    }, (err) => { console.error(err); });
};

window.markStatus = async function(id, newStatus, characterName = null) {
    try {
        await updateDoc(doc(db, "rps_received", id), { 
            status: newStatus,
            updatedAt: serverTimestamp() 
        });
        
        // 🌟 CONDITION EXCLUSIVE : On nettoie l'IA SEULEMENT si le statut passe à "repondu" 
        // ET que le personnage de la carte correspond bien à ton personnage actif !
        if (newStatus === "repondu" && characterName && window.currentActiveCharName) {
            if (characterName.toLowerCase() === window.currentActiveCharName.toLowerCase()) {
                if (typeof window.clearAiHistory === "function") {
                    await window.clearAiHistory(id);
                }
            }
        }

        if (document.getElementById("coWriteModal").style.display === "flex") {
            document.getElementById("coWriteModal").style.display = "none";
        }
        window.updateStats();
    } catch (err) { console.error(err); }
};

window.addSent = async function() {
    const charInput = document.getElementById("char_sent");
    const serverInput = document.getElementById("server_sent");
    const contentInput = document.getElementById("content_sent");
    if (!charInput || !serverInput || !contentInput) return;
    const character = charInput.value.trim();
    const server = serverInput.value.trim();
    const content = contentInput.value.trim();
    if (!character || !server || !content) { alert("❌ Champs requis !"); return; }
    try {
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const xpGained = Math.floor(wordCount * 0.1);
        await addDoc(collection(db, "rps_sent"), { character, server, content, wordCount, xp: xpGained, createdAt: serverTimestamp() });
        showFeedback(contentInput, false, `Enregistré ! +${xpGained} XP`);
        charInput.value = ""; serverInput.value = ""; contentInput.value = "";
        window.updateStats();
    } catch (err) { showFeedback(contentInput, true); }
};

window.updateStats = async function() {
    const statsContainer = document.getElementById("statsContainer");
    if (!statsContainer) return;
    try {
        const stats = await getAdvancedStats();
        statsContainer.innerHTML = `
            <h2>Statistiques</h2>
            <div class="stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-top:15px;">
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; text-align:center;"><div>Total XP</div><div class="xp-counter">${stats.totalXP || 0}</div></div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; text-align:center;"><div>RPs Archivés</div><div style="font-size:1.8rem; color:#2ecc71;">${stats.totalSent || 0}</div></div>
                <div class="stat-card" style="background:rgba(255,255,255,0.05); padding:15px; text-align:center;"><div>Mots Écrits</div><div style="font-size:1.8rem; color:#3498db;">${stats.totalWords || 0}</div></div>
            </div>
        `;
    } catch (e) {}
};

function showFeedback(element, isError = false, message = "") {
    if (!element) return;
    if (isError) {
        element.classList.add("shake-animation"); element.style.borderColor = "red";
        setTimeout(() => { element.classList.remove("shake-animation"); element.style.borderColor = ""; }, 1000);
    } else {
        const feedbackMsg = document.createElement("div");
        feedbackMsg.style.color = "#2ecc71"; feedbackMsg.style.fontSize = "0.8rem"; feedbackMsg.style.marginTop = "5px";
        feedbackMsg.innerText = "✅ " + message; element.parentElement.appendChild(feedbackMsg);
        setTimeout(() => feedbackMsg.remove(), 4000);
    }
}

function lancerInitialisation() {
    if (typeof window.initPendingList === "function") window.initPendingList();
    if (typeof window.updateStats === "function") window.updateStats();
}
if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", lancerInitialisation); } else { lancerInitialisation(); }