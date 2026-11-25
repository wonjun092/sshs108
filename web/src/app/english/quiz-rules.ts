import { WEDNESDAY_WARS_PART2_TOTAL } from "@/lib/english-quiz";
import {
  holesVocabulary,
  wednesdayWarsVocabulary,
  type VocabularyQuestion,
} from "./vocabulary";

export const books = {
  holes: {
    title: "Holes Vocabulary Master",
    rangeHelp: "원하는 챕터를 선택하고 문제 수를 입력하세요.",
    chapterLabel: (ch: string) => `Ch.${ch}`,
    quizChapterLabel: (ch: string) => `Chapter ${ch}`,
    vocabulary: holesVocabulary,
  },
  wednesdayWars: {
    title: "The Wednesday Wars Vocabulary",
    rangeHelp:
      "원하는 월(챕터)과 문제 수를 고르세요. 랭킹 기록은 Part 2만 전체 선택하고 모든 문제를 풀면 저장할 수 있습니다.",
    chapterLabel: (ch: string) => ch,
    quizChapterLabel: (ch: string) => ch,
    vocabulary: wednesdayWarsVocabulary,
  },
};

export type BookKey = keyof typeof books;

const part2Months = new Set(["February", "March", "April", "May", "June"]);
const partChapters = { 1: new Set<string>(), 2: new Set<string>() };
for (const { ch } of wednesdayWarsVocabulary) {
  const part = part2Months.has(ch.split("-")[0]) ? 2 : 1;
  partChapters[part].add(ch);
}

export const wednesdayParts: Readonly<Record<1 | 2, ReadonlySet<string>>> = partChapters;

export function isRankedRange(
  bookKey: BookKey,
  selected: ReadonlySet<string>,
  requested: number,
): boolean {
  const part2 = wednesdayParts[2];
  return (
    bookKey === "wednesdayWars" &&
    requested === WEDNESDAY_WARS_PART2_TOTAL &&
    selected.size === part2.size &&
    Array.from(part2).every((chapter) => selected.has(chapter))
  );
}

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
}

export function isCorrectAnswer(question: VocabularyQuestion, value: string): boolean {
  const answer = normalizeAnswer(value);
  return [question.correctFill, ...(question.acceptedAnswers ?? [])].some(
    (accepted) => normalizeAnswer(accepted) === answer,
  );
}

export function sentenceWithFirstLetterHint(
  question: Pick<VocabularyQuestion, "sent" | "correctFill">,
): string {
  const firstLetter = question.correctFill.match(/\p{L}/u)?.[0];
  return firstLetter ? question.sent.replace(/_+/, (blank) => firstLetter + blank.slice(1)) : question.sent;
}

export function formatDuration(durationMs: number, precise = false): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const clock = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  return precise ? `${clock}.${String(Math.floor(durationMs) % 1000).padStart(3, "0")}` : clock;
}
