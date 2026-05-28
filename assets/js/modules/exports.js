import { appState, getCurrentUser } from "../core/state.js";
import { showToast, getStatusName, orderServicesText } from "../core/ui.js";

export function exportDataset(filenameBase, rows, format, title) {
  if (!rows.length) {
    showToast("Нет данных для выгрузки.", "info");
    return;
  }

  if (format === "txt") {
    const headers = Object.keys(rows[0]);
    let txt = `${title}\n${"=".repeat(title.length)}\n\n`;
    txt += headers.join(" | ") + "\n";
    txt += rows.map(r => headers.map(h => String(r[h] ?? "")).join(" | ")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    a.download = `${filenameBase}.txt`;
    a.click();
    showToast("TXT сформирован.", "success");
    return;
  }

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filenameBase}.xlsx`);
    showToast("Excel сформирован.", "success");
    return;
  }

  if (format === "pdf") {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(title, 14, 14);
    doc.autoTable({
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.keys(rows[0]).map(k => String(r[k] ?? ""))),
      startY: 20,
      styles: { fontSize: 8 }
    });
    doc.save(`${filenameBase}.pdf`);
    showToast("PDF сформирован.", "success");
  }
}

export function exportRequests(format, scope) {
  const rows = (appState.requests || []).map(r => ({
    "ID": r.requestId,
    "Дата": new Date(r.requestDate).toLocaleDateString("ru-RU"),
    "Предприятие": r.organization || r.userName || getCurrentUser()?.organization || getCurrentUser()?.fullName || "-",
    "Услуги": orderServicesText(r),
    "Культура": r.grainTypeName || r.grainTypeId,
    "Объем, т": r.volumeTons,
    "Статус": getStatusName(r.status)
  }));
  exportDataset(`${scope}_requests_${Date.now()}`, rows, format, "Отчет по заявкам");
}

export function downloadInvoice(requestId) {
  const req = (appState.requests || []).find(x => x.requestId === requestId);
  if (!req) {
    showToast("Заявка не найдена.", "error");
    return;
  }
  exportDataset(`invoice_${req.requestId}`, [{
    "Накладная №": `INV-${req.requestId}`,
    "Дата": new Date(req.requestDate).toLocaleDateString("ru-RU"),
    "Предприятие": req.organization || req.userName || getCurrentUser()?.organization || getCurrentUser()?.fullName || "-",
    "Услуги": orderServicesText(req),
    "Культура": req.grainTypeName || req.grainTypeId,
    "Объем, т": req.volumeTons,
    "Статус": getStatusName(req.status)
  }], "pdf", `Накладная #${req.requestId}`);
}
