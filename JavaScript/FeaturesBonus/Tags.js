import { db } from '../Firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fabrique le code HTML des badges et du menu déroulant pour un RP donné
 */
export function genererBadgesEtSelecteur(rpId, tagsTab = []) {
    // SÉCURITÉ : Si tagsTab n'existe pas ou est indéfini (anciens RPs), on prend un tableau vide
    const listeTags = Array.isArray(tagsTab) ? tagsTab : [];
    
    let badgesHTML = '';
    listeTags.forEach(tag => {
        if (tag) {
            const classeCouleur = tag.replace('#', '').toLowerCase(); 
            badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
        }
    });

    const itemFooterHTML = `
        <div class="pending-footer-tags" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; width:100%;">
            <div class="rp-tags-badges">${badgesHTML}</div>
            <select class="select-tag-toggle" data-rpid="${rpId}">
                <option value="">🏷️ Gérer les tags...</option>
                <option value="#Action" ${listeTags.includes('#Action') ? 'selected style="color:#ff5555; font-weight:bold;"' : ''}>
                    ⚔️ Action ${listeTags.includes('#Action') ? '✅' : ''}
                </option>
                <option value="#Romance" ${listeTags.includes('#Romance') ? 'selected style="color:#ff66b2; font-weight:bold;"' : ''}>
                    ❤️ Romance ${listeTags.includes('#Romance') ? '✅' : ''}
                </option>
                <option value="#Important" ${listeTags.includes('#Important') ? 'selected style="color:#ffaa00; font-weight:bold;"' : ''}>
                    🚨 Important ${listeTags.includes('#Important') ? '✅' : ''}
                </option>
                <option value="#Rapide" ${listeTags.includes('#Rapide') ? 'selected style="color:#00bcd4; font-weight:bold;"' : ''}>
                    ⚡ Rapide ${listeTags.includes('#Rapide') ? '✅' : ''}
                </option>
            </select>
        </div>
    `;

    return itemFooterHTML;
}

/**
 * Initialise le filtrage dynamique au clic sur la barre d'énergie
 */
export function initialiserFiltrageTags() {
    // --- 1. FILTRAGE AU CLIC SUR LES BOUTONS ---
    document.querySelectorAll('.btn-tag-filter').forEach(button => {
        // On clone pour écraser les anciens écouteurs et éviter les clics fantômes / doublons
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Stop la propagation totale
            
            document.querySelectorAll('.btn-tag-filter').forEach(btn => btn.classList.remove('active'));
            newButton.classList.add('active');

            const tagSelectionne = newButton.getAttribute('data-tag');
            const cards = document.querySelectorAll('.pending-item');

            cards.forEach(card => {
                const cardTags = card.getAttribute('data-tags') || '';
                
                if (tagSelectionne === 'all' || cardTags.includes(tagSelectionne)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // --- 2. ATTRIBUTION DES TAGS ---
    document.querySelectorAll('.select-tag-toggle').forEach(selector => {
        selector.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Évite le clic fantôme sur la carte derrière !

            const rpId = selector.getAttribute('data-rpid');
            const tagChoisi = e.target.value;

            if (!tagChoisi) return;

            try {
                const docRef = doc(db, "rps_received", rpId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let currentTags = docSnap.data().tags || [];

                    if (currentTags.includes(tagChoisi)) {
                        // Supprime si déjà présent
                        currentTags = currentTags.filter(t => t !== tagChoisi);
                    } else {
                        // Ajoute si absent
                        currentTags.push(tagChoisi);
                    }

                    // Envoi à Firebase
                    await updateDoc(docRef, { tags: currentTags });
                    
                    // Recharge la liste en direct sans recharger toute la page web
                    if (window.loadPending) window.loadPending();
                }
            } catch (error) {
                console.error("Erreur lors du toggle du tag dans Firebase :", error);
            }
        });
    });
}