// =========================================================================
// 🐱 1. LES FICHES DES PERSONNAGES (NETTOYÉES AVEC CLÉS MAÎTRESSES)
// =========================================================================
export const fichesPersonnagesJDR = {
    "ArdeurDuLynx": {
        nom: "Nuage de Lynx",
        traits: {
            "Independant": 8,
            "Resilient": 7,
            "Audacieuse_Brave": 7,
            "Franc": 7,
            "Perseverant_Tenace": 6,
            "Fuyant_Distant": 8,
            "Paranoïaque_Accusateur": 7,
            "Brusque": 7,
            "Rancunier_Inflexible": 7,
            "Instable_Imprevisible": 6
        }
    },
    "EtincelleDeVie": {
        nom: "Étincelle de Vie",
        traits: {
            "Solaire_Enthousiaste": 6,
            "Diplomate": 6,
            "Maternel_Nourricier": 8,
            "Protecteur": 6,
            "Loyal_Fidele": 6,
            "Intuitif": 3,
            "Envahissant_Intrusif": 7,
            "Naif": 6,
            "Impatient": 6,
            "Taquin_Moqueur": 6,
            "Orgueilleux_Fier": 6,
            "Etourdi_Distrait": 4
        }
    },
    "NuageAnemone": {
        nom: "Nuage d'Anémone",
        traits: {
            "Perspicace_Sagace": 8,
            "Observateur": 9,
            "Discipline": 7,
            "Calme_Paisible": 6,
            "Empathique": 5,
            "Effacement_Passif": 8,
            "Pusillanime_Timide": 8,
            "Velleitaire_Hesitant": 7,
            "Susceptible": 6,
            "Pessimiste_Anxieux": 6
        }
    },
    "RacinePissenlit": {
        nom: "Racine de Pissenlit",
        traits: {
            "Integre_Responsable": 7, // Fusionné ou cumulé automatiquement par le moteur
            "Loyal_Fidele": 6,
            "Sage": 6,
            "Protecteur": 6,
            "Perspicace_Sagace": 4,
            "Arrogant_Outrecuidant": 7,
            "Colerique_Feroce": 6,
            "Impulsif": 6,
            "Rancunier_Inflexible": 6,
            "Impatient": 5,
            "Meritocratique": 5
        }
    }
};

// =========================================================================
// 🌍 2. RÉFÉRENTIEL UNIQUE DE CORRESPONDANCE (SYNONYMES -> CLÉ MAÎTRESSE)
// =========================================================================
export const dictionnaireSynonymesCaractere = {
    qualites: {
        "Empathique": ["empathique", "empathie", "sensible", "sensibilité", "réceptif", "compatissant", "compassion"],
        "Bienveillant_Altruiste": ["bienveillant", "bienveillance", "gentil", "gentillesse", "altruiste", "généreux", "générosité"],
        "Maternel_Nourricier": ["maternelle", "maternel", "couveuse", "attentionné", "fibre maternelle"],
        "Protecteur": ["protecteur", "protectrice", "protection", "pilier", "rempart", "gardien"],
        "Humble": ["humble", "humilité", "modeste", "sans prétention", "simple"],
        "Indulgent": ["indulgente", "indulgent", "indulgence", "clément", "pardon"],
        "Calme_Paisible": ["calme", "paisible", "pacifique", "posé", "tranquille", "sérénité"],
        "Resilient": ["résiliente", "résilient", "résilience", "inébranlable"],
        "Perseverant_Tenace": ["persévérante", "persévérant", "persévérance", "tenace", "ténacité", "acharné"],
        "Diplomate": ["diplomate", "diplomatie", "pacificateur", "conciliant", "médiateur"],
        "Loyal_Fidele": ["loyale", "loyal", "loyauté", "fidèle", "fidélité", "allégeance"],
        "Integre_Responsable": ["intégrité", "intègre", "responsabilité", "responsable", "droiture", "honnête"],
        "Solaire_Enthousiaste": ["solaire", "enthousiaste", "enthousiasme", "lumineux", "joie de vivre"],
        "Charismatique": ["charismatique", "charisme", "inspirant", "prestance", "aura"],
        "Intuitif": ["intuitive", "intuitif", "intuition", "instinctif", "flair"],
        "Perspicace_Sagace": ["perspicacité", "perspicace", "sagacité", "finesse d'esprit", "clairvoyance", "intelligent"],
        "Observateur": ["sens de l'observation", "observateur", "observatrice", "attentive", "analytique"],
        "Vigilant": ["vigilant", "vigilance", "sur ses gardes", "guet", "alerte", "prudent"],
        "Audacieuse_Brave": ["audacieuse", "audacieux", "audace", "courageux", "courage", "brave", "intrépide"],
        "Independant": ["indépendante", "indépendant", "indépendance", "autonome", "libre"],
        "Franc": ["franche", "franc", "franchise", "direct", "parler vrai"],
        "Discipline": ["discipline", "discipliné", "rigoureux", "rigueur", "maîtrise de soi"],
        "Sage": ["sagesse", "sage", "esprit pondéré", "raisonnable"],
        "Fier": ["fier"]
    },
    defauts: {
        "Naif": ["naïve", "naïf", "naïveté", "crédule", "candide"],
        "Impatient": ["impatiente", "impatient", "impatience", "irritable", "fébrile"],
        "Colerique_Feroce": ["colère", "colérique", "emporté", "féroce", "rage", "irascible", "agressif", "violent"],
        "Taquin_Moqueur": ["taquine", "taquin", "moqueur", "moqueuse", "ironique", "sarcastique"],
        "Orgueilleux_Fier": ["orgueilleuse", "orgueilleux", "orgueil", "fierté", "égocentrique"],
        "Arrogant_Outrecuidant": ["arrogant", "arrogance", "outrecuidance", "suffisance", "suffisant", "méprisant", "hautain"],
        "Etourdi_Distrait": ["étourdie", "étourdi", "étourderie", "distrait", "distraction", "tête en l'air"],
        "Envahissant_Intrusif": ["envahissante", "envahissant", "intrusive", "intrusif", "étouffant", "indiscret"],
        "Rancunier_Inflexible": ["rancunière", "rancunier", "rancune", "vindicatif", "obstination inflexible"],
        "Brusque": ["brusque", "manque de tact", "cassant", "rude", "brutal"],
        "Paranoïaque_Accusateur": ["paranoïaque", "paranoïa", "suspicieux", "accusateur", "soupçonneux"],
        "Instable_Imprevisible": ["instable", "instabilité", "lunatique", "capricieux"],
        "Fuyant_Distant": ["fuyante", "fuyant", "évitement", "fuit les conflits", "renfermé"],
        "Susceptible": ["susceptible", "susceptibilité", "ombrageux", "se vexe très facilement"],
        "Pessimiste_Anxieux": ["pessimisme", "pessimiste", "défaitiste", "inquiet", "angoissé"],
        "Velleitaire_Hesitant": ["velléité", "velléitaire", "indécis", "manque de confiance en soi"],
        "Pusillanime_Timide": ["pusillanimité", "pusillanime", "timide", "craintif", "peur de déranger"],
        "Effacement_Passif": ["effacement", "invisible", "passive", "passif", "passivité"],
        "Impulsif": ["impulsif", "impulsive", "impulsivite", "tête baissée", "sans réfléchir"],
        "Meritocratique": ["méritocratique", "élitiste", "juge au mérite strict", "exigeant"],
        "Mefiant": ["méfiant", "méfiante", "méfiance", "secret", "distant"]
    }
};

