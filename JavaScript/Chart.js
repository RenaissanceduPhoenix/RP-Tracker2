import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;
let startPicker, endPicker;

// =======================
// 📅 INITIALISATION DES CALENDRIERS
// =======================
document.addEventListener('DOMContentLoaded', () => {
    const startElem = document.getElementById("startDate");
    const endElem = document.getElementById("endDate");

    if (startElem && endElem) {
        startPicker = flatpickr("#startDate", {
            dateFormat: "Y-m-d",
            defaultDate: new Date(Date.now() - 6 * 86400000),
            onChange: () => window.loadCharts()
        });

        endPicker = flatpickr("#endDate", {
            dateFormat: "Y-m-d",
            defaultDate: new Date(),
            onChange: () => window.loadCharts()
        });
    }
});

// =======================
// 📊 FONCTION PRINCIPALE
// =======================
window.loadCharts = async function() {
    // 🛡️ SÉCURITÉ : Vérifier si les calendriers existent
    if (!startPicker || !endPicker) return;
    
    // On récupère les dates sélectionnées
    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];

    // Si une des deux dates manque, on s'arrête
    if (!start || !end) {
        console.warn("Graphique : Dates manquantes.");
        return;
    }

    const type = document.getElementById("chartType")?.value || "week";
    const endDateFull = new Date(end);
    endDateFull.setHours(23, 59, 59, 999);

    try {
        const qSent = query(
            collection(db, "rps_sent"),
            where("createdAt", ">=", start),
            where("createdAt", "<=", endDateFull),
            orderBy("createdAt", "asc")
        );

        const snapshot = await getDocs(qSent);
        let data = [];

        snapshot.forEach(docSnap => {
            const rp = docSnap.data();
            const date = rp.createdAt?.toDate ? rp.createdAt.toDate() : new Date(rp.createdAt);
            data.push({ character: rp.character, server: rp.server, date: date });
        });

        if (data.length === 0) {
            console.log("Graphique : Aucun RP trouvé.");
            if (chart) chart.destroy();
            return;
        }

        generateChart(data, type, start, endDateFull);
    } catch (err) {
        console.error("❌ loadCharts Error:", err);
    }
};

// =======================
// 📈 GÉNÉRATION DU GRAPH
// =======================
function generateChart(data, type, start, end) {
    const ctx = document.getElementById("chart");
    if (!ctx) return;
    if (chart) chart.destroy();

    const labels = [];
    let curr = new Date(start);
    while (curr <= end) {
        labels.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const datasets = [];
    if (type === "week") {
        const values = labels.map(label => 
            data.filter(rp => rp.date.toISOString().split("T")[0] === label).length
        );
        datasets.push({ 
            label: "Total RP", 
            data: values, 
            borderColor: "#ffcc00", 
            backgroundColor: "rgba(255,204,0,0.1)", 
            fill: true 
        });
    }

    chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}