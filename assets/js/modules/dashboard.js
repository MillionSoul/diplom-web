import { apiFetch } from "../core/api.js";
import { appState } from "../core/state.js";

export async function loadDashboard() {
  try {
    appState.dashboard = await apiFetch("/Dashboard/summary");
    return appState.dashboard;
  } catch {
    appState.dashboard = null;
    return null;
  }
}

export function renderHomeStats() {
  const d = appState.dashboard;
  if (!d) return;
  const p = d.processPipeline || {};

  const map = {
    homeStatOccupied: `${Number(d.totalOccupied).toLocaleString("ru-RU")} т`,
    homeStatMoisture: d.avgMoisture != null ? `${Number(d.avgMoisture).toFixed(1)}%` : "—",
    homeStatDrying: String(d.needsDryingCount ?? p.drying ?? 0),
    homeStatReceived: `${Number(d.receivedTodayTons ?? 0).toLocaleString("ru-RU")} т`,
    pipeScales: String(p.scales ?? 0),
    pipeLaboratory: String(p.laboratory ?? p.labPending ?? 0),
    pipeReception: String(p.reception ?? 0),
    pipeCleaning: String(p.cleaning ?? 0),
    pipeDrying: String(p.drying ?? 0),
    pipeStorage: String(p.storage ?? 0)
  };
  Object.entries(map).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  document.querySelectorAll("#homePipeline .pipeline-step").forEach(step => {
    const count = step.querySelector(".pipeline-count");
    if (count && Number(count.textContent) > 0) step.classList.add("pipeline-step-active");
  });
}
