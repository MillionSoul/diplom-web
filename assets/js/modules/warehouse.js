import { apiFetch } from "../core/api.js";
import { appState, getCurrentUser } from "../core/state.js";
import { showToast, openModal, closeModal } from "../core/ui.js";
import { fillGrainSelect, fillFacilitySelect, getGrainById } from "./dictionaries.js";
import { exportDataset } from "./exports.js";

function qualityClass(moisture, baseMoisture) {
  const m = Number(moisture);
  const b = Number(baseMoisture);
  if (m <= b) return "quality-ok";
  if (m <= b + 2) return "quality-warn";
  return "quality-bad";
}

function renderFacilitiesGrid() {
  const grid = document.getElementById("facilitiesGrid");
  if (!grid) return;
  grid.innerHTML = appState.facilities.map(f => {
    const cap = Number(f.capacityTons) || 1;
    const occ = Number(f.currentOccupancy) || 0;
    const pct = Math.min(100, Math.round((occ / cap) * 100));
    const statusClass = f.status === "operational" ? "facility-ok" : f.status === "maintenance" ? "facility-maint" : "facility-closed";
    return `
      <div class="facility-card ${statusClass}">
        <div class="facility-card-header">
          <span class="facility-number">${f.facilityNumber}</span>
          <span class="facility-type">${f.facilityType}</span>
        </div>
        <div class="facility-bar"><div class="facility-bar-fill" style="width:${pct}%"></div></div>
        <p class="facility-meta">${occ.toLocaleString("ru-RU")} / ${cap.toLocaleString("ru-RU")} т (${pct}%)</p>
        <p class="facility-status">${f.status}</p>
      </div>`;
  }).join("");
}

export async function initWarehousePage() {
  fillGrainSelect("batchGrain", false);
  fillFacilitySelect("batchSilo");
  await loadBatches();
}

export async function loadBatches() {
  const tbody = document.getElementById("batchesTableBody");
  if (!tbody) return;
  try {
    const batches = await apiFetch("/GrainBatches");
    appState.batches = batches;
    let occupied = 0;
    tbody.innerHTML = batches.length ? batches.map(b => {
      occupied += Number(b.receiptWeightNet || 0);
      const grain = b.grainType || getGrainById(b.grainTypeId);
      const baseM = grain?.baseMoisture ?? 14;
      const qClass = qualityClass(b.moisturePercent, baseM);
      const needsDry = Number(b.moisturePercent) > baseM;
      const cleanIcon = b.needsCleaning && !b.cleaningCompleted ? '<i class="fas fa-filter text-amber-600" title="Очистка"></i>' : b.cleaningCompleted ? '<i class="fas fa-check text-green-600"></i>' : "—";
      const dryIcon = b.needsDrying && !b.dryingCompleted ? '<i class="fas fa-wind text-orange-500" title="Сушка"></i>' : b.dryingCompleted ? '<i class="fas fa-check text-green-600"></i>' : "—";
      return `
      <tr class="table-row">
        <td><span class="font-mono text-sm">${b.batchNumber || b.batchId}</span></td>
        <td>${new Date(b.receiptDate).toLocaleDateString("ru-RU")}</td>
        <td>${grain?.grainName || "—"}</td>
        <td>${b.receiptWeightNet}</td>
        <td><span class="${qClass}">${b.moisturePercent}%</span></td>
        <td>${cleanIcon}</td>
        <td>${dryIcon}</td>
        <td>${b.facility?.facilityNumber || b.facilityId}</td>
        <td><span class="badge badge-pending">${b.status}</span></td>
        <td><button onclick="deleteBatchById(${b.batchId})" class="btn-icon danger"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="9" class="empty-state">Партий нет</td></tr>`;

    const d = appState.dashboard;
    const totalCap = d?.totalCapacity ?? 100000;
    document.getElementById("totalOccupied").textContent = `${occupied.toLocaleString("ru-RU")} т`;
    document.getElementById("totalFree").textContent = `${Math.max(0, totalCap - occupied).toLocaleString("ru-RU")} т`;
    document.getElementById("totalBatches").textContent = String(batches.length);
    document.getElementById("totalCapacityLabel")?.textContent &&
      (document.getElementById("totalCapacityLabel").textContent = `${totalCap.toLocaleString("ru-RU")} т`);
    renderFacilitiesGrid();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-red-600 p-4">${err.message}</td></tr>`;
  }
}

export function openAddBatchModal() {
  openModal("addBatchModal");
}

export async function saveBatch(e) {
  e.preventDefault();
  try {
    const user = getCurrentUser();
    const volume = Number(document.getElementById("batchVolume").value);
    const moisture = Number(document.getElementById("batchMoisture").value);
    const grainId = Number(document.getElementById("batchGrain").value);
    const grain = getGrainById(grainId);
    await apiFetch("/GrainBatches", {
      method: "POST",
      body: JSON.stringify({
        batchId: 0,
        batchNumber: `BHB-${Date.now().toString(36).toUpperCase()}`,
        supplierId: null,
        grainTypeId: grainId,
        facilityId: Number(document.getElementById("batchSilo").value),
        receiptDate: new Date().toISOString(),
        receiptWeightGross: volume * 1.01,
        receiptWeightNet: volume,
        moisturePercent: moisture,
        glutenPercent: document.getElementById("batchGluten").value
          ? Number(document.getElementById("batchGluten").value) : null,
        needsDrying: document.getElementById("batchNeedsDrying")?.checked ?? (grain ? moisture > Number(grain.baseMoisture) : false),
      needsCleaning: document.getElementById("batchNeedsCleaning")?.checked ?? true,
        status: "stored",
        createdBy: user?.userId || null
      })
    });
    closeModal("addBatchModal");
    e.target.reset();
    await loadBatches();
    showToast("Партия добавлена.", "success");
  } catch (err) {
    showToast(`Ошибка: ${err.message}`, "error");
  }
}

export async function deleteBatchById(id) {
  if (!confirm("Удалить партию?")) return;
  try {
    await apiFetch(`/GrainBatches/${id}`, { method: "DELETE" });
    await loadBatches();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function filterBatches() {
  const search = document.getElementById("searchBatch")?.value.toLowerCase() || "";
  document.querySelectorAll("#batchesTableBody tr").forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(search) ? "" : "none";
  });
}

export function generateReport(format) {
  const rows = (appState.batches || []).map(r => ({
    "Партия": r.batchNumber,
    "Культура": r.grainType?.grainName || "-",
    "Вес нетто, т": r.receiptWeightNet,
    "Влажность, %": r.moisturePercent,
    "Силос": r.facility?.facilityNumber || r.facilityId,
    "Статус": r.status,
    "Дата": new Date(r.receiptDate).toLocaleDateString("ru-RU")
  }));
  exportDataset(`warehouse_report_${Date.now()}`, rows, format, "Отчет по складу");
}
