import test from "node:test";
import assert from "node:assert/strict";
import { extractRecords } from "../src/transform.mjs";

test("finds the two-row Ozon header and required funnel metrics", () => {
  const matrix = [["01.01.2026 – 18.10.2026"], [], ["Товары", "Модель", "SKU", "Артикул", "День", "", "", "", "", ""], ["", "", "", "", "", "Заказано на сумму (по цене реализации)", "Показы всего", "Уникальные посетители с просмотром карточки товара", "Добавления в корзину всего", "Заказано товаров"], ["Итого и среднее"], ["Сумка", "3053", "561309427", "AOTIAN_3053Black", "18.10.2026", 3900, 1000, 100, 20, 1]];
  const records = extractRecords(matrix); assert.equal(records.length, 1); assert.equal(records[0].sku, "561309427"); assert.equal(records[0].uniqueCardVisitors, 100);
});
test("fails closed when unique card visitors are absent", () => {
  const matrix = [["Товары", "Модель", "SKU", "Артикул", "День", "", "", "", ""], ["", "", "", "", "", "Заказано на сумму", "Показы всего", "Добавления в корзину всего", "Заказано товаров"]];
  assert.throws(() => extractRecords(matrix), /уникальные посетители/i);
});
