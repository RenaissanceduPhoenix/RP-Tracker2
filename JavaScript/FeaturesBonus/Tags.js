// On importe les fonctions nécessaires de Firebase pour les mises à jour
import { db } from './Firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fabrique le code HTML des badges et du menu déroulant pour un RP donné
 * @param {string} rpId - L'ID Firebase du document RP
 * @param {Array} tagsTab - Le tableau des tags actuels du RP (ex: ['#Action', '#Important'])
 * @returns {string} Le code HTML à insérer dans la carte du Pending
 */
export function genererBadgesEtSelecteur(rpId, tagsTab = []) {
    // 1. Génération des petits badges
    let badgesHTML = '';
    tagsTab.forEach(tag => {
        // Enlève le # et met en minuscule pour correspondre aux classes du CSS (.action, .romance...)
        const classeCouleur = tag.replace('#', '').toLowerCase(); 
        badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
    });

    // 2. Génération du menu déroulant avec les styles "cochés" si le tag est actif
    const itemFooterHTML = `
        <div class="rp-tags-badges">${badgesHTML}</div>
        <div class="pending-footer-tags">
            <select class="select-tag-toggle" data-rpid="${rpId}">
                <option value="">🏷️ Gérer les tags...</option>
                <option value="#Action" ${tagsTab.includes('#Action') ? 'style="color:#ff5555; font-weight:bold;"' : ''}>
                    ⚔️ Action ${tagsTab.includes('#Action') ? '✅' : ''}
                </option>
                <option value="#Romance" ${tagsTab.includes('#Romance') ? 'style="color:#ff66b2; font-weight:bold;"' : ''}>
                    ❤️ Romance ${tagsTab.includes('#Romance') ? '✅' : ''}
                </option>
                <option value="#Important" ${tagsTab.includes('#Important') ? 'style="color:#ffaa00; font-weight:bold;"' : ''}>
                    🚨 Important ${tagsTab.includes('#Important') ? '✅' : ''}
                </option>
                <option value="#Rapide" ${tagsTab.includes('#Rapide') ? 'style="color:#00bcd4; font-weight:bold;"' : ''}>
                    ⚡ Rapide ${tagsTab.includes('#Rapide') ? '✅' : ''}
                </option>
            </select>
        </div>
    `;

    return itemFooterHTML;
}

/**
 * Initialise les écouteurs d'événements pour les boutons de filtres et les menus déroulants.
 * À exécuter UNE SEULE FOIS au chargement de la page.
 */
export function initialiserFiltrageTags() {
    
    // --- 1. FILTRAGE AU CLIC SUR LES BOUTONS ---
    document.querySelectorAll('.btn-tag-filter').forEach(button => {
        button.addEventListener('click', () => {
            // Gère l'état visuel actif des boutons de la barre
            document.querySelectorAll('.btn-tag-filter').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tagSelectionne = button.getAttribute('data-tag');
            const cards = document.querySelectorAll('.pending-item');

            cards.forEach(card => {
                // On récupère les tags de la carte stockés dans son attribut 'data-tags'
                const cardTags = card.getAttribute('data-tags') || '';
                
                if (tagSelectionne === 'all' || cardTags.includes(tagSelectionne)) {
                    card.style.display = 'block'; // On affiche
                } else {
                    card.style.display = 'none';  // On cache
                }
            });
        });
    });

    // --- 2. GESTION DES CHANGEMENTS DANS LE SÉLECTEUR (TOGGLE FIREBASE) ---
    document.addEventListener('change', async (e) => {
        if (e.target.classList.contains('select-tag-toggle')) {
            const rpId = e.target.getAttribute('data-rpid');
            const tagChoisi = e.target.value;

            if (!tagChoisi) return;

            try {
                // On pointe sur le document concerné dans la collection "pending"
                const docRef = doc(db, "pending", rpId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let currentTags = docSnap.data().tags || [];

                    // Système de "Toggle" : si le tag y est on l'enlève, sinon on l'ajoute
                    if (currentTags.includes(tagChoisi)) {
                        currentTags = currentTags.filter(t => t !== tagChoisi);
                    } else {
                        currentTags.push(tagChoisi);
                    }

                    // Enregistrement de la mise à jour dans Firebase
                    await updateDoc(docRef, { tags: currentTags });
                    
                    // Optionnel : On rafraîchit la page pour appliquer visuellement le changement instantanément
                    location.reload();
                }
            } catch (error) {
                console.error("Erreur lors du toggle du tag dans Firebase :", error);
            }
        }
    });
}