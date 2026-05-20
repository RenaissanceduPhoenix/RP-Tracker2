// On remonte d'un dossier (..) car Tags.js est dans FeaturesBonus et Firebase.js est dans JavaScript
import { db } from '../Firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fabrique le code HTML des badges et du menu déroulant pour un RP donné
 */
export function genererBadgesEtSelecteur(rpId, tagsTab = []) {
    let badgesHTML = '';
    tagsTab.forEach(tag => {
        const classeCouleur = tag.replace('#', '').toLowerCase(); 
        badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
    });

    const itemFooterHTML = `
        <div class="pending-footer-tags" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; width:100%;">
            <div class="rp-tags-badges">${badgesHTML}</div>
            <select class="select-tag-toggle" data-rpid="${rpId}">
                <option value="">🏷️ Gérer les tags...</option>
                <option value="#Action" ${tagsTab.includes('#Action') ? 'style="color:#ff5555; font-weight:bold;"' : ''}>
                    ⚔️ Action ${tagsTab.includes('#Action') ? '❌' : ''}
                </option>
                <option value="#Romance" ${tagsTab.includes('#Romance') ? 'style="color:#ff66b2; font-weight:bold;"' : ''}>
                    ❤️ Romance ${tagsTab.includes('#Romance') ? '❌' : ''}
                </option>
                <option value="#Important" ${tagsTab.includes('#Important') ? 'style="color:#ffaa00; font-weight:bold;"' : ''}>
                    🚨 Important ${tagsTab.includes('#Important') ? '❌' : ''}
                </option>
                <option value="#Rapide" ${tagsTab.includes('#Rapide') ? 'style="color:#00bcd4; font-weight:bold;"' : ''}>
                    ⚡ Rapide ${tagsTab.includes('#Rapide') ? '❌' : ''}
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
    // --- 1. FILTRAGE AU CLIC ---
    document.querySelectorAll('.btn-tag-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Évite les conflits d'événements
            
            document.querySelectorAll('.btn-tag-filter').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tagSelectionne = button.getAttribute('data-tag');
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

    // --- 2. ENREGISTREMENT AU CHANGEMENT DU SELECTEUR ---
    document.querySelectorAll('.select-tag-toggle').forEach(selector => {
        // On enlève un éventuel ancien écouteur pour éviter les doublons
        selector.removeEventListener('change', gérerChangementTag);
        selector.addEventListener('change', gérerChangementTag);
    });
}

// Fonction isolée pour traiter le changement de tag dans Firebase
async function gérerChangementTag(e) {
    const rpId = e.target.getAttribute('data-rpid');
    const tagChoisi = e.target.value;

    if (!tagChoisi) return;

    try {
        // Cible la collection "rps_received" (car tes pending sont dedans !)
        const docRef = doc(db, "rps_received", rpId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            let currentTags = docSnap.data().tags || [];

            if (currentTags.includes(tagChoisi)) {
                currentTags = currentTags.filter(t => t !== tagChoisi);
            } else {
                currentTags.push(tagChoisi);
            }

            await updateDoc(docRef, { tags: currentTags });
            
            // Rechargement léger pour mettre à jour les badges visuellement
            if (window.loadPending) window.loadPending();
        }
    } catch (error) {
        console.error("Erreur lors du toggle du tag dans Firebase :", error);
    }
}