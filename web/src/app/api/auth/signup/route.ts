import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { User } from "@/models/User";
import { signupSchema } from "@/validation/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = signupSchema.parse(await request.json());
    await connectDatabase();
    if (await User.exists({ loginId: input.loginId })) {
      return NextResponse.json(
        { error: "이미 사용 중이거나 승인 대기 중인 아이디입니다." },
        { status: 409 },
      );
    }
    await User.create({
      loginId: input.loginId,
      passwordHash: await hash(input.password, 12),
      role: "student",
      status: "pending",
      studentId: input.studentId,
      name: input.name,
      birthDate: input.birthDate,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
