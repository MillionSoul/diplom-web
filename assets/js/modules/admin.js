import { apiFetch } from "../core/api.js";
import { appState, getCurrentUser, isAdmin } from "../core/state.js";
import { showToast, getStatusName, statusBadge, roleLabel, openModal, closeModal, orderServicesHtml } from "../core/ui.js";
import { bindSearchInput, rowMatchesQuery, searchBarHtml } from "../core/search.js";
import { exportRequests } from "./exports.js";
import { loadDashboard } from "./dashboard.js";
import { translateRequestStatuses, buildOccupancyChartConfig, renderOccupancyLegend } from "./chart-labels.js";

let adminCharts = {};
let regsSearchQuery = "";
let adminRequestsSearchQuery = "";

function mountAdminSearchBars() {
  const regsMount = document.getElementById("adminRegsSearchMount");
  if (regsMount && !document.getElementById("adminRegsSearchInput")) {
    regsMount.innerHTML = searchBarHtml("adminRegsSearchInput", "Поиск по ФИО, предприятию, логину, email…", "adminRegsSearchClear");
    bindSearchInput("adminRegsSearchInput", q => {
      regsSearchQuery = q;
      renderPendingRegistrations();
    }, "adminRegsSearchClear");
  }
  const reqMount = document.getElementById("adminRequestsSearchMount");
  if (reqMount && !document.getElementById("adminRequestsSearchInput")) {
    reqMount.innerHTML = searchBarHtml("adminRequestsSearchInput", "Поиск по ID, предприятию, культуре…", "adminRequestsSearchClear");
    bindSearchInput("adminRequestsSearchInput", q => {
      adminRequestsSearchQuery = q;
      renderAdminRequestsTable();
    }, "adminRequestsSearchClear");
  }
}

function destroyAdminChart(key) {
  if (adminCharts[key]) {
    adminCharts[key].destroy();
    delete adminCharts[key];
  }
}

export async function loadAdminPanel() {
  if (!isAdmin()) return;
  mountAdminSearchBars();
  await Promise.all([
    loadPendingRegistrations(),
    loadAdminRequests(),
    loadAdminUsers()
  ]);
  updateAdminStats();
  setAdminTab("registrations");
}

export function setAdminTab(tabName) {
  const sections = {
    registrations: "adminRegistrationsSection",
    requests: "adminRequestsSection",
    users: "adminUsersSection",
    analytics: "adminAnalyticsSection"
  };
  const buttons = {
    registrations: "adminTabRegsBtn",
    requests: "adminTabRequestsBtn",
    users: "adminTabUsersBtn",
    analytics: "adminTabAnalyticsBtn"
  };

  Object.entries(sections).forEach(([key, id]) => {
    document.getElementById(id)?.classList.toggle("hidden", key !== tabName);
  });
  Object.entries(buttons).forEach(([key, id]) => {
    document.getElementById(id)?.classList.toggle("tab-btn-active", key === tabName);
  });

  if (tabName === "analytics") renderAdminAnalytics();
}

function updateAdminStats() {
  const pendingRegs = appState.pendingUsers?.length ?? 0;
  const requests = appState.requests || [];
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("adminPendingRegs", pendingRegs);
  set("adminTotalRequests", requests.length);
  set("adminPendingRequests", requests.filter(r => r.status === "pending").length);
  set("adminCompletedRequests", requests.filter(r => r.status === "completed").length);
}

export async function loadPendingRegistrations() {
  const tbody = document.getElementById("adminRegistrationsBody");
  if (!tbody) return;
  try {
    const users = await apiFetch("/Users?pendingOnly=true");
    appState.pendingUsers = users;
    renderPendingRegistrations();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-red-600 p-4">${err.message}</td></tr>`;
  }
}

