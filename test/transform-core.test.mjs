import test from "node:test";
import assert from "node:assert/strict";
import { buildOutputRows, formatDate, OUTPUT_HEADERS, toNumber } from "../src/transform-core.mjs";

test("formats Russian and ISO dates", () => { assert.equal(formatDate("2026-10-18"), "18.10.2026"); assert.equal(formatDate("18.10.2026"), "18.10.2026"); });
test("parses Russian numbers", () => { assert.equal(toNumber("12 345,67 ₽"), 12345.67); });
test("builds exactly G:Y and computes overall cart conversion", () => {
  const [row] = buildOutputRows([{ product: "Сумка", model: "3053", sku: "561309427", article: "AOTIAN_3053Black", day: "2026-10-18", amount: 3900, orderedUnits: 1, uniqueCardVisitors: 100, cartAdds: 20, impressions: 1000 }]);
  assert.equal(OUTPUT_HEADERS.length, 19); assert.equal(row.length, 19); assert.equal(row[5], "18.10.2026"); assert.equal(row[11], 0.02);
});
