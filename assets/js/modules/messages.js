import { apiFetch } from "../core/api.js";
import { appState, getCurrentUser, isStaff } from "../core/state.js";
import { showToast } from "../core/ui.js";
import { showPage } from "../core/router.js";
import { avatarHtml, escapeHtml, formatChatTime } from "./chat-ui.js";
import { bindSearchInput, rowMatchesQuery, searchBarHtml } from "../core/search.js";

let activeThreadId = null;
let pollTimer = null;
/** direct | support */
let chatScope = "direct";
let chatSearchQuery = "";
let cachedMessages = [];

export function getChatScope() {
  return chatScope;
}

export function setChatScope(scope) {
  chatScope = scope === "support" ? "support" : "direct";
  activeThreadId = null;
  appState.activeChatThreadId = null;
  document.getElementById("chatEmpty")?.classList.remove("hidden");
  document.getElementById("chatActive")?.classList.add("hidden");
  updateChatTabsUi();
  updateSidebarForScope();
  loadThreads();
}

function updateChatTabsUi() {
  document.getElementById("chatTabDirect")?.classList.toggle("chat-mode-tab-active", chatScope === "direct");
  document.getElementById("chatTabSupport")?.classList.toggle("chat-mode-tab-active", chatScope === "support");
}

function updateSidebarForScope() {
  const staff = isStaff();
  const actions = document.getElementById("chatSidebarActions");
  const tabs = document.getElementById("chatModeTabs");
  const clientSupportBtn = document.getElementById("clientSupportBtn");
  const newChatBlock = document.getElementById("newChatBlock");

  if (tabs) {
    tabs.classList.toggle("hidden", !staff);
    tabs.classList.toggle("nav-hidden", !staff);
  }
  if (actions) actions.classList.toggle("hidden", staff && chatScope === "support");
  if (clientSupportBtn) clientSupportBtn.classList.toggle("hidden", staff);
  if (newChatBlock) newChatBlock.classList.toggle("hidden", staff && chatScope === "support");

  const hint = document.getElementById("chatScopeHint");
  if (hint) {
    hint.textContent = chatScope === "support"
      ? "Обращения клиентов в техподдержку"
      : "Личные диалоги с коллегами";
  }
}

function threadsQuery() {
  const user = getCurrentUser();
  if (!user) return "";
  if (isStaff()) {
    const scope = chatScope === "support" ? "support" : "direct";
    return `/Chat/threads?userId=${user.userId}&scope=${scope}`;
  }
  return `/Chat/threads?userId=${user.userId}`;
}

export async function initMessagesPage() {
  const user = getCurrentUser();
  if (!user) return showPage("login");

  const hash = location.hash || "";
  if (hash.includes("support") && isStaff()) chatScope = "support";
  else if (!isStaff()) chatScope = "direct";

  updateChatTabsUi();
  updateSidebarForScope();
  mountChatSearch();
  await loadThreads();
  await loadContacts();
  startPolling();
}

function mountChatSearch() {
  const mount = document.getElementById("chatSearchMount");
  if (!mount || document.getElementById("chatSearchInput")) return;
  mount.innerHTML = searchBarHtml("chatSearchInput", "Имя собеседника или текст сообщения…", "chatSearchClear");
  bindSearchInput("chatSearchInput", q => {
    chatSearchQuery = q;
    renderThreadsList();
    if (activeThreadId) renderMessagesArea(activeThreadId, false);
  }, "chatSearchClear");
}

function threadMatchesChatSearch(t) {
  return rowMatchesQuery([t.title, t.lastMessage, t.otherUserName], chatSearchQuery);
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (appState.currentPage === "messages") {
      await loadThreads(false);
      if (activeThreadId) await loadMessages(activeThreadId, false);
    }
  }, 8000);
}

export async function updateUnreadBadge(threadsPrefetched = null) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const threads = threadsPrefetched || await apiFetch(`/Chat/threads?userId=${user.userId}`);
    const direct = threads.filter(t => t.threadType === "direct");
    const total = direct.reduce((s, t) => s + (t.unreadCount || 0), 0);
    const badge = document.getElementById("navUnreadBadge");
    if (badge) {
      badge.textContent = total > 99 ? "99+" : String(total);
      badge.classList.toggle("hidden", total === 0);
    }
  } catch { /* */ }
}

