import { db } from './Firebase.js';
import { collection, setDoc, addDoc, getDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { 
    getStatsSemaine, 
    getStatsMois, 
    getStatsGlobales
} from './DataService.js';
import { genererBadgesEtSelecteur, initialiserFiltrageTags } from './FeaturesBonus/Tags.js';
import { getUrgencyTag } from './FeaturesBonus/UrgencyTags.js';

let unsubscribePending = null;
let rpsActifsCache = []; // Stocke les RPs (actifs et répondus) pour l'auto-remplissage et les transitions de statut

/**
 * 1. Intercepte le clic, nettoie les IDs et demande confirmation
 */
window.validerChangementNom = async function(charName) {
    const idSecurise = charName.replace(/['\s]/g, '-');
    const input = document.getElementById(`input-bapteme-${idSecurise}`);
    if (!input) return;

    const nouveauNom = input.value.trim();
    if (!nouveauNom) {
        alert("❌ Veuillez entrer un nom valide.");
        return;
    }

    if (confirm(`⚠️ Mettre à jour le rang :\nVoulez-vous enregistrer le nom de baptême "${nouveauNom}" pour le profil de "${charName}" ?`)) {
        await window.executerBaptemeFirebase(charName, nouveauNom);
    }
};

/**
 * 2. Modifie le document existant ou le crée s'il n'existe pas encore
 */
window.executerBaptemeFirebase = async function(charName, nouveauNom) {
    const nomNettoye = nouveauNom.trim();
    const docRef = doc(db, "characters", charName);

    try {
        // setDoc avec { merge: true } crée le doc s'il est absent, ou fusionne s'il existe déjà !
        await setDoc(docRef, {
            nom_bapteme: nomNettoye,
            // Ces valeurs par défaut ne s'appliqueront QUE si le document est créé pour la première fois
            level: 1,
            xp: 0
        }, { merge: true });

        console.log(`🎉 [Firestore] Rang mis à jour (ou créé) avec succès pour ${charName}.`);
        alert(`✨ Le baptême est prononcé ! Le personnage s'appelle désormais "${nomNettoye}".`);
        
        // Relance l'affichage du profil pour mettre à jour le titre immédiatement
        if (typeof window.openFullPerso === "function") {
            await window.openFullPerso();
        } else {
            location.reload();
        }

    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour du document Firestore :", error);
        alert("Une erreur est survenue lors de la mise à jour du nom de baptême.");
    }
};

window.openModal = function(content, title, meta) {
    const area = document.getElementById('displayAreaPending');
    if(!area) return;
    
    area.innerHTML = `
        <div class="rp-reader">
            <div class="rp-reader-header">
                <div>
                    <h3 class="rp-reader-title">${title}</h3>
                    <small class="rp-reader-meta">${meta}</small>
                </div>
                <button type="button" onclick="window.clearView()" class="rp-reader-close" title="Fermer">&times;</button>
            </div>
            <div class="rp-display-content">${parseRP(content)}</div>
        </div>
    `;
};

window.clearView = function() {
    const displayArea = document.getElementById("displayArea");
    const displayAreaPending = document.getElementById("displayAreaPending");
    if (displayArea) { 
        displayArea.innerHTML = ""; 
        displayArea.style.display = "none"; 
    }
    if (displayAreaPending) { 
        displayAreaPending.innerHTML = ""; 
    }
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

    // 🎯 ID UNIQUE SYNCHRONISÉ : On récupère l'ID généré par l'IA ou on en crée un s'il n'existe pas
    const uniqueIdDuPost = window.lastGeneratedMsgId || "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    try {
        if (rpExistant) {
            // Définition des données de mise à jour de base
            const updateData = {
                character: character,
                participants: participantsArray,
                server: server,
                status: "pending", 
                updatedAt: serverTimestamp()
            };
            
            // Si du contenu textuel est envoyé, on l'ajoute
            if (content !== "") {
                updateData.content = content;
            }

            // --- NOTE TECHNIQUE ---
            // Si tes messages internes sont stockés dans un champ spécial ou un tableau, 
            // c'est ici qu'on inclurait { id: uniqueIdDuPost }. 
            // Pour l'instant, on met à jour le document global de rps_received.
            // ----------------------

            await updateDoc(doc(db, "rps_received", rpExistant.id), updateData);
            showFeedback(contentInput, false, "Le RP est de retour en attente !");
        } else {
            // Pour un NOUVEAU RP complet, on crée le document principal avec les infos
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

        // 🧼 NETTOYAGE : Une fois l'action effectuée, on réinitialise l'ID pour le prochain tour
        window.lastGeneratedMsgId = null;

        // Reset du formulaire
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

// On filtre les documents pour ne garder que ceux dont le statut n'est pas 'done'

// 🛡️ SÉCURITÉ : On s'assure que le snapshot et ses documents existent bien avant de filtrer
        if (!snapshot || !snapshot.docs) {
            console.warn("[RP.js] ⚠️ Le snapshot Firestore reçu est incomplet ou vide.");
            return;
        }

        const rpsEnAttente = snapshot.docs.filter(doc => doc.data().status !== "done");
        const snapshotSize = rpsEnAttente.length;

        const Totalite = snapshot.docs;
        const longeur = Totalite.length;
        
        const rpsRepondu = snapshot.docs.filter(doc => doc.data().status === "repondu");
        const snapshotRepSize = rpsRepondu.length;

        const rpsDone = snapshot.docs.filter(doc => doc.data().status === "done");
        const snapshotDoneSize = rpsDone.length;
        // 🌟 CODE À AJOUTER POUR TON NOUVEAU HEADER DYNAMIQUE :
        // 1. Met à jour le compteur de RPs en attente au centre du Header
        const globalPendingBadge = document.getElementById('global-pending-badge');
        if (globalPendingBadge) {
            globalPendingBadge.innerText = `${snapshotSize} RP${snapshotSize > 1 ? 's' : ''}`;
        };

        const globalRepBadge = document.getElementById('global-repondu');
        if (globalRepBadge) {
            globalRepBadge.innerText = `${snapshotRepSize} RP${snapshotRepSize > 1 ? 's' : ''}`;
        };

        const globalDone = document.getElementById(`global-done`);
        if (globalDone) {
            globalDone.innerText = `${snapshotDoneSize} RP${snapshotDoneSize > 1 ? 's' : ''}`;
        }

        const Global = document.getElementById(`global`);
        if (Global) {
            Global.innerText = `${longeur} RP${longeur > 1 ? 's' : ''}`;
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
                <div class="rp-card-header">
    <div class="rp-card-info">
        <div class="rp-card-title-row">
            <span class="rp-card-title">${title}</span>
            <div class="rp-card-badge-container">${urgencyBadge}</div>
        </div>
        <div class="rp-card-meta">
            <div class="rp-card-char">🎭 Perso : ${character}</div>
            <div class="rp-card-server">🌐 Serveur : ${server}</div>
        </div>
    </div>
    <div class="rp-card-actions">
        <button type="button" class="btn-action btn-done" title="Marquer comme Répondu (Faire Disparaître)">✅</button>
        <button type="button" class="btn-action btn-archive" title="Terminer le RP (Archiver)">🛑</button>
        <button type="button" class="btn-action btn-clean-ai" title="🧹 Forcer le nettoyage de la mémoire IA">🧹</button>
        <button type="button" class="btn-pending btn-cowrite" onclick="window.openCoWriteModal('${id}', '${character.replace(/'/g, "\\'")}')" title="Co-Écriture">🖋️</button>
    </div>
</div>
<div class="rp-card-tags-area">${tagsHTML}</div>
            `;

            card.querySelector(".btn-done").addEventListener("click", () => window.markStatus(id, "repondu"));
            card.querySelector(".btn-archive").addEventListener("click", () => window.markStatus(id, "done"));

            card.querySelector(".btn-clean-ai").addEventListener("click", async function() {
    if (confirm(`Voulez-vous vider la mémoire IA du RP "${title}" pour corriger les bugs ?`)) {
    if (typeof window.clearAiHistory === "function") {
        this.classList.add("is-loading");
        this.innerText = "⏳";
        
        await window.clearAiHistory(id);
        
        this.classList.remove("is-loading");
        this.classList.add("is-success");
        this.innerText = "✨";
        
        setTimeout(() => { 
            this.innerText = "🧹"; 
            this.classList.remove("is-success"); 
        }, 2000);
    }
}
});

            container.appendChild(card);
        });

        initialiserFiltrageTags();
    }, (err) => { console.error(err); });
    // Exemple à mettre là où ton script calcule déjà le nombre de RPs en attente :
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

/**
 * 🌟 FONCTION GLOBALE D'ENVOI DE RP
 */
window.ajouterUnRpEnvoye = async function() {
    const charInput = document.getElementById('char_sent');
    const titleInput = document.getElementById('titleSent');
    const serverInput = document.getElementById('server_sent');
    const contextInput = document.getElementById('content_sent');

    // 1. Vérification de la sélection et récupération IMMÉDIATE du nom de baptême affiché
    if (!charInput || charInput.selectedIndex <= 0) {
        alert("❌ Veuillez sélectionner un personnage dans la liste.");
        return;
    }
    
    // Le nom de baptême (ex: "Nuage de Lynx" ou "Petit Test") visible dans la galerie/sélecteur
    const nomBapteme = charInput.options[charInput.selectedIndex].text;
    // L'ID/Nom brut pour la base de données Firebase
    const characterName = charInput.value.trim();
    const title = titleInput ? titleInput.value.trim() : "";
    const server = serverInput ? serverInput.value.trim() : "";
    const textContext = contextInput ? contextInput.value.trim() : "";

    const charCount = textContext ? textContext.length : 0;

    if (!characterName) {
        alert("❌ Veuillez sélectionner un personnage dans la liste.");
        return;
    }

    if (charCount < 150) {
        alert(`⚠️ Votre RP est trop court (${charCount} caractères). Il doit contenir au moins 150 mots pour être enregistré.`);
        return;
    }

    const xpGain = Math.floor(charCount / 10);

    try {
        const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        await addDoc(collection(db, "rps_sent"), {
            character: characterName, 
            title: title,
            server: server,
            context: textContext,
            charCount: charCount,
            xpGain: xpGain,
            createdAt: serverTimestamp()
        });

        if (typeof window.ajouterXpPersonnage === "function") {
            await window.ajouterXpPersonnage(characterName, xpGain);
        }

        showFeedback(serverInput, false, `RP contenant ${charCount} caractères ! ${nomBapteme} obtient donc ${xpGain} point d'experience ! Bravo ! `)
        
        if (titleInput) titleInput.value = "";
        if (serverInput) serverInput.value = "";
        if (contextInput) contextInput.value = "";
        if (charInput) charInput.value = "";

    } catch (error) {
        console.error("Erreur ajout RP :", error);
        alert("Une erreur est survenue lors de l'enregistrement.");
    }
};


window.updateStats = async function() {
    const statsContainer = document.getElementById("statsContainer");
    if (!statsContainer) return;
    
    try {
        const resSemaine = await getStatsSemaine();
        const resMois = await getStatsMois();
        const resGlobal = await getStatsGlobales();

        // Calculs des pourcentages des graphiques
        const calcPercents = (s) => {
            const t = s.actions + s.paroles + s.pensees;
            const act = t > 0 ? Math.round((s.actions / t) * 100) : 0;
            const par = t > 0 ? Math.round((s.paroles / t) * 100) : 0;
            const pen = t > 0 ? (100 - (act + par)) : 0;
            return { act, par, pen };
        };

        const pS = calcPercents(resSemaine.stylesGlobaux);
        const pM = calcPercents(resMois.stylesGlobaux);
        const pG = calcPercents(resGlobal.stylesGlobaux);

        statsContainer.innerHTML = `
    <h2 class="stats-title">⚔️ Quartier Général des Statistiques</h2>
    
    <div class="stats-grid-container">
        
        <div class="stats-card">
            <h3 class="stats-card-title semaine">📊 RELEVÉ 7 JOURS</h3>
            <ul class="stats-list">
                <li>⚡ <b>XP :</b> <span class="stats-highlight-xp">${resSemaine.totalXp.toLocaleString()} XP</span></li>
                <li>🏆 <b>Champion :</b> <span>${resSemaine.topChar}</span></li>
                <li>🏰 <b>Front Actif :</b> <span>${resSemaine.topServer}</span></li>
                <li>📈 <b>Activité :</b> <span class="stats-highlight-activity">${resSemaine.moyenneJour}</span></li>
                <li>📝 <b>Mots :</b> <span class="stats-highlight-words">${resSemaine.totalMots.toLocaleString()} mots</span></li>
                <li class="stats-subtext">⚔️ Act: ${resSemaine.stylesGlobaux.actions} | 💬 Par: ${resSemaine.stylesGlobaux.paroles} | 💭 Pen: ${resSemaine.stylesGlobaux.pensees}</li>
            </ul>
            <button type="button" id="btnGraphSemaine" class="btn-toggle-graph">DÉPLOYER LE GRAPH</button>
            <div id="zoneGraphSemaine" class="stats-graph-zone">
                <div class="stats-pie-chart" style="--act: ${pS.act}%; --par: ${pS.par}%;"></div>
                <div class="stats-graph-legend">
                    <span class="legend-act">● Act (${pS.act}%)</span> 
                    <span class="legend-par">● Par (${pS.par}%)</span> 
                    <span class="legend-pen">● Pen (${pS.pen}%)</span>
                </div>
            </div>
        </div>

        <div class="stats-card">
            <h3 class="stats-card-title mois">🦅 RELEVÉ 30 JOURS</h3>
            <ul class="stats-list">
                <li>⚡ <b>XP :</b> <span class="stats-highlight-xp">${resMois.totalXp.toLocaleString()} XP</span></li>
                <li>🏆 <b>Champion :</b> <span>${resMois.topChar}</span></li>
                <li>🏰 <b>Front Actif :</b> <span>${resMois.topServer}</span></li>
                <li>📈 <b>Activité :</b> <span class="stats-highlight-activity">${resMois.moyenneJour}</span></li>
                <li>📝 <b>Mots :</b> <span class="stats-highlight-words">${resMois.totalMots.toLocaleString()} mots</span></li>
                <li class="stats-subtext">⚔️ Act: ${resMois.stylesGlobaux.actions} | 💬 Par: ${resMois.stylesGlobaux.paroles} | 💭 Pen: ${resMois.stylesGlobaux.pensees}</li>
            </ul>
            <button type="button" id="btnGraphMois" class="btn-toggle-graph">DÉPLOYER LE GRAPH</button>
            <div id="zoneGraphMois" class="stats-graph-zone">
                <div class="stats-pie-chart" style="--act: ${pM.act}%; --par: ${pM.par}%;"></div>
                <div class="stats-graph-legend">
                    <span class="legend-act">● Act (${pM.act}%)</span> 
                    <span class="legend-par">● Par (${pM.par}%)</span> 
                    <span class="legend-pen">● Pen (${pM.pen}%)</span>
                </div>
            </div>
        </div>

        <div class="stats-card">
            <h3 class="stats-card-title global">👑 HISTORIQUE GLOBAL</h3>
            <ul class="stats-list">
                <li>⚡ <b>XP :</b> <span class="stats-highlight-xp">${resGlobal.totalXp.toLocaleString()} XP</span></li>
                <li>🏆 <b>Champion :</b> <span>${resGlobal.topChar}</span></li>
                <li>🏰 <b>Front Actif :</b> <span>${resGlobal.topServer}</span></li>
                <li>📈 <b>Activité :</b> <span class="stats-highlight-activity">${resGlobal.moyenneJour}</span></li>
                <li>📝 <b>Mots :</b> <span class="stats-highlight-words">${resGlobal.totalMots.toLocaleString()} mots</span></li>
                <li class="stats-subtext">⚔️ Act: ${resGlobal.stylesGlobaux.actions} | 💬 Par: ${resGlobal.stylesGlobaux.paroles} | 💭 Pen: ${resGlobal.stylesGlobaux.pensees}</li>
            </ul>
            <button type="button" id="btnGraphGlobal" class="btn-toggle-graph">DÉPLOYER LE GRAPH</button>
            <div id="zoneGraphGlobal" class="stats-graph-zone">
                <div class="stats-pie-chart" style="--act: ${pG.act}%; --par: ${pG.par}%;"></div>
                <div class="stats-graph-legend">
                    <span class="legend-act">● Act (${pG.act}%)</span> 
                    <span class="legend-par">● Par (${pG.par}%)</span> 
                    <span class="legend-pen">● Pen (${pG.pen}%)</span>
                </div>
            </div>
        </div>

    </div>
`;
        

        // Écouteurs de clic pour afficher/masquer chaque graphe
        const lierGraphique = (idBtn, idZone) => {
            const btn = document.getElementById(idBtn);
            const zone = document.getElementById(idZone);
            if (!btn || !zone) return;

            btn.addEventListener("click", function() {
                const estVisible = zone.classList.toggle("is-visible");
                this.innerText = estVisible ? "MASQUER LE GRAPH" : "DÉPLOYER LE GRAPH";
            });
        };

        lierGraphique("btnGraphSemaine", "zoneGraphSemaine");
        lierGraphique("btnGraphMois", "zoneGraphMois");
        lierGraphique("btnGraphGlobal", "zoneGraphGlobal");

    } catch (e) {
        console.error("Erreur lors de la mise à jour des statistiques :", e);
    }
};

function showFeedback(element, isError = false, message = "") {
    if (!element) return;

    if (isError) {
        element.classList.add("shake-animation", "input-error");
        
        setTimeout(() => { 
            element.classList.remove("shake-animation", "input-error"); 
        }, 1000);
    } else {
        const feedbackMsg = document.createElement("div");
        feedbackMsg.className = "feedback-success-msg";
        feedbackMsg.innerText = "✅ " + message;
        
        element.parentElement.appendChild(feedbackMsg);
        
        setTimeout(() => feedbackMsg.remove(), 7000);
    }
}
function lancerInitialisation() {
    if (typeof window.initPendingList === "function") window.initPendingList();
    if (typeof window.updateStats === "function") window.updateStats();
}

/**
 * 🌟 AJOUT AUTOMATIQUE D'XP DANS FIRESTORE
 * Attachée à window pour être accessible partout sans problème de portée
 */
window.ajouterXpPersonnage = async function(charName, points) {
    if (!charName || points <= 0) return; // Si 0 XP gagné, on s'arrête
    
    const docRef = doc(db, "characters", charName);

    try {
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const currentData = snap.data();
            const xpActuelle = currentData.xp || 0;
            const nouveauTotalXp = xpActuelle + points;

            await updateDoc(docRef, {
                xp: nouveauTotalXp
            });
            console.log(`📈 XP mis à jour pour ${charName} : +${points} XP (Nouveau Total: ${nouveauTotalXp})`);
        } else {
            await setDoc(docRef, {
                xp: points,
                level: 1,
                nom_bapteme: ""
            });
            console.log(`🌱 Premier RP pour ${charName} ! Document créé avec +${points} XP.`);
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'attribution de l'XP :", error);
    }
};

if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", lancerInitialisation); } else { lancerInitialisation(); }

// =========================================================================
// 🎛️ GESTIONNAIRE DE BASCULE : MODE ADMIN - GESTION (FRAGMENT DYNAMIQUE)
// =========================================================================
document.getElementById('toggle-admin-mode')?.addEventListener('change', async (e) => {
    const isGestionMode = e.target.checked;
    
    const zoneRoliste = document.getElementById('contenu-roliste');
    const zoneGestion = document.getElementById('conteneur-admin-gestion');
    const userRoleBadge = document.getElementById('user-role-badge');

    if (isGestionMode) {
        console.log("🔄 Bascule : Mode ADMIN - GESTION");
        if (userRoleBadge) userRoleBadge.innerText = "Admin - Gestion";
        
        // 1. Permutation des vues sous le header
        if (zoneRoliste) zoneRoliste.style.display = 'none';
        if (zoneGestion) zoneGestion.style.display = 'block';
        
        // 2. Injection du CSS de gestion exclusive
        if (!document.getElementById('css-admin')) {
            const link = document.createElement('link');
            link.id = 'css-admin';
            link.rel = 'stylesheet';
            link.href = './ADMIN/admin-style.css';
            document.head.appendChild(link);
        } else {
            document.getElementById('css-admin').disabled = false;
        }

        // 3. Récupération asynchrone du panneau HTML externe
        if (zoneGestion && zoneGestion.innerHTML.trim() === "") {
            try {
                const response = await fetch('./ADMIN/admin-panel.html'); 
                if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);
                
                zoneGestion.innerHTML = await response.text();
                
                // Chargement dynamique du module JS de contrôle
                const { initialiserDashboardAdmin } = await import('/ADMIN/admin-logic.js');
                await initialiserDashboardAdmin();
                
            } catch (err) {
                console.error("❌ Erreur lors de l'initialisation du panneau Admin :", err);
                zoneGestion.innerHTML = `<div id="System-Error">[SYSTEM ERROR] Échec du couplage avec le module de gestion : ${err.message}</div>`;
            }
        } else {
            // Si le tableau est déjà chargé, on demande un rafraîchissement des compteurs Firestore
            if (window.mettreAJourStatsAdmin) window.mettreAJourStatsAdmin();
        }
    } else {
        console.log("🔄 Bascule : Mode ADMIN - RÔLISTE");
        if (userRoleBadge) userRoleBadge.innerText = "Admin - Rôliste";
        
        // Permutation inverse des blocs
        if (zoneGestion) zoneGestion.style.display = 'none';
        if (zoneRoliste) zoneRoliste.style.display = 'block';
        
        // Désactivation des styles temporaires du tableau de bord d'administration
        if (document.getElementById('css-admin')) {
            document.getElementById('css-admin').disabled = true;
        }
    }
});