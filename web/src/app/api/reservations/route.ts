import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Reservation } from "@/models/Reservation";
import { reservationCreateSchema } from "@/validation/reservation";

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
    const reservation = await Reservation.create({ ...input, createdBy: session.userId });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
