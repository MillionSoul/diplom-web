import { buildApiBaseCandidates, LAST_API_BASE_KEY } from "./config.js";

function tunnelHeaders(base) {
  const h = {};
  if (base.includes("loca.lt")) {
    h["Bypass-Tunnel-Reminder"] = "true";
  }
  return h;
}

export function getApiBases() {
  if (window.location.hostname.endsWith("github.io")) {
    localStorage.removeItem(LAST_API_BASE_KEY);
  }

  const candidates = buildApiBaseCandidates();
  const saved = localStorage.getItem(LAST_API_BASE_KEY);

  if (saved && candidates.includes(saved)) {
    return [saved, ...candidates.filter((x) => x !== saved)];
  }
  return candidates;
}

async function probeBase(base) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${base}/health`, {
      signal: ctrl.signal,
      mode: "cors",
      cache: "no-store",
      headers: tunnelHeaders(base)
    });
    clearTimeout(t);
    return r.ok;
  } catch {
    clearTimeout(t);
    return false;
  }
}

export async function checkApiConnection() {
  const bases = getApiBases();
  if (!bases.length) {
    return { ok: false, reason: "no-api-url" };
  }
  for (const base of bases) {
    if (await probeBase(base)) {
      localStorage.setItem(LAST_API_BASE_KEY, base);
      return { ok: true, base };
    }
  }
  return { ok: false, reason: "unreachable" };
}

export async function apiFetch(endpoint, options = {}) {
  const bases = getApiBases();
  if (!bases.length) {
    throw new Error("API не настроен. Запустите Запуск-сайта.bat и дождитесь DONE.");
  }

  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...tunnelHeaders(base),
          ...(options.headers || {})
        },
        mode: "cors",
        cache: "no-store",
        ...options
      });
      if (!response.ok) {
        let message = "Ошибка API";
        try {
          const data = await response.json();
          message = data.message || data.error || data.title || data.Message || JSON.stringify(data);
        } catch {
          message = await response.text();
        }
        const err = new Error(message || `HTTP ${response.status}`);
        err.status = response.status;
        err.apiReached = true;
        throw err;
      }
      localStorage.setItem(LAST_API_BASE_KEY, base);
      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      if (error?.apiReached) throw error;
    }
  }

  const api = window.KURSAVSUH_CONFIG?.apiBaseUrl || "";
  const hint = api
    ? `Запустите Запуск-сайта.bat (ПК включён, окна API+tunnel открыты). Текущий API: ${api}`
    : "Запустите Запуск-сайта.bat и дождитесь DONE.";

  const raw = lastError?.message || "";
  if (raw === "Failed to fetch" || raw.includes("fetch") || raw.includes("abort")) {
    throw new Error(`Сервер недоступен. ${hint}`);
  }
  throw new Error(raw || `Сервер недоступен. ${hint}`);
}
