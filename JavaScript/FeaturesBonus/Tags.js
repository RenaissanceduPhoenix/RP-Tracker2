import { db } from '../Firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fabrique le code HTML des badges et de la barre de gestion des tags
 */
export function genererBadgesEtSelecteur(rpId, tagsTab) {
    const listeTags = Array.isArray(tagsTab) ? tagsTab : [];
    
    let badgesHTML = '';
    listeTags.forEach(tag => {
        if (tag) {
            const classeCouleur = tag.replace('#', '').toLowerCase(); 
            badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
        }
    });

    // Retourne le sélecteur d'attribution individuel sans interaction avec le parent (zéro clic fantôme)
    return `
        <div class="pending-footer-tags" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; width:100%;">
            <div class="rp-tags-badges" style="display:flex; gap:4px;">${badgesHTML}</div>
            <select class="select-tag-toggle" data-rpid="${rpId}" style="background:#101015; color:#ccc; border:1px solid rgba(167, 119, 227, 0.4); border-radius:4px; padding:2px 5px; font-size:11px; cursor:pointer;">
                <option value="" selected>🏷️ Gérer les tags...</option>
                <option value="#Action" style="color:#ff5555;">${listeTags.includes('#Action') ? '❌ Retirer' : '⚔️ Ajouter'} Action</option>
                <option value="#Romance" style="color:#ff66b2;">${listeTags.includes('#Romance') ? '❌ Retirer' : '❤️ Ajouter'} Romance</option>
                <option value="#Important" style="color:#ffaa00;">${listeTags.includes('#Important') ? '❌ Retirer' : '🚨 Ajouter'} Important</option>
                <option value="#Rapide" style="color:#00bcd4;">${listeTags.includes('#Rapide') ? '❌ Retirer' : '⚡ Ajouter'} Rapide</option>
            </select>
        </div>
    `;
}

/**
 * Initialise le filtrage dynamique des boutons supérieurs et les écouteurs de tags
 */
export function initialiserFiltrageTags() {
    // --- 1. FILTRAGE DES CARTES (Boutons supérieurs de la barre d'énergie) ---
    document.querySelectorAll('.btn-tag-filter').forEach(button => {
        // Recréation propre de l'élément pour purger les écouteurs dupliqués en mémoire
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.btn-tag-filter').forEach(btn => btn.classList.remove('active'));
            newButton.classList.add('active');

            const tagSelectionne = newButton.getAttribute('data-tag'); // Contient "all" ou "#Action" par exemple
            const cards = document.querySelectorAll('.pending-item');

            cards.forEach(card => {
                const cardTagsString = card.getAttribute('data-tags') || '';
                // Découpage propre des tags sous forme de tableau
                const listeTagsDeLaCarte = cardTagsString.split(',').filter(t => t.trim() !== "");

                // CORRECTION LOGIQUE : Si "all" on affiche, sinon on vérifie la présence du tag exact
                if (tagSelectionne === 'all' || listeTagsDeLaCarte.includes(tagSelectionne)) {
                    card.style.setProperty('display', 'block', 'important');
                } else {
                    card.style.setProperty('display', 'none', 'important');
                }
            });
        });
    });

    // --- 2. ATTRIBUTION / RETRAIT DYNAMIQUES DANS FIRESTORE ---
    document.querySelectorAll('.select-tag-toggle').forEach(selector => {
        selector.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Tue l'événement ici pour détruire le clic fantôme

            const rpId = selector.getAttribute('data-rpid');
            const tagChoisi = e.target.value;

            if (!tagChoisi) return;

            try {
                const docRef = doc(db, "rps_received", rpId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let currentTags = docSnap.data().tags;
                    if (!Array.isArray(currentTags)) currentTags = [];

                    if (currentTags.includes(tagChoisi)) {
                        currentTags = currentTags.filter(t => t !== tagChoisi);
                    } else {
                        currentTags.push(tagChoisi);
                    }

                    // Sauvegarde instantanée sur la collection rps_received
                    await updateDoc(docRef, { tags: currentTags });
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour du tag :", error);
            } finally {
                selector.value = ""; // Remet le menu à l'état initial
            }
        });
    });
}