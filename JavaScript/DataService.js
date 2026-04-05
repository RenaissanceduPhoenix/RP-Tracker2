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