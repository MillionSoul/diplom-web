/** API base URL resolution */

function normalizeApiBase(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

function isGitHubPages() {
  return window.location.hostname.endsWith("github.io");
}

export function buildApiBaseCandidates() {
  const { protocol, hostname, port } = window.location;
  const local = hostname === "localhost" || hostname === "127.0.0.1";

  const fromQuery = new URLSearchParams(window.location.search).get("apiBaseUrl");
  const fromConfig = window.KURSAVSUH_CONFIG?.apiBaseUrl;

  const preferred = [normalizeApiBase(fromQuery), normalizeApiBase(fromConfig)].filter(Boolean);
  const unique = [...new Set(preferred)];

  if (isGitHubPages()) {
    return unique;
  }

  const localFallbacks = [
    "http://127.0.0.1:5090/api",
    "http://localhost:5090/api"
  ];

  if (protocol === "file:") return [...unique, ...localFallbacks, "/api"];
  if (local) return ["/api", ...unique, ...localFallbacks];
  return [...unique, "/api", ...localFallbacks];
}

export const LAST_API_BASE_KEY = "lastApiBase";
export const SESSION_KEY = "currentUserProfile";
