import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Reservation } from "@/models/Reservation";
import { getGoogleSession, updateSheet } from "@/lib/google";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    if (!(await getGoogleSession()))
      return NextResponse.json(
        { error: "학교 Google 로그인이 필요합니다." },
        { status: 401 },
      );
    const input = (await request.json()) as Record<string, string>;
    const start = new Date(`${input.startDate}T00:00:00Z`);
    const end = new Date(`${input.endDate}T00:00:00Z`);
    if (
      !input.startDate ||
      !input.endDate ||
      Number.isNaN(start.valueOf()) ||
      Number.isNaN(end.valueOf())
    )
      return NextResponse.json(
        { error: "날짜 형식이 잘못되었습니다." },
        { status: 400 },
      );
    if (start > end)
      return NextResponse.json(
        { error: "종료일이 시작일보다 빠를 수 없습니다." },
        { status: 400 },
      );
    const studentNumber = Number(input.studentId.replace(/\D/g, ""));
    const studentOdd = studentNumber % 2 === 1;
    const documents: Record<string, unknown>[] = [];
    for (
      const day = new Date(start);
      day <= end;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const weekday = day.getUTCDay();
      if (weekday < 1 || weekday > 4) continue;
      if (input.location === "(기숙사)" && Number.isFinite(studentNumber)) {
        const dateOdd = day.getUTCDate() % 2 === 1;
        const isAllowedDormitoryDate = studentOdd ? !dateOdd : dateOdd;
        if (!isAllowedDormitoryDate) continue;
      }
      const date = day.toISOString().slice(0, 10);
      documents.push({
        date,
        studentId: input.studentId,
        name: input.name,
        period: input.period,
        location: input.location,
        createdBy: session.userId,
        status: "scheduled",
      });
    }
    await connectDatabase();
    let added = 0;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(new Date());
    for (const document of documents) {
      try {
        if (document.date === today) {
          await updateSheet(
            String(document.studentId),
            String(document.period),
            String(document.location),
          );
          document.status = "applied";
        }
        await Reservation.create(document);
        added++;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("E11000"))
          throw error;
      }
    }
    return NextResponse.json({ added });
  } catch (error) {
    return apiError(error);
  }
}
