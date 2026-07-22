import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { User } from "@/models/User";

export async function GET() {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    await connectDatabase();
    const users = await User.find({ status: "pending" }).select("loginId name studentId birthDate createdAt").sort({ createdAt: 1 }).lean();
    return NextResponse.json({ users });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    const { id, status } = await request.json() as { id?: string; status?: string };
    if (!id || !["active", "rejected"].includes(status ?? "")) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    await connectDatabase();
    await User.findByIdAndUpdate(id, { status });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
