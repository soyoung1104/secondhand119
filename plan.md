# 헌옷119 명함 QR 접수 서비스 - 상세 구현 계획

## 1. 개요

**헌옷119**는 사람들에게 옷/가방/신발을 매입(수거)하는 업체다. 명함에 인쇄된 QR코드를
스캔하면 모바일 랜딩페이지가 열리고, 사용자는 두 가지 액션 중 하나를 선택한다.

1. **카카오톡 연결하기** → 카카오톡 채널(`http://pf.kakao.com/_xcWfxfX`)로 즉시 이동
2. **바로 접수하기** → 이름/계좌번호/주소/공동현관 비밀번호/전화번호 입력 폼(모달)이
   뜨고, "확인"을 누르면 해당 정보가 구글 시트에 한 행으로 저장됨

이 프로젝트는 **"웹앱"(Node.js 서버 등을 직접 운영하는 애플리케이션)이 아니라
정적 "웹페이지"** 다. `index.html` 파일 하나를 브라우저가 그대로 읽어서 보여주는
구조이며, 접수 정보를 저장하는 부분만 **Google이 무료로 대신 운영해주는
Apps Script 엔드포인트**를 빌려 쓴다. 이유:
- 트래픽이 낮은 소규모 자영업 서비스 → 직접 서버를 두거나 운영비를 낼 필요 없음
- 개인정보(이름/계좌번호/주소/공동현관 비밀번호/전화번호)를 구글 인프라(시트)에 바로 적재 가능
- 프론트엔드에 구글 API 키를 노출하지 않아도 됨 (Apps Script가 실행 계정 권한으로 시트에 씀)

> **서버가 필요한가? → 아니요.** 여러분이 직접 설치/관리/재부팅해야 하는 서버는
> 없다. 필요한 것은 (1) `index.html` 파일을 인터넷에 올려둘 무료 정적 호스팅
> 한 곳(§7), (2) Google이 이미 서버를 대신 돌려주는 Apps Script 배포(§4) 두 가지뿐이다.
> 둘 다 신용카드 등록이나 서버 유지보수가 필요 없는 무료 서비스다. 자세한 비교는
> §0을 참고.

## 0. 웹페이지 vs 웹앱 — 용어 정리

| | 이 프로젝트가 쓰는 것 | 직접 서버를 두는 "웹앱" |
|---|---|---|
| 실체 | 정적 HTML/CSS/JS 파일 몇 개 | Node.js/Express 등 상시 실행되는 서버 프로세스 |
| 호스팅 | Netlify/GitHub Pages 같은 정적 호스팅(무료, 파일 업로드만 하면 끝) | 서버 인스턴스를 직접 띄우고 운영·재시작·모니터링 필요 |
| 데이터 저장 | Google이 대신 운영하는 Apps Script 엔드포인트 → 구글 시트 | 직접 만든 API + DB(운영/백업 책임 본인) |
| 유지보수 | 사실상 없음 (파일 교체만 하면 됨) | 서버 다운, 보안 패치, 스케일링 등 지속 관리 필요 |

Apps Script를 배포할 때 Google 화면에 뜨는 "웹 앱(Web App)"이라는 표현은
Google이 지정한 **배포 유형 이름**일 뿐이며, 이걸 우리가 서버로 관리하는 게
아니라 Google이 자기 인프라에서 대신 실행해준다. 즉 우리 입장에서는 그냥
"구글이 공짜로 열어준 저장용 창구" 정도로 이해하면 된다.

## 2. 사용자 흐름

