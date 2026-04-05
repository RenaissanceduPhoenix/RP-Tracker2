import { db } from './Firebase.js';
import { 
    collection, query, where, getCountFromServer, 
    getDocs, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function getAdvancedStats() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 1. RP envoyés cette semaine
    const qSent = query(
        collection(db, "rps_sent"),
        where("createdAt", ">=", oneWeekAgo),
        orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(qSent);
    const serverCounts = {};
    const charCounts = {};
    let totalSemaine = 0;

    querySnapshot.forEach(doc => {
        const data = doc.data();
        totalSemaine++;
        serverCounts[data.server] = (serverCounts[data.server] || 0) + 1;
        charCounts[data.character] = (charCounts[data.character] || 0) + 1;
    });

    const topServer = Object.keys(serverCounts).length > 0 
        ? Object.keys(serverCounts).reduce((a, b) => serverCounts[a] > serverCounts[b] ? a : b) 
        : "Aucun";
        
    const topChar = Object.keys(charCounts).length > 0 
        ? Object.keys(charCounts).reduce((a, b) => charCounts[a] > charCounts[b] ? a : b) 
        : "Aucun";

    // 2. Compte des Pending (Méthode rapide)
    const pendingSnapshot = await getCountFromServer(
        query(collection(db, "rps_received"), where("status", "==", "pending"))
    );

    return {
        totalSemaine,
        moyenneJour: (totalSemaine / 7).toFixed(1),
        topServer,
        topChar,
        pendingCount: pendingSnapshot.data().count
    };
}