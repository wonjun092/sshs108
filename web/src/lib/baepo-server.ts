import { NextResponse } from "next/server";
import { isObjectIdOrHexString } from "mongoose";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { User } from "@/models/User";
import { BaepoError, MAX_UPLOAD_BYTES, validateHtml } from "@/lib/baepo-policy";

export async function activeBaepoUser() {
  const session = await getSession();
  if (!session || !isObjectIdOrHexString(session.userId)) throw new BaepoError(401, "로그인이 필요합니다.");
  await connectDatabase();
  // Recheck status and role rather than trusting a seven-day-old token.
  const user = await User.findOne({ _id: session.userId, status: "active" }).select("loginId role").lean();
  if (!user) throw new BaepoError(403, "승인된 계정만 사용할 수 있습니다.");
  return { userId: String(user._id), loginId: user.loginId, role: user.role };
}

export function baepoError(error: unknown) {
  if (error instanceof BaepoError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === 11000)
    return NextResponse.json({ error: "이미 등록된 경로입니다. 다른 경로를 선택해주세요." }, { status: 409 });
  return apiError(error);
}

export async function readHtmlUpload(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;"))
    throw new BaepoError(415, "HTML 파일을 첨부해주세요.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_UPLOAD_BYTES))
    throw new BaepoError(413, "업로드 요청이 너무 큽니다.");
  if (!request.body) throw new BaepoError(400, "파일이 필요합니다.");
  // Bound the stream before parsing multipart, including chunked requests.
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new BaepoError(413, "업로드 요청이 너무 큽니다.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
  catch { throw new BaepoError(400, "올바른 파일 업로드 요청이 아닙니다."); }
  const file = form.get("file");
  if (!(file instanceof File) || form.getAll("file").length !== 1)
    throw new BaepoError(400, "HTML 파일 하나를 선택해주세요.");
  const html = validateHtml(file.name, new Uint8Array(await file.arrayBuffer()));
  return { form, html, filename: file.name, size: file.size };
}

export function revisionFrom(request: Request) {
  const revision = request.headers.get("if-match");
  if (!revision || !/^[0-9a-f-]{36}$/.test(revision))
    throw new BaepoError(428, "목록을 새로고침한 후 다시 시도해주세요.");
  return revision;
}