```
명함 QR 스캔
     │
     ▼
[랜딩페이지 index.html]
     │
     ├─ "카카오톡 연결하기" 클릭 ──▶ location.href = http://pf.kakao.com/_xcWfxfX
     │
     └─ "바로 접수하기" 클릭
             │
             ▼
        [접수 모달 오픈]
        이름·계좌번호(같은 줄) / 주소 / 공동현관 비밀번호 / 전화번호 / 개인정보 동의 체크
             │
             ▼
        "확인" 클릭 → fetch POST
             │
             ▼
   [Google Apps Script 엔드포인트 (doPost, 구글이 대신 호스팅)]
             │
             ▼
   [Google Sheets "접수내역" 시트에 행 추가]
             │
             ▼
    프론트: "접수가 완료되었습니다" 표시
```

## 3. 폴더 구조

TypeScript strict 모드로 작성하고(`any`/`unknown` 미사용), `npm run typecheck`로
지속 검증한다. 브라우저/Apps Script/Node.js 세 실행 환경의 전역 타입이 서로
달라 충돌하므로 `web/`, `apps-script/`, `tools/`로 tsconfig를 분리했다.

```
code119/
├── plan.md                      # 본 문서
├── CLAUDE.md                    # 세션마다 재사용하는 표준 작업 규칙
├── package.json                 # typecheck/build 스크립트, 의존성
├── .gitignore                   # node_modules/, dist/ 제외
├── web/                         # 랜딩페이지 (웹페이지)
│   ├── tsconfig.json
│   ├── index.html                # 버튼 2개 + 접수 모달
│   ├── privacy.html              # 개인정보 처리방침 (법적 요구사항)
│   ├── style.css
│   ├── src/
│   │   └── script.ts             # 버튼 동작, 모달, fetch 로직 (TS)
│   ├── dist/
│   │   └── script.js             # tsc 컴파일 결과, index.html이 참조
│   └── assets/
│       └── logo.png              # 실제 로고 이미지로 교체 필요
├── apps-script/                 # Google Apps Script 백엔드
│   ├── tsconfig.json
│   ├── src/
│   │   └── Code.ts               # doPost 핸들러 (TS, @types/google-apps-script)
│   └── dist/
│       └── Code.gs               # 컴파일 결과, Apps Script 편집기에 붙여넣기용
└── tools/                       # 명함용 QR 이미지 생성 스크립트
    ├── tsconfig.json
    └── generate-qr.ts
```

## 4. Google Sheets + Apps Script 설정 (백엔드 역할)

### 4.1 시트 준비
1. 새 Google Sheets 생성 (예: `헌옷119_접수내역`)
2. 시트 탭 이름을 `접수내역`으로 변경
3. 1행에 헤더 입력: `접수일시 | 이름 | 계좌번호 | 주소 | 공동현관 비밀번호 | 전화번호`

### 4.2 Apps Script 작성 (`apps-script/src/Code.ts` → 컴파일 → `apps-script/dist/Code.gs`)

TypeScript로 작성하고 `@types/google-apps-script` 타입 정의로 typecheck한다.
`any`/`unknown`을 쓰지 않고, `JSON.parse` 결과는 즉시 `ApplicationPayload`로
캐스팅한 뒤 런타임에서 `isValidPayload`로 필드를 검증한다.

```typescript
// apps-script/src/Code.ts
const SHEET_NAME = "접수내역";

interface ApplicationPayload {
  name: string;
  accountNumber: string;
  address: string;
  entrancePassword: string;
  phone: string;
}

interface ApiResponse {
  result: "success" | "error";
  message?: string;
}

function isValidPayload(data: ApplicationPayload): boolean {
  return (
    typeof data.name === "string" && data.name.trim().length > 0 &&
    typeof data.accountNumber === "string" && data.accountNumber.trim().length > 0 &&
    typeof data.address === "string" && data.address.trim().length > 0 &&
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
      data.accountNumber,
      data.address,
      data.entrancePassword,
      data.phone,
    ]);

    return jsonResponse({ result: "success" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return jsonResponse({ result: "error", message });
  }
}
```

`npm run build:apps-script`를 실행하면 `tsc`가 `apps-script/dist/Code.js`를
생성하고, 곧바로 `apps-script/dist/Code.gs`로 복사된다. Apps Script는 브라우저의
`fetch`처럼 `import`/`export`를 지원하지 않으므로 `module: "none"`으로 컴파일해
전역 함수 형태를 유지한다.

