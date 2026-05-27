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
            // Nettoie le '#' et passe en minuscule pour correspondre aux classes CSS (.action, .romance...)
            const classeCouleur = tag.replace('#', '').toLowerCase().trim(); 
            badgesHTML += `<span class="badge-tag ${classeCouleur}">${tag}</span>`;
        }
    });

    // Retourne le sélecteur d'attribution individuel (zéro clic fantôme)
    return `
        <div class="pending-footer-tags" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; width:100%;">
            <div class="rp-tags-badges" style="display:flex; gap:4px; flex-wrap:wrap;">${badgesHTML}</div>
            <select class="select-tag-toggle" data-rpid="${rpId}" style="background:#101015; color:#ccc; border:1px solid rgba(167, 119, 227, 0.4); border-radius:4px; padding:2px 5px; font-size:11px; cursor:pointer;">
                <option value="">🏷️ Gérer...</option>
                <option value="#Action">⚔️ Action</option>
                <option value="#Romance">❤️ Romance</option>
                <option value="#Important">🚨 Important</option>
                <option value="#Rapide">⚡ Rapide</option>
                <option value="#Chill"> Chill</option>
            </select>
        </div>
    `;
}

/**
 * Initialise la logique d'écoute des filtres du haut et des changements de sélecteurs
 */
export function initialiserFiltrageTags() {
    // --- 1. FILTRAGE DES CARTES (Boutons supérieurs) ---
    document.querySelectorAll('.btn-tag-filter').forEach(button => {
        // Clonage pour purger les anciens écouteurs et éviter les doublons de clics
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Gestion de la classe active visuelle
            document.querySelectorAll('.btn-tag-filter').forEach(btn => btn.classList.remove('active'));
            newButton.classList.add('active');

            const tagSelectionne = newButton.getAttribute('data-tag'); // ex: "all", "Action", "Romance"
            const cards = document.querySelectorAll('.pending-item');

            cards.forEach(card => {
                if (tagSelectionne === 'all') {
                    card.style.setProperty('display', 'block', 'important');
                    return;
                }

                // Récupère la liste des tags de la carte stockés dans l'attribut (ex: "#Action,#Important")
                const cardTagsString = card.getAttribute('data-tags') || '';
                const listeTagsDeLaCarte = cardTagsString.split(',').map(t => t.trim());

                // HARMONISATION : Ton HTML utilise "Action", mais Firebase utilise "#Action"
                const tagFormatte = tagSelectionne.startsWith('#') ? tagSelectionne : '#' + tagSelectionne;

                if (listeTagsDeLaCarte.includes(tagFormatte)) {
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
            e.stopPropagation(); // Évite l'ouverture de la modale de lecture située derrière

            const rpId = selector.getAttribute('data-rpid');
            let tagChoisi = e.target.value;

            if (!tagChoisi) return;
            
            // Sécurité : on s'assure que le tag possède le symbole '#' avant de l'envoyer dans Firebase
            if (!tagChoisi.startsWith('#')) {
                tagChoisi = '#' + tagChoisi;
            }

            try {
                const docRef = doc(db, "rps_received", rpId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let currentTags = docSnap.data().tags;
                    if (!Array.isArray(currentTags)) currentTags = [];

                    // Si le tag y est déjà, on le retire (système d'interrupteur), sinon on l'ajoute
                    if (currentTags.includes(tagChoisi)) {
                        currentTags = currentTags.filter(t => t !== tagChoisi);
                    } else {
                        currentTags.push(tagChoisi);
                    }

                    // Mise à jour temps réel sur Firestore
                    await updateDoc(docRef, { tags: currentTags });
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour du tag :", error);
            } finally {
                selector.value = ""; // Réinitialise le menu déroulant de la carte
            }
        });
    });
}