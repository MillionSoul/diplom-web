import { apiFetch } from "../core/api.js";
import { appState, getCurrentUser } from "../core/state.js";
import { showToast, openModal, closeModal, orderServicesHtml } from "../core/ui.js";
import { bindSearchInput, rowMatchesQuery, searchBarHtml } from "../core/search.js";
import { loadDictionaries, fillGrainSelect } from "./dictionaries.js";
import { downloadAccountingInvoice } from "./workflow-invoice.js";

const STAGES = [
  { id: "scales", label: "Весы", hint: "Сверка заявленного и фактического веса, затем отправка в лабораторию" },
  { id: "laboratory", label: "Лаборатория", hint: "Влажность, культура, заражение паразитами. При заражении — отмена заказа" },
  { id: "reception", label: "Приемка", hint: "Оформление приема после проверок" },
  { id: "cleaning", label: "Очистка", hint: "Зерноочистительные машины" },
  { id: "drying", label: "Сушка", hint: "Снижение влажности до базиса" },
  { id: "storage", label: "Хранение", hint: "Размещение в силосе" },
  { id: "completed", label: "Завершено", hint: "Накладная для бухгалтерии (Excel)" }
];

const STAGE_LABELS = Object.fromEntries(STAGES.map(s => [s.id, s.label]));

let currentStage = "scales";
let stageBatches = [];
let pendingList = [];
let pendingSearchQuery = "";
let stageSearchQuery = "";

export async function refreshWorkflow() {
  await loadPending();
  await loadSummary();
  await selectWorkflowStage(currentStage);
}

export async function initMonitoringPage() {
  await loadDictionaries();
  fillWorkflowFacilitySelect();
  fillScalesGrainSelect();
  fillLabGrainSelect();
  mountWorkflowSearchBars();
  currentStage = "scales";
  await refreshWorkflow();
}

function mountWorkflowSearchBars() {
  const pendingMount = document.getElementById("pendingSearchMount");
  if (pendingMount && !document.getElementById("pendingSearchInput")) {
    pendingMount.innerHTML = searchBarHtml("pendingSearchInput", "Поиск по ID, предприятию, культуре…", "pendingSearchClear");
    bindSearchInput("pendingSearchInput", q => {
      pendingSearchQuery = q;
      renderPendingTable();
    }, "pendingSearchClear");
  }
  const stageMount = document.getElementById("stageSearchMount");
  if (stageMount && !document.getElementById("stageSearchInput")) {
    stageMount.innerHTML = searchBarHtml("stageSearchInput", "Поиск по партии, предприятию, культуре…", "stageSearchClear");
    bindSearchInput("stageSearchInput", q => {
      stageSearchQuery = q;
      renderStageTable();
    }, "stageSearchClear");
  }
}

async function loadSummary() {
  try {
    const s = await apiFetch("/Workflow/summary");
    STAGES.forEach(st => {
      const el = document.getElementById(`tabCount_${st.id}`);
      if (el) el.textContent = String(s.byStage?.[st.id] ?? 0);
    });
  } catch { /* */ }
}

async function loadPending() {
  const tbody = document.getElementById("pendingRequestsBody");
  if (!tbody) return;
  try {
    pendingList = await apiFetch("/Workflow/pending-requests");
    renderPendingTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-red-600 p-4">${err.message}. Выполните database_organization_workflow.sql</td></tr>`;
  }
}

