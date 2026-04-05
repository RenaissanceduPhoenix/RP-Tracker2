import { db } from './Firebase.js';
import { 
    collection, 
    query, 
    where, 
    getCountFromServer, 
    getAggregateFromServer, 
    sum, 
    orderBy, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// MÉTHODE 3 : Agrégation Native (Calculé sur le serveur Google)
// Très rapide, ne télécharge aucun document
export async function getGlobalStats() {
    const sentColl = collection(db, "rps_sent");
    const receivedColl = collection(db, "rps_received");

    // On compte le nombre total de documents sans les télécharger
    const snapshotSent = await getCountFromServer(sentColl);
    const snapshotPending = await getCountFromServer(query(receivedColl, where("status", "==", "pending")));
    const snapshotDone = await getCountFromServer(query(receivedColl, where("status", "==", "done")));

    return {
        totalSent: snapshotSent.data().count,
        pending: snapshotPending.data().count,
        done: snapshotDone.data().count
    };
}

// MÉTHODE 1 & 2 : Récupération optimisée pour le graphique
// On ne récupère que le strict nécessaire
export async function getChartData(startDate, endDate) {
    const qSent = query(
        collection(db, "rps_sent"),
        where("createdAt", ">=", startDate),
        where("createdAt", "<=", endDate),
        orderBy("createdAt", "asc")
    );

    const querySnapshot = await getDocs(qSent);
    const results = [];
    
    querySnapshot.forEach(doc => {
        const data = doc.data();
        results.push({
            date: data.createdAt.toDate(),
            server: data.server,
            character: data.character
        });
    });

    return results;
}

export async function getAdvancedStats() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Récupération des RP envoyés cette semaine
    const qSent = query(
        collection(db, "rps_sent"),
        where("createdAt", ">=", oneWeekAgo),
        orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(qSent);
    const sentRps = [];
    const serverCounts = {};
    const charCounts = {};

    querySnapshot.forEach(doc => {
        const data = doc.data();
        sentRps.push(data);
        
        // Comptage pour le serveur le plus actif
        serverCounts[data.server] = (serverCounts[data.server] || 0) + 1;
        // Comptage pour le perso le plus actif
        charCounts[data.character] = (charCounts[data.character] || 0) + 1;
    });

    // Calculs
    const totalSemaine = sentRps.length;
    const moyenneJour = (totalSemaine / 7).toFixed(1);
    
    // Trouver le max pour serveur et perso
    const topServer = Object.keys(serverCounts).reduce((a, b) => serverCounts[a] > serverCounts[b] ? a : b, "Aucun");
    const topChar = Object.keys(charCounts).reduce((a, b) => charCounts[a] > charCounts[b] ? a : b, "Aucun");

    // Nombre de RP à répondre (Pending)
    const pendingSnapshot = await getCountFromServer(
        query(collection(db, "rps_received"), where("status", "==", "pending"))
    );

    return {
        totalSemaine,
        moyenneJour,
        topServer,
        topChar,
        pendingCount: pendingSnapshot.data().count
    };
}