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
        responsive: true,
        maintainAspectRatio: false,
        animation: false, 
        transitions: {
            active: {
                animation: {
                    duration: 0 // Évite les saccades au survol de la souris
                }
            }
        },
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

let modalChart = null; // Contiendra l'instance du graphique en grand

// Fonction pour ouvrir la modale et générer le gros graphique
function openChartModal() {
    const modal = document.getElementById("chartModal");
    const mainCanvas = document.getElementById("chart");
    const modalCanvas = document.getElementById("modalChart");

    if (!modal || !mainCanvas || !modalCanvas) return;

    // Récupérer l'instance Chart.js du graphique principal
    const mainChartInstance = Chart.getChart(mainCanvas);
    if (!mainChartInstance) return;

    // Afficher la modale
    modal.style.display = "flex";

    // Si un graphique de modale existe déjà, on le détruit proprement pour le récréer
    if (modalChart) {
        modalChart.destroy();
    }

    // On clone la configuration du graphique principal (données, filtres actifs, etc.)
    const mainConfig = mainChartInstance.config;

    // Création du graphique géant
    modalChart = new Chart(modalCanvas, {
        type: mainConfig.type,
        data: JSON.parse(JSON.stringify(mainConfig.data)), // Copie profonde des données actuelles filtrées
        options: {
            ...mainConfig.options,
            responsive: true,
            maintainAspectRatio: false, // Permet de prendre toute la hauteur de la modale
            plugins: {
                ...mainConfig.options.plugins,
                legend: {
                    ...mainConfig.options.plugins?.legend,
                    labels: { font: { size: 14 } } // Optionnel : agrandit les textes de légende
                }
            }
        }
    });
}

// Fonction pour fermer la modale
function closeChartModal() {
    const modal = document.getElementById("chartModal");
    if (modal) modal.style.display = "none";
    if (modalChart) {
        modalChart.destroy();
        modalChart = null;
    }
}

// --- INITIALISATION UNIQUE & ÉCOUTEURS D'ÉVÉNEMENTS ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialisation de Flatpickr pour la sélection des dates
    if (window.flatpickr) {
        flatpickr("#startDate", { 
            altInput: true, 
            altFormat: "d/m/Y", 
            dateFormat: "Y-m-d",
            onChange: function() {
                if (typeof window.loadCharts === "function") window.loadCharts();
            }
        });

        flatpickr("#endDate", { 
            altInput: true, 
            altFormat: "d/m/Y", 
            dateFormat: "Y-m-d",
            onChange: function() {
                if (typeof window.loadCharts === "function") window.loadCharts();
            }
        });
    }

    // 2. Écouteur pour le type de vue (Jour / Semaine / Mois)
    const viewTypeSelect = document.getElementById('viewType');
    if (viewTypeSelect) {
        viewTypeSelect.addEventListener('change', () => {
            if (typeof window.loadCharts === "function") window.loadCharts();
        });
    }

    // 3. Écouteur pour le filtre de Personnage lié au graphique
    const filterCharacterSelect = document.getElementById('filterCharacter');
    if (filterCharacterSelect) {
        filterCharacterSelect.addEventListener('change', () => {
            if (typeof window.loadCharts === "function") window.loadCharts();
        });
    }

    // 4. Gestion de la modale de zoom
    const btnZoom = document.getElementById("btnZoomChart");
    const btnClose = document.querySelector(".chart-modal-close");
    const modal = document.getElementById("chartModal");

    if (btnZoom) btnZoom.addEventListener("click", openChartModal);
    if (btnClose) btnClose.addEventListener("click", closeChartModal);

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeChartModal();
        });
    }

    // Premier chargement initial du graphique au démarrage
    if (typeof window.loadCharts === "function") {
        window.loadCharts();
    }
});

// Interception globale pour synchroniser automatiquement la modale si elle est ouverte
const originalUpdate = Chart.prototype.update;
Chart.prototype.update = function(...args) {
    originalUpdate.apply(this, args);
    if (this.canvas && this.canvas.id === "chart" && document.getElementById("chartModal")?.style.display === "flex") {
        setTimeout(openChartModal, 50);
    }
};