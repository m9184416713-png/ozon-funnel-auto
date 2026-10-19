export const OUTPUT_HEADERS = [
  "Тип товара",
  "Товары",
  "Модель",
  "Ozon ID",
  "Артикул",
  "День",
  "Заказано на сумму",
  "Заказано товаров",
  "Отменено товаров",
  "Уникальные посетители, всего",
  "Уникальные посетители с просмотром карточки товара",
  "Конверсия в корзину, общая",
  "Конверсия в корзину из карточки товара",
  "Конверсия в корзину из поиска или каталога",
  "В корзину, всего",
  "Доставлено товаров",
  "Показы, всего",
  "Уникальные посетители с просмотром в поиске или каталоге",
  "Возвращено товаров"
];

export function normalize(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value)
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/[₽%]/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.+-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value) {
  let date;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    date = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    date = new Date(epoch + Math.round(value * 86400000));
  } else {
    const text = String(value ?? "").trim();
    const ru = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
    if (ru) return `${ru[1].padStart(2, "0")}.${ru[2].padStart(2, "0")}.${ru[3]}`;
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
    date = new Date(text);
  }
  if (!date || Number.isNaN(date.valueOf())) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

export function buildOutputRows(records) {
  return records.map((record) => {
    const impressions = toNumber(record.impressions);
    const cartAdds = toNumber(record.cartAdds);
    const overallCartConversion = impressions > 0 ? cartAdds / impressions : "";
    return ["", String(record.product ?? ""), String(record.model ?? ""), String(record.sku ?? ""), String(record.article ?? ""), formatDate(record.day), toNumber(record.amount), toNumber(record.orderedUnits), "", "", toNumber(record.uniqueCardVisitors), overallCartConversion, "", "", cartAdds, "", impressions, "", ""];
  });
}
