/**
 * Calcule la pastille d'urgence en fonction de la date du RP
 */
export function getUrgencyTag(createdAt) {
    if (!createdAt) return "";

    // Conversion de la date Firebase (Timestamp) en objet Date JS
    const dateRP = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffInMs = now - dateRP;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    // 1. Plus de 6 jours : Relance (Rouge)
    if (diffInDays >= 6) {
        return `<span class="urgency-badge urgent" title="Reçu il y a ${diffInDays} jours">Relance !</span>`;
    }
    // 2. Entre 3 et 5 jours : Attente (Orange)
    if (diffInDays >= 3) {
         return `<span class="urgency-badge medium" title="Reçu il y a ${diffInDays} jours">En attente</span>`;
    }
    // 3. Moins de 3 jours : Récent (Vert)
    return `<span class="urgency-badge safe" title="Reçu il y a ${diffInDays} jours">Récent</span>`;
}