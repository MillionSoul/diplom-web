/** Подписи статусов заявок для графиков */
export const REQUEST_STATUS_RU = {
  pending: "Ожидает",
  approved: "Одобрено",
  in_progress: "В работе",
  completed: "Выполнено",
  rejected: "Отклонено"
};

export function translateRequestStatuses(requestsByStatus) {
  if (!requestsByStatus) return { labels: [], values: [] };
  const order = ["pending", "approved", "in_progress", "completed", "rejected"];
  const keys = order.filter(k => k in requestsByStatus);
  const extra = Object.keys(requestsByStatus).filter(k => !order.includes(k));
  const all = [...keys, ...extra];
  return {
    labels: all.map(k => REQUEST_STATUS_RU[k] || k),
    values: all.map(k => requestsByStatus[k])
  };
}

/** Загрузка элеватора: шкала 0…вместимость (т), под графиком — тоннаж по категориям */
export function buildOccupancyChartConfig(occupied, capacity) {
  const cap = Math.max(Number(capacity) || 1, 1);
  const occ = Math.max(0, Math.min(Number(occupied) || 0, cap));
  const free = Math.max(0, cap - occ);

  const rows = [
    { key: "capacity", label: "Общая вместимость", tons: cap, color: "#d1d5db" },
    { key: "occupied", label: "Занято", tons: occ, color: "#d97706" },
    { key: "free", label: "Свободно", tons: free, color: "#22c55e" }
  ];

  return {
    type: "bar",
    data: {
      labels: rows.map(r => r.label),
      datasets: [{
        label: "Тонн",
        data: rows.map(r => r.tons),
        backgroundColor: rows.map(r => r.color),
        barThickness: "flex",
        maxBarThickness: 72
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${Number(ctx.parsed.y).toLocaleString("ru-RU")} т`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: cap,
          title: { display: true, text: "Тонн" },
          ticks: {
            callback: (v) => Number(v).toLocaleString("ru-RU")
          }
        },
        x: {
          ticks: { maxRotation: 0, minRotation: 0, font: { size: 11 } }
        }
      }
    },
    legendRows: rows
  };
}

export function renderOccupancyLegend(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el || !rows?.length) return;
  el.innerHTML = rows.map(r => `
    <div class="occupancy-legend-item">
      <span class="occupancy-legend-dot" style="background:${r.color}"></span>
      <span class="occupancy-legend-label">${r.label}</span>
      <strong class="occupancy-legend-tons">${Number(r.tons).toLocaleString("ru-RU")} т</strong>
    </div>`).join("");
}
