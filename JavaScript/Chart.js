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

function updateFlatpickrLimits(data) {
    // Sécurité : Si data est vide ou mal chargé, on s'arrête là
    if (!data || data.length === 0) return; 

    // On vérifie que l'élément 0 existe bien avant de lire 'date'
    if (data[0] && data[0].date) {
        const minDate = data[0].date;
        const maxDate = data[data.length - 1].date;
        
        if (window.fpStart && window.fpEnd) {
            window.fpStart.set('minDate', minDate);
            window.fpStart.set('maxDate', maxDate);
            window.fpEnd.set('minDate', minDate);
            window.fpEnd.set('maxDate', maxDate);
        }
    }
}

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
// 📥 LOAD DATA + CHART
// =======================
window.loadCharts = async function() { // Retire l'argument (data) ici car on va chercher dans Firestore
    const type = getType();
    const start = startPicker.selectedDates[0];
    const end = endPicker.selectedDates[0];

    // Sécurité : on ne fait rien si les dates sont vides ou si db n'est pas là
    if (!start || !end || !db) return;

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

        // 🛡️ Sécurité supplémentaire avant de générer
        if (data.length === 0) {
            console.warn("Aucun RP trouvé pour ces dates.");
            if (chart) chart.destroy(); // On vide le graph s'il y en avait un
            return;
        }

        generateChart(data, type, start, endDateFull);

    } catch (err) {
        console.error("❌ loadCharts Error:", err.message);
    }
}; // Vérifie bien que la parenthèse ferme ici
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