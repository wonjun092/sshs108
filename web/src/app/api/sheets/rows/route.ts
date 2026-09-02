import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { readSheetRows } from "@/lib/google";
import { updateSheet } from "@/lib/google";
import { connectDatabase } from "@/lib/db";
import { Reservation } from "@/models/Reservation";
export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(now);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const minutes =
      Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
      Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    await connectDatabase();
    if (minutes >= 7 * 60 + 15 && minutes < 19 * 60) {
      const due = await Reservation.find({ date: today, status: "scheduled" });
      for (const item of due) {
        try {
          await updateSheet(item.studentId, item.period, item.location);
          item.status = "applied";
          await item.save();
        } catch {
          item.status = "failed";
          await item.save();
        }
      }
    }
    const rows = await readSheetRows();
    return NextResponse.json({
      rows,
      classRows: rows.filter((row) => {
        const id = Number(row[0]);
        return id >= 1801 && id <= 1816;
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
