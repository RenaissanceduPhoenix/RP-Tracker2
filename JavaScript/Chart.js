import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// On utilise un nom unique pour ne pas entrer en conflit avec l'ID "chart" du HTML
let rpChart = null; 

const chartColors = ['#a777e3', '#ffcc00', '#2ecc71', '#e74c3c', '#3498db', '#f1c40f', '#9b59b6'];

window.loadCharts = async function() {
    const canvas = document.getElementById('chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const viewType = document.getElementById('viewType').value;
    
    // Récupération des dates
    let startInput = document.getElementById('startDate').value;
    let endInput = document.getElementById('endDate').value;
    
    let endDate = endInput ? new Date(endInput) : new Date();
    let startDate = startInput ? new Date(startInput) : new Date();
    if (!startInput) startDate.setDate(endDate.getDate() - 7);

    startDate.setHours(0,0,0,0);
    endDate.setHours(23,59,59,999);

    const q = query(
        collection(db, "rps_sent"), 
        where("createdAt", ">=", startDate), 
        where("createdAt", "<=", endDate),
        orderBy("createdAt", "asc")
    );
    
    const snap = await getDocs(q);

    // Axe X (les jours)
    const labels = [];
    let tmp = new Date(startDate);
    while (tmp <= endDate) {
        labels.push(tmp.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
        tmp.setDate(tmp.getDate() + 1);
    }

    let datasets = [];

    if (viewType === 'total') {
        const counts = {};
        snap.forEach(doc => {
            const d = doc.data().createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            counts[d] = (counts[d] || 0) + 1;
        });
        datasets.push({
            label: 'Total RP Envoyés',
            data: labels.map(l => counts[l] || 0),
            borderColor: '#a777e3',
            backgroundColor: 'rgba(167, 119, 227, 0.2)',
            fill: true,
            tension: 0.3
        });
    } else {
        const key = (viewType === 'perso') ? 'character' : 'server';
        const groups = {};

        snap.forEach(doc => {
            const data = doc.data();
            const name = data[key] || "Inconnu";
            const d = data.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            if (!groups[name]) groups[name] = {};
            groups[name][d] = (groups[name][d] || 0) + 1;
        });

        Object.keys(groups).forEach((name, i) => {
            datasets.push({
                label: name,
                data: labels.map(l => groups[name][l] || 0),
                borderColor: chartColors[i % chartColors.length],
                backgroundColor: 'transparent',
                tension: 0.3,
                borderWidth: 2
            });
        });
    }

    // CORRECTION CRITIQUE : On vérifie si rpChart est bien une instance de Chart
    if (rpChart && typeof rpChart.destroy === 'function') {
        rpChart.destroy();
    }
    
    // Création du nouveau graphique
    rpChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#fff', stepSize: 1 } },
                x: { ticks: { color: '#fff' } }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.flatpickr) {
        flatpickr("#startDate", { altInput: true, altFormat: "d/m/Y", dateFormat: "Y-m-d" });
        flatpickr("#endDate", { altInput: true, altFormat: "d/m/Y", dateFormat: "Y-m-d" });
    }
    window.loadCharts();
});