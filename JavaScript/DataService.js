import { db } from './Firebase.js';
import { 
    collection, query, where, getDocs, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1️⃣ TOUT POUR LA SEMAINE (7 JOURS)
// ============================================================================
export async function getStatsSemaine() {
    const maintenant = new Date();
    const limiteSemaine = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const requeteSemaine = query(
        collection(db, "rps_sent"),
        where("createdAt", ">=", limiteSemaine),
        orderBy("createdAt", "desc")
    );
    
    const snapshotSemaine = await getDocs(requeteSemaine);
    
    const serveursSemaine = {};
    const persosSemaine = {};
    let messagesSemaine = 0;
    let motsSemaine = 0;
    let xpSemaine = 0;
    let stylesSemaine = { actions: 0, paroles: 0, pensees: 0 };

    snapshotSemaine.forEach(doc => {
        const data = doc.data();
        const texte = data.text || data.content || data.context || "";
        
        messagesSemaine++;
        
        // Compte des mots local
        motsSemaine += texte.trim().split(/\s+/).filter(m => m.length > 0).length;

        // Calcul XP local
        if (data.xpGain) {
            xpSemaine += Number(data.xpGain); 
        } else {
            xpSemaine += Math.floor(texte.length / 10);
        }

        if (data.server) serveursSemaine[data.server] = (serveursSemaine[data.server] || 0) + 1;
        if (data.character) persosSemaine[data.character] = (persosSemaine[data.character] || 0) + 1;

        // Analyse des styles locale
        const pSemaine = (texte.match(/\*([^*]+)\*/g) || []).length;
        const dSemaine = (texte.match(/^>\s*(.+)/gm) || []).length;
        const phSemaine = texte.split(/[.!?]+/).filter(p => p.trim().length > 0).length;
        const aSemaine = Math.max(1, phSemaine - (dSemaine + pSemaine));

        stylesSemaine.pensees += pSemaine;
        stylesSemaine.paroles += dSemaine;
        stylesSemaine.actions += aSemaine;
    });

    const topServerSemaine = Object.keys(serveursSemaine).length > 0 
        ? `${Object.keys(serveursSemaine).reduce((a, b) => serveursSemaine[a] > serveursSemaine[b] ? a : b)} (${serveursSemaine[Object.keys(serveursSemaine).reduce((a, b) => serveursSemaine[a] > serveursSemaine[b] ? a : b)]} RP)`
        : "Aucun";
        
    const topCharSemaine = Object.keys(persosSemaine).length > 0 
        ? `${Object.keys(persosSemaine).reduce((a, b) => persosSemaine[a] > persosSemaine[b] ? a : b)} (${persosSemaine[Object.keys(persosSemaine).reduce((a, b) => persosSemaine[a] > persosSemaine[b] ? a : b)]} RP)`
        : "Aucun";

    return {
        totalMessages: messagesSemaine,
        moyenneJour: `${(messagesSemaine / 7).toFixed(1)} / jour`,
        topServer: topServerSemaine,
        topChar: topCharSemaine,
        totalMots: motsSemaine,
        totalXp: xpSemaine,
        stylesGlobaux: stylesSemaine
    };
}

// ============================================================================
// 2️⃣ TOUT POUR LE MOIS (30 JOURS)
// ============================================================================
export async function getStatsMois() {
    const maintenant = new Date();
    const limiteMois = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const requeteMois = query(
        collection(db, "rps_sent"),
        where("createdAt", ">=", limiteMois),
        orderBy("createdAt", "desc")
    );
    
    const snapshotMois = await getDocs(requeteMois);
    
    const serveursMois = {};
    const persosMois = {};
    let messagesMois = 0;
    let motsMois = 0;
    let xpMois = 0;
    let stylesMois = { actions: 0, paroles: 0, pensees: 0 };

console.log("Nombre de docs récupérés pour le mois :", snapshotMois.size);

    snapshotMois.forEach(doc => {
        const data = doc.data();
        const texte = data.text || data.content || data.context || "";
        
        messagesMois++;
        
        // Compte des mots local

// 1. On nettoie les espaces au début et à la fin (trim)
// 2. On découpe sur un ou plusieurs espaces (\s+)
// 3. On filtre pour ignorer les éléments vides

        motsMois += texte.trim().split(/\s+/).filter(m => m.length > 0).length;
        // Calcul XP local
        if (data.xpGain) {
            xpMois += Number(data.xpGain); 
        } else {
            xpMois += Math.floor(texte.length / 10);
        }

        if (data.server) serveursMois[data.server] = (serveursMois[data.server] || 0) + 1;
        if (data.character) persosMois[data.character] = (persosMois[data.character] || 0) + 1;

        // Analyse des styles locale
        const pMois = (texte.match(/\*([^*]+)\*/g) || []).length;
        const dMois = (texte.match(/^>\s*(.+)/gm) || []).length;
        const phMois = texte.split(/[.!?]+/).filter(p => p.trim().length > 0).length;
        const aMois = Math.max(1, phMois - (dMois + pMois));

        stylesMois.pensees += pMois;
        stylesMois.paroles += dMois;
        stylesMois.actions += aMois;
    });

    const topServerMois = Object.keys(serveursMois).length > 0 
        ? `${Object.keys(serveursMois).reduce((a, b) => serveursMois[a] > serveursMois[b] ? a : b)} (${serveursMois[Object.keys(serveursMois).reduce((a, b) => serveursMois[a] > serveursMois[b] ? a : b)]} RP)`
        : "Aucun";
        
    const topCharMois = Object.keys(persosMois).length > 0 
        ? `${Object.keys(persosMois).reduce((a, b) => persosMois[a] > persosMois[b] ? a : b)} (${persosMois[Object.keys(persosMois).reduce((a, b) => persosMois[a] > persosMois[b] ? a : b)]} RP)`
        : "Aucun";

    return {
        totalMessages: messagesMois,
        moyenneJour: `${(messagesMois / 30).toFixed(1)} / jour`,
        topServer: topServerMois,
        topChar: topCharMois,
        totalMots: motsMois,
        totalXp: xpMois,
        stylesGlobaux: stylesMois
    };
}

// ============================================================================
// 3️⃣ TOUT POUR LE GLOBAL (HISTORIQUE COMPLET)
// ============================================================================
export async function getStatsGlobales() {
    const requeteGlobal = query(
        collection(db, "rps_sent"),
        orderBy("createdAt", "desc")
    );
    
    const snapshotGlobal = await getDocs(requeteGlobal);
    
    const serveursGlobal = {};
    const persosGlobal = {};
    let messagesGlobal = 0;
    let motsGlobal = 0;
    let xpGlobal = 0;
    let stylesGlobal = { actions: 0, paroles: 0, pensees: 0 };

    snapshotGlobal.forEach(doc => {
        const data = doc.data();
        const texte = data.text || data.content || data.context || "";
        
        messagesGlobal++;
        
        // Compte des mots local
        motsGlobal += texte.trim().split(/\s+/).filter(m => m.length > 0).length;

        // Calcul XP local
        if (data.xpGain) {
            xpGlobal += Number(data.xpGain); 
        } else {
            xpGlobal += Math.floor(texte.length / 10);
        }

        if (data.server) serveursGlobal[data.server] = (serveursGlobal[data.server] || 0) + 1;
        if (data.character) persosGlobal[data.character] = (persosGlobal[data.character] || 0) + 1;

        // Analyse des styles locale
        const pGlobal = (texte.match(/\*([^*]+)\*/g) || []).length;
        const dGlobal = (texte.match(/^>\s*(.+)/gm) || []).length;
        const phGlobal = texte.split(/[.!?]+/).filter(p => p.trim().length > 0).length;
        const aGlobal = Math.max(1, phGlobal - (dGlobal + pGlobal));

        stylesGlobal.pensees += pGlobal;
        stylesGlobal.paroles += dGlobal;
        stylesGlobal.actions += aGlobal;
    });

    const topServerGlobal = Object.keys(serveursGlobal).length > 0 
        ? `${Object.keys(serveursGlobal).reduce((a, b) => serveursGlobal[a] > serveursGlobal[b] ? a : b)} (${serveursGlobal[Object.keys(serveursGlobal).reduce((a, b) => serveursGlobal[a] > serveursGlobal[b] ? a : b)]} RP)`
        : "Aucun";
        
    const topCharGlobal = Object.keys(persosGlobal).length > 0 
        ? `${Object.keys(persosGlobal).reduce((a, b) => persosGlobal[a] > persosGlobal[b] ? a : b)} (${persosGlobal[Object.keys(persosGlobal).reduce((a, b) => persosGlobal[a] > persosGlobal[b] ? a : b)]} RP)`
        : "Aucun";

    return {
        totalMessages: messagesGlobal,
        moyenneJour: `${(messagesGlobal / 7).toFixed(1)} / jour`,
        topServer: topServerGlobal,
        topChar: topCharGlobal,
        totalMots: motsGlobal,
        totalXp: xpGlobal,
        stylesGlobaux: stylesGlobal
    };
}