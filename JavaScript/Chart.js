import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chart;

window.loadCharts = async function() {
    const ctx = document.getElementById('chart').getContext('2d');
    const viewType = document.getElementById('viewType').value;
    
    // Dates par défaut (7 derniers jours) si vide
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    const start = startInput ? new Date(startInput) : new Date(Date.now() - 7 * 86400000);
    const end = endInput ? new Date(endInput) : new Date();

    const q = query(collection(db, "rps_sent"), where("createdAt", ">=", start), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    
    const counts = {};
    snap.forEach(doc => {
        const d = doc.data();
        const dateKey = d.createdAt.toDate().toLocaleDateString();
        counts[dateKey] = (counts[dateKey] || 0) + 1;
    });

    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: 'Nombre de RP Envoyés',
                data: Object.values(counts),
                borderColor: '#a777e3',
                backgroundColor: 'rgba(167, 119, 227, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 2, color: '#ffffff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#ffffff' } }
            }
        }
    });
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.loadCharts, 1000);
});