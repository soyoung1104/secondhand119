import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import QRCode from "qrcode";

const SITE_URL = "https://soyoung1104.github.io/secondhand119/";
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
