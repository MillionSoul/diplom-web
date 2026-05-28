import { appState } from "../core/state.js";
import { apiFetch } from "../core/api.js";
import { translateRequestStatuses, buildOccupancyChartConfig, renderOccupancyLegend } from "./chart-labels.js";

function destroyChart(key) {
  if (appState.chartInstances[key]) {
    appState.chartInstances[key].destroy();
    delete appState.chartInstances[key];
  }
}

export async function initAnalyticsPage() {
  let d = appState.dashboard;
  if (!d) {
    try { d = await apiFetch("/Dashboard/summary"); appState.dashboard = d; } catch { /* */ }
  }
  if (d) renderStatsCards(d);
  await renderCharts(d);
}

function renderStatsCards(d) {
  const map = {
    statReceived: `${Number(d.totalReceivedThisYear || d.totalOccupied).toLocaleString("ru-RU")} т`,
    statShipped: `${Number(d.totalShippedEstimate || 0).toLocaleString("ru-RU")} т`,
    statDried: `${Number(d.needsDryingCount ?? d.processPipeline?.drying ?? 0)} партий`,
    statMoisture: `${d.avgMoisture != null ? Number(d.avgMoisture).toFixed(1) : "—"}%`
  };
  Object.entries(map).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

async function renderCharts(d) {
  const batches = appState.batches?.length
    ? appState.batches
    : await apiFetch("/GrainBatches").catch(() => []);

  const byGrain = d?.grainDistribution || {};
  if (!Object.keys(byGrain).length) {
    batches.forEach(b => {
      const name = b.grainType?.grainName || "Не указано";
      byGrain[name] = (byGrain[name] || 0) + Number(b.receiptWeightNet || 0);
    });
  }

  const occupied = Number(d?.totalOccupied ?? batches.reduce((s, b) => s + Number(b.receiptWeightNet || 0), 0));
  const capacity = Number(d?.totalCapacity ?? 100000);

  const ctx1 = document.getElementById("occupancyChart");
  if (ctx1) {
    destroyChart("occupancy");
    const cfg = buildOccupancyChartConfig(occupied, capacity);
    renderOccupancyLegend("occupancyChartLegend", cfg.legendRows);
    appState.chartInstances.occupancy = new Chart(ctx1, {
      type: cfg.type,
      data: cfg.data,
      options: cfg.options
    });
  }

  const ctx2 = document.getElementById("grainDistributionChart");
  if (ctx2) {
    destroyChart("grain");
    const labels = Object.keys(byGrain).length ? Object.keys(byGrain) : ["Нет данных"];
    const values = Object.values(byGrain).length ? Object.values(byGrain) : [1];
    appState.chartInstances.grain = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          label: "Масса, т",
          data: values,
          backgroundColor: ["#d97706", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#64748b"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: c => `${c.label}: ${Number(c.parsed).toLocaleString("ru-RU")} т`
            }
          }
        }
      }
    });
  }

  const ctx3 = document.getElementById("requestsChart");
  if (ctx3 && d?.requestsByStatus) {
    destroyChart("requests");
    const { labels, values } = translateRequestStatuses(d.requestsByStatus);
    appState.chartInstances.requests = new Chart(ctx3, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Количество заявок",
          data: values,
          backgroundColor: "#d97706"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `${c.parsed.y} шт.` } }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Заявок, шт." },
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }
}
