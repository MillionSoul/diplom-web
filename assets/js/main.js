import { initApiConfig } from "./core/api-config.js";
import { appState, isAdmin, isStaff, getCurrentUser } from "./core/state.js";
import { showPage, updateNavState, registerPageInit, closeUserMenu, closeMobileMenu } from "./core/router.js";
import { showToast, closeModal } from "./core/ui.js";
import { loadDictionaries } from "./modules/dictionaries.js";
import { loadDashboard, renderHomeStats } from "./modules/dashboard.js";
import { restoreSession, handleLogin, handleRegister, logout, switchAuthTab } from "./modules/auth.js";
import { fillProfile, handleAvatarUpload, updateProfile, changePassword } from "./modules/profile.js";
import { initRequestsPage, submitRequest, loadUserRequests, deleteRequestById, exportRequests } from "./modules/requests.js";
import { initWarehousePage, loadBatches, openAddBatchModal, saveBatch, deleteBatchById, filterBatches, generateReport } from "./modules/warehouse.js";
import {
  loadAdminPanel, setAdminTab, updateRequestStatus, toggleUserActive,
  approveRegistration, rejectRegistration, openEditUser, saveUserEdit
} from "./modules/admin.js";
import { initCalculatorPage, updateRequestEstimate } from "./modules/calculator.js";
import { initAnalyticsPage } from "./modules/analytics.js";
import {
  initMonitoringPage, refreshWorkflow, selectWorkflowStage, acceptClientRequest, rejectClientRequest,
  openBatchEditor, saveWorkflowBatch, toggleWfStorageMonths, advanceBatch, sendBatchToStage, deleteWorkflowBatch,
  openScalesModal, submitScalesToLab, openLaboratoryModal, submitLaboratory,
  toggleLabParasiteCancel, cancelOrderParasites
} from "./modules/workflow.js";
import { downloadAccountingInvoice } from "./modules/workflow-invoice.js";
import {
  initMessagesPage, openSupportChat, openSupportDesk, setChatScope, toggleNewChatPanel, startDirectChat,
  selectThread, sendChatMessage, updateUnreadBadge
} from "./modules/messages.js";
import { startChatNotifications, stopChatNotifications } from "./modules/chat-notify.js";
import { downloadInvoice } from "./modules/exports.js";

Object.assign(window, {
  showPage, closeUserMenu, closeMobileMenu,
  handleLogin, handleRegister, logout, switchAuthTab,
  handleAvatarUpload, updateProfile, changePassword,
  submitRequest, deleteRequestById, exportRequests,
  openAddBatchModal, saveBatch, deleteBatchById, filterBatches, generateReport,
  closeModal,
  loadAdminPanel, setAdminTab, updateRequestStatus, toggleUserActive,
  approveRegistration, rejectRegistration, openEditUser, saveUserEdit,
  updateRequestEstimate,
  downloadInvoice,
  openSupportChat, openSupportDesk, setChatScope, toggleNewChatPanel, startDirectChat, selectThread, sendChatMessage,
  refreshWorkflow, selectWorkflowStage, acceptClientRequest, rejectClientRequest,
  openBatchEditor, saveWorkflowBatch, toggleWfStorageMonths, advanceBatch, sendBatchToStage, deleteWorkflowBatch,
  openScalesModal, submitScalesToLab, openLaboratoryModal, submitLaboratory,
  toggleLabParasiteCancel, cancelOrderParasites,
  downloadAccountingInvoice
});

function handleContactForm(e) {
  e.preventDefault();
  showToast("Спасибо! Мы свяжемся с вами.", "success");
  e.target.reset();
}

document.getElementById("userMenuBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeMobileMenu();
  document.getElementById("userDropdown")?.classList.toggle("hidden");
});

document.getElementById("menuBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("mobileMenu")?.classList.toggle("is-open");
  document.getElementById("userDropdown")?.classList.add("hidden");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#userMenuWrap")) closeUserMenu();
  if (!e.target.closest("#menuBtn") && !e.target.closest("#mobileMenu")) closeMobileMenu();
});

document.addEventListener("submit", (e) => {
  if (e.target.id === "contactForm") handleContactForm(e);
});

function setupAutoRefresh() {
  if (appState.autoRefreshId) clearInterval(appState.autoRefreshId);
  appState.autoRefreshId = setInterval(async () => {
    if (appState.currentPage === "requests" && getCurrentUser()) await loadUserRequests();
    if (appState.currentPage === "warehouse" && isStaff()) await loadBatches();
    if (appState.currentPage === "admin" && isAdmin()) await loadAdminPanel();
    if (appState.currentPage === "home") {
      await loadDashboard();
      renderHomeStats();
    }
    if (appState.currentPage === "monitoring" && isStaff()) await refreshWorkflow();
    if (getCurrentUser()) await updateUnreadBadge();
  }, 30000);
}

registerPageInit("home", async () => {
  await loadDashboard();
  renderHomeStats();
});
registerPageInit("profile", fillProfile);
registerPageInit("requests", initRequestsPage);
registerPageInit("warehouse", initWarehousePage);
registerPageInit("calculator", initCalculatorPage);
registerPageInit("analytics", initAnalyticsPage);
registerPageInit("admin", loadAdminPanel);
registerPageInit("messages", initMessagesPage);
registerPageInit("monitoring", initMonitoringPage);

window.addEventListener("hashchange", async () => {
  const raw = location.hash.replace("#", "") || "home";
  const page = raw.split("?")[0];
  if (page === "messages-support") {
    await showPage("messages");
    const { openSupportDesk } = await import("./modules/messages.js");
    await openSupportDesk();
  } else {
    await showPage(page);
  }
});

async function updateApiStatusBar() {
  const bar = document.getElementById("apiStatusBar");
  if (!bar) return;
  const { checkApiConnection } = await import("./core/api.js");
  const { ok } = await checkApiConnection();
  if (ok) {
    bar.classList.add("hidden");
    bar.textContent = "";
    return;
  }
  const onLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const tunnel = window.KURSAVSUH_CONFIG?.apiBaseUrl || "";
  bar.classList.remove("hidden");
  if (onLocal) {
    bar.innerHTML = `<i class="fas fa-plug-circle-xmark"></i> Нет связи с API. Запустите <code>Запуск-сайта.bat</code> и не закрывайте окно API.`;
  } else if (tunnel) {
    bar.innerHTML = `<i class="fas fa-plug-circle-xmark"></i> Нет связи с API. На ПК запустите <code>Запуск-сайта.bat</code>, не закрывайте API/tunnel, затем <b>Ctrl+F5</b> здесь. API: <code>${tunnel}</code>`;
  } else {
    bar.innerHTML = `<i class="fas fa-plug-circle-xmark"></i> Нет связи. Запустите <code>Запуск-сайта.bat</code> на ПК, затем Ctrl+F5.`;
  }
}

window.addEventListener("load", async () => {
  await initApiConfig();
  updateNavState();
  await updateApiStatusBar();
  await restoreSession();
  await loadDictionaries();
  try {
    await loadDashboard();
    const { apiFetch } = await import("./core/api.js");
    appState.batches = await apiFetch("/GrainBatches").catch(() => []);
  } catch { /* */ }
  if (getCurrentUser()) {
    await updateUnreadBadge();
    startChatNotifications();
  }
  const hash = (location.hash.replace("#", "") || "home").split("?")[0];
  if (hash === "messages-support") {
    await showPage("messages");
    const { openSupportDesk } = await import("./modules/messages.js");
    await openSupportDesk();
  } else {
    await showPage(hash);
  }
  setupAutoRefresh();
});
