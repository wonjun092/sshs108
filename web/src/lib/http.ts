import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "입력값을 확인해주세요.", issues: error.flatten() },
      { status: 400 },
    );
  }

  if (error instanceof Error) console.error(error);
  return NextResponse.json(
    { error: "서버 오류가 발생했습니다." },
    { status: 500 },
  );
}
