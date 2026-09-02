import { z } from "zod";

export const loginSchema = z.object({
  loginId: z.string().trim().min(1).max(40),
  password: z.string().min(5).max(128),
});

export const signupSchema = loginSchema
  .extend({
    passwordConfirm: z.string().min(5).max(128),
    studentId: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(40),
    birthDate: z.string().trim().min(4).max(20),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });
