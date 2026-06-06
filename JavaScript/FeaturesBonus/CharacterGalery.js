import { charactersDB } from './CharacterData.js';
import { db } from '../Firebase.js';
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Mapping de sécurité de base
const nameToImage = {
    "Petite Lynx": "Lynx.png",
    "Nuage de Lynx": "Lynx.png",
    "Frasques du Lynx": "Lynx.png",
    "Petite Anémone": "Anemone.webp",
    "Nuage d’Anémone": "Anemone.webp",
    "Nuage d'Anémone": "Anemone.webp",
    "Eclats d’Anémone": "Anemone.webp",
    "Eclats d'Anémone": "Anemone.webp",
    "Etincelle de Vie": "Etincelle.png",
    "Racine de Pissenlit": "Racine.webp",
    "Petit Test": "Racine.webp",
    "Nuage de Test": "Lynx.png"
};

// Liste par défaut mise à jour
const MaNouvelleListe = ["Frasques du Lynx", "Nuage d'Anémone", "Etincelle de Vie", "Racine de Pissenlit"];
localStorage.setItem("myActiveChars", JSON.stringify(MaNouvelleListe));

const getActiveChars = () => JSON.parse(localStorage.getItem("myActiveChars"));

// --- 🌟 VERSION CORRIGÉE ET DYNAMIQUE DE LA GALERIE ---
window.afficherGaleriePersonnages = async function() {
    const container = document.getElementById("char-gallery");
    if (!container) {
        console.warn("⚠️ Conteneur de la galerie (char-gallery) introuvable.");
        return;
    }

    container.innerHTML = "";
    const activeChars = getActiveChars();

    // On utilise un for...of pour gérer les appels asynchrones à Firestore proprement
    for (const charName of activeChars) {
        if (charName === "Pelage des Sables" || charName === "Ardeur du Lynx") continue;

        // 1. Valeurs par défaut basées sur le nom local d'origine
        let nomAffichage = charName;
        let racinePourImage = charName; 

        // 2. 🔍 ON COUPLERA FIRESTORE POUR RÉCUPÉRER LE NOM DE BAPTÊME
        try {
            const docRef = doc(db, "characters", charName);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const firestoreData = docSnap.data();
                if (firestoreData.nom_bapteme) {
                    nomAffichage = firestoreData.nom_bapteme;
                    racinePourImage = firestoreData.nom_bapteme; // On utilise le nouveau nom pour l'image
                }
            }
        } catch (error) {
            console.error(`[Galerie] Erreur de récupération Firestore pour ${charName}:`, error);
        }

        // 3. 📸 ATTRIBUTION INTELLIGENTE DE L'IMAGE (gère les évolutions de grade)
        let imgName = "Lynx.png"; // Image de secours global
        const nomMinuscule = racinePourImage.toLowerCase();

        if (nameToImage[charName]) {
            // Si le nom d'origine technique est connu dans la liste, on l'applique en priorité
            imgName = nameToImage[charName];
        } else if (nameToImage[racinePourImage]) {
            // Si le nom de baptême exact est connu dans la liste
            imgName = nameToImage[racinePourImage];
        } else {
            // Détection automatique par mots-clés dans le nom (Lynx, Anémone, Pissenlit, Test...)
            if (nomMinuscule.includes("lynx")) {
                imgName = "Lynx.png";
            } else if (nomMinuscule.includes("anémone") || nomMinuscule.includes("anemone")) {
                imgName = "Anemone.webp";
            } else if (nomMinuscule.includes("pissenlit") || nomMinuscule.includes("racine")) {
                imgName = "Racine.webp";
            } else if (nomMinuscule.includes("test")) {
                // Associe ici l'image que tu veux pour tes comptes de tests (ex: Racine.webp ou Lynx.png)
                imgName = "Racine.webp"; 
            } else if (nomMinuscule.includes("vie") || nomMinuscule.includes("etincelle")) {
                imgName = "Etincelle.png";
            }
        }

        const basePath = "./JavaScript/FeaturesBonus/Assets/Avatars/";

        // 4. CRÉATION DE LA CARTE HTML DYNAMIQUE
        const card = document.createElement("div");
        card.className = "char-card";
        card.setAttribute("data-name", charName); // 🌟 CRUCIAL : Conserve l'identifiant stable pour l'XP
        
        card.innerHTML = `
            <img src="${basePath}${imgName}" alt="${nomAffichage}" onerror="this.onerror=null; this.src='${basePath}Lynx.png';">
            <h3>${nomAffichage}</h3>
        `;

        card.addEventListener("click", function() {
            document.querySelectorAll(".char-card").forEach(c => c.classList.remove("active"));
            card.classList.add("active");

            const filterSelect = document.getElementById("filterCharacter");
            if (filterSelect) {
                filterSelect.value = charName;
                filterSelect.dispatchEvent(new Event("change"));
            }

            if (typeof window.mettreAJourMiniStats === "function") {
                window.mettreAJourMiniStats(charName);
            }
            
            if (typeof window.openFullPerso === "function") {
                window.openFullPerso();
            }
        });

        container.appendChild(card);


    }
   
    // 🌟 MISE À JOUR DU SÉLECTEUR D'ENVOI (AddSent)
    const charSentSelect = document.getElementById("char_sent");
    if (charSentSelect) {
        // On conserve la première option par défaut
        charSentSelect.innerHTML = '<option value="">-- Choisir un personnage --</option>';
        
        // On ré-exécute une boucle rapide pour remplir les options
        for (const char of activeChars) {
            if (char === "Pelage des Sables" || char === "Ardeur du Lynx") continue;
            
            const option = document.createElement("option");
            option.value = char; // 📋 Le nom technique stable (ex: Frasques du Lynx)
            
            // On retrouve le nom de baptême qui a été chargé plus haut dans ta fonction
            // (Idéalement, stocke-le dans un objet ou récupère l'élément HTML mis à jour)
            const carteAssociee = container.querySelector(`[data-name="${char}"] h3`);
            option.innerText = carteAssociee ? carteAssociee.innerText : char; // 🎭 Le nom de baptême (ex: Nuage de Lynx)
            
            charSentSelect.appendChild(option);
        }
    }
};

// --- LOGIQUE DES MINI-STATS REELLES (FIRESTORE) ---
window.mettreAJourMiniStats = async function(charName) {
    const pendingText = document.getElementById("stat-pending-count");
    const sentText = document.getElementById("stat-sent-total");

    if (!pendingText || !sentText) return;

    try {
        const qPending = query(collection(db, "rps_received"), where("character", "==", charName), where("status", "==", "pending"));
        const snapPending = await getDocs(qPending);
        pendingText.innerText = `Attente : ${snapPending.size}`;

        const qSent = query(collection(db, "rps_sent"), where("character", "==", charName));
        const snapSent = await getDocs(qSent);
        sentText.innerText = `Total Envoyés : ${snapSent.size}`;

    } catch (error) {
        console.error("Erreur lors du calcul des mini-stats :", error);
    }
};

// Initialisation au chargement de la page
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.afficherGaleriePersonnages());
} else {
    window.afficherGaleriePersonnages();
}