// =========================================================================
// 🎭 3. LE DICTIONNAIRE DES ACTIONS SOCIALES
// =========================================================================
export const dictionnaireActionsSociales = {
    "persuasion": {
        nom: "Persuasion & Négociation",
        description: "Convaincre un autre chat par la parole, calmer les esprits ou négocier.",
        qualitesLiees: ["Diplomate", "Empathique", "Charismatique", "Solaire_Enthousiaste"],
        defautsLies: ["Arrogant_Outrecuidant", "Impulsif", "Colerique_Feroce", "Brusque", "Impatient"]
    },
    "bluff": {
        nom: "Tromperie & Bluff",
        description: "Mentir, dissimuler ses intentions, feinter ou trahir en gardant son sang-froid.",
        qualitesLiees: ["Perspicace_Sagace", "Observateur"],
        defautsLies: ["Franc", "Naif", "Etourdi_Distrait", "Pusillanime_Timide"]
    },
    "protection_sociale": {
        nom: "Protection & Vigilance",
        description: "Veiller sur les siens, faire office de rempart, s'interposer ou monter la garde.",
        qualitesLiees: ["Protecteur", "Maternel_Nourricier", "Vigilant", "Loyal_Fidele", "Audacieuse_Brave"],
        defautsLies: ["Effacement_Passif", "Pusillanime_Timide", "Etourdi_Distrait", "Fuyant_Distant"]
    },
    "education": {
        nom: "Éducation & Mentorat",
        description: "Transmettre un savoir à un novice ou un chaton, guider, expliquer les règles.",
        qualitesLiees: ["Maternel_Nourricier", "Sage", "Integre_Responsable", "Charismatique", "Bienveillant_Altruiste"],
        defautsLies: ["Arrogant_Outrecuidant", "Impatient", "Colerique_Feroce", "Meritocratique", "Brusque"]
    },
    "apprentissage": {
        nom: "Apprentissage & Assimilation",
        description: "Écouter les leçons, observer une technique, s'entraîner sous les ordres.",
        qualitesLiees: ["Humble", "Discipline", "Perspicace_Sagace", "Observateur"],
        defautsLies: ["Susceptible", "Impulsif", "Paranoïaque_Accusateur", "Etourdi_Distrait"]
    },
    "seduction": {
        nom: "Séduction & Charme",
        description: "Troubler l'interlocuteur, utiliser son magnétisme ou flatter pour endormir la méfiance.",
        qualitesLiees: ["Solaire_Enthousiaste", "Charismatique", "Diplomate", "Fier"],
        defautsLies: ["Orgueilleux_Fier", "Arrogant_Outrecuidant", "Naif"]
    },
    "consolation": {
        nom: "Consolation & Apaisement",
        description: "Calmer la crise d'un allié, dissiper la colère, la panique ou apporter du réconfort.",
        qualitesLiees: ["Maternel_Nourricier", "Protecteur", "Empathique", "Calme_Paisible", "Bienveillant_Altruiste"],
        defautsLies: ["Envahissant_Intrusif", "Impatient"]
    },
    "raillerie": {
        nom: "Raillerie & Provocation",
        description: "Pousser délibérément quelqu'un à bout pour lui faire perdre son sang-froid ou faire une erreur.",
        qualitesLiees: ["Taquin_Moqueur", "Franc"],
        defautsLies: ["Impatient", "Brusque", "Colerique_Feroce"]
    },
    "perspicacite": {
        nom: "Perspicacité (Lire l'autre)",
        description: "Analyser les expressions, décoder le langage corporel pour détecter les mensonges ou les intentions cachées.",
        qualitesLiees: ["Intuitif", "Perspicace_Sagace", "Observateur"],
        defautsLies: ["Paranoïaque_Accusateur", "Mefiant", "Etourdi_Distrait"]
    }
    
};

