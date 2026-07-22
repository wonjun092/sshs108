import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { User } from "@/models/User";
import { loginSchema } from "@/validation/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = loginSchema.parse(await request.json());
    await connectDatabase();
    const user = await User.findOne({ loginId: input.loginId }).select("+passwordHash");
    if (!user || !(await compare(input.password, user.passwordHash))) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ error: "관리자 승인을 기다리고 있습니다." }, { status: 403 });
    }

    const token = await createSessionToken({
      userId: user._id.toString(),
      loginId: user.loginId,
      role: user.role,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
