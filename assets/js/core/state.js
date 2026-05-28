import { SESSION_KEY } from "./config.js";

function safeParse(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export const appState = {
  currentUser: safeParse(localStorage.getItem(SESSION_KEY)),
  grainTypes: [],
  facilities: [],
  batches: [],
  requests: [],
  users: [],
  dashboard: null,
  currentPage: "home",
  autoRefreshId: null,
  chartInstances: {},
  chatThreads: [],
  activeChatThreadId: null,
  chatNotifySnapshot: {}
};

export function getCurrentUser() { return appState.currentUser; }
export function isAdmin() { return getCurrentUser()?.role === "admin"; }
export function isStaff() {
  return ["admin", "manager", "operator"].includes(getCurrentUser()?.role);
}

export function persistUser(user) {
  appState.currentUser = user;
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}