### 4.3 Apps Script 엔드포인트 배포 (Google이 대신 서버를 띄워줌)
1. `npm run build:apps-script` 실행 후 `apps-script/dist/Code.gs` 내용을 전체 복사
2. 시트 메뉴 → **확장 프로그램 → Apps Script** → 편집기에 붙여넣기
3. 편집기 → **배포 → 새 배포**
4. 유형: **웹 앱** (Google이 지정한 배포 유형 이름일 뿐, 우리가 관리하는 서버가 아님 — §0 참고)
5. 실행 계정: **나** (시트 소유자)
6. 액세스 권한: **모든 사용자** (프론트에서 로그인 없이 POST해야 하므로)
7. 배포 후 생성되는 **웹 앱 URL**을 복사 → `web/src/script.ts`의 `SHEET_ENDPOINT`에 붙여넣고 `npm run build:web` 재실행

> 주의: 이 URL은 "누구나 이 시트에 행을 추가할 수 있는" 엔드포인트다.
> `doPost`에서만 동작하도록 하고(`doGet` 미구현), 스팸성 대량 요청을 막기 위해
> 추후 reCAPTCHA나 rate limit 추가를 고려한다 (§9 참고).

## 5. 프론트엔드 구현

### 5.1 `web/index.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>헌옷119 - 방문수거 접수</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="container">
    <img src="assets/logo.png" alt="헌옷119" class="logo" />
    <h1>헌옷119</h1>
    <p class="subtitle">옷 · 가방 · 신발 무료 방문수거</p>

    <div class="button-group">
      <button id="kakaoBtn" class="btn btn-kakao" type="button">카카오톡 연결하기</button>
      <button id="applyBtn" class="btn btn-primary" type="button">바로 접수하기</button>
    </div>
  </main>

  <!-- 매입 가격/품목/이용방법/불가품목/페널티 안내 섹션 (§5.5 참고, 실제 카피는 index.html 참고) -->
  <section class="info"> ... </section>

  <!-- 접수 모달 -->
  <div id="applyModal" class="modal hidden" aria-hidden="true">
    <div class="modal-content">
      <button id="closeModal" class="modal-close" type="button" aria-label="닫기">&times;</button>
      <h2>수거 접수</h2>
      <form id="applyForm" novalidate>
        <div class="form-row">
          <label>
            이름
            <input type="text" name="name" required />
          </label>
          <label>
            계좌번호
            <input type="text" name="accountNumber" placeholder="은행명 000-0000-0000" required />
          </label>
        </div>
        <label>
          주소
          <input type="text" name="address" required />
        </label>
        <label>
          공동현관 비밀번호
          <input type="text" name="entrancePassword" placeholder="예: 1234# (없으면 비워두세요)" />
        </label>
        <label>
          전화번호
          <input type="tel" name="phone" placeholder="010-0000-0000" required
                 pattern="^01[016789]-?\d{3,4}-?\d{4}$" />
        </label>
        <label class="consent">
          <input type="checkbox" name="consent" required />
          <span>개인정보 수집·이용에 동의합니다. (<a href="privacy.html" target="_blank">보기</a>)</span>
        </label>
        <button id="submitBtn" type="submit" class="btn btn-primary">확인</button>
      </form>
      <p id="formStatus" role="status"></p>
    </div>
  </div>

  <script src="dist/script.js" defer></script>
