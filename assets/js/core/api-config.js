/** Load fresh API URL on GitHub Pages (fixes stale tunnel in cache) */

export async function initApiConfig() {
  const q = new URLSearchParams(window.location.search).get("apiBaseUrl");
  if (q) {
    window.KURSAVSUH_CONFIG = { apiBaseUrl: q.trim() };
    localStorage.removeItem("lastApiBase");
    return;
  }

  if (!window.location.hostname.endsWith("github.io")) return;

  localStorage.removeItem("lastApiBase");
  localStorage.removeItem("manualApiBase");

  try {
    const jsonUrl = new URL("api-url.json", window.location.href);
    jsonUrl.searchParams.set("t", String(Date.now()));
    const r = await fetch(jsonUrl, { cache: "no-store", mode: "cors" });
    if (!r.ok) return;
    const data = await r.json();
    if (data?.apiBaseUrl) {
      window.KURSAVSUH_CONFIG = { apiBaseUrl: String(data.apiBaseUrl).trim() };
    }
  } catch {
    /* deploy-config fallback */
  }
}
