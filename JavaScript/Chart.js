import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;
let startPicker, endPicker;

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
    if (!startPicker || !endPicker || !startPicker.selectedDates[0] || !endPicker.selectedDates[0]) return;
    
    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];
    const type = document.getElementById("chartType")?.value || "week"; // Assure-toi que l'ID est bien chartType

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
            if (chart) chart.destroy();
            return;
        }

        generateChart(data, type, start, endDateFull);
    } catch (err) {
        console.error("❌ loadCharts Error:", err);
    }
};

function generateChart(data, type, start, end) {
    const ctx = document.getElementById("chart");
    if (!ctx) return;
    if (chart) chart.destroy();

    // 1. Création des labels (tous les jours entre début et fin)
    const labels = [];
    let curr = new Date(start);
    while (curr <= end) {
        labels.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const datasets = [];

    if (type === "week" || type === "month" || type === "year") {
        // MODE TOTAL (Une seule ligne)
        const values = labels.map(label => 
            data.filter(rp => rp.date.toISOString().split("T")[0] === label).length
        );
        datasets.push({ 
            label: "Total RP", 
            data: values, 
            borderColor: "#ffcc00", 
            backgroundColor: "rgba(255,204,0,0.1)", 
            fill: true,
            tension: 0.3
        });
    } else {
        // MODE RÉPARTITION (Serveur ou Personnage)
        const groups = {};
        data.forEach(rp => {
            const key = (type === "server") ? rp.server : rp.character;
            if (!groups[key]) groups[key] = [];
            groups[key].push(rp);
        });

        const colors = ['#ffcc00', '#00d1b2', '#3273dc', '#ff3860', '#9b59b6']; // Liste de couleurs
        
        Object.keys(groups).forEach((key, index) => {
            const values = labels.map(label => 
                groups[key].filter(rp => rp.date.toISOString().split("T")[0] === label).length
            );
            datasets.push({ 
                label: key, 
                data: values, 
                borderColor: colors[index % colors.length],
                tension: 0.3 
            });
        });
    }

    chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    min: 0, 
                    max: 16, 
                    ticks: { stepSize: 1 } 
                } 
            }
        }
    });
}