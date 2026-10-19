import fs from "node:fs/promises";
import path from "node:path";
import { downloadOzonReport } from "./ozon.mjs";
import { transformWorkbook } from "./transform.mjs";
import { replaceFunnelRange } from "./sheets.mjs";

const downloadDir = path.resolve("downloads");
const artifactDir = path.resolve("artifacts");

function assertFresh(lastDate) {
  const match = String(lastDate ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) throw new Error("Не удалось определить последнюю дату в отчёте Ozon.");
  const reportDay = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const now = new Date();
  const moscow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  const today = Date.UTC(Number(moscow.year), Number(moscow.month) - 1, Number(moscow.day));
  const ageDays = Math.floor((today - reportDay) / 86400000);
  const maxLag = Number(process.env.MAX_REPORT_LAG_DAYS || 3);
  if (ageDays < 0 || ageDays > maxLag) {
    throw new Error(`Отчёт Ozon устарел: последняя дата ${lastDate}, допустимое отставание — ${maxLag} дн. Лист не обновлён.`);
  }
}

async function main() {
  await fs.mkdir(artifactDir, { recursive: true });
  const filePath = await downloadOzonReport({ downloadDir, artifactDir });
  const transformed = transformWorkbook(filePath);
  assertFresh(transformed.lastDate);
  const result = await replaceFunnelRange(transformed.values);
  const summary = {
    ok: true,
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(filePath),
    sourceRows: transformed.rowCount,
    firstDate: transformed.firstDate,
    lastDate: transformed.lastDate,
    targetSheet: result.sheetName,
    writtenRows: result.writtenRows
  };
  await fs.writeFile(path.join(artifactDir, "run-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async (error) => {
  const failure = { ok: false, generatedAt: new Date().toISOString(), error: String(error?.stack || error) };
  await fs.mkdir(artifactDir, { recursive: true }).catch(() => {});
  await fs.writeFile(path.join(artifactDir, "run-summary.json"), JSON.stringify(failure, null, 2)).catch(() => {});
  console.error(failure.error);
  process.exitCode = 1;
});
