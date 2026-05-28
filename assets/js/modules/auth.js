import { apiFetch } from "../core/api.js";
import { persistUser, getCurrentUser, isAdmin, isStaff } from "../core/state.js";
import { showToast } from "../core/ui.js";
import { showPage, updateNavState } from "../core/router.js";

export function switchAuthTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("loginForm")?.classList.toggle("hidden", !isLogin);
  document.getElementById("registerForm")?.classList.toggle("hidden", isLogin);
  document.getElementById("tabLoginBtn").className = `flex-1 py-2 rounded-md text-sm font-semibold ${isLogin ? "bg-white shadow" : "text-gray-600"}`;
  document.getElementById("tabRegisterBtn").className = `flex-1 py-2 rounded-md text-sm font-semibold ${!isLogin ? "bg-white shadow" : "text-gray-600"}`;
}

export async function handleLogin(e) {
  e.preventDefault();
  try {
    const user = await apiFetch("/Auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("loginUsername").value.trim(),
        password: document.getElementById("loginPassword").value
      })
    });
    persistUser(user);
    updateNavState();
    const { startChatNotifications } = await import("./chat-notify.js");
    startChatNotifications();
    showToast(`Добро пожаловать, ${user.fullName}`, "success");
    const page = isAdmin() ? "admin" : isStaff() ? "monitoring" : "requests";
    showPage(page);
  } catch (err) {
    showToast(`Ошибка входа: ${err.message}`, "error");
  }
}

export async function handleRegister(e) {
  e.preventDefault();
  try {
    const res = await apiFetch("/Auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("registerUsername").value.trim(),
        fullName: document.getElementById("registerFullName").value.trim(),
        organization: document.getElementById("registerOrganization").value.trim(),
        email: document.getElementById("registerEmail").value.trim() || null,
        phone: document.getElementById("registerPhone").value.trim() || null,
        password: document.getElementById("registerPassword").value
      })
    });
    showToast(res?.message || "Заявка отправлена. Ожидайте одобрения администратора.", "success");
    e.target.reset();
    switchAuthTab("login");
  } catch (err) {
    const msg = err.message || "Неизвестная ошибка";
    if (msg.includes("занят") || msg.includes("используется")) {
      showToast(msg, "error");
    } else {
      showToast(`Ошибка регистрации: ${msg}`, "error");
    }
  }
}

export function logout() {
  persistUser(null);
  updateNavState();
  import("./chat-notify.js").then(m => m.stopChatNotifications());
  showPage("home");
}

export async function restoreSession() {
  const user = getCurrentUser();
  if (!user?.userId) return;
  try {
    const fresh = await apiFetch(`/Users/${user.userId}`);
    persistUser(fresh);
    updateNavState();
    const { startChatNotifications } = await import("./chat-notify.js");
    startChatNotifications();
  } catch {
    updateNavState();
    showToast("Профиль недоступен, локальная сессия сохранена.", "info");
  }
}