function renderPendingTable() {
  const tbody = document.getElementById("pendingRequestsBody");
  if (!tbody) return;
  const filtered = pendingList.filter(r => rowMatchesQuery([
    String(r.requestId),
    r.organization,
    r.userName,
    r.grainTypeName,
    String(r.volumeTons),
    String(r.moisturePercent ?? "")
  ], pendingSearchQuery));

  tbody.innerHTML = filtered.length ? filtered.map(r => `
      <tr class="table-row">
        <td>${r.requestId}</td>
        <td>${new Date(r.requestDate).toLocaleDateString("ru-RU")}</td>
        <td><strong>${r.organization || r.userName || "—"}</strong></td>
        <td>${orderServicesHtml(r)}</td>
        <td>${r.grainTypeName || "—"}</td>
        <td>${r.volumeTons}</td>
        <td>${r.moisturePercent ?? "—"}</td>
        <td class="actions-cell">
          <span class="btn-action-pair">
            <button type="button" onclick="acceptClientRequest(${r.requestId})" class="btn-stage-sm btn-accept">
              <i class="fas fa-check"></i> Принять
            </button>
            <button type="button" onclick="rejectClientRequest(${r.requestId})" class="btn-stage-sm btn-reject">
              <i class="fas fa-times"></i> Отклонить
            </button>
          </span>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="8" class="empty-state">${pendingSearchQuery ? "Ничего не найдено" : "Нет ожидающих заявок"}</td></tr>`;
}

export async function acceptClientRequest(requestId) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    await apiFetch(`/Workflow/accept-request/${requestId}`, {
      method: "POST",
      body: JSON.stringify({ operatorUserId: user.userId, notes: "Принято в работу" })
    });
    showToast("Заявка принята. Партия на этапе «Весы».", "success");
    await refreshWorkflow();
    selectWorkflowStage("scales");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function rejectClientRequest(requestId) {
  const user = getCurrentUser();
  if (!user) return;
  const reason = prompt("Причина отклонения (необязательно):", "Не соответствует условиям приёмки");
  if (reason === null) return;
  try {
    await apiFetch(`/Workflow/reject-request/${requestId}`, {
      method: "POST",
      body: JSON.stringify({
        operatorUserId: user.userId,
        notes: reason.trim() || "Отклонено оператором"
      })
    });
    showToast("Заявка отклонена.", "success");
    await refreshWorkflow();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function deleteWorkflowBatch(batchId) {
  const user = getCurrentUser();
  if (!user) return;
  const row = stageBatches.find(b => b.batchId === batchId);
  const label = row?.batchNumber ? `партию ${row.batchNumber}` : `партию #${batchId}`;
  if (!confirm(`Удалить ${label}? Заявка останется одобренной без партии.`)) return;
  try {
    await apiFetch(`/Workflow/batch/${batchId}?operatorUserId=${user.userId}`, { method: "DELETE" });
    showToast("Партия удалена.", "success");
    await refreshWorkflow();
    await selectWorkflowStage(currentStage);
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function selectWorkflowStage(stage) {
  currentStage = stage;
  document.querySelectorAll(".workflow-tab").forEach(tab => {
    tab.classList.toggle("workflow-tab-active", tab.dataset.stage === stage);
  });
  const meta = STAGES.find(s => s.id === stage);
  document.getElementById("stagePanelTitle").textContent = `Этап: ${meta?.label || stage}`;
  document.getElementById("stagePanelHint").textContent = meta?.hint || "";

  try {
    stageBatches = await apiFetch(`/Workflow/stage/${stage}`);
    renderStageTable();
  } catch (err) {
    document.getElementById("stageBatchesBody").innerHTML =
      `<tr><td colspan="8" class="text-red-600 p-4">${err.message}</td></tr>`;
  }
}

function clientLabel(b) {
  return b.clientOrganization || b.clientName || "—";
}

function renderStageTable() {
  const tbody = document.getElementById("stageBatchesBody");
  if (!tbody) return;

  const filtered = stageBatches.filter(b => rowMatchesQuery([
    b.batchNumber,
    clientLabel(b),
    b.grainName,
    b.facilityNumber,
    String(b.receiptWeightNet),
    String(b.moisturePercent),
    b.stageNotes
  ], stageSearchQuery));

  tbody.innerHTML = filtered.length ? filtered.map(b => {
    const cancelled = b.status === "cancelled";
    const actions = renderStageActions(b, cancelled);
    return `
    <tr class="table-row ${cancelled ? "opacity-60" : ""}">
      <td class="font-mono text-xs">${b.batchNumber}</td>
      <td><strong>${clientLabel(b)}</strong></td>
      <td>${orderServicesHtml(b)}</td>
      <td>${b.grainName || "—"}</td>
      <td>${b.receiptWeightNet}</td>
      <td>${b.moisturePercent}%</td>
      <td>${b.facilityNumber || "—"}</td>
      <td class="actions-cell workflow-actions flex flex-wrap gap-1">${actions}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" class="empty-state">${stageSearchQuery ? "Ничего не найдено" : "На этом этапе партий нет"}</td></tr>`;
}

function renderStageActions(b, cancelled) {
  if (cancelled) {
    const note = b.stageNotes ? `<br><small>${b.stageNotes}</small>` : "";
    return `<span class="text-red-600 text-xs font-semibold">Отменено</span>${note}
      <button onclick="deleteWorkflowBatch(${b.batchId})" class="btn-icon danger ml-1" title="Удалить"><i class="fas fa-trash"></i></button>`;
  }

  const parts = [];

  if (b.processStage === "scales") {
    parts.push(`<button onclick="openScalesModal(${b.batchId})" class="btn-primary text-xs px-2 py-1"><i class="fas fa-weight-scale"></i> Весы</button>`);
  } else if (b.processStage === "laboratory") {
    parts.push(`<button onclick="openLaboratoryModal(${b.batchId})" class="btn-primary text-xs px-2 py-1"><i class="fas fa-flask"></i> Лаборатория</button>`);
  } else if (b.processStage === "completed" || (b.processStage === "storage" && b.costTotal)) {
    parts.push(`<button onclick="downloadAccountingInvoice(${b.batchId})" class="btn-primary text-xs px-2 py-1"><i class="fas fa-file-excel"></i> Накладная Excel</button>`);
  }

  if (!["scales", "laboratory"].includes(b.processStage) && b.nextStage) {
    parts.push(`<button onclick="advanceBatch(${b.batchId}, false)" class="btn-primary text-xs px-2 py-1" title="Следующий: ${b.nextStageLabel}">
      <i class="fas fa-arrow-right"></i> ${b.nextStageLabel}
    </button>`);
  }

  if (b.processStage === "storage" || b.processStage === "completed") {
    parts.push(`<button onclick="downloadAccountingInvoice(${b.batchId})" class="btn-ghost text-xs px-2 py-1"><i class="fas fa-file-excel"></i> Excel</button>`);
  }

  if (!["scales", "laboratory", "completed", "cancelled"].includes(b.processStage)) {
    parts.push(`<button onclick="openBatchEditor(${b.batchId})" class="btn-icon" title="Редактировать"><i class="fas fa-pen"></i></button>`);
  }

  parts.push(`<button onclick="deleteWorkflowBatch(${b.batchId})" class="btn-icon danger" title="Удалить партию"><i class="fas fa-trash"></i></button>`);

  return parts.join("") || "—";
}

export async function openScalesModal(batchId) {
  try {
    const b = await apiFetch(`/Workflow/batch/${batchId}`);
    document.getElementById("scalesBatchId").value = b.batchId;
    document.getElementById("scalesBatchNumber").textContent = b.batchNumber;
    document.getElementById("scalesOrganization").textContent = clientLabel(b);
    const so = document.getElementById("scalesOrderServices");
    if (so) so.innerHTML = `<span class="text-gray-600">Заказ:</span> ${orderServicesHtml(b)}`;
    document.getElementById("scalesDeclaredWeight").textContent = `${b.declaredVolumeTons ?? "—"} т`;
    document.getElementById("scalesWeightNet").value = b.receiptWeightNet;
    document.getElementById("scalesWeightGross").value = b.receiptWeightGross;
    document.getElementById("scalesNotes").value = b.stageNotes || "";
    const diff = Number(b.receiptWeightNet) - Number(b.declaredVolumeTons || 0);
    document.getElementById("scalesDiff").textContent =
      b.declaredVolumeTons != null ? `Δ ${diff >= 0 ? "+" : ""}${diff.toFixed(2)} т` : "";
    openModal("scalesModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function submitScalesToLab(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const batchId = Number(document.getElementById("scalesBatchId").value);
  try {
    await apiFetch(`/Workflow/batch/${batchId}/scales-to-laboratory`, {
      method: "POST",
      body: JSON.stringify({
        operatorUserId: user.userId,
        receiptWeightNet: Number(document.getElementById("scalesWeightNet").value),
        receiptWeightGross: Number(document.getElementById("scalesWeightGross").value),
        stageNotes: document.getElementById("scalesNotes").value
      })
    });
    closeModal("scalesModal");
    showToast("Данные весов сохранены. Партия в лаборатории.", "success");
    await refreshWorkflow();
    selectWorkflowStage("laboratory");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function openLaboratoryModal(batchId) {
  try {
    const b = await apiFetch(`/Workflow/batch/${batchId}`);
    document.getElementById("labBatchId").value = b.batchId;
    document.getElementById("labBatchNumber").textContent = b.batchNumber;
    document.getElementById("labOrganization").textContent = clientLabel(b);
    const lo = document.getElementById("labOrderServices");
    if (lo) lo.innerHTML = `<span class="text-gray-600">Заказ:</span> ${orderServicesHtml(b)}`;
    document.getElementById("labParasite").checked = false;
    toggleLabParasiteCancel();
    document.getElementById("labDeclaredGrain").textContent = b.declaredGrainName || "—";
    document.getElementById("labDeclaredMoisture").textContent =
      b.declaredMoisturePercent != null ? `${b.declaredMoisturePercent}%` : "—";
    document.getElementById("labMoisture").value = b.moisturePercent;
    const sel = document.getElementById("labGrainType");
    if (sel) sel.value = b.grainTypeId;
    document.getElementById("labParasite").checked = false;
    document.getElementById("labNotes").value = b.stageNotes || "";
    openModal("laboratoryModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function toggleLabParasiteCancel() {
  const on = document.getElementById("labParasite")?.checked;
  const btn = document.getElementById("labCancelParasiteBtn");
  if (!btn) return;
  btn.classList.toggle("hidden", !on);
  btn.disabled = !on;
}

export async function cancelOrderParasites() {
  const user = getCurrentUser();
  const batchId = Number(document.getElementById("labBatchId").value);
  if (!document.getElementById("labParasite")?.checked) {
    showToast("Отметьте «В пробе обнаружены вредители», если нужна отмена.", "info");
    return;
  }
  try {
    await apiFetch(`/Workflow/batch/${batchId}/laboratory-complete`, {
      method: "POST",
      body: JSON.stringify({
        operatorUserId: user.userId,
        grainTypeId: Number(document.getElementById("labGrainType").value),
        moisturePercent: Number(document.getElementById("labMoisture").value),
        parasiteInfested: true,
        stageNotes: document.getElementById("labNotes").value || "Отмена: вредители в пробе"
      })
    });
    closeModal("laboratoryModal");
    showToast("Заказ отменён: в пробе обнаружены вредители.", "info");
    await refreshWorkflow();
    selectWorkflowStage("completed");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function submitLaboratory(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const batchId = Number(document.getElementById("labBatchId").value);

  if (document.getElementById("labParasite")?.checked) {
    showToast("Снимите галочку «вредители» или нажмите «Отменить заказ».", "info");
    return;
  }

  try {
    await apiFetch(`/Workflow/batch/${batchId}/laboratory-complete`, {
      method: "POST",
      body: JSON.stringify({
        operatorUserId: user.userId,
        grainTypeId: Number(document.getElementById("labGrainType").value),
        moisturePercent: Number(document.getElementById("labMoisture").value),
        parasiteInfested: false,
        stageNotes: document.getElementById("labNotes").value
      })
    });
    closeModal("laboratoryModal");
    showToast("Лаборатория завершена. Партия на приёмке.", "success");
    await refreshWorkflow();
    selectWorkflowStage("reception");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function toggleWfStorageMonths() {
  const on = document.getElementById("wfNeedsStorage")?.checked;
  document.getElementById("wfStorageMonthsWrap")?.classList.toggle("hidden", !on);
}

export async function openBatchEditor(batchId) {
  try {
    const b = await apiFetch(`/Workflow/batch/${batchId}`);
    document.getElementById("wfBatchId").value = b.batchId;
    document.getElementById("wfBatchNumber").textContent = b.batchNumber;
    document.getElementById("wfStageLabel").textContent = STAGE_LABELS[b.processStage] || b.processStage;
    document.getElementById("wfClient").textContent = clientLabel(b);
    document.getElementById("wfWeightNet").value = b.receiptWeightNet;
    document.getElementById("wfWeightGross").value = b.receiptWeightGross;
    document.getElementById("wfMoisture").value = b.moisturePercent;
    document.getElementById("wfStageNotes").value = b.stageNotes || "";
    document.getElementById("wfNeedsCleaning").checked = b.needsCleaning;
    document.getElementById("wfNeedsDrying").checked = b.needsDrying;
    const wantsStorage = !!(b.wantsStorage || (b.storageMonths && b.storageMonths > 0));
    document.getElementById("wfNeedsStorage").checked = wantsStorage;
    const monthsEl = document.getElementById("wfStorageMonths");
    if (monthsEl) monthsEl.value = b.storageMonths > 0 ? b.storageMonths : 3;
    toggleWfStorageMonths();
    const orderEl = document.getElementById("wfOrderServices");
    if (orderEl) orderEl.innerHTML = `<span class="text-gray-600">Заказ:</span> ${orderServicesHtml(b)}`;
    const sel = document.getElementById("wfFacility");
    if (sel) sel.value = b.facilityId;
    openModal("workflowBatchModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function fillWorkflowFacilitySelect() {
  const sel = document.getElementById("wfFacility");
  if (!sel) return;
  sel.innerHTML = appState.facilities.map(f =>
    `<option value="${f.facilityId}">${f.facilityNumber}</option>`
  ).join("");
}

function fillScalesGrainSelect() { /* не нужен на весах */ }

function fillLabGrainSelect() {
  fillGrainSelect("labGrainType", false);
}

export async function saveWorkflowBatch(e) {
  e.preventDefault();
  const batchId = Number(document.getElementById("wfBatchId").value);
  try {
    await apiFetch(`/Workflow/batch/${batchId}`, {
      method: "PATCH",
      body: JSON.stringify({
        receiptWeightNet: Number(document.getElementById("wfWeightNet").value),
        receiptWeightGross: Number(document.getElementById("wfWeightGross").value),
        moisturePercent: Number(document.getElementById("wfMoisture").value),
        facilityId: Number(document.getElementById("wfFacility").value),
        needsCleaning: document.getElementById("wfNeedsCleaning").checked,
        needsDrying: document.getElementById("wfNeedsDrying").checked,
        wantsStorage: document.getElementById("wfNeedsStorage").checked,
        storageMonths: document.getElementById("wfNeedsStorage").checked
          ? Number(document.getElementById("wfStorageMonths").value) || 3
          : 0,
        stageNotes: document.getElementById("wfStageNotes").value
      })
    });
    closeModal("workflowBatchModal");
    showToast("Данные партии сохранены.", "success");
    await refreshWorkflow();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function advanceBatch(batchId, skipOptional = false) {
  const user = getCurrentUser();
  try {
    await apiFetch(`/Workflow/batch/${batchId}/advance`, {
      method: "POST",
      body: JSON.stringify({ operatorUserId: user.userId, skipOptional })
    });
    showToast("Партия переведена на следующий этап.", "success");
    await refreshWorkflow();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function sendBatchToStage(batchId, targetStage) {
  const user = getCurrentUser();
  const label = STAGE_LABELS[targetStage];
  if (!confirm(`Перевести партию на этап «${label}»?`)) return;
  try {
    await apiFetch(`/Workflow/batch/${batchId}/send-to/${targetStage}`, {
      method: "POST",
      body: JSON.stringify({ operatorUserId: user.userId })
    });
    showToast(`Партия на этапе «${label}».`, "success");
    await refreshWorkflow();
    selectWorkflowStage(targetStage);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function numOrNull(id) {
  const v = document.getElementById(id)?.value;
  return v === "" || v == null ? null : Number(v);
}

function intOrNull(id) {
  const v = document.getElementById(id)?.value;
  return v === "" || v == null ? null : parseInt(v, 10);
}

