export const WEDNESDAY_WARS_TOTAL = 159;

export type EnglishQuizRecord = {
  score: number;
  total: number;
  durationMs?: number;
};

export function parseEnglishQuizRecord(body: unknown): EnglishQuizRecord | null {
  if (typeof body !== "object" || body === null) return null;
  const { score, total, durationMs } = body as Record<string, unknown>;
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > WEDNESDAY_WARS_TOTAL ||
    total !== WEDNESDAY_WARS_TOTAL ||
    (durationMs !== undefined &&
      (typeof durationMs !== "number" ||
        !Number.isSafeInteger(durationMs) ||
        durationMs <= 0))
  ) return null;

  return { score, total, durationMs: durationMs as number | undefined };
}
