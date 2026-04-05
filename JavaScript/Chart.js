import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;
let startPicker, endPicker;

document.addEventListener('DOMContentLoaded', () => {
    startPicker = flatpickr("#startDate", { defaultDate: new Date(Date.now() - 6*86400000), onChange: () => window.loadCharts() });
    endPicker = flatpickr("#endDate", { defaultDate: new Date(), onChange: () => window.loadCharts() });
    setTimeout(() => window.loadCharts(), 500);
});

window.loadCharts = async function() {
    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];
    if (!start || !end) return;
    end.setHours(23, 59, 59);

    const q = query(collection(db, "rps_sent"), where("createdAt", ">=", start), where("createdAt", "<=", end), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ ...d.data(), date: d.data().createdAt.toDate() }));
    renderChart(data, start, end);
};

function renderChart(data, start, end) {
    const ctx = document.getElementById('chart').getContext('2d');
    const labels = [];
    let curr = new Date(start);
    while (curr <= end) {
        labels.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const type = document.getElementById("viewType").value;
    let datasets = [];
    const palette = ["#ffcc00", "#ff3860", "#209cee", "#23d160", "#ffdd57"];

    if (type === "week") {
        datasets.push({
            label: "Total RP",
            data: labels.map(l => data.filter(d => d.date.toISOString().split('T')[0] === l).length),
            borderColor: "#ffcc00", tension: 0.3, fill: false
        });
    } else {
        const key = type === "server" ? "server" : "character";
        const groups = {};
        data.forEach(d => { groups[d[key]] = groups[d[key]] || []; groups[d[key]].push(d); });
        Object.keys(groups).forEach((name, i) => {
            datasets.push({
                label: name,
                data: labels.map(l => groups[name].filter(d => d.date.toISOString().split('T')[0] === l).length + (i * 0.05)),
                borderColor: palette[i % palette.length], tension: 0.3
            });
        });
    }

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.floor(c.raw)}` } } },
            // ... dans les options de ton new Chart
scales: {
    y: {
        beginAtZero: true,
        min: 0,
        max: 20,
        ticks: {
            stepSize: 1, // Force l'affichage de 1, 2, 3, 4 (pas de 1.5)
            color: '#666' // Optionnel : couleur des chiffres
        },
        grid: {
            color: 'rgba(0, 0, 0, 0.05)'
        }
    },
    x: {
        ticks: { color: '#666' }
    }
}}})}
