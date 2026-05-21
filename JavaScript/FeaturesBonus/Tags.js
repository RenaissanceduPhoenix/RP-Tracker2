import { db } from '../Firebase.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fabrique le code HTML des badges et de la barre de gestion des tags
 */
export function genererBadgesEtSelecteur(rpId, tagsTab) {
    const listeTags = Array.isArray(tagsTab) ? tagsTab : [];
    
    // 1. Fabrication des badges visuels au-dessus du sélecteur
    let badgesHTML = '';
    listeTags.forEach(tag => {
        if (tag) {
            const classeCouleur = tag.replace('#', '').toLowerCase(); 
            badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
        }
    });

    // 2. Création d'un menu déroulant propre avec un indicateur clair d'Ajout/Retrait
    const itemFooterHTML = `
        <div class="pending-footer-tags" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; width:100%;">
            <div class="rp-tags-badges">${badgesHTML}</div>
            <select class="select-tag-toggle" data-rpid="${rpId}" style="background:#101015; color:#ccc; border:1px solid rgba(167, 119, 227, 0.4); border-radius:4px; padding:2px 5px; font-size:11px; cursor:pointer;">
                <option value="" selected>🏷️ Gérer les tags...</option>
                <option value="#Action" style="color:#ff5555;">${listeTags.includes('#Action') ? '❌ Retirer' : '⚔️ Ajouter'} Action</option>
                <option value="#Romance" style="color:#ff66b2;">${listeTags.includes('#Romance') ? '❌ Retirer' : '❤️ Ajouter'} Romance</option>
                <option value="#Important" style="color:#ffaa00;">${listeTags.includes('#Important') ? '❌ Retirer' : '🚨 Ajouter'} Important</option>
                <option value="#Rapide" style="color:#00bcd4;">${listeTags.includes('#Rapide') ? '❌ Retirer' : '⚡ Ajouter'} Rapide</option>
            </select>
        </div>
    `;

    return itemFooterHTML;
}

/**
 * Initialise le filtrage et les clics sur les boutons d'attribution
 */
export function initialiserFiltrageTags() {
    // --- 1. FILTRER LES CARTES (Barre supérieure d'énergie du tableau de bord) ---
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

    // --- 2. ATTRIBUER OU RETIRER LES TAGS (Au changement de sélection du menu déroulant) ---
    document.querySelectorAll('.select-tag-toggle').forEach(selector => {
        selector.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // ÉRADICATION DU CLIC FANTÔME : Le clic meurt ici et n'ouvre pas le texte de la carte située derrière !

            const rpId = selector.getAttribute('data-rpid');
            const tagChoisi = e.target.value;

            if (!tagChoisi) return;

            try {
                // CORRECTION DE LA COLLECTION : Changement pour "rps_received"
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

                    // Écriture instantanée dans Firestore
                    await updateDoc(docRef, { tags: currentTags });
                    
                    // Remise à zéro immédiate de la valeur affichée du sélecteur
                    selector.value = "";
                }
            } catch (error) {
                console.error("Erreur d'écriture dans rps_received :", error);
            }
        });
    });
}