import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Attachment } from "@/models/Attachment";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await getSession()))
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const { id } = await params;
    if (!isValidObjectId(id))
      return NextResponse.json(
        { error: "잘못된 파일입니다." },
        { status: 400 },
      );
    await connectDatabase();
    const attachment = await Attachment.findById(id);
    if (!attachment)
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 },
      );
    const filename = attachment.filename.replace(/["\r\n]/g, "_");
    // Only inert raster images render inline. HTML/SVG and other attachments
    // must not become an alternate same-origin script execution endpoint.
    const inlineImage = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]
      .includes(attachment.contentType.toLowerCase());
    return new NextResponse(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": inlineImage ? attachment.contentType : "application/octet-stream",
        "Content-Disposition": `${inlineImage ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Security-Policy": "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
