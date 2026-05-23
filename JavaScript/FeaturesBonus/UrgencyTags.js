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

    let urgencyClass = "safe"; // Vert par défaut (Récent)
    let label = "Récent";

    if (diffInDays >= 3 && diffInDays < 6) {
        urgencyClass = "medium"; // Orange (En attente)
        label = "Attente";
    } else if (diffInDays >= 6) {
        urgencyClass = "urgent"; // Rouge (Urgent)
        label = "Relance !";
    }

    // Application de la classe globale pour gérer l'arrondi parfait via le CSS
    return `<span class="urgency-badge ${urgencyClass}" title="Reçu il y a ${diffInDays} jours">
                ${label}
            </span>`;
}