function renderPendingRegistrations() {
  const tbody = document.getElementById("adminRegistrationsBody");
  const users = appState.pendingUsers || [];
  if (!tbody) return;
  const filtered = users.filter(u => rowMatchesQuery([
    String(u.userId),
    u.fullName,
    u.organization,
    u.username,
    u.email,
    u.phone
  ], regsSearchQuery));

  tbody.innerHTML = filtered.length ? filtered.map(u => `
      <tr class="table-row">
        <td>${u.userId}</td>
        <td>${new Date(u.createdAt).toLocaleDateString("ru-RU")}</td>
        <td>${u.fullName}</td>
        <td><strong>${u.organization || "—"}</strong></td>
        <td>${u.username}</td>
        <td>${u.email || "—"}</td>
        <td>${u.phone || "—"}</td>
        <td>
          <select id="approveRole_${u.userId}" class="select-sm">
            <option value="client" selected>Клиент</option>
            <option value="operator">Оператор</option>
            <option value="manager">Менеджер</option>
          </select>
        </td>
        <td class="actions-cell">
          <button onclick="approveRegistration(${u.userId})" class="btn-primary text-xs px-2 py-1">Одобрить</button>
          <button onclick="rejectRegistration(${u.userId})" class="btn-export btn-export-red text-xs px-2 py-1">Отклонить</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="9" class="empty-state">${regsSearchQuery ? "Ничего не найдено" : "Нет ожидающих регистраций"}</td></tr>`;
  updateAdminStats();
}

export async function approveRegistration(userId) {
  const role = document.getElementById(`approveRole_${userId}`)?.value || "client";
  try {
    await apiFetch(`/Users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: true, role })
    });
    showToast("Пользователь одобрен.", "success");
    await loadPendingRegistrations();
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function rejectRegistration(userId) {
  if (!confirm("Отклонить заявку и удалить учётную запись?")) return;
  try {
    await apiFetch(`/Users/${userId}`, { method: "DELETE" });
    showToast("Заявка на регистрацию отклонена.", "success");
    await loadPendingRegistrations();
    updateAdminStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function loadAdminRequests() {
  const tbody = document.getElementById("adminRequestsTableBody");
  if (!tbody) return;
  try {
    appState.requests = await apiFetch("/ServiceRequests");
    renderAdminRequestsTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-red-600 p-4">${err.message}</td></tr>`;
  }
}

function renderAdminRequestsTable() {
  const tbody = document.getElementById("adminRequestsTableBody");
  const requests = appState.requests || [];
  if (!tbody) return;
  const filtered = requests.filter(r => rowMatchesQuery([
    String(r.requestId),
    r.organization,
    r.userName,
    r.grainTypeName,
    String(r.volumeTons),
    getStatusName(r.status)
  ], adminRequestsSearchQuery));

  tbody.innerHTML = filtered.length ? filtered.map(r => `
      <tr class="table-row">
        <td>${r.requestId}</td>
        <td>${new Date(r.requestDate).toLocaleDateString("ru-RU")}</td>
        <td>${r.organization || r.userName || "-"}</td>
        <td>${orderServicesHtml(r)}</td>
        <td>${r.grainTypeName || "-"}</td>
        <td>${r.volumeTons}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="actions-cell">
          <select onchange="updateRequestStatus(${r.requestId}, this.value)" class="select-sm">
            ${["pending", "approved", "in_progress", "completed", "rejected"].map(s =>
              `<option value="${s}" ${r.status === s ? "selected" : ""}>${getStatusName(s)}</option>`
            ).join("")}
          </select>
          <button onclick="downloadInvoice(${r.requestId})" class="btn-icon"><i class="fas fa-file-invoice"></i></button>
          <button onclick="deleteRequestById(${r.requestId})" class="btn-icon danger"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join("") : `<tr><td colspan="8" class="empty-state">${adminRequestsSearchQuery ? "Ничего не найдено" : "Нет заявок"}</td></tr>`;
  updateAdminStats();
}

export async function updateRequestStatus(requestId, newStatus) {
  try {
    await apiFetch(`/ServiceRequests/${requestId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: newStatus,
        assignedToUserId: getCurrentUser()?.userId || null
      })
    });
    await loadAdminRequests();
    showToast("Статус обновлён.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function loadAdminUsers() {
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;
  try {
    const users = await apiFetch("/Users");
    appState.users = users;
    tbody.innerHTML = users.map(u => `
      <tr class="table-row">
        <td>${u.userId}</td>
        <td>${u.username}</td>
        <td>${u.fullName}</td>
        <td>${roleLabel(u.role)}</td>
        <td>${u.isActive ? '<span class="badge badge-completed">Активен</span>' : '<span class="badge badge-rejected">Неактивен</span>'}</td>
        <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString("ru-RU") : "—"}</td>
        <td class="actions-cell">
          <button onclick="openEditUser(${u.userId})" class="btn-icon" title="Редактировать"><i class="fas fa-pen"></i></button>
          <button onclick="toggleUserActive(${u.userId}, ${!u.isActive})" class="btn-link text-xs">
            ${u.isActive ? "Блок." : "Разблок."}
          </button>
        </td>
      </tr>`).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-red-600 p-4">${err.message}</td></tr>`;
  }
}

export function openEditUser(userId) {
  const u = (appState.users || []).find(x => x.userId === userId);
  if (!u) return;
  document.getElementById("editUserId").value = u.userId;
  document.getElementById("editUserFullName").value = u.fullName;
  document.getElementById("editUserUsername").value = u.username;
  document.getElementById("editUserEmail").value = u.email || "";
  document.getElementById("editUserPhone").value = u.phone || "";
  document.getElementById("editUserRole").value = u.role;
  document.getElementById("editUserActive").value = String(u.isActive);
  openModal("editUserModal");
}

export async function saveUserEdit(e) {
  e.preventDefault();
  const id = Number(document.getElementById("editUserId").value);
  try {
    await apiFetch(`/Users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        fullName: document.getElementById("editUserFullName").value.trim(),
        email: document.getElementById("editUserEmail").value.trim() || null,
        phone: document.getElementById("editUserPhone").value.trim() || null,
        role: document.getElementById("editUserRole").value,
        isActive: document.getElementById("editUserActive").value === "true"
      })
    });
    closeModal("editUserModal");
    showToast("Данные пользователя сохранены.", "success");
    await loadAdminUsers();
    await loadPendingRegistrations();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function toggleUserActive(userId, isActive) {
  try {
    await apiFetch(`/Users/${userId}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function renderAdminAnalytics() {
  const d = await loadDashboard();
  if (!d) return;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("adminStatOccupied", `${Number(d.totalOccupied).toLocaleString("ru-RU")} т`);
  set("adminStatCapacity", `${Number(d.totalCapacity).toLocaleString("ru-RU")} т`);
  set("adminStatBatches", String(d.batchCount));
  set("adminStatMoisture", d.avgMoisture != null ? `${Number(d.avgMoisture).toFixed(1)}%` : "—");

  const occupied = Number(d.totalOccupied);
  const capacity = Number(d.totalCapacity);

  const c1 = document.getElementById("adminOccupancyChart");
  if (c1) {
    destroyAdminChart("occ");
    const cfg = buildOccupancyChartConfig(occupied, capacity);
    renderOccupancyLegend("adminOccupancyLegend", cfg.legendRows);
    adminCharts.occ = new Chart(c1, { type: cfg.type, data: cfg.data, options: cfg.options });
  }

  const c2 = document.getElementById("adminGrainChart");
  if (c2 && d.grainDistribution) {
    destroyAdminChart("grain");
    adminCharts.grain = new Chart(c2, {
      type: "doughnut",
      data: {
        labels: Object.keys(d.grainDistribution),
        datasets: [{ data: Object.values(d.grainDistribution), backgroundColor: ["#d97706", "#22c55e", "#3b82f6", "#a855f7", "#ef4444"] }]
      }
    });
  }

  const c3 = document.getElementById("adminRequestsChart");
  if (c3 && d.requestsByStatus) {
    destroyAdminChart("req");
    const { labels, values } = translateRequestStatuses(d.requestsByStatus);
    adminCharts.req = new Chart(c3, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Заявок", data: values, backgroundColor: "#d97706" }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }
}

export { exportRequests };
