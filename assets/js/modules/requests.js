import { apiFetch } from "../core/api.js";
import { appState, getCurrentUser } from "../core/state.js";
import { showToast, statusBadge, orderServicesHtml } from "../core/ui.js";
import { getSelectedRequestServices } from "./calculator.js";
import { showPage } from "../core/router.js";
import { fillGrainSelect } from "./dictionaries.js";
import { exportRequests } from "./exports.js";
import { updateRequestEstimate, buildEstimateNote } from "./calculator.js";

const STAGE_LABELS = {
  scales: "Весы", laboratory: "Лаборатория", reception: "Приемка",
  cleaning: "Очистка", drying: "Сушка", storage: "Хранение", completed: "Завершено", cancelled: "Отменено"
};
function processStageLabel(s) {
  if (!s) return "—";
  return STAGE_LABELS[s] || s;
}

export async function initRequestsPage() {
  fillGrainSelect("requestGrain");
  updateRequestEstimate();
  await loadUserRequests();
}

export async function submitRequest(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return showPage("login");
  const svc = getSelectedRequestServices();
  if (!svc.wantsCleaning && !svc.wantsDrying && !svc.wantsStorage) {
    return showToast("Выберите хотя бы одну услугу.", "error");
  }
  const detailsRaw = document.getElementById("requestDetails").value.trim();
  const estimateNote = buildEstimateNote();
  const storageNote = svc.wantsStorage
    ? `Срок хранения: ${document.getElementById("requestStorageMonths")?.value || 3} мес.`
    : "";
  const details = [detailsRaw, storageNote, estimateNote].filter(Boolean).join("\n\n");

  try {
    await apiFetch("/ServiceRequests", {
      method: "POST",
      body: JSON.stringify({
        userId: user.userId,
        wantsCleaning: svc.wantsCleaning,
        wantsDrying: svc.wantsDrying,
        wantsStorage: svc.wantsStorage,
        grainTypeId: Number(document.getElementById("requestGrain").value),
        volumeTons: Number(document.getElementById("requestVolume").value),
        moisturePercent: document.getElementById("requestMoisture").value
          ? Number(document.getElementById("requestMoisture").value) : null,
        details: details || null
      })
    });
    showToast("Заявка отправлена.", "success");
    e.target.reset();
    document.getElementById("requestStorageMonths").value = "3";
    updateRequestEstimate();
    await loadUserRequests();
  } catch (err) {
    showToast(`Ошибка: ${err.message}`, "error");
  }
}

export async function loadUserRequests() {
  const user = getCurrentUser();
  const tbody = document.getElementById("requestsTableBody");
  if (!user || !tbody) return;
  try {
    const requests = await apiFetch(`/ServiceRequests/by-user/${user.userId}`);
    appState.requests = requests;
    tbody.innerHTML = requests.length ? requests.map(r => `
      <tr class="table-row">
        <td>${r.requestId}</td>
        <td>${new Date(r.requestDate).toLocaleDateString("ru-RU")}</td>
        <td>${orderServicesHtml(r)}</td>
        <td>${r.grainTypeName || r.grainTypeId}</td>
        <td>${r.volumeTons}</td>
        <td>${statusBadge(r.status)}${r.processStage ? `<br><small class="text-gray-500">${processStageLabel(r.processStage)}</small>` : ""}</td>
        <td class="actions-cell">
          <button onclick="downloadInvoice(${r.requestId},'user')" class="btn-icon" title="Накладная"><i class="fas fa-file-invoice"></i></button>
          ${r.status === "pending" ? `<button onclick="deleteRequestById(${r.requestId})" class="btn-icon danger" title="Удалить"><i class="fas fa-trash"></i></button>` : ""}
        </td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty-state">Заявок пока нет</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-red-600 p-4">${err.message}</td></tr>`;
  }
}

export async function deleteRequestById(id) {
  if (!confirm("Удалить заявку?")) return;
  try {
    await apiFetch(`/ServiceRequests/${id}`, { method: "DELETE" });
    if (appState.currentPage === "admin") {
      const { loadAdminPanel } = await import("./admin.js");
      await loadAdminPanel();
    } else await loadUserRequests();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export { exportRequests, updateRequestEstimate };
