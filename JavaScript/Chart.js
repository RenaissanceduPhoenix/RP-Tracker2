import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Couleurs pour les graphiques multi-courbes
const chartColors = [
    '#a777e3', '#ffcc00', '#2ecc71', '#e74c3c', '#3498db', 
    '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'
];

window.loadCharts = async function() {
    const canvas = document.getElementById('chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const viewType = document.getElementById('viewType').value; // 'total', 'perso', 'server'
    
    // 1. Définition de la période (7 derniers jours par défaut)
    const startInput = document.getElementById('startDate').value;
    const endInput = document.getElementById('endDate').value;
    
    const endDate = endInput ? new Date(endInput) : new Date();
    const startDate = startInput ? new Date(startInput) : new Date();
    if (!startInput) startDate.setDate(endDate.getDate() - 7);

    // 2. Récupération des données Firebase
    const q = query(
        collection(db, "rps_sent"), 
        where("createdAt", ">=", startDate), 
        where("createdAt", "<=", endDate),
        orderBy("createdAt", "asc")
    );
    
    const snap = await getDocs(q);

    // 3. Préparation des labels (Dates de l'axe X)
    const labels = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
        labels.push(cur.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
        cur.setDate(cur.getDate() + 1);
    }

    // 4. Traitement des données selon le mode
    let datasets = [];

    if (viewType === 'total') {
        // --- MODE TOTAL ---
        const counts = {};
        snap.forEach(doc => {
            const date = doc.data().createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            counts[date] = (counts[date] || 0) + 1;
        });

        datasets.push({
            label: 'Total RP Envoyés',
            data: labels.map(l => counts[l] || 0),
            borderColor: '#a777e3',
            backgroundColor: 'rgba(167, 119, 227, 0.2)',
            tension: 0.3,
            fill: true
        });

    } else {
        // --- MODE PERSO OU SERVEUR ---
        const key = (viewType === 'perso') ? 'character' : 'server';
        const groups = {}; // { "NomPerso": { "01/04": 2, "02/04": 1 } }

        snap.forEach(doc => {
            const data = doc.data();
            const groupName = data[key] || "Inconnu";
            const date = data.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

            if (!groups[groupName]) groups[groupName] = {};
            groups[groupName][date] = (groups[groupName][date] || 0) + 1;
        });

        // Transformer les groupes en datasets Chart.js
        Object.keys(groups).forEach((name, index) => {
            datasets.push({
                label: name,
                data: labels.map(l => groups[name][l] || 0),
                borderColor: chartColors[index % chartColors.length],
                backgroundColor: 'transparent',
                tension: 0.3,
                pointRadius: 4
            });
        });
    }

    // 5. Destruction de l'ancien graphique et création du nouveau
    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#ffffff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#ffffff', font: { size: 11 } } },
                tooltip: { backgroundColor: '#1a1a24', titleColor: '#a777e3', bodyColor: '#fff' }
            }
        }
    });
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Initialisation Flatpickr si présent
    if (typeof flatpickr !== "undefined") {
        flatpickr("#startDate", { altInput: true, altFormat: "d/m/Y", dateFormat: "Y-m-d" });
        flatpickr("#endDate", { altInput: true, altFormat: "d/m/Y", dateFormat: "Y-m-d" });
    }
    window.loadCharts();
});