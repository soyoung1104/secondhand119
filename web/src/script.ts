const KAKAO_URL = "http://pf.kakao.com/_xcWfxfX";
// §4.3에서 배포한 Apps Script 엔드포인트 URL로 교체할 것
const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbwmY5eXC-wD_kWSDpbQK2Fsk1OXLm73i18uthY9ygcFnkkcBSou3D8QkKdKoPh5fVoB/exec";

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
