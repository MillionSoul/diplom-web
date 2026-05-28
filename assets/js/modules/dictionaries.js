import { apiFetch } from "../core/api.js";
import { appState } from "../core/state.js";

export async function loadDictionaries() {
  try {
    const [grainTypes, facilities] = await Promise.all([
      apiFetch("/GrainTypes"),
      apiFetch("/StorageFacilities")
    ]);
    appState.grainTypes = grainTypes;
    appState.facilities = facilities;
  } catch (err) {
    console.error(err);
  }
}

export function fillGrainSelect(selectId, includeEmpty = true) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const options = appState.grainTypes.map(g =>
    `<option value="${g.grainTypeId}" data-moisture="${g.baseMoisture}" data-gost="${g.gostStandard || ""}">${g.grainName}</option>`
  ).join("");
  el.innerHTML = (includeEmpty ? '<option value="">Выберите культуру</option>' : "") + options;
}

export function fillFacilitySelect(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '<option value="">Выберите силос</option>' +
    appState.facilities.map(f => {
      const free = Math.max(0, Number(f.capacityTons) - Number(f.currentOccupancy));
      return `<option value="${f.facilityId}" data-free="${free}">${f.facilityNumber} — свободно ${free.toLocaleString("ru-RU")} т</option>`;
    }).join("");
}

export function getGrainById(id) {
  return appState.grainTypes.find(g => g.grainTypeId === Number(id));
}
