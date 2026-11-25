export const WEDNESDAY_WARS_RANKING_BOOK = "wednesdayWarsPart2";
export const WEDNESDAY_WARS_PART2_TOTAL = 193;
export const ENGLISH_QUIZ_GUEST_NAME_MAX = 20;

export type EnglishQuizRecord = {
  score: number;
  total: number;
  durationMs: number;
};

export function parseEnglishQuizRecord(body: unknown): EnglishQuizRecord | null {
  if (typeof body !== "object" || body === null) return null;
  const { score, total, durationMs } = body as Record<string, unknown>;
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > WEDNESDAY_WARS_PART2_TOTAL ||
    total !== WEDNESDAY_WARS_PART2_TOTAL ||
    typeof durationMs !== "number" ||
    !Number.isSafeInteger(durationMs) ||
    durationMs <= 0
  ) return null;

  return { score, total, durationMs };
}

export function parseEnglishQuizGuestName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = value.normalize("NFC").trim().replace(/ +/g, " ");
  if (name.length < 2 || name.length > ENGLISH_QUIZ_GUEST_NAME_MAX) return null;
  if (!/[\p{L}\p{N}]/u.test(name)) return null;
  return /^[\p{L}\p{M}\p{N} _-]+$/u.test(name) ? name : null;
}