</body>
</html>
```

`이름`과 `계좌번호`는 `.form-row`(flex)로 감싸 한 줄에 나란히 배치한다.
`공동현관 비밀번호`는 건물마다 없을 수 있어 `required`를 붙이지 않았다.

`submitBtn`에 id를 부여해 `document.querySelector` 대신 `getElementById`로
타입 안전하게(널 체크 포함) 가져온다 (§5.3). `dist/script.js`는 `web/src/script.ts`를
`tsc`로 컴파일한 결과이며 직접 수정하지 않는다.

### 5.2 `web/style.css` (핵심 부분만)

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Pretendard", -apple-system, sans-serif;
  background: #fafafa;
  color: #222;
}
.container {
  max-width: 420px;
  margin: 0 auto;
  padding: 48px 24px;
  text-align: center;
}
.logo { width: 96px; margin-bottom: 12px; }
.button-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 32px;
}
.btn {
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.btn-kakao { background: #fee500; color: #191600; }
.btn-primary { background: #2f7dfa; color: #fff; }

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal.hidden { display: none; }
.modal-content {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: min(90vw, 360px);
  position: relative;
}
.modal-close {
  position: absolute;
  top: 12px;
  right: 16px;
  border: none;
  background: none;
  font-size: 22px;
  cursor: pointer;
}
#applyForm label {
  display: block;
  text-align: left;
  font-size: 14px;
  margin-bottom: 12px;
}
#applyForm input[type="text"],
#applyForm input[type="tel"] {
  width: 100%;
  padding: 10px;
  margin-top: 4px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
}
.form-row { display: flex; gap: 10px; }
.form-row label { flex: 1; min-width: 0; }
.consent { display: flex; align-items: center; gap: 6px; }
```

> `.info`, `.info-block`, `.info-warning` 등 매입 안내 섹션 스타일은 분량이 많아
> 본문에는 생략했다. 최신 전체 스타일은 `web/style.css` 참고.

### 5.3 `web/src/script.ts`

TypeScript strict 모드로 작성한다. `document.getElementById`는 `HTMLElement | null`을
반환하므로 `requireElement<T>` 헬퍼로 널 체크와 타입 캐스팅을 한 곳에서 처리하고,
`any`/`unknown`은 쓰지 않는다.

```typescript
const KAKAO_URL = "http://pf.kakao.com/_xcWfxfX";
// 4.3에서 배포한 Apps Script 엔드포인트 URL로 교체
const SHEET_ENDPOINT = "https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec";

interface ApplicationPayload {
  name: string;
  accountNumber: string;
  address: string;
  entrancePassword: string;
  phone: string;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) {
    throw new Error(`Element not found: #${id}`);
  }
  return el as T;
}

const kakaoBtn = requireElement<HTMLButtonElement>("kakaoBtn");
const applyBtn = requireElement<HTMLButtonElement>("applyBtn");
const modal = requireElement<HTMLDivElement>("applyModal");
const closeModalBtn = requireElement<HTMLButtonElement>("closeModal");
const form = requireElement<HTMLFormElement>("applyForm");
const submitBtn = requireElement<HTMLButtonElement>("submitBtn");
const statusEl = requireElement<HTMLParagraphElement>("formStatus");

function openModal(): void {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(): void {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  statusEl.textContent = "";
}

kakaoBtn.addEventListener("click", () => {
  window.location.href = KAKAO_URL;
});

applyBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);

function getFieldValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing form field: ${key}`);
  }
  return value.trim();
}

function buildPayload(formData: FormData): ApplicationPayload {
  return {
    name: getFieldValue(formData, "name"),
    accountNumber: getFieldValue(formData, "accountNumber"),
    address: getFieldValue(formData, "address"),
    entrancePassword: getFieldValue(formData, "entrancePassword"),
    phone: getFieldValue(formData, "phone"),
  };
}

form.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "접수 중...";

  const payload = buildPayload(new FormData(form));

  // Apps Script 엔드포인트는 CORS 응답 헤더를 주지 않으므로 no-cors로 전송한다.
  // (Content-Type: text/plain이면 preflight 없이 simple request로 처리됨)
  fetch(SHEET_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then(() => {
      statusEl.textContent = "접수가 완료되었습니다. 곧 연락드리겠습니다!";
      form.reset();
      window.setTimeout(closeModal, 1500);
    })
    .catch(() => {
      statusEl.textContent = "접수 중 오류가 발생했습니다. 다시 시도해주세요.";
    })
    .finally(() => {
      submitBtn.disabled = false;
    });
});
```

