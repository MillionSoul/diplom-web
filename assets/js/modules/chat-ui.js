/** Аватар и разметка чата */
export function avatarUrl(name, imageUrl, size = 96) {
  if (imageUrl?.trim()) return imageUrl.trim();
  const n = encodeURIComponent(name || "User");
  return `https://ui-avatars.com/api/?name=${n}&background=d97706&color=fff&size=${size}`;
}

export function avatarHtml(name, imageUrl, sizeClass = "chat-avatar-md") {
  const src = avatarUrl(name, imageUrl);
  const alt = String(name || "").replace(/"/g, "");
  return `<img src="${src}" alt="${alt}" class="chat-avatar ${sizeClass}" loading="lazy">`;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatChatTime(iso) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}
