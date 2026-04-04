import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;
let startPicker, endPicker;

// On initialise Flatpickr uniquement si les éléments existent
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

window.loadCharts = async function() {
    // 🛡️ LA SÉCURITÉ ANTI-CRASH (Ligne 41)
    if (!startPicker || !endPicker || !startPicker.selectedDates[0] || !endPicker.selectedDates[0]) {
        console.warn("Le graphique attend l'initialisation des calendriers...");
        return;
    }

    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];
    // ... reste du code identique

    if (!selectedStart || !selectedEnd) {
        console.warn("Graphique : Dates non sélectionnées.");
        return;
    }

    const type = getType();
    const endDateFull = new Date(selectedEnd);
    endDateFull.setHours(23, 59, 59, 999);

    try {
        const qSent = query(
            collection(db, "rps_sent"),
            where("createdAt", ">=", selectedStart),
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

        generateChart(data, type, selectedStart, endDateFull);
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
    // Logique simplifiée pour les datasets
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