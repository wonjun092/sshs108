import { z } from "zod";

export const reservationCreateSchema = z.object({
  date: z.iso.date(),
  studentId: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(40),
  period: z.string().trim().min(1).max(30),
  location: z.string().trim().min(1).max(100),
});
