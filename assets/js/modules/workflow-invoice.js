import { apiFetch } from "../core/api.js";
import { showToast } from "../core/ui.js";

/** Бухгалтерская накладная Excel с фиксированными ширинами колонок */
export async function downloadAccountingInvoice(batchId) {
  try {
    const inv = await apiFetch(`/Workflow/batch/${batchId}/invoice`);
    const rows = [
      ["Накладная для бухгалтерии", ""],
      ["Партия", inv.batchNumber],
      ["Предприятие / организация", inv.organization],
      ["Культура (факт)", inv.grainName],
      ["Культура (заявлено)", inv.declaredGrainName || inv.grainName],
      ["Масса, т (факт)", inv.weightTons],
      ["Масса, т (заявлено)", inv.declaredVolumeTons ?? inv.weightTons],
      ["Влажность % (факт)", inv.moisturePercent],
      ["Влажность % (заявлено)", inv.declaredMoisturePercent ?? inv.moisturePercent],
      ["", ""],
      ["Услуга: очистка, ₽", inv.costCleaning],
      ["Услуга: сушка, ₽", inv.costDrying],
      ["Услуга: хранение, ₽", inv.costStorage],
      ["ИТОГО, ₽", inv.costTotal],
      ["", ""],
      ["Дата", new Date(inv.receiptDate).toLocaleDateString("ru-RU")]
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 32 }, { wch: 28 }];
    ws["!rows"] = rows.map((_, i) => ({ hpt: i === 0 ? 22 : 18 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Накладная");

    const titleRow = 0;
    if (ws["A1"]) {
      ws["A1"].s = { font: { bold: true, sz: 14 } };
    }
    const totalRow = rows.findIndex(r => r[0] === "ИТОГО, ₽");
    if (totalRow >= 0 && ws[`A${totalRow + 1}`]) {
      ws[`A${totalRow + 1}`].s = { font: { bold: true } };
      ws[`B${totalRow + 1}`].s = { font: { bold: true } };
    }

    XLSX.writeFile(wb, `nakladnaya_${inv.batchNumber}_${Date.now()}.xlsx`, {
      bookType: "xlsx",
      cellStyles: true
    });
    showToast("Накладная Excel сохранена.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}
