import { db } from './Firebase.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// =======================
// 📊 GRAPHIQUES + DATES
// =======================

let chart;

// =======================
// 📅 FLATPICKR INIT
// =======================

const startPicker = flatpickr("#startDate", {
  dateFormat: "Y-m-d",
  defaultDate: new Date(Date.now() - 6 * 86400000),
  onChange: function(selectedDates) {
    if (!selectedDates[0]) return;

    const start = selectedDates[0];
    const type = getType();

    // 🔹 Auto calcul fin
    if (type === "week" || type === "server" || type === "character") {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      endPicker.setDate(end, false);
    }

    updateFlatpickrLimits();
    loadCharts();
  }
});

const endPicker = flatpickr("#endDate", {
  dateFormat: "Y-m-d",
  defaultDate: new Date(),
  onChange: function() {
    loadCharts();
  }
});

// =======================
// 🔧 HELPERS
// =======================

function getType() {
  return document.getElementById("chartType").value;
}

// =======================
// 🔒 LIMITATION 7 JOURS
// =======================

// 🔧 1. Correction de la fonction des limites (Ligne 56/108)
function updateFlatpickrLimits(data) {
    // Si pas de données, on ne fait rien
    if (!data || !Array.isArray(data) || data.length === 0) return;

    // On s'assure que l'élément 0 et le dernier élément existent
    const firstEntry = data[0];
    const lastEntry = data[data.length - 1];

    if (firstEntry && firstEntry.date && lastEntry && lastEntry.date) {
        const minDate = firstEntry.date;
        const maxDate = lastEntry.date;

        if (window.fpStart && window.fpEnd) {
            window.fpStart.set('minDate', minDate);
            window.fpStart.set('maxDate', maxDate);
            window.fpEnd.set('minDate', minDate);
            window.fpEnd.set('maxDate', maxDate);
        }
    }
}

// 📊 2. Fonction loadCharts complète et sécurisée
window.loadCharts = async function() {
    // Vérification des sélecteurs
    const start = startPicker ? startPicker.selectedDates[0] : null;
    const end = endPicker ? endPicker.selectedDates[0] : null;

    if (!start || !end || !db) {
        console.warn("Graphique : En attente des dates ou de la base de données.");
        return;
    }

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
            // Sécurité sur la conversion de date Firebase
            const date = rp.createdAt?.toDate ? rp.createdAt.toDate() : new Date(rp.createdAt);
            data.push({ 
                character: rp.character || "Inconnu", 
                server: rp.server || "Sans serveur", 
                date: date 
            });
        });

        if (data.length === 0) {
            console.log("Graphique : Aucun RP trouvé pour cette période.");
            if (chart) chart.destroy();
            return;
        }

        // On met à jour les limites du calendrier avec les vraies dates trouvées
        updateFlatpickrLimits(data);

        // On génère le graphique
        generateChart(data, type, start, endDateFull);

    } catch (err) {
        console.error("❌ Erreur loadCharts:", err);
    }
};

// =======================
// 🔁 CHANGEMENT DE TYPE
// =======================

document.getElementById("chartType").addEventListener("change", () => {
  const type = getType();
  const today = new Date();

  let start = new Date();
  let end = new Date();

  if (type === "week" || type === "server" || type === "character") {
    start.setDate(today.getDate() - 6);
    end = new Date(today);
  }
  else if (type === "month") {
    start.setDate(today.getDate() - 29);
    end = new Date(today);
  }
  else if (type === "year") {
    start.setMonth(today.getMonth() - 11);
    end = new Date(today);
  }

  startPicker.setDate(start, false);
  endPicker.setDate(end, false);

  updateFlatpickrLimits();
  loadCharts();
});

// =======================
// 📊 GENERATE CHART
// =======================

function generateChart(data, type, startDate, endDate) {

  if (chart) chart.destroy();

  const labels = [];
  const days = Math.ceil((endDate - startDate) / 86400000);

  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    labels.push(d.toISOString().split("T")[0]);
  }

  let datasets = [];

  if (type === "week" || type === "month" || type === "year") {

    const counts = labels.map(label =>
      data.filter(rp =>
        rp.date.toISOString().split("T")[0] === label
      ).length
    );

    datasets.push({
      label: "RP envoyés",
      data: counts,
      tension: 0.3
    });

  } else {

    const groups = {};

    data.forEach(rp => {
      const key = type === "server" ? rp.server : rp.character;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rp);
    });

    Object.keys(groups).forEach(key => {
      const values = labels.map(label =>
        groups[key].filter(rp =>
          rp.date.toISOString().split("T")[0] === label
        ).length
      );

      datasets.push({
        label: key,
        data: values,
        tension: 0.3
      });
    });
  }

  const allValues = datasets.flatMap(d => d.data);
  const maxValue = allValues.length ? Math.max(...allValues) : 0;
  const maxY = Math.max(10, Math.ceil(maxValue / 2) * 2);

  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          onClick: (e, legendItem, legend) => {
            const ci = legend.chart;
            const index = legendItem.datasetIndex;
            const meta = ci.getDatasetMeta(index);

            meta.hidden = meta.hidden === null
              ? !ci.data.datasets[index].hidden
              : null;

            ci.update();
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: maxY,
          ticks: { stepSize: 2 }
        }
      }
    }
  });
}

// =======================
// 🚀 INIT
// =======================

updateFlatpickrLimits();
loadCharts();