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

    let color = "#23d160"; // Vert (Récent)
    let label = "Récent";

    if (diffInDays >= 3 && diffInDays < 6) {
        color = "#ffcc00"; // Orange (En attente)
        label = "Attente";
    } else if (diffInDays >= 6) {
        color = "#f81a1a"; // Rouge (Urgent)
        label = "Relance !";
    }

    return `<span class="urgency-tag" style="background-color: ${color};" title="Reçu il y a ${diffInDays} jours">
                ${label}
            </span>`;
}