> **no-cors 한계**: 서버가 실제로 성공했는지 클라이언트에서 확인할 수 없다.
> 실패를 더 정확히 감지하려면 §9의 대안(JSONP 방식 또는 CORS 허용 프록시)을 참고한다.

### 5.4 `web/privacy.html`
개인정보(이름, 계좌번호, 주소, 공동현관 비밀번호, 전화번호)를 수집하므로 개인정보보호법상
**처리방침 고지 + 동의**가 필요하다. 특히 계좌번호와 공동현관 비밀번호는 금융/보안 정보에
가까우므로 수집 항목에 명시적으로 나열한다. 수집 목적(수거 접수/연락/매입대금 지급), 보유
기간, 파기 절차를 명시한 정적 페이지를 만들고 접수 폼의 동의 체크박스에서 링크로 연결한다
(5.1의 `<a href="privacy.html">` 참고).

## 6. 명함용 QR 코드 생성

랜딩페이지 배포 URL(예: `https://heonot119.example.com`)을 QR로 인코딩한다.
Node.js에서 실행하므로 `@types/node`로 typecheck한다.

```typescript
// tools/generate-qr.ts
// 사용: npm run qr
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import QRCode from "qrcode";

const SITE_URL = "https://heonot119.example.com";
const OUTPUT_PATH = resolve(__dirname, "../../web/assets/qr.png");

async function generateQr(): Promise<void> {
  const buffer: Buffer = await QRCode.toBuffer(SITE_URL, { width: 512, margin: 1 });
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, buffer);
  console.log(`QR 코드 생성 완료: ${OUTPUT_PATH}`);
}

generateQr().catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
```

생성된 `web/assets/qr.png`를 명함 디자인 파일(인쇄용 AI/PSD 등)에 삽입한다.

## 7. 배포 (직접 관리하는 서버 없이 배포하는 방법)

**웹페이지 호스팅은 GitHub Pages + GitHub Actions로 자동화했다.**
- 저장소: `github.com/soyoung1104/secondhand119`
- `.github/workflows/deploy.yml`이 `main` 브랜치에 push될 때마다 `npm ci` →
  `npm run typecheck` → `npm run build:web` → `web/` 폴더를 GitHub Pages로 배포한다.
- 저장소 설정에서 `Settings → Pages → Source`가 **GitHub Actions**로 지정되어 있다.
- **배포 주소: https://soyoung1104.github.io/secondhand119/**
- 이후 코드를 수정하면 `git push`만 하면 되고, 수동으로 파일을 업로드할 필요가 없다.

Apps Script 엔드포인트는 §4.3에서 이미 Google 쪽에 배포됨 (별도 호스팅/서버 준비 불필요).
배포된 웹페이지 URL을 §6의 `SITE_URL`에 넣고 `npm run qr`로 QR 재생성 → 명함 인쇄.

## 8. 테스트 체크리스트

- [ ] 실제 명함 크기로 인쇄한 QR을 모바일로 스캔 → 랜딩페이지 정상 오픈
- [ ] iOS Safari / Android Chrome 양쪽에서 "카카오톡 연결하기" → 카카오톡 앱 정상 실행
- [ ] "바로 접수하기" → 모달 오픈, 이름/계좌번호가 한 줄에 나란히 표시되는지 확인
- [ ] 필드(이름/계좌번호/주소/전화번호) 미입력 시 브라우저 기본 유효성 메시지 노출
- [ ] 공동현관 비밀번호는 비워둔 채로도 제출이 되는지 확인 (선택 항목)
- [ ] 전화번호 형식 오류 입력 시 제출 차단
- [ ] 동의 체크 안 하면 제출 차단
- [ ] 정상 제출 후 구글 시트에 새 행이 실제로 추가되는지 확인
      (접수일시/이름/계좌번호/주소/공동현관 비밀번호/전화번호)
