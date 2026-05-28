export function showToast(message, type = "info") {

  const container = document.getElementById("toastContainer");

  if (!container) return;

  const node = document.createElement("div");

  node.className = `toast ${type}`;

  node.textContent = message;

  container.appendChild(node);

  setTimeout(() => node.remove(), 3200);

}



export function roleLabel(role) {

  return ({

    admin: "Администратор",

    manager: "Менеджер",

    operator: "Оператор",

    client: "Клиент",

    user: "Пользователь"

  }[role] || role);

}



export function getServiceName(service) {

  return ({

    storage: "Хранение",

    drying: "Сушка",

    cleaning: "Очистка",

    shipment: "Отгрузка",

    combo: "Комплекс услуг"

  }[service] || service);

}



function resolveServiceFlags(item) {
  if (!item) return { cleaning: false, drying: false, storage: false };
  const isBatch = item.needsCleaning !== undefined || item.needsDrying !== undefined;
  let cleaning = isBatch ? !!item.needsCleaning : !!item.wantsCleaning;
  let drying = isBatch ? !!item.needsDrying : !!item.wantsDrying;
  let storage = isBatch
    ? Number(item.storageMonths) > 0
    : !!(item.wantsStorage || Number(item.storageMonths) > 0);
  if (!cleaning && !drying && !storage && item.serviceType) {
    if (item.serviceType === "cleaning") return { cleaning: true, drying: false, storage: false };
    if (item.serviceType === "drying") return { cleaning: false, drying: true, storage: false };
    if (item.serviceType === "storage") return { cleaning: false, drying: false, storage: true };
    if (item.serviceType === "combo") return { cleaning: true, drying: true, storage: true };
  }
  return { cleaning, drying, storage };
}



/** Бейджи заказанных услуг для оператора */

export function orderServicesHtml(item) {

  const f = resolveServiceFlags(item);

  const pills = [];

  if (f.cleaning) pills.push('<span class="service-pill service-pill-cleaning">Очистка</span>');

  if (f.drying) pills.push('<span class="service-pill service-pill-drying">Сушка</span>');

  if (f.storage) pills.push('<span class="service-pill service-pill-storage">Хранение</span>');

  if (!pills.length) return '<span class="text-gray-400">—</span>';

  return `<span class="service-pills">${pills.join("")}</span>`;

}



export function orderServicesText(item) {

  const f = resolveServiceFlags(item);

  const parts = [];

  if (f.cleaning) parts.push("Очистка");

  if (f.drying) parts.push("Сушка");

  if (f.storage) parts.push("Хранение");

  return parts.length ? parts.join(", ") : "—";

}



export function getStatusName(status) {

  return ({

    pending: "В ожидании",

    approved: "Одобрено",

    in_progress: "В работе",

    completed: "Выполнено",

    rejected: "Отклонено"

  }[status] || status);

}



export function statusBadge(status) {

  const colors = {

    pending: "badge-pending",

    approved: "badge-approved",

    in_progress: "badge-progress",

    completed: "badge-completed",

    rejected: "badge-rejected"

  };

  return `<span class="badge ${colors[status] || "badge-pending"}">${getStatusName(status)}</span>`;

}



let modalScrollY = 0;



export function openModal(id) {

  const el = document.getElementById(id);

  if (!el) return;

  modalScrollY = window.scrollY;

  document.body.classList.add("modal-open");

  document.body.style.top = `-${modalScrollY}px`;

  el.classList.add("active");

}



export function closeModal(id) {

  const el = document.getElementById(id);

  if (el) el.classList.remove("active");

  if (!document.querySelector(".modal.active")) {

    document.body.classList.remove("modal-open");

    document.body.style.top = "";

    window.scrollTo(0, modalScrollY);

  }

}



export function setLoading(containerId, show = true) {

  const el = document.getElementById(containerId);

  if (!el) return;

  el.classList.toggle("loading-overlay", show);

}

