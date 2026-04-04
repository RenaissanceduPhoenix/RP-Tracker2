import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;

// =======================
// 📅 FLATPICKR INIT
// =======================
const startPicker = flatpickr("#startDate", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(Date.now() - 6 * 86400000),
    onChange: function() { loadCharts(); }
});

const endPicker = flatpickr("#endDate", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(),
    onChange: function() { loadCharts(); }
});

// =======================
// 🔧 HELPERS
// =======================
function getType() {
    return document.getElementById("viewType")?.value || "week";
}

function updateFlatpickrLimits(data) {
    if (!data || data.length === 0 || !window.fpStart) return;
    const minDate = data[0].date;
    const maxDate = data[data.length - 1].date;
    window.fpStart.set('minDate', minDate);
    window.fpEnd.set('maxDate', maxDate);
}

// =======================
// 📊 FONCTION PRINCIPALE (CORRIGÉE)
// =======================
window.loadCharts = async function() {
    // 🛡️ SÉCURITÉ : On vérifie si les calendriers sont prêts
    if (!startPicker || !endPicker || !startPicker.selectedDates[0] || !endPicker.selectedDates[0]) {
        console.warn("Graphique : En attente de l'initialisation des dates...");
        return;
    }

    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];
    const type = getType();
    
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
            console.log("Graphique : Aucun RP à afficher.");
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
        datasets.push({ label: "Total RP", data: values, borderColor: "#ffcc00", backgroundColor: "rgba(255,204,0,0.1)", fill: true });
    } else {
        const groups = {};
        data.forEach(rp => {
            const key = type === "server" ? rp.server : rp.character;
            if (!groups[key]) groups[key] = [];
            groups[key].push(rp);
        });

        Object.keys(groups).forEach(key => {
            const values = labels.map(label => 
                groups[key].filter(rp => rp.date.toISOString().split("T")[0] === label).length
            );
            datasets.push({ label: key, data: values, tension: 0.3 });
        });
    }

    chart = new Chart(document.getElementById("chart"), {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}