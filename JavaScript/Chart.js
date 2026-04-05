import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;
let startPicker, endPicker;

document.addEventListener('DOMContentLoaded', () => {
    // Initialisation des calendriers
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
});

window.loadCharts = async function() {
    if (!startPicker || !endPicker || !startPicker.selectedDates[0] || !endPicker.selectedDates[0]) return;

    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];
    const type = document.getElementById("viewType")?.value || "week";

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

        generateChart(data, type, start, endDateFull);
    } catch (err) {
        console.error("❌ Erreur loadCharts:", err);
    }
};

function generateChart(data, type, start, end) {
    const ctx = document.getElementById("chart");
    if (chart) chart.destroy();

    // Création de l'axe X (les jours)
    const labels = [];
    let curr = new Date(start);
    while (curr <= end) {
        labels.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const datasets = [];
    const palette = ['#ffcc00', '#00d1b2', '#3273dc', '#ff3860', '#9b59b6', '#f1c40f', '#e67e22'];

    if (type === "week") {
        // --- 1 SEULE COURBE : TOTAL ---
        const values = labels.map(label => 
            data.filter(rp => rp.date.toISOString().split("T")[0] === label).length
        );
        datasets.push({
            label: "Total RP",
            data: values,
            borderColor: "#ffcc00",
            backgroundColor: "rgba(255, 204, 0, 0.1)",
            fill: true,
            tension: 0.3
        });
    } else {
        // --- MULTI-COURBES (SERVEUR OU PERSO) ---
        const groups = {};
        data.forEach(rp => {
            const key = (type === "server") ? rp.server : rp.character;
            if (!groups[key]) groups[key] = [];
            groups[key].push(rp);
        });

        Object.keys(groups).forEach((key, index) => {
            // Décalage de 0.04 par index pour éviter la superposition
            const offset = index * 0.04; 
            
            const values = labels.map(label => {
                const count = groups[key].filter(rp => rp.date.toISOString().split("T")[0] === label).length;
                return count > 0 ? count + offset : 0;
            });

            datasets.push({
                label: key,
                data: values,
                borderColor: palette[index % palette.length],
                tension: 0.3,
                borderWidth: 2,
                pointRadius: 4
            });
        });
    }

    // ... dans la fonction generateChart
chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${Math.floor(context.raw)}`
                    }
                }
            }, // <-- Virgule ici
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 16,
                    ticks: { stepSize: 1 }
                }
            }
        }
    })}