- [ ] 네트워크 끊긴 상태에서 제출 시 에러 메시지 노출 확인
- [ ] 동일 정보로 중복 제출 시 시트에 중복 행이 쌓이는지 확인 (§9 개선 대상)

## 9. 향후 개선 사항 (범위 밖, 참고용)

- **스팸 방지**: Apps Script `doPost`에 간단한 rate limit(같은 전화번호 N분 내 재접수 차단) 또는 reCAPTCHA v3 추가
- **접수 알림**: `doPost` 성공 시 Apps Script에서 사장님께 알림톡/이메일 자동 발송 (`GmailApp.sendEmail` 등)
- **성공/실패 정확한 피드백**: Apps Script에 `Access-Control-Allow-Origin` 헤더를 흉내내는 프록시(Cloudflare Worker 등)를 앞단에 두면 `no-cors` 없이 정확한 응답 처리 가능
- **관리자 화면**: 시트 자체를 필터/피벗으로 활용하거나, Looker Studio 연동으로 대시보드화

## 10. 구현 체크리스트

`CLAUDE.md`의 표준 규칙(any/unknown 미사용, 지속 typecheck, 완료 시 체크 표시)에 따라
코드 구현을 진행했다.

### 코드 구현 (완료)
- [x] `CLAUDE.md` — 세션마다 재사용하는 표준 작업 규칙 작성
- [x] `package.json` + `web/tsconfig.json` + `apps-script/tsconfig.json` + `tools/tsconfig.json` 스캐폴딩
- [x] `web/src/script.ts` 구현 (strict, any/unknown 미사용)
- [x] `web/index.html`, `web/style.css`, `web/privacy.html` 구현
- [x] `apps-script/src/Code.ts` 구현 (strict, `@types/google-apps-script`)
- [x] `tools/generate-qr.ts` 구현
- [x] `npm install` 및 `npm run typecheck` (web/apps-script/tools 전체) 통과 — 오류 0건
- [x] `npm run build` 실행 → `web/dist/script.js`, `apps-script/dist/Code.gs` 생성 확인
- [x] 경쟁사 홍보글을 헌옷119 브랜드로 재구성한 매입 안내 섹션(`.info`) 메인페이지에 추가
- [x] 접수 폼에 계좌번호(이름과 한 줄 배치)·공동현관 비밀번호 필드 추가, `ApplicationPayload`
      타입/Apps Script/`privacy.html` 수집 항목 전부 동기화, typecheck·빌드·프리뷰 검증 완료

### 수동 설정 (사용자 계정/실물 자산이 필요해 코드로 대신할 수 없음)
- [ ] Google Sheets `헌옷119_접수내역` 생성 + `접수내역` 탭 + 헤더 행 (§4.1)
- [ ] `apps-script/dist/Code.gs` 내용을 실제 Apps Script 프로젝트에 붙여넣고 웹 앱으로 배포 (§4.3)
- [ ] 배포된 Apps Script URL을 `web/src/script.ts`의 `SHEET_ENDPOINT`에 반영 후 `npm run build:web` 재실행
- [ ] `web/assets/logo.png` 실제 로고 이미지 추가
- [x] GitHub Pages 배포 완료 → **https://soyoung1104.github.io/secondhand119/**
      (저장소: `github.com/soyoung1104/secondhand119`, `main` 브랜치 push 시
      `.github/workflows/deploy.yml`이 자동으로 typecheck·빌드·배포)
- [ ] 확정된 URL(`https://soyoung1104.github.io/secondhand119/`)로
      `tools/generate-qr.ts`의 `SITE_URL` 수정 후 `npm run qr` 실행 → 명함용 QR 생성
- [ ] §8 테스트 체크리스트 전체 수행
