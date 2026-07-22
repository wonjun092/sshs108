import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Attachment } from "@/models/Attachment";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "첨부파일을 선택해주세요." }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "첨부파일은 4MB 이하여야 합니다." }, { status: 413 });
    await connectDatabase();
    const attachment = await Attachment.create({ filename: file.name, contentType: file.type || "application/octet-stream", size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedBy: session.userId });
    return NextResponse.json({ fileUrl: `/api/uploads/${attachment._id}` }, { status: 201 });
  } catch (error) { return apiError(error); }
}
