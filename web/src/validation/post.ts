import { z } from "zod";
import { BOARD_TYPES } from "@/models/Post";

export const postCreateSchema = z.object({
  board: z.enum(BOARD_TYPES),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  location: z.string().trim().max(100).optional(),
  fileUrl: z
    .string()
    .trim()
    .refine(
      (value) => value.startsWith("/") || URL.canParse(value),
      "올바른 첨부파일 주소가 아닙니다.",
    )
    .optional()
    .or(z.literal("")),
  scheduledAt: z.iso.datetime().optional(),
});

export const postUpdateSchema = postCreateSchema
  .pick({
    title: true,
    content: true,
    location: true,
    fileUrl: true,
    scheduledAt: true,
  })
  .partial();

export const commentCreateSchema = z.object({
  content: z.string().trim().min(1).max(2_000),
});
