import reservedRoutes from "./baepo-reserved.json";

export const MAX_HTML_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_HTML_BYTES + 16 * 1024;
const reserved = new Set(reservedRoutes);

export class BaepoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function validateSlug(value: unknown, allowReserved = false): string {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(value))
    throw new BaepoError(400, "경로는 소문자 영문·숫자·하이픈으로 1~48자이며, 처음과 끝은 영문·숫자여야 합니다.");
  if (!allowReserved && reserved.has(value)) throw new BaepoError(409, "기존 페이지 또는 예약된 경로입니다.");
  return value;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin ||
      ["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? ""))
    throw new BaepoError(403, "이 사이트의 업로드 관리 화면에서 요청해주세요.");
}

export function validateHtml(filename: string, bytes: Uint8Array) {
  if (!/\.html?$/i.test(filename) || filename.length > 180 || /[\\/\x00-\x1f]/.test(filename))
    throw new BaepoError(400, ".html 또는 .htm 파일만 업로드할 수 있습니다.");
  if (!bytes.length) throw new BaepoError(400, "빈 파일은 업로드할 수 없습니다.");
  if (bytes.length > MAX_HTML_BYTES) throw new BaepoError(413, "HTML 파일은 3MB 이하여야 합니다.");
  let html: string;
  try { html = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new BaepoError(400, "UTF-8로 저장한 HTML 파일을 선택해주세요."); }
  if (html.includes("\0") || !/<(?:!doctype\s+html|html)(?:\s|>)/i.test(html))
    throw new BaepoError(400, "DOCTYPE 또는 html 태그가 있는 HTML 문서가 필요합니다.");
  return html;
}

// HTTP sandbox also applies when the content URL is opened directly.
// No allow-same-origin: uploaded JS never receives the application's origin.
export const HTML_CSP = [
  "sandbox allow-scripts", "default-src 'none'", "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'", "img-src data: blob:", "font-src data:",
  "media-src data: blob:", "connect-src 'none'", "frame-src 'none'",
  "worker-src 'none'", "object-src 'none'", "base-uri 'none'",
  "form-action 'none'", "frame-ancestors 'self'",
].join("; ");

export const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": HTML_CSP,
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};
