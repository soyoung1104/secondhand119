const SHEET_NAME = "접수내역";

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
