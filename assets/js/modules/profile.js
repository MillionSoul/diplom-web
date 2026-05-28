import { apiFetch } from "../core/api.js";
import { persistUser, getCurrentUser } from "../core/state.js";
import { showToast, roleLabel } from "../core/ui.js";

export function fillProfile() {
  const user = getCurrentUser();
  if (!user) return;
  const fields = {
    profileNameCard: user.fullName || "—",
    profileRoleCard: roleLabel(user.role),
    profileFullName: user.fullName || "",
    profileOrganization: user.organization || "",
    profileUsername: user.username || "",
    profileEmail: user.email || "",
    profilePhone: user.phone || "",
    profileImageUrl: user.profileImageUrl || ""
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el[id === "profileNameCard" || id === "profileRoleCard" ? "textContent" : "value"] = val;
  });
  const avatar = document.getElementById("profileAvatar");
  if (avatar) {
    avatar.src = user.profileImageUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&background=F59E0B&color=fff&size=160`;
  }
}

export async function handleAvatarUpload(event) {
  const user = getCurrentUser();
  if (!user) return;
  const file = event.target.files?.[0];
  if (!file?.type.startsWith("image/")) {
    showToast("Выберите файл изображения.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const dataUrl = String(reader.result || "");
      document.getElementById("profileAvatar").src = dataUrl;
      document.getElementById("profileImageUrl").value = dataUrl;
      await apiFetch(`/Users/${user.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ profileImageUrl: dataUrl })
      });
      persistUser({ ...user, profileImageUrl: dataUrl });
      showToast("Аватар обновлен.", "success");
    } catch (err) {
      showToast(`Ошибка: ${err.message}`, "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsDataURL(file);
}

export async function updateProfile(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;
  try {
    const dto = {
      fullName: document.getElementById("profileFullName").value.trim(),
      organization: document.getElementById("profileOrganization")?.value?.trim() || null,
      email: document.getElementById("profileEmail").value.trim() || null,
      phone: document.getElementById("profilePhone").value.trim() || null,
      profileImageUrl: document.getElementById("profileImageUrl").value.trim() || null
    };
    await apiFetch(`/Users/${user.userId}`, { method: "PATCH", body: JSON.stringify(dto) });
    persistUser({ ...user, ...dto });
    fillProfile();
    showToast("Профиль обновлен.", "success");
  } catch (err) {
    showToast(`Ошибка: ${err.message}`, "error");
  }
}

export async function changePassword(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;
  try {
    await apiFetch(`/Users/${user.userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        oldPasswordHash: document.getElementById("oldPassword").value,
        newPasswordHash: document.getElementById("newPassword").value
      })
    });
    showToast("Пароль изменен.", "success");
    e.target.reset();
  } catch (err) {
    showToast(`Ошибка: ${err.message}`, "error");
  }
}
