import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { User } from "@/models/User";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const { currentPassword, newPassword, confirmPassword } =
      (await request.json()) as Record<string, string>;
    if (!currentPassword || !newPassword || newPassword.length < 5)
      return NextResponse.json(
        { error: "새 비밀번호는 5자 이상이어야 합니다." },
        { status: 400 },
      );
    if (newPassword !== confirmPassword)
      return NextResponse.json(
        { error: "새 비밀번호가 서로 일치하지 않습니다." },
        { status: 400 },
      );
    await connectDatabase();
    const user = await User.findById(session.userId).select("+passwordHash");
    if (!user || !(await compare(currentPassword, user.passwordHash)))
      return NextResponse.json(
        { error: "현재 비밀번호가 틀렸습니다." },
        { status: 400 },
      );
    user.passwordHash = await hash(newPassword, 12);
    await user.save();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
