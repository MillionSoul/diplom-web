import { fillGrainSelect, getGrainById } from "./dictionaries.js";

import { showPage } from "../core/router.js";



export const TARIFFS = {

  storagePerTonMonth: 150,

  dryingPerPointTon: 120,

  cleaningPerTon: 85,

};



export function getSelectedRequestServices() {

  return {

    wantsCleaning: !!document.getElementById("svcCleaning")?.checked,

    wantsDrying: !!document.getElementById("svcDrying")?.checked,

    wantsStorage: !!document.getElementById("svcStorage")?.checked,

  };

}



/** Расчёт стоимости при подаче заявки (одна или несколько услуг) */

export function estimateForRequest({ wantsCleaning, wantsDrying, wantsStorage, grain, volumeTons, moisturePercent, storageMonths = 3 }) {

  const volume = Math.max(0, Number(volumeTons) || 0);

  const moisture = Number(moisturePercent) || (grain ? Number(grain.baseMoisture) : 14);

  const baseMoisture = grain ? Number(grain.baseMoisture) : 14;

  const months = Math.max(1, Number(storageMonths) || 3);

  const lines = [];

  let total = 0;

  const warnings = [];



  if (volume <= 0) {

    return { total: 0, lines: ["Укажите объём партии, т"], warnings: [] };

  }



  if (!wantsCleaning && !wantsDrying && !wantsStorage) {

    return { total: 0, lines: ["Отметьте хотя бы одну услугу"], warnings: [] };

  }



  if (wantsStorage) {

    let price = TARIFFS.storagePerTonMonth * volume * months;

    if (moisture > baseMoisture) {

      price *= 1 + ((moisture - baseMoisture) * 0.04);

      warnings.push(`Влажность выше базиса (${baseMoisture}%). Учтена доплата за кондиционирование.`);

    }

    total += price;

    lines.push(`<span class="estimate-tag estimate-tag-storage">Хранение</span>: ${volume} т × ${months} мес. × ${TARIFFS.storagePerTonMonth} ₽/т/мес`);

  }



  if (wantsDrying) {

    const target = baseMoisture;

    const reduction = Math.max(0, moisture - target);

    const dryingCost = reduction * TARIFFS.dryingPerPointTon * volume;

    total += dryingCost;

    const hours = Math.ceil((volume / 12) * Math.max(1, reduction));

    lines.push(`<span class="estimate-tag estimate-tag-drying">Сушка</span>: снижение влажности на ${reduction.toFixed(1)} п.п. × ${volume} т`);

    lines.push(`Ориентировочное время: ~${hours} ч`);

    if (reduction < 0.5) warnings.push("Влажность уже близка к базису — сушка может не потребоваться.");

  }



  if (wantsCleaning) {

    total += TARIFFS.cleaningPerTon * volume;

    lines.push(`<span class="estimate-tag estimate-tag-cleaning">Очистка</span>: ${volume} т × ${TARIFFS.cleaningPerTon} ₽/т`);

  }



  return {

    total: Math.round(total),

    lines,

    warnings,

    summary: total > 0 ? `Ориентировочно: ${Math.round(total).toLocaleString("ru-RU")} ₽` : ""

  };

}



export function initCalculatorPage() {

  showPage("requests");

}



export function updateRequestEstimate() {

  const services = getSelectedRequestServices();

  const grain = getGrainById(document.getElementById("requestGrain")?.value);

  const volumeTons = document.getElementById("requestVolume")?.value;

  const moisturePercent = document.getElementById("requestMoisture")?.value;

  const storageMonths = document.getElementById("requestStorageMonths")?.value;



  const panel = document.getElementById("requestEstimatePanel");

  const priceEl = document.getElementById("requestEstimatePrice");

  const linesEl = document.getElementById("requestEstimateLines");

  const warnEl = document.getElementById("requestEstimateWarn");

  const storageField = document.getElementById("requestStorageMonthsWrap");



  if (storageField) storageField.classList.toggle("hidden", !services.wantsStorage);



  if (!panel) return;



  const est = estimateForRequest({ ...services, grain, volumeTons, moisturePercent, storageMonths });



  if (priceEl) priceEl.textContent = est.total > 0 ? `${est.total.toLocaleString("ru-RU")} ₽` : "—";

  if (linesEl) {

    linesEl.innerHTML = est.lines.map(l => `<li class="estimate-line">${l}</li>`).join("") || "<li>Заполните поля заявки</li>";

  }

  if (warnEl) {

    warnEl.innerHTML = est.warnings.map(w => `<p class="alert alert-warn text-sm">${w}</p>`).join("");

    warnEl.classList.toggle("hidden", !est.warnings.length);

  }

  panel.classList.remove("hidden");

}



export function buildEstimateNote() {

  const grain = getGrainById(document.getElementById("requestGrain")?.value);

  const est = estimateForRequest({

    ...getSelectedRequestServices(),

    grain,

    volumeTons: document.getElementById("requestVolume")?.value,

    moisturePercent: document.getElementById("requestMoisture")?.value,

    storageMonths: document.getElementById("requestStorageMonths")?.value

  });

  if (!est.total) return "";

  const plain = est.lines.map(l => l.replace(/<[^>]+>/g, "").trim());

  return `[Расчёт: ~${est.total.toLocaleString("ru-RU")} ₽] ${plain.join("; ")}`;

}