export async function updateSupportBadge(threadsPrefetched = null) {
  if (!isStaff()) return;
  try {
    const user = getCurrentUser();
    const threads = threadsPrefetched || await apiFetch(`/Chat/threads?userId=${user.userId}&scope=support`);
    const total = threads.reduce((s, t) => s + (t.unreadCount || 0), 0);
    const badge = document.getElementById("navSupportBadge");
    const tabBadge = document.getElementById("supportTabUnread");
    const adminBadge = document.getElementById("adminSupportBadge");
    [badge, tabBadge, adminBadge].forEach(el => {
      if (!el) return;
      el.textContent = total > 99 ? "99+" : String(total);
      el.classList.toggle("hidden", total === 0);
    });
  } catch { /* */ }
}

export async function loadThreads(scroll = true) {
  const user = getCurrentUser();
  const list = document.getElementById("threadsList");
  if (!user || !list) return;

  try {
    appState.chatThreads = await apiFetch(threadsQuery());
    renderThreadsList();

    if (scroll) {
      await updateUnreadBadge();
      if (isStaff()) await updateSupportBadge();
    }
  } catch (err) {
    list.innerHTML = `<p class="text-red-600 text-sm p-3">${err.message}</p>`;
  }
}

function renderThreadsList() {
  const list = document.getElementById("threadsList");
  if (!list) return;
  const all = appState.chatThreads || [];
  const threads = all.filter(t => threadMatchesChatSearch(t));

  list.innerHTML = threads.length ? threads.map(t => `
      <button type="button" class="thread-item ${activeThreadId === t.threadId ? "thread-item-active" : ""}"
        onclick="selectThread(${t.threadId})">
        <div class="thread-item-row">
          ${avatarHtml(t.title, t.otherUserAvatarUrl, "chat-avatar-sm")}
          <div class="thread-item-main">
            <div class="thread-item-top">
              <span class="thread-title">${escapeHtml(t.title)}</span>
              ${t.unreadCount ? `<span class="thread-unread">${t.unreadCount}</span>` : ""}
            </div>
            <p class="thread-preview">${escapeHtml(t.lastMessage || "Нет сообщений")}</p>
            ${t.lastMessageAt ? `<span class="thread-time">${formatChatTime(t.lastMessageAt)}</span>` : ""}
          </div>
        </div>
      </button>`).join("")
    : `<p class="text-sm text-gray-500 p-3">${chatSearchQuery ? "Диалоги не найдены" : (chatScope === "support" ? "Обращений в поддержку пока нет" : "Диалогов пока нет")}</p>`;
}

export async function loadContacts() {
  const user = getCurrentUser();
  const sel = document.getElementById("newChatUser");
  if (!user || !sel) return;
  try {
    const contacts = await apiFetch(`/Chat/contacts?userId=${user.userId}`);
    const roleRu = { client: "Клиент", operator: "Оператор", manager: "Менеджер", admin: "Админ" };
    sel.innerHTML = '<option value="">Выберите собеседника</option>' +
      contacts.map(c => `<option value="${c.userId}">${c.fullName} (${roleRu[c.role] || c.role})</option>`).join("");
  } catch { /* */ }
}

export function toggleNewChatPanel() {
  document.getElementById("newChatPanel")?.classList.toggle("hidden");
}

export async function startDirectChat() {
  const user = getCurrentUser();
  const otherId = Number(document.getElementById("newChatUser")?.value);
  if (!otherId) return showToast("Выберите собеседника.", "info");
  try {
    const thread = await apiFetch("/Chat/threads", {
      method: "POST",
      body: JSON.stringify({ userId: user.userId, threadType: "direct", otherUserId: otherId })
    });
    chatScope = "direct";
    updateChatTabsUi();
    updateSidebarForScope();
    document.getElementById("newChatPanel")?.classList.add("hidden");
    await loadThreads();
    selectThread(thread.threadId);
  } catch (err) {
    showToast(err.message, "error");
  }
}

