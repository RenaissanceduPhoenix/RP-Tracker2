import { db } from '../Firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fabrique le code HTML des badges et de la barre de gestion des tags
 */
export function genererBadgesEtSelecteur(rpId, tagsTab) {
    const listeTags = Array.isArray(tagsTab) ? tagsTab : [];
    
    // 1. Fabrication des badges visuels
    let badgesHTML = '';
    listeTags.forEach(tag => {
        if (tag) {
            const classeCouleur = tag.replace('#', '').toLowerCase(); 
            badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
        }
    });

    // 2. Boutons d'action individuels (Suppression radicale du menu déroulant et du clic fantôme)
    const boutonsActionsHTML = `
        <div class="tag-actions-wrapper" style="display:flex; gap:5px; margin-top:5px;">
            <button class="btn-toggle-action ${listeTags.includes('#Action') ? 'active-tag' : ''}" data-rpid="${rpId}" data-value="#Action" style="font-size:11px; padding:2px 6px; cursor:pointer;">⚔️ Action</button>
            <button class="btn-toggle-action ${listeTags.includes('#Romance') ? 'active-tag' : ''}" data-rpid="${rpId}" data-value="#Romance" style="font-size:11px; padding:2px 6px; cursor:pointer;">❤️ Romance</button>
            <button class="btn-toggle-action ${listeTags.includes('#Important') ? 'active-tag' : ''}" data-rpid="${rpId}" data-value="#Important" style="font-size:11px; padding:2px 6px; cursor:pointer;">🚨 Important</button>
            <button class="btn-toggle-action ${listeTags.includes('#Rapide') ? 'active-tag' : ''}" data-rpid="${rpId}" data-value="#Rapide" style="font-size:11px; padding:2px 6px; cursor:pointer;">⚡ Rapide</button>
        </div>
    `;

    return `
        <div class="tags-block-container" style="width:100%; margin-top:8px;">
            <div class="rp-tags-badges" style="margin-bottom:5px;">${badgesHTML}</div>
            ${boutonsActionsHTML}
        </div>
    `;
}

/**
 * Initialise le filtrage et les clics sur les boutons d'attribution
 */
export function initialiserFiltrageTags() {
    // --- 1. FILTRER LES CARTES (Barre d'énergie du haut) ---
    document.querySelectorAll('.btn-tag-filter').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.btn-tag-filter').forEach(btn => btn.classList.remove('active'));
            newButton.classList.add('active');

            const tagSelectionne = newButton.getAttribute('data-tag');
            const cards = document.querySelectorAll('.pending-item');

            cards.forEach(card => {
                const cardTags = card.getAttribute('data-tags') || '';
                if (tagSelectionne === 'all' || cardTags.split(',').includes(tagSelectionne)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // --- 2. ATTRIBUER LES TAGS aux documents de rps_received ---
    document.querySelectorAll('.btn-toggle-action').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Bloque la transmission du clic vers le texte d'en dessous (Anti-clic fantôme)

            const rpId = btn.getAttribute('data-rpid');
            const tagChoisi = btn.getAttribute('data-value');

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

                    await updateDoc(docRef, { tags: currentTags });
                }
            } catch (error) {
                console.error("Erreur d'écriture Firestore :", error);
            }
        });
    });
}