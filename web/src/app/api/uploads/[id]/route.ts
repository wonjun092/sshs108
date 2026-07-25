import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Attachment } from "@/models/Attachment";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getSession())) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await params; if (!isValidObjectId(id)) return NextResponse.json({ error: "잘못된 파일입니다." }, { status: 400 });
    await connectDatabase(); const attachment = await Attachment.findById(id);
    if (!attachment) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    const filename = attachment.filename.replace(/["\r\n]/g, "_");
    return new NextResponse(new Uint8Array(attachment.data), { headers: { "Content-Type": attachment.contentType, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, max-age=3600" } });
  } catch (error) { return apiError(error); }
}