/** Клиент: свой чат с поддержкой */
export async function openSupportChat() {
  const user = getCurrentUser();
  if (isStaff()) {
    openSupportDesk();
    return;
  }
  try {
    const thread = await apiFetch("/Chat/threads", {
      method: "POST",
      body: JSON.stringify({ userId: user.userId, threadType: "support" })
    });
    await showPage("messages");
    chatScope = "direct";
    await loadThreads();
    selectThread(thread.threadId);
  } catch (err) {
    showToast(err.message, "error");
  }
}

/** Админ/оператор: очередь техподдержки */
export async function openSupportDesk() {
  if (!isStaff()) return openSupportChat();
  await showPage("messages");
  setChatScope("support");
}

export function selectThread(threadId) {
  activeThreadId = threadId;
  appState.activeChatThreadId = threadId;
  const t = (appState.chatThreads || []).find(x => x.threadId === threadId);
  document.getElementById("chatEmpty")?.classList.add("hidden");
  document.getElementById("chatActive")?.classList.remove("hidden");

  const header = document.getElementById("chatHeaderInner");
  if (header) {
    header.innerHTML = `
      ${avatarHtml(t?.title, t?.otherUserAvatarUrl, "chat-avatar-md")}
      <div>
        <h2 id="chatTitle">${escapeHtml(t?.title || "Диалог")}</h2>
        ${t?.threadType === "support" && isStaff() ? `<p class="chat-header-sub">Обращение в техподдержку</p>` : ""}
      </div>`;
  } else {
    const titleEl = document.getElementById("chatTitle");
    if (titleEl) titleEl.textContent = t?.title || "Диалог";
  }

  loadMessages(threadId);
  loadThreads(false);
}

export async function loadMessages(threadId, scroll = true) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    cachedMessages = await apiFetch(`/Chat/threads/${threadId}/messages?userId=${user.userId}`);
    renderMessagesArea(threadId, scroll);

    const all = await apiFetch(`/Chat/threads?userId=${user.userId}`);
    appState.chatNotifySnapshot = Object.fromEntries(
      all.map(t => [String(t.threadId), `${t.threadId}:${t.unreadCount}:${t.lastMessageAt}:${t.lastMessage}`])
    );
    await updateUnreadBadge(all);
    if (isStaff()) await updateSupportBadge(all);
  } catch (err) {
    const area = document.getElementById("messagesArea");
    if (area) area.innerHTML = `<p class="text-red-600 text-sm">${err.message}</p>`;
  }
}

function renderMessagesArea(threadId, scroll = true) {
  const user = getCurrentUser();
  const area = document.getElementById("messagesArea");
  if (!area || !user) return;

  const filtered = cachedMessages.filter(m =>
    rowMatchesQuery([m.senderName, m.body], chatSearchQuery));

  area.innerHTML = filtered.length ? filtered.map(m => {
    const mine = m.senderId === user.userId;
    return `
        <div class="msg-row ${mine ? "msg-row-mine" : "msg-row-other"}">
          ${!mine ? avatarHtml(m.senderName, m.senderAvatarUrl, "chat-avatar-xs") : ""}
          <div class="msg-bubble ${mine ? "msg-mine" : "msg-other"}">
            ${!mine ? `<span class="msg-sender">${escapeHtml(m.senderName)}</span>` : ""}
            <p>${escapeHtml(m.body)}</p>
            <span class="msg-time">${formatChatTime(m.sentAt)}</span>
          </div>
          ${mine ? avatarHtml(m.senderName, m.senderAvatarUrl, "chat-avatar-xs") : ""}
        </div>`;
  }).join("")
    : `<p class="text-sm text-gray-500 p-4 text-center">${chatSearchQuery ? "Сообщения не найдены" : "Нет сообщений"}</p>`;

  if (scroll) area.scrollTop = area.scrollHeight;
}

export async function sendChatMessage(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const input = document.getElementById("messageInput");
  if (!activeThreadId || !input?.value.trim()) return;

  try {
    await apiFetch(`/Chat/threads/${activeThreadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ userId: user.userId, body: input.value.trim() })
    });
    input.value = "";
    await loadMessages(activeThreadId);
    await loadThreads(false);
  } catch (err) {
    showToast(err.message, "error");
  }
}
