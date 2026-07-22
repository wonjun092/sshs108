import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Reservation } from "@/models/Reservation";
import { reservationCreateSchema } from "@/validation/reservation";
import { updateSheet } from "@/lib/google";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    await connectDatabase();
    const reservations = await Reservation.find({ createdBy: session.userId }).sort({ date: 1 }).lean();
    return NextResponse.json({ reservations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const input = reservationCreateSchema.parse(await request.json());
    await connectDatabase();
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
    if (input.date < today) return NextResponse.json({ error: "과거 날짜는 신청할 수 없습니다." }, { status: 400 });
    let status: "scheduled" | "applied" = "scheduled";
    if (input.date === today) {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
      const minutes = Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
      if (minutes >= 19 * 60) return NextResponse.json({ error: "오늘 신청 가능한 시간이 지났습니다." }, { status: 400 });
      if (minutes >= 7 * 60 + 15) { await updateSheet(input.studentId, input.period, input.location); status = "applied"; }
    }
    const reservation = await Reservation.create({ ...input, createdBy: session.userId, status });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await request.json() as { id?: string };
    await connectDatabase();
    const result = await Reservation.deleteOne({ _id: id, createdBy: session.userId, status: "scheduled" });
    if (!result.deletedCount) return NextResponse.json({ error: "취소할 예약을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
