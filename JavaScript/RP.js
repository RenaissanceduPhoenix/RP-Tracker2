import { db } from './Firebase.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, onSnapshot, Timestamp} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Déclaration en haut du fichier pour éviter l'erreur d'initialisation
let unsubscribePending = null;



// ➜ Ajouter RP envoyé
window.addSent = async function() {
  const character = document.getElementById("char_sent").value;
  const server = document.getElementById("server_sent").value;
  if (!character || !server) { alert("Remplis tous les champs"); return; }
  await addDoc(collection(db, "rps_sent"), { character, server, createdAt: new Date() });
  document.getElementById("char_sent").value = "";
  document.getElementById("server_sent").value = "";
};

// ➜ Ajouter RP reçu
window.addReceived = async function() {
  const title = document.getElementById("title").value;
  const character = document.getElementById("char_received").value;
  const server = document.getElementById("server_received").value;
  const content = document.getElementById("content").value;
  if (!title || !character || !server) { alert("Remplis tous les champs importants"); return; }
  await addDoc(collection(db, "rps_received"), { title, character, server, content, status: "pending", createdAt: new Date() });
  document.getElementById("title").value = "";
  document.getElementById("char_received").value = "";
  document.getElementById("server_received").value = "";
  document.getElementById("content").value = "";
  loadPending();
};

// ➜ Charger RP à répondre


window.loadPending = function() {
  // 2. Sécurité : Si une écoute existe déjà, on l'arrête proprement avant d'en créer une nouvelle
  if (unsubscribePending) {
    unsubscribePending();
  }

  const q = query(collection(db, "rps_received"), where("status", "==", "pending"));
  
  // 3. On stocke la fonction de désabonnement dans notre variable
  unsubscribePending = onSnapshot(q, (snapshot) => {
    const list = document.getElementById("pendingList");
    if (!list) return;

    // On vide la liste avant de la reconstruire (plus simple pour débuter)
    list.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const rp = docSnap.data();
      const id = docSnap.id;

      const div = document.createElement("div");
      div.className = "rp-card";
      div.setAttribute("data-id", id);

      // Préparation du contenu pour la modal
      const safeContent = rp.content ? rp.content.replace(/`/g, "\\`").replace(/\n/g, "\\n") : "";

      //div.onclick = () => {
        //  if (typeof openModal === 'function') {
          //    openModal(safeContent, rp.title, `${rp.character} — ${rp.server}`);
          //}
      //};

      div.innerHTML = `
        <div class="rp-info">
          <b>${rp.title}</b><br>
          <small>${rp.character} — ${rp.server}</small>
        </div>
        <button class="btn-done" onclick="event.stopPropagation(); markDone('${id}')">Fait</button>
      `;
      list.appendChild(div);
    });
  }, (err) => {
    console.error("❌ Erreur loadPending:", err);
  });
};

// ➜ Marquer comme fait
window.markDone = async function(id) {
  try {
    await updateDoc(doc(db, "rps_received", id), { status: "done" });
    // Le refresh se fera tout seul grâce au onSnapshot !
  } catch (e) {
    console.error("Erreur markDone:", e);
  }
};

// Lancement initial
loadPending();

window.debugFirebase = async function() {
  try {
    const snap = await getDocs(collection(db, "rps_sent"));
    console.log("🔥 Docs trouvés:", snap.size);
  } catch (err) {
    console.error("❌ Firebase mort:", err.message);
  }
};
window.openModal = function(content, title, meta) {
    const displayArea = document.getElementById("displayArea");
    
    if (displayArea) {
        // On vide le message d'attente
        displayArea.innerHTML = ""; 

        // Création de la structure
        const header = `<h3>${title}</h3><p><small>${meta}</small></p><hr>`;
        
        // Utilisation de ta fonction de Markdown.js
        // Si parseRP n'est pas trouvé, on affiche le texte brut
        const formattedContent = (typeof parseRP === 'function') 
            ? parseRP(content) 
            : content.replace(/\n/g, "<br>");

        displayArea.innerHTML = `
            ${header}
            <div class="rp-display-content">
                ${formattedContent}
            </div>
        `;

        // Scroll automatique en haut de la zone quand on change de RP
        displayArea.scrollTop = 0;
    }
};
window.closeModal = function() {
    document.getElementById("modal").style.display = "none";
};

// 🚀 Initialisation de l'application
async function initApp() {
    console.log("Démarrage de l'application...");
    try {
        // 1. Charger la liste des RP en attente (Live Snapshot)
        if (typeof loadPending === 'function') {
            await loadPending();
        }

        // 2. Charger les stats (si la fonction existe)
        if (typeof updateStats === 'function') {
            await updateStats();
        }

        // 3. Déclencher le premier rendu du graphique
        // On attend un court instant pour laisser Flatpickr s'initialiser
        setTimeout(() => {
            if (typeof window.loadCharts === 'function') {
                window.loadCharts();
            }
        }, 500);

    } catch (error) {
        console.error("Erreur lors de l'initialisation :", error);
    }
}

// Lancement
window.addEventListener('DOMContentLoaded', initApp);