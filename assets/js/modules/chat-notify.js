import { apiFetch } from "../core/api.js";
import { appState, getCurrentUser } from "../core/state.js";
import { showPage } from "../core/router.js";
import { avatarHtml, escapeHtml } from "./chat-ui.js";

let pollId = null;
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { /* */ }
  }
  return audioCtx;
}

export function unlockChatSound() {
  const ctx = ensureAudio();
  if (ctx?.state === "suspended") ctx.resume();
}

export function playChatSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* */ }
}

function snapshotKey(t) {
  return `${t.threadId}:${t.unreadCount || 0}:${t.lastMessageAt || ""}:${t.lastMessage || ""}`;
}

export function showIncomingChatPopup(thread) {
  const stack = document.getElementById("chatNotifyStack");
  if (!stack) return;

  const card = document.createElement("button");
  card.type = "button";
  card.className = "chat-notify-card";
  card.innerHTML = `
    ${avatarHtml(thread.title, thread.otherUserAvatarUrl, "chat-avatar-sm")}
    <div class="chat-notify-body">
      <strong>${escapeHtml(thread.title)}</strong>
      <p>${escapeHtml(thread.lastMessage || "Новое сообщение")}</p>
    </div>
    <span class="chat-notify-close" aria-label="Закрыть">&times;</span>`;

  const close = (e) => {
    e?.stopPropagation();
    card.remove();
  };
  card.querySelector(".chat-notify-close")?.addEventListener("click", close);
  card.addEventListener("click", () => {
    close();
    import("./messages.js").then(m => {
      if (thread.threadType === "support" && ["admin", "manager", "operator"].includes(getCurrentUser()?.role)) {
        m.openSupportDesk();
      } else {
        showPage("messages");
        m.selectThread(thread.threadId);
      }
    });
  });

  stack.appendChild(card);
  setTimeout(() => card.classList.add("is-visible"), 10);
  setTimeout(() => card.remove(), 12000);
}

async function pollChatNotifications() {
  const user = getCurrentUser();
  if (!user?.userId) return;

  try {
    const threads = await apiFetch(`/Chat/threads?userId=${user.userId}`);
    const prev = appState.chatNotifySnapshot || {};
    const next = {};

    for (const t of threads) {
      const key = String(t.threadId);
      next[key] = snapshotKey(t);

      const old = prev[key];
      const isNew = old && old !== next[key];
      const hasUnread = (t.unreadCount || 0) > 0;

      if (!isNew || !hasUnread) continue;

      const onMessagesPage = appState.currentPage === "messages";
      const viewingThis = onMessagesPage && appState.activeChatThreadId === t.threadId;
      if (viewingThis) continue;

      if (t.lastSenderId === user.userId) continue;

      playChatSound();
      showIncomingChatPopup(t);
    }

    appState.chatNotifySnapshot = next;
    const { updateUnreadBadge, updateSupportBadge } = await import("./messages.js");
    await updateUnreadBadge(threads);
    if (["admin", "manager", "operator"].includes(user.role)) {
      await updateSupportBadge(threads);
    }
  } catch { /* API off */ }
}

export function startChatNotifications() {
  stopChatNotifications();
  document.addEventListener("click", unlockChatSound, { once: true });
  pollChatNotifications();
  pollId = setInterval(pollChatNotifications, 6000);
}

export function stopChatNotifications() {
  if (pollId) clearInterval(pollId);
  pollId = null;
}
