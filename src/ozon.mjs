import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ANALYTICS_URL = "https://seller.ozon.ru/app/analytics/graphs";

async function decodeStorageState(targetPath) {
  const encoded = process.env.OZON_STORAGE_STATE_B64;
  if (!encoded) throw new Error("Не задан секрет OZON_STORAGE_STATE_B64.");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const decoded = Buffer.from(encoded.trim(), "base64").toString("utf8");
  JSON.parse(decoded);
  await fs.writeFile(targetPath, decoded, { mode: 0o600 });
}

async function waitForReport(page, reportNameBefore) {
  const managerTitle = page.getByText("Менеджер загрузок", { exact: true });
  await managerTitle.waitFor({ state: "visible", timeout: 30_000 });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = page.locator("tr").filter({ hasText: "analytics_report_daily_" });
    if ((await rows.count()) > 0) {
      const firstRow = rows.first();
      const rowText = await firstRow.innerText();
      const nameMatch = rowText.match(/analytics_report_daily_[^\s]+/);
      const reportName = nameMatch?.[0] ?? rowText;
      const isNew = !reportNameBefore || !reportName.includes(reportNameBefore);
      if (isNew && rowText.includes("Готов")) return firstRow;
      if (isNew && /Ошибка|Не удалось/i.test(rowText)) throw new Error(`Ozon не сформировал отчёт: ${rowText}`);
    }
    await page.waitForTimeout(15_000);
  }
  throw new Error("Ozon не подготовил отчёт за 25 минут.");
}

export async function downloadOzonReport({ downloadDir, artifactDir }) {
  const authPath = path.join(".auth", "ozon-storage-state.json");
  await decodeStorageState(authPath);
  await fs.mkdir(downloadDir, { recursive: true });
  await fs.mkdir(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authPath, locale: "ru-RU", timezoneId: "Europe/Moscow", acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(ANALYTICS_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("heading", { name: "Моя аналитика", exact: true }).waitFor({ timeout: 60_000 });
    if (/login|auth|signin/i.test(page.url())) throw new Error("Сессия Ozon истекла. Обновите секрет OZON_STORAGE_STATE_B64.");
    await page.getByRole("button", { name: "Год", exact: true }).first().click();
    await page.getByRole("button", { name: "Настроить", exact: true }).click();
    await page.getByText("Демиткина - воронка", { exact: true }).click();
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    const groupingButton = page.getByRole("button", { name: /Группировать по:/ }).first();
    const groupingText = await groupingButton.innerText();
    if (!/дням/i.test(groupingText)) { await groupingButton.click(); await page.getByText("дням", { exact: true }).click(); }
    await page.waitForTimeout(3_000);
    await page.getByRole("button", { name: "Скачать", exact: true }).first().click();
    await page.getByText("Открыть менеджер загрузок", { exact: true }).click();
    const currentRows = page.locator("tr").filter({ hasText: "analytics_report_daily_" });
    const reportNameBefore = (await currentRows.count()) ? ((await currentRows.first().innerText()).match(/analytics_report_daily_[^\s]+/)?.[0] ?? "") : "";
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Скачать", exact: true }).first().click();
    await page.getByText("Отчёт по дням", { exact: true }).click();
    await page.waitForTimeout(1_500);
    await page.getByRole("button", { name: "Скачать", exact: true }).first().click();
    await page.getByText("Открыть менеджер загрузок", { exact: true }).click();
    const reportRow = await waitForReport(page, reportNameBefore);
    const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
    await reportRow.getByRole("button", { name: "Скачать", exact: true }).click();
    const download = await downloadPromise;
    const filePath = path.join(downloadDir, download.suggestedFilename() || "ozon-funnel.xlsx");
    await download.saveAs(filePath);
    return filePath;
  } catch (error) {
    await page.screenshot({ path: path.join(artifactDir, "ozon-error.png"), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(artifactDir, "ozon-error.txt"), String(error?.stack || error)).catch(() => {});
    throw error;
  } finally { await browser.close(); }
}