// =========================================================================
// 🧠 4. LE MOTEUR DE TRADUCTION ET CALCUL INTELLIGENT
// =========================================================================
export function executerLancerSocialPrecalcul(chatTraitsRaw, idAction) {
    const configAction = dictionnaireActionsSociales[idAction];
    if (!configAction) return null;

    // ÉTAPE 1 : Nettoyer et stocker les traits bruts de la fiche vers les Clés Maîtresses
    // On va stocker une liste de valeurs pour chaque clé maîtresse afin de gérer les doublons
    const qualitesTrouvees = {}; // Structure : { "Integre_Responsable": [7, 6] }
    const defautsTrouves = {};

    const trouverCleMaitresse = (traitRaw) => {
        const net = traitRaw.toLowerCase().trim();
        // Check dans les qualités
        for (const [cleMaitresse, synonymes] of Object.entries(dictionnaireSynonymesCaractere.qualites)) {
            if (cleMaitresse.toLowerCase() === net || synonymes.some(s => s.toLowerCase() === net)) {
                return { type: "qualite", cle: cleMaitresse };
            }
        }
        // Check dans les défauts
        for (const [cleMaitresse, synonymes] of Object.entries(dictionnaireSynonymesCaractere.defauts)) {
            if (cleMaitresse.toLowerCase() === net || synonymes.some(s => s.toLowerCase() === net)) {
                return { type: "defaut", cle: cleMaitresse };
            }
        }
        return null;
    };

    if (chatTraitsRaw) {
        Object.entries(chatTraitsRaw).forEach(([nomOriginal, valeur]) => {
            const correspondance = trouverCleMaitresse(nomOriginal);
            if (correspondance) {
                if (correspondance.type === "qualite") {
                    if (!qualitesTrouvees[correspondance.cle]) qualitesTrouvees[correspondance.cle] = [];
                    qualitesTrouvees[correspondance.cle].push(valeur);
                } else if (correspondance.type === "defaut") {
                    if (!defautsTrouves[correspondance.cle]) defautsTrouves[correspondance.cle] = [];
                    defautsTrouves[correspondance.cle].push(valeur);
                }
            }
        });
    }

    // ÉTAPE 2 & 3 : Analyse des Qualités liées
    let sommeQualites = 0;
    configAction.qualitesLiees.forEach(cleQualite => {
        if (qualitesTrouvees.hasOwnProperty(cleQualite) && qualitesTrouvees[cleQualite].length > 0) {
            // RÈGLE : Si plusieurs synonymes d'une même qualité sont présents, ils comptent tous !
            const totalFamilleQualite = qualitesTrouvees[cleQualite].reduce((sum, val) => sum + val, 0);
            sommeQualites += totalFamilleQualite;
        } else {
            // Valeur par défaut si absente
            sommeQualites += 5;
        }
    });

    // ÉTAPE 2 & 3 : Analyse des Défauts liés
    let sommeDefauts = 0;
    configAction.defautsLies.forEach(cleDefaut => {
        if (defautsTrouves.hasOwnProperty(cleDefaut) && defautsTrouves[cleDefaut].length > 0) {
            // RÈGLE : Si plusieurs défauts d'une même famille sont présents, on prend le pire (le plus haut) * 1.5
            const valeurMax = Math.max(...defautsTrouves[cleDefaut]);
            if (defautsTrouves[cleDefaut].length > 1) {
                sommeDefauts += (valeurMax * 1.5);
            } else {
                sommeDefauts += valeurMax;
            }
        } else {
            // Valeur par défaut si absent
            sommeDefauts += 6;
        }
    });

    // ÉTAPE 4 : Application stricte de TA formule Mathématique modifiée
    let totalPsy = (sommeQualites * 2.5) - (sommeDefauts / 3.5);
    totalPsy = Math.max(0, Math.min(totalPsy, 30)); // Bornage de sécurité entre 0 et 30

    const de = Math.floor(Math.random() * 20) + 1; // D20 pour le social
    const totalFinal = de + Math.round(totalPsy);

    // ÉTAPE 5 : Calcul des verdicts selon tes nouveaux paliers et conditions de dé
    let verdict = { texte: "Échec Standard ❌", couleur: "#ff3333", description: "L'interaction sociale n'obtient pas l'effet escompté." };
    
    if (totalFinal <= 10) verdict = { texte: "Échec Critique 💀", couleur: "#5f0de2", description: "Un fiasco relationnel total, la situation s'envenime !" };
    else if (totalFinal <= 20) verdict = { texte: "Échec Standard ❌", couleur: "#ff3333", description: "Le message ne prend pas." };
    else if (totalFinal <= 30) verdict = { texte: "Réussite Partielle ⚖️", couleur: "#ffcc00", description: "Le message passe mais avec d'importantes réserves." };
    else if (totalFinal <= 40) verdict = { texte: "Très Bonne Réussite 🔥", couleur: "#33cc33", description: "Succès de l'interaction !" };
    else verdict = { texte: "Réussite Critique 🌟", couleur: "#00ffff", description: "Une impression mémorable, l'interlocuteur est conquis !" };

    // Égalités ou priorités absolues liées à la valeur brute du Dé (1 ou 17+)
    if (de === 1) {
        verdict = { texte: "Échec Critique 💀", couleur: "#5f0de2", description: "Un fiasco relationnel total, la situation s'envenime !" };
    } else if (de >= 17) {
        verdict = { texte: "Réussite Critique 🌟", couleur: "#00ffff", description: "Une impression mémorable, l'interlocuteur est conquis !" };
    }

    return {
        nomAction: configAction.nom,
        total: totalFinal,
        de: de,
        bonus: Math.round(totalPsy),
        verdict: verdict
    };
}