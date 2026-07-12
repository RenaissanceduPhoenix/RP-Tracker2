import { db } from './Firebase.js';
import { collection, setDoc, addDoc, getDoc, updateDoc, doc, query, where, onSnapshot, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseRP } from './Markdown.js';
import { getStatsSemaine, getStatsMois, getStatsGlobales } from './DataService.js';
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
                        <button class="btn-action btn-done" title="Marquer comme Répondu (Faire Disparaître)" style="background:#27ae60;">✅</button>
                        <button class="btn-action btn-archive" title="Terminer le RP (Archiver)" style="background:#c0392b;">🛑</button>
                        <button class="btn-action btn-clean-ai" title="🧹 Forcer le nettoyage de la mémoire IA" style="background:#34495e;">🧹</button>
                        <button class="btn-pending" onclick="window.openCoWriteModal('${id}', '${character.replace(/'/g, "\\'")}')" title="Co-Écriture" style="background: none; border: none; font-size: 1.1rem; cursor: pointer;">🖋️</button>
                    </div>
                </div>
                <div class="rp-card-tags-area" style="margin-top: 8px;">${tagsHTML}</div>
            `;

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
        // Chargement simultané mais dans 3 variables totalement hermétiques
        const resSemaine = await getStatsSemaine();
        const resMois = await getStatsMois();
        const resGlobal = await getStatsGlobales();

        // 📊 Préparation Graphique SEMAINE
        const sS = resSemaine.stylesGlobaux;
        const tS = sS.actions + sS.paroles + sS.pensees;
        const pActS = tS > 0 ? Math.round((sS.actions / tS) * 100) : 0;
        const pParS = tS > 0 ? Math.round((sS.paroles / tS) * 100) : 0;
        const pPenS = tS > 0 ? (100 - (pActS + pParS)) : 0;

        // 📊 Préparation Graphique MOIS
        const sM = resMois.stylesGlobaux;
        const tM = sM.actions + sM.paroles + sM.pensees;
        const pActM = tM > 0 ? Math.round((sM.actions / tM) * 100) : 0;
        const pParM = tM > 0 ? Math.round((sM.paroles / tM) * 100) : 0;
        const pPenM = tM > 0 ? (100 - (pActM + pParM)) : 0;

        // 📊 Préparation Graphique GLOBAL
        const sG = resGlobal.stylesGlobaux;
        const tG = sG.actions + sG.paroles + sG.pensees;
        const pActG = tG > 0 ? Math.round((sG.actions / tG) * 100) : 0;
        const pParG = tG > 0 ? Math.round((sG.paroles / tG) * 100) : 0;
        const pPenG = tG > 0 ? (100 - (pActG + pParG)) : 0;

        // Injection brute des 3 structures séparées dans le DOM
        statsContainer.innerHTML = `
            <h2 style=" color: #a777e3; margin-bottom: 25px;">⚔️ Quartier Général des Statistiques</h2>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid #2a2a35; padding: 20px; border-radius: 6px; color: #e0e0e0;">
                    <h3 style="color: #ffcc00; margin-top: 0;  border-bottom: 1px solid #2a2a35; padding-bottom: 8px;">📊 RELEVÉ 7 JOURS</h3>
                    <ul style="list-style: none; padding: 0; line-height: 1.8; font-size: 0.9rem;">
                        <li>⚡ <b>XP :</b> <span style="color: #ffcc00; font-weight: bold;">${resSemaine.totalXp.toLocaleString()} XP</span></li>
                        <li>🏆 <b>Champion :</b> <span>${resSemaine.topChar}</span></li>
                        <li>🏰 <b>Front Actif :</b> <span>${resSemaine.topServer}</span></li>
                        <li>📈 <b>Activité :</b> <span style="color: #2ecc71;">${resSemaine.moyenneJour}</span></li>
                        <li>📝 <b>Mots :</b> <span style="color: #3498db; font-weight: bold;">${resSemaine.totalMots.toLocaleString()} mots</span></li>
                        <li style="margin-top: 5px; font-size: 0.8rem; color: #aaa;">⚔️ Act: ${sS.actions} | 💬 Par: ${sS.paroles} | 💭 Pen: ${sS.pensees}</li>
                    </ul>
                    <button type="button" id="btnGraphSemaine" style="background: #a777e3; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.75rem; width: 100%; margin-top: 10px;">DÉPLOYER LE GRAPH</button>
                    <div id="zoneGraphSemaine" style="display: none; flex-direction: column; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <div style="width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(#e28743 0% ${pActS}%, #76b5c5 ${pActS}% ${pActS + pParS}%, #873e23 ${pActS + pParS}% 100%);"></div>
                        <div style="display: flex; gap: 8px; margin-top: 10px; font-size: 0.7rem; font-weight: bold;">
                            <span style="color: #e28743;">● Act (${pActS}%)</span> <span style="color: #76b5c5;">● Par (${pParS}%)</span> <span style="color: #873e23;">● Pen (${pPenS}%)</span>
                        </div>
                    </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid #2a2a35; padding: 20px; border-radius: 6px; color: #e0e0e0;">
                    <h3 style="color: #3498db; margin-top: 0; border-bottom: 1px solid #2a2a35; padding-bottom: 8px;">🦅 RELEVÉ 30 JOURS</h3>
                    <ul style="list-style: none; padding: 0; line-height: 1.8; font-size: 0.9rem;">
                        <li>⚡ <b>XP :</b> <span style="color: #ffcc00; font-weight: bold;">${resMois.totalXp.toLocaleString()} XP</span></li>
                        <li>🏆 <b>Champion :</b> <span>${resMois.topChar}</span></li>
                        <li>🏰 <b>Front Actif :</b> <span>${resMois.topServer}</span></li>
                        <li>📈 <b>Activité :</b> <span style="color: #2ecc71;">${resMois.moyenneJour}</span></li>
                        <li>📝 <b>Mots :</b> <span style="color: #3498db; font-weight: bold;">${resMois.totalMots.toLocaleString()} mots</span></li>
                        <li style="margin-top: 5px; font-size: 0.8rem; color: #aaa;">⚔️ Act: ${sM.actions} | 💬 Par: ${sM.paroles} | 💭 Pen: ${sM.pensees}</li>
                    </ul>
                    <button type="button" id="btnGraphMois" style="background: #a777e3; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.75rem; width: 100%; margin-top: 10px;">DÉPLOYER LE GRAPH</button>
                    <div id="zoneGraphMois" style="display: none; flex-direction: column; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <div style="width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(#e28743 0% ${pActM}%, #76b5c5 ${pActM}% ${pActM + pParM}%, #873e23 ${pActM + pParM}% 100%);"></div>
                        <div style="display: flex; gap: 8px; margin-top: 10px; font-size: 0.7rem; font-weight: bold;">
                            <span style="color: #e28743;">● Act (${pActM}%)</span> <span style="color: #76b5c5;">● Par (${pParM}%)</span> <span style="color: #873e23;">● Pen (${pPenM}%)</span>
                        </div>
                    </div>
                </div>

                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid #2a2a35; padding: 20px; border-radius: 6px; color: #e0e0e0;">
                    <h3 style="color: #2ecc71; margin-top: 0; border-bottom: 1px solid #2a2a35; padding-bottom: 8px;">👑 HISTORIQUE GLOBAL</h3>
                    <ul style="list-style: none; padding: 0; line-height: 1.8; font-size: 0.9rem;">
                        <li>⚡ <b>XP :</b> <span style="color: #ffcc00; font-weight: bold;">${resGlobal.totalXp.toLocaleString()} XP</span></li>
                        <li>🏆 <b>Champion :</b> <span>${resGlobal.topChar}</span></li>
                        <li>🏰 <b>Front Actif :</b> <span>${resGlobal.topServer}</span></li>
                        <li>📈 <b>Activité :</b> <span style="color: #2ecc71;">${resGlobal.moyenneJour}</span></li>
                        <li>📝 <b>Mots :</b> <span style="color: #3498db; font-weight: bold;">${resGlobal.totalMots.toLocaleString()} mots</span></li>
                        <li style="margin-top: 5px; font-size: 0.8rem; color: #aaa;">⚔️ Act: ${sG.actions} | 💬 Par: ${sG.paroles} | 💭 Pen: ${sG.pensees}</li>
                    </ul>
                    <button type="button" id="btnGraphGlobal" style="background: #a777e3; color: #fff; border: none; padding: 5px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.75rem; width: 100%; margin-top: 10px;">DÉPLOYER LE GRAPH</button>
                    <div id="zoneGraphGlobal" style="display: none; flex-direction: column; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <div style="width: 110px; height: 110px; border-radius: 50%; background: conic-gradient(#e28743 0% ${pActG}%, #76b5c5 ${pActG}% ${pActG + pParG}%, #873e23 ${pActG + pParG}% 100%);"></div>
                        <div style="display: flex; gap: 8px; margin-top: 10px; font-size: 0.7rem; font-weight: bold;">
                            <span style="color: #e28743;">● Act (${pActG}%)</span> <span style="color: #76b5c5;">● Par (${pParG}%)</span> <span style="color: #873e23;">● Pen (${pPenG}%)</span>
                        </div>
                    </div>
                </div>

            </div>
        `;

        // 🔒 Bouton Semaine 
        document.getElementById("btnGraphSemaine").addEventListener("click", function() {
            const z = document.getElementById("zoneGraphSemaine");
            z.style.display = z.style.display === "flex" ? "none" : "flex";
            this.innerText = z.style.display === "flex" ? "MASQUER LE GRAPH" : "DÉPLOYER LE GRAPH";
        });

        // 🔒 Bouton Mois
        document.getElementById("btnGraphMois").addEventListener("click", function() {
            const z = document.getElementById("zoneGraphMois");
            z.style.display = z.style.display === "flex" ? "none" : "flex";
            this.innerText = z.style.display === "flex" ? "MASQUER LE GRAPH" : "DÉPLOYER LE GRAPH";
        });

        // 🔒 Bouton Global
        document.getElementById("btnGraphGlobal").addEventListener("click", function() {
            const z = document.getElementById("zoneGraphGlobal");
            z.style.display = z.style.display === "flex" ? "none" : "flex";
            this.innerText = z.style.display === "flex" ? "MASQUER LE GRAPH" : "DÉPLOYER LE GRAPH";
        });

    } catch (e) {
        console.error("Erreur critique lors de la mise à jour des statistiques :", e);
    }
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
        setTimeout(() => feedbackMsg.remove(), 5000);
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