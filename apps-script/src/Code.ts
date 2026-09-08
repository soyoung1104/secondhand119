const SHEET_NAME = "접수내역";
const SUMMARY_EMAIL = "89vintage@naver.com";

interface ApplicationPayload {
  name: string;
  bankName: string;
  accountNumber: string;
  address: string;
  addressDetail: string;
  entrancePassword: string;
  phone: string;
}

interface ApiResponse {
  result: "success" | "error";
  message?: string;
}

function isValidPayload(data: ApplicationPayload): boolean {
  return (
    typeof data.name === "string" && data.name.trim().length > 0 && data.name.length <= 10 &&
    typeof data.bankName === "string" && data.bankName.trim().length > 0 &&
    typeof data.accountNumber === "string" && data.accountNumber.trim().length > 0 &&
    typeof data.address === "string" && data.address.trim().length > 0 &&
    typeof data.addressDetail === "string" &&
    typeof data.entrancePassword === "string" &&
    typeof data.phone === "string" && data.phone.trim().length > 0
  );
}

function jsonResponse(body: ApiResponse): GoogleAppsScript.Content.TextOutput {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (sheet === null) {
      return jsonResponse({ result: "error", message: `시트를 찾을 수 없습니다: ${SHEET_NAME}` });
    }

    const data = JSON.parse(e.postData.contents) as ApplicationPayload;

    if (!isValidPayload(data)) {
      return jsonResponse({ result: "error", message: "필수 항목 누락" });
    }

    sheet.appendRow([
      new Date(),
      data.name,
      data.bankName,
      data.accountNumber,
      data.address,
      data.addressDetail,
      data.entrancePassword,
      data.phone,
    ]);

    return jsonResponse({ result: "success" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return jsonResponse({ result: "error", message });
  }
}

function getYesterdayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end };
}

function formatRow(row: (string | Date)[]): string {
  const [timestamp, name, bankName, accountNumber, address, addressDetail, entrancePassword, phone] = row;
  const timeLabel = timestamp instanceof Date
    ? Utilities.formatDate(timestamp, "Asia/Seoul", "HH:mm")
    : String(timestamp);
  const entranceLabel = entrancePassword === "" ? "없음" : String(entrancePassword);
  return `- [${timeLabel}] ${name} / ${bankName} ${accountNumber} / ${address} ${addressDetail} / `
    + `공동현관 ${entranceLabel} / ${phone}`;
}

function sendDailySummary(): void {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet === null) {
    return;
  }

  const { start, end } = getYesterdayRange();
  const values = sheet.getDataRange().getValues() as (string | Date)[][];
  const rows = values.slice(1).filter((row) => {
    const timestamp = row[0];
    return timestamp instanceof Date && timestamp >= start && timestamp < end;
  });

  const dateLabel = Utilities.formatDate(start, "Asia/Seoul", "yyyy-MM-dd");
  const subject = `[헌옷119] ${dateLabel} 접수 요약 (${rows.length}건)`;
  const body = rows.length === 0
    ? "어제 접수된 건이 없습니다."
    : rows.map(formatRow).join("\n");

  MailApp.sendEmail(SUMMARY_EMAIL, subject, body);
}

function setupDailyTrigger(): void {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "sendDailySummary")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("sendDailySummary")
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .inTimezone("Asia/Seoul")
    .create();
}
