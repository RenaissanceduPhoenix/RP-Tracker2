// On définit d'abord les fiches complètes
const fiches = {
    lynx: `
        HISTOIRE ET ÉVOLUTION :
        Née en 501 sous le nom de Petite Lynx. En 503, la disparition d'Attrape Rêve ancre en elle une méfiance précoce pour la sécurité promise par le clan. Elle rejette la guerre de 504 par pur rejet émotionnel du contrôle exercé sur elle. Le sacrifice de Patte de Lapin en 507 est le choc de trop : elle acquiert la conviction que la hiérarchie sacrifie n'importe qui pour de la politique. Durant les cycles 510 et 511, elle se mure dans une contestation silencieuse. Elle travaille ses atouts seule, loin du camp, pour ne rien devoir à personne. Aujourd'hui, son refus de plier en fait une icône pour certains novices, mais une recrue jugée dangereuse par d'autres. Elle ne cherche pas à diriger, mais à ne plus subir.

        CARACTÈRE ET PSYCHOLOGIE :
        Alignement Chaotique Bon. Très fermée, elle possède une peur viscérale de l'attachement (s'attacher = devenir vulnérable). Elle juge aux actes, jamais aux paroles. Elle est allergique à la hiérarchie et aux ordres.
        STYLE SOCIAL : Elle quitte brusquement une conversation ou une patrouille dès qu'elle se sent "acculée".
    `,
    anemone: `
        HISTOIRE ET ÉVOLUTION :
        Dernière-née de l'union entre Merle Blanc et Feuille de Vigne. Fragile à la naissance, ses parents ont craint pour sa vie. Depuis la pouponnière, elle montre une sagacité précoce. Elle refuse d'être perçue comme un fardeau malgré sa fragilité naturelle. Elle nourrit le rêve secret de prouver que même la plus fragile des fleurs peut affronter les tempêtes pour protéger son clan par l'intuition et la sagesse.

        CARACTÈRE ET PSYCHOLOGIE :
        Très timide, observatrice et sagace. Elle préfère l'observation aux jeux turbulents. Elle est extrêmement susceptible concernant sa taille ou sa faiblesse supposée. Très dépendante de l'affection de sa mère (Merle Blanc) et de sa sœur (Petite Lys). Elle redoute la solitude de la forêt.
    `,
    sables: `
        HISTOIRE ET ÉVOLUTION :
        Nommée Boule de Sable en hommage aux couleurs de son pelage, puis Pelage des Sables par sa cheffe. Guerrière qui a dû apprendre à compenser ses faiblesses physiques par une détermination sans faille. Très liée à ses origines.

        CARACTÈRE ET PSYCHOLOGIE :
        Tempérament stable et résilient. Elle manque de robustesse et d'agilité, mais son cœur bat avec force. Elle ne baisse jamais les bras et utilise sa stabilité mentale pour rester au niveau des autres guerriers.
    `
};

// On lie chaque nom d'évolution à la fiche correspondante
export const charactersDB = {
    // Évolutions de Lynx
    "Petite Lynx": fiches.lynx,
    "Nuage de Lynx": fiches.lynx,
    "Ardeur du Lynx": fiches.lynx,

    // Évolutions d'Anémone
    "Petite Anémone": fiches.anemone,
    "Nuage d’Anémone": fiches.anemone,
    "Eclats d’Anémone": fiches.anemone,

    // Évolutions de Sables
    "Boule de Sable": fiches.sables,
    "Nuage des Sables": fiches.sables,
    "Pelage des Sables": fiches.sables
};