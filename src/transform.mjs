import * as XLSX from "xlsx";
import { buildOutputRows, normalize, OUTPUT_HEADERS } from "./transform-core.mjs";

const REQUIRED = {
  product: ["товары", "товар"],
  model: ["модель"],
  sku: ["sku"],
  article: ["артикул"],
  day: ["день"],
  amount: ["заказано на сумму (по цене реализации)", "заказано на сумму"],
  impressions: ["показы всего", "показы, всего"],
  uniqueCardVisitors: ["уникальные посетители с просмотром карточки товара", "уникальные посетители карточки товара"],
  cartAdds: ["добавления в корзину всего", "в корзину, всего"],
  orderedUnits: ["заказано товаров"]
};

function findHeaderIndex(headers, aliases) {
  for (const alias of aliases) { const exact = headers.findIndex((header) => header === alias); if (exact >= 0) return exact; }
  for (const alias of aliases) { const partial = headers.findIndex((header) => header.includes(alias)); if (partial >= 0) return partial; }
  return -1;
}
function isDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return true;
  if (typeof value === "number" && Number.isFinite(value)) return value > 30000;
  const text = String(value ?? "").trim();
  return /^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}$/.test(text) || /^\d{4}-\d{2}-\d{2}/.test(text);
}

export function extractRecords(matrix) {
  const headerRow = matrix.findIndex((row) => { const normalized = row.map(normalize); return normalized.includes("товары") && normalized.includes("sku") && normalized.includes("артикул"); });
  if (headerRow < 0) throw new Error("Не найдена строка заголовков отчёта Ozon.");
  const top = matrix[headerRow] ?? [];
  const bottom = matrix[headerRow + 1] ?? [];
  const width = Math.max(top.length, bottom.length);
  const headers = Array.from({ length: width }, (_, index) => normalize(bottom[index] || top[index]));
  const indexes = {};
  for (const [key, aliases] of Object.entries(REQUIRED)) {
    indexes[key] = findHeaderIndex(headers, aliases);
    if (indexes[key] < 0) throw new Error(`В отчёте отсутствует обязательный столбец: ${aliases[0]}. Лист не обновлён.`);
  }
  const records = [];
  for (const row of matrix.slice(headerRow + 2)) {
    if (!isDateValue(row[indexes.day])) continue;
    const sku = row[indexes.sku]; const article = row[indexes.article];
    if ((sku === null || sku === undefined || sku === "") && !String(article ?? "").trim()) continue;
    records.push({ product: row[indexes.product], model: row[indexes.model], sku, article, day: row[indexes.day], amount: row[indexes.amount], impressions: row[indexes.impressions], uniqueCardVisitors: row[indexes.uniqueCardVisitors], cartAdds: row[indexes.cartAdds], orderedUnits: row[indexes.orderedUnits] });
  }
  if (!records.length) throw new Error("В отчёте Ozon не найдено ни одной строки товар × день.");
  return records;
}

export function transformWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellNF: false, cellStyles: false, dense: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("В файле Ozon нет листов.");
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
  const records = extractRecords(matrix);
  const rows = buildOutputRows(records);
  const dates = rows.map((row) => row[5]).filter(Boolean).sort((a, b) => { const [ad, am, ay] = a.split(".").map(Number); const [bd, bm, by] = b.split(".").map(Number); return Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd); });
  return { values: [OUTPUT_HEADERS, ...rows], rowCount: rows.length, firstDate: dates[0], lastDate: dates.at(-1) };
}
