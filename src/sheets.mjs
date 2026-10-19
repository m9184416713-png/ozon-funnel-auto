import { google } from "googleapis";

function decodeCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Не задан секрет GOOGLE_SERVICE_ACCOUNT_JSON.");
  const candidates = [raw];
  try { candidates.push(Buffer.from(raw.trim(), "base64").toString("utf8")); } catch {}
  for (const candidate of candidates) {
    try { const parsed = JSON.parse(candidate); if (parsed.client_email && parsed.private_key) return parsed; } catch {}
  }
  throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON не содержит корректный JSON сервисного аккаунта.");
}

function quoteSheet(name) { return `'${name.replace(/'/g, "''")}'`; }

export async function replaceFunnelRange(values) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.WORKSHEET_TITLE || "Реклама руками (воронка)";
  if (!spreadsheetId) throw new Error("Не задан SPREADSHEET_ID.");
  if (!Array.isArray(values) || values.length < 2 || values[0].length !== 19) throw new Error("Проверка безопасности: ожидается непустой массив из 19 столбцов G:Y.");
  const auth = new google.auth.GoogleAuth({ credentials: decodeCredentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === sheetName);
  if (!exists) throw new Error(`В книге нет листа «${sheetName}». Ничего не изменено.`);
  const base = quoteSheet(sheetName);
  const backupResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${base}!G:Y`, valueRenderOption: "UNFORMATTED_VALUE" });
  const backup = backupResponse.data.values ?? [];
  try {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${base}!G:Y` });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${base}!G1`, valueInputOption: "USER_ENTERED", requestBody: { values } });
  } catch (error) {
    if (backup.length) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${base}!G:Y` }).catch(() => {});
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${base}!G1`, valueInputOption: "RAW", requestBody: { values: backup } }).catch(() => {});
    }
    throw error;
  }
  const verification = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${base}!G:Y` });
  const writtenRows = verification.data.values?.length ?? 0;
  if (writtenRows !== values.length) throw new Error(`Проверка после записи не прошла: ожидалось ${values.length} строк, получено ${writtenRows}.`);
  return { writtenRows: writtenRows - 1, sheetName };
}
