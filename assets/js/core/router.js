import { appState, getCurrentUser, isAdmin, isStaff } from "./state.js";
import { showToast } from "./ui.js";

const PAGE_INITS = {};

export function registerPageInit(pageId, fn) {
  PAGE_INITS[pageId] = fn;
}

export function closeUserMenu() {
  document.getElementById("userDropdown")?.classList.add("hidden");
}

export function closeMobileMenu() {
  document.getElementById("mobileMenu")?.classList.remove("is-open");
}

export async function showPage(pageId) {
  const authPages = ["requests", "profile", "messages"];
  const staffPages = ["warehouse", "analytics", "monitoring", "processes", "about"];
  const adminOnlyPages = ["admin"];

  if (authPages.includes(pageId) && !getCurrentUser()) {
    showToast("Сначала войдите в систему.", "info");
    pageId = "login";
  }
  if (staffPages.includes(pageId) && !isStaff()) {
    showToast("Раздел доступен только для оператора или администратора.", "error");
    pageId = getCurrentUser() ? "requests" : "home";
  }
  if (adminOnlyPages.includes(pageId) && !isAdmin()) {
    showToast("Центр управления доступен только администратору.", "error");
    pageId = isStaff() ? "monitoring" : getCurrentUser() ? "requests" : "home";
  }

  const root = document.getElementById("page-root");
  if (!root) return;

  root.innerHTML = `<div class="page-loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>`;
  closeUserMenu();
  closeMobileMenu();

  try {
    const res = await fetch(`pages/${pageId}.html`);
    if (!res.ok) throw new Error(`Страница ${pageId} не найдена`);
    const html = await res.text();
    root.innerHTML = `<main id="${pageId}" class="page-section active">${html}</main>`;
  } catch (err) {
    root.innerHTML = `<main class="page-section active p-20 text-center text-red-600">${err.message}</main>`;
    return;
  }

  document.querySelectorAll("[data-nav]").forEach(link => {
    link.classList.toggle("nav-active", link.dataset.nav === pageId);
  });

  window.scrollTo(0, 0);
  appState.currentPage = pageId;
  history.replaceState({ page: pageId }, "", `#${pageId}`);

  const init = PAGE_INITS[pageId];
  if (init) await init();
}

export function updateNavState() {
  const user = getCurrentUser();
  document.body.classList.toggle("logged-in", !!user);

  const label = document.getElementById("userMenuLabel");

  if (user) {
    if (label) label.textContent = user.fullName?.split(" ")[0] || user.username;
    closeMobileMenu();
  } else {
    closeUserMenu();
  }

  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("nav-hidden", !isAdmin());
  });
  document.querySelectorAll(".staff-only").forEach(el => {
    el.classList.toggle("nav-hidden", !isStaff());
  });
  document.querySelectorAll(".client-only").forEach(el => {
    el.classList.toggle("nav-hidden", !user || isStaff());
  });
  document.body.classList.toggle("role-admin", !!user && isAdmin());
  document.body.classList.toggle("role-client", !!user && user.role === "client");
}
