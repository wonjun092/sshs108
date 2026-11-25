"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  books,
  formatDuration,
  isCorrectAnswer,
  isRankedRange,
  sentenceWithFirstLetterHint,
  wednesdayParts,
  type BookKey,
} from "./quiz-rules";
import type { VocabularyQuestion } from "./vocabulary";
import styles from "./english.module.css";

type Run = {
  questions: readonly VocabularyQuestion[];
  startedAt: number | null;
  showFirstLetter: boolean;
};

type QuizResult = {
  score: number;
  total: number;
  wrongQuestions: VocabularyQuestion[];
  durationMs: number | null;
  showFirstLetter: boolean;
};

type RankingSave =
  | { kind: "off" }
  | { kind: "nickname"; message?: string }
  | { kind: "saving"; asGuest: boolean }
  | { kind: "done"; message: string };

type Screen =
  | { kind: "setup" }
  | { kind: "quiz"; run: Run }
  | { kind: "result"; result: QuizResult; save: RankingSave }
  | { kind: "ranking"; visit: number };

type RankedEntry = {
  rank: number;
  loginId: string;
  score: number;
  total: number;
  durationMs: number;
  isGuest?: boolean;
};

const rankingURL = "/api/english-ranking";
const parts = [1, 2] as const;

function shuffle(questions: readonly VocabularyQuestion[]) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function Setup({
  bookKey,
  visible,
  onStart,
}: {
  bookKey: BookKey;
  visible: boolean;
  onStart: (run: Run) => void;
}) {
  const book = books[bookKey];
  const chapters = [...new Set(book.vocabulary.map(({ ch }) => ch))];
  const [selected, setSelected] = useState(() => new Set(chapters));
  const [count, setCount] = useState(() => String(book.vocabulary.length));
  const [showFirstLetter, setShowFirstLetter] = useState(false);
  const [recordScore, setRecordScore] = useState(true);
  const candidates = book.vocabulary.filter(({ ch }) => selected.has(ch));
  const eligible = isRankedRange(bookKey, selected, Number(count));

  function updateCount(nextChapters: Set<string>, nextCount: string) {
    if (!eligible && isRankedRange(bookKey, nextChapters, Number(nextCount))) {
      setRecordScore(true);
    }
    setCount(nextCount);
  }

  function selectChapters(changes: Iterable<string>, checked: boolean) {
    const next = new Set(selected);
    for (const chapter of changes) {
      if (checked) next.add(chapter);
      else next.delete(chapter);
    }
    setSelected(next);
    updateCount(next, String(book.vocabulary.filter(({ ch }) => next.has(ch)).length));
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.size) {
      window.alert("챕터를 선택하세요!");
      return;
    }

    const requested = Number(count);
    if (!Number.isInteger(requested) || requested < 1) {
      window.alert("문제 수를 1 이상의 정수로 입력하세요!");
      return;
    }

    onStart({
      questions: shuffle(candidates).slice(0, requested),
      startedAt: eligible && recordScore ? performance.now() : null,
      showFirstLetter,
    });
  }

  return (
    <form id="setup-section" className={styles.card} hidden={!visible} onSubmit={start} noValidate>
      <h2>시험 범위 설정</h2>
      <p id="range-help" className={styles.rangeHelp}>{book.rangeHelp}</p>
      <div className={styles.scopeControls}>
        <button type="button" onClick={() => selectChapters(chapters, true)}>전체 선택</button>
        <button type="button" className={styles.muted} onClick={() => selectChapters(chapters, false)}>
          전체 해제
        </button>
      </div>

      {bookKey === "wednesdayWars" && (
        <div id="wednesday-parts" className={styles.chapterParts} role="group" aria-label="파트별 전체 선택">
          {parts.map((part) => {
            const group = wednesdayParts[part];
            const selectedCount = [...group].filter((ch) => selected.has(ch)).length;
            return (
              <label key={part} className={styles.chapterItem}>
                <input
                  type="checkbox"
                  id={`part${part}-select`}
                  checked={selectedCount === group.size}
                  ref={(input) => {
                    if (input) input.indeterminate = selectedCount > 0 && selectedCount < group.size;
                  }}
                  onChange={(event) => selectChapters(group, event.target.checked)}
                />
                {part === 1 ? "Part 1 (9~1월) 전체 선택" : "Part 2 (2~6월) 전체 선택"}
              </label>
            );
          })}
        </div>
      )}

      <div id="chapter-grid" className={styles.chapterGrid}>
        {chapters.map((chapter) => (
          <label key={chapter} className={styles.chapterItem}>
            <input
              type="checkbox"
              value={chapter}
              checked={selected.has(chapter)}
              onChange={(event) => selectChapters([chapter], event.target.checked)}
            />
            {book.chapterLabel(chapter)}
          </label>
        ))}
      </div>

      <label htmlFor="question-count">
        문제 수 (선택 범위 내 최대 <strong id="max-count" className={styles.maxCount}>{candidates.length}</strong>개):
      </label>
      <input
        type="number"
        id="question-count"
        value={count}
        onChange={(event) => updateCount(selected, event.target.value)}
      />

      <label className={styles.chapterItem}>
        <input
          type="checkbox"
          id="first-letter-hint"
          checked={showFirstLetter}
          onChange={(event) => setShowFirstLetter(event.target.checked)}
        />
        첫 글자 힌트 켜기
      </label>

      {eligible && (
        <div id="record-option" className={styles.recordOption}>
          <label>
            <input type="checkbox" id="record-score" checked={recordScore} onChange={(event) => setRecordScore(event.target.checked)} />
            기록 재기
          </label>
          <span className={styles.recordNote}>Part 2의 맞힌 개수와 소요 시간을 랭킹에 기록합니다.</span>
        </div>
      )}

      <button type="submit" className={styles.startButton}>테스트 시작</button>
    </form>
  );
}

function QuestionPrompt({ question, showFirstLetter }: { question: VocabularyQuestion; showFirstLetter: boolean }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const hints = [
    { buttonId: "definition-toggle", panelId: "display-def", label: "영-영 풀이", text: question.definition?.trim() },
    { buttonId: "korean-meaning-toggle", panelId: "display-korean-meaning", label: "한글 뜻", text: question.koreanMeaning?.trim() },
    { buttonId: "hint-toggle", panelId: "display-hint", label: question.hintType ? `추가 힌트 (${question.hintType})` : "추가 힌트", text: question.hint?.trim() },
  ].filter(({ text }) => text);

  function toggle(panelId: string) {
    const next = new Set(open);
    if (next.has(panelId)) next.delete(panelId);
    else next.add(panelId);
    setOpen(next);
  }

  return (
    <div className={styles.questionBox}>
      <div id="display-sent" className={styles.sentence}>
        {showFirstLetter ? sentenceWithFirstLetterHint(question) : question.sent}
      </div>
      {hints.length > 0 && (
        <div className={styles.hintControls}>
          {hints.map(({ buttonId, panelId, label }) => (
            <button type="button" key={buttonId} id={buttonId} className={styles.hintToggle} aria-expanded={open.has(panelId)} aria-controls={panelId} onClick={() => toggle(panelId)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {hints.map(({ panelId, label, text }) => (
        <div key={panelId} id={panelId} className={styles.definition} hidden={!open.has(panelId)}>{label}: {text}</div>
      ))}
    </div>
  );
}

function Timer({ startedAt, durationMs }: { startedAt: number; durationMs: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (durationMs !== null) return;
    const timer = window.setInterval(() => setElapsed(performance.now() - startedAt), 250);
    return () => window.clearInterval(timer);
  }, [startedAt, durationMs]);

  return (
    <div id="quiz-timer" className={styles.quizTimer} role="timer" aria-label="경과 시간">
      경과 시간 <span id="elapsed-time">{formatDuration(durationMs ?? elapsed)}</span>
    </div>
  );
}

function Question({
  question,
  showFirstLetter,
  chapter,
  progress,
  answer,
  onAnswer,
  onNext,
}: {
  question: VocabularyQuestion;
  showFirstLetter: boolean;
  chapter: string;
  progress: string;
  answer: boolean | undefined;
  onAnswer: (value: string) => void;
  onNext: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answer === undefined) {
      onAnswer(input.current?.value ?? "");
      input.current?.focus();
    } else {
      onNext();
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={(event) => {
      if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
    }}>
      <div className={styles.quizInfo}>
        <div id="progress" className={styles.progress}>{progress}</div>
        <div id="display-chap" className={styles.chapterTag}>{chapter}</div>
      </div>
      <QuestionPrompt question={question} showFirstLetter={showFirstLetter} />
      <input
        ref={input}
        type="text"
        id="answer-input"
        placeholder="정답 단어를 입력하세요"
        aria-label="정답 단어"
        autoComplete="off"
        readOnly={answer !== undefined}
      />
      {answer !== undefined && (
        <div id="feedback" role="status" className={`${styles.feedback} ${answer ? styles.correct : styles.incorrect}`}>
          {answer ? "정답입니다! ✨" : `틀렸습니다. 정답: [ ${question.correctFill} ]`}
        </div>
      )}
      <button type="submit" id={answer === undefined ? "submit-btn" : "next-btn"} className={styles.fullWidth}>
        {answer === undefined ? "정답 확인" : "다음 문제"}
      </button>
    </form>
  );
}

function ActiveQuiz({ bookKey, run, onFinish }: { bookKey: BookKey; run: Run; onFinish: (result: QuizResult) => void }) {
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [index, setIndex] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const finished = useRef(false);
  const question = run.questions[index];

  function answer(value: string) {
    setAnswers([...answers, isCorrectAnswer(question, value)]);
    if (index === run.questions.length - 1 && run.startedAt !== null) {
      setDurationMs(Math.max(1, Math.round(performance.now() - run.startedAt)));
    }
  }

  function next() {
    if (index + 1 < run.questions.length) {
      setIndex(index + 1);
    } else if (!finished.current) {
      finished.current = true;
      const wrongQuestions = run.questions.filter((_, answerIndex) => !answers[answerIndex]);
      onFinish({
        score: run.questions.length - wrongQuestions.length,
        total: run.questions.length,
        wrongQuestions,
        durationMs,
        showFirstLetter: run.showFirstLetter,
      });
    }
  }

  return (
    <section id="quiz-section" className={styles.card}>
      {run.startedAt !== null && <Timer startedAt={run.startedAt} durationMs={durationMs} />}
      <Question
        key={index}
        question={question}
        showFirstLetter={run.showFirstLetter}
        chapter={books[bookKey].quizChapterLabel(question.ch)}
        progress={`문제 ${index + 1} / ${run.questions.length}`}
        answer={answers[index]}
        onAnswer={answer}
        onNext={next}
      />
    </section>
  );
}

function Ranking() {
  const [entries, setEntries] = useState<RankedEntry[]>([]);
  const [status, setStatus] = useState("기록을 불러오는 중입니다.");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(rankingURL, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { rankings?: RankedEntry[]; error?: string };
        if (!response.ok || !Array.isArray(data.rankings)) {
          throw new Error(data.error || "랭킹 불러오기 실패");
        }
        if (controller.signal.aborted) return;
        setEntries(data.rankings);
        setStatus(data.rankings.length ? "" : "아직 등록된 기록이 없습니다.");
      } catch (error) {
        if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "랭킹을 불러오지 못했습니다.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return (
    <section id="ranking-section" className={styles.card}>
      <h2>Wednesday Wars Part 2 랭킹</h2>
      <p className={styles.rankingStatus}>맞힌 개수가 많은 순으로 표시합니다. 개수가 같으면 시간이 짧은 기록이 앞섭니다.</p>
      <p id="ranking-status" className={styles.rankingStatus} role="status">{status}</p>
      <ol id="ranking-list" className={styles.rankingList}>
        {entries.map((entry) => (
          <li key={entry.rank} className={styles.rankingRow} data-rank={entry.rank}>
            <span className={styles.rankBadge}>{entry.rank}</span>
            <span className={styles.rankingUser}>
              {entry.loginId}
              {entry.isGuest && <span className={styles.guestLabel}>게스트</span>}
            </span>
            <div className={styles.rankingScore}>
              {entry.score} / {entry.total}
              <span className={styles.rankingDuration}>{formatDuration(entry.durationMs, true)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GuestRankingForm({ saving, onSave }: { saving: boolean; onSave: (name: string) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guestName = new FormData(event.currentTarget).get("guestName");
    if (!saving && typeof guestName === "string") onSave(guestName.trim());
  }

  return (
    <form className={styles.guestForm} onSubmit={submit}>
      <label htmlFor="ranking-guest-name">랭킹에 공개될 닉네임</label>
      <p id="ranking-guest-note" className={styles.recordNote}>실명이나 연락처 없이 2~20자로 입력하세요.</p>
      <input type="text" id="ranking-guest-name" name="guestName" minLength={2} maxLength={20} required autoComplete="off" aria-describedby="ranking-guest-note" disabled={saving} />
      <button type="submit" id="save-guest-ranking" className={styles.fullWidth} disabled={saving}>랭킹에 기록하기</button>
    </form>
  );
}

export default function EnglishQuiz({ isAuthenticated, sidebar }: { isAuthenticated: boolean; sidebar: ReactNode }) {
  const [bookKey, setBookKey] = useState<BookKey>("wednesdayWars");
  const [setupRevision, setSetupRevision] = useState(0);
  const [screen, setScreen] = useState<Screen>({ kind: "setup" });
  const submittedResults = useRef(new WeakSet<QuizResult>());
  const ranking = screen.kind === "ranking";

  function selectBook(nextBook: BookKey) {
    setBookKey(nextBook);
    setSetupRevision((revision) => revision + 1);
    setScreen({ kind: "setup" });
  }

  function finish(result: QuizResult) {
    if (result.durationMs === null) {
      setScreen({ kind: "result", result, save: { kind: "off" } });
    } else if (isAuthenticated) {
      setScreen({ kind: "result", result, save: { kind: "saving", asGuest: false } });
      void saveResult(result);
    } else {
      setScreen({ kind: "result", result, save: { kind: "nickname" } });
    }
  }

  function updateSave(result: QuizResult, save: RankingSave) {
    setScreen((current) => current.kind === "result" && current.result === result ? { ...current, save } : current);
  }

  async function saveResult(result: QuizResult, guestName?: string) {
    if (result.durationMs === null || submittedResults.current.has(result)) return;

    const asGuest = guestName !== undefined;
    if (asGuest && guestName.length < 2) {
      updateSave(result, { kind: "nickname", message: "닉네임을 2~20자로 입력하세요." });
      return;
    }

    submittedResults.current.add(result);
    updateSave(result, { kind: "saving", asGuest });

    try {
      const response = await fetch(rankingURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: result.score, total: result.total, durationMs: result.durationMs, guestName }),
      });
      const data = await response.json() as { improved?: boolean; error?: string; requiresNickname?: boolean };
      if (response.status === 401 && data.requiresNickname && !asGuest) {
        submittedResults.current.delete(result);
        updateSave(result, { kind: "nickname" });
        return;
      }
      if (!response.ok) throw new Error(data.error || "기록 저장 실패");
      const message = data.improved ? "새 최고 기록이 저장되었습니다." : "기존 최고 기록을 유지했습니다.";
      updateSave(result, { kind: "done", message });
    } catch (error) {
      submittedResults.current.delete(result);
      const message = error instanceof Error ? error.message : "기록을 저장하지 못했습니다.";
      updateSave(result, asGuest ? { kind: "nickname", message } : { kind: "done", message });
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          {sidebar}
          <h1 id="book-title">{ranking ? "🏆 Wednesday Wars Part 2 Ranking" : `📖 ${books[bookKey].title}`}</h1>
        </div>
        <div className={styles.bookSelector} role="group" aria-label="책 선택">
          <button type="button" className={styles.bookTab} data-book="holes" aria-pressed={!ranking && bookKey === "holes"} onClick={() => selectBook("holes")}>Holes</button>
          <button type="button" className={styles.bookTab} data-book="wednesdayWars" aria-pressed={!ranking && bookKey === "wednesdayWars"} onClick={() => selectBook("wednesdayWars")}>Wednesday Wars</button>
          <button type="button" id="ranking-tab" className={styles.bookTab} aria-pressed={ranking} onClick={() => setScreen((current) => ({ kind: "ranking", visit: current.kind === "ranking" ? current.visit + 1 : 0 }))}>Ranking</button>
        </div>
      </header>

      <main className={styles.container}>
        <Setup key={setupRevision} bookKey={bookKey} visible={screen.kind === "setup"} onStart={(run) => setScreen({ kind: "quiz", run })} />
        {screen.kind === "quiz" && <ActiveQuiz bookKey={bookKey} run={screen.run} onFinish={finish} />}
        {screen.kind === "result" && (
          <section id="result-section" className={`${styles.card} ${styles.result}`}>
            <h2>시험 결과</h2>
            <div id="final-score" className={styles.finalScore}>{screen.result.score} / {screen.result.total}</div>
            <div id="record-status" className={styles.recordStatus} role="status">
              {screen.save.kind === "saving" && "기록을 저장하는 중입니다..."}
              {(screen.save.kind === "nickname" || screen.save.kind === "done") && screen.save.message}
            </div>
            {screen.result.durationMs !== null && (
              <div id="final-duration" className={styles.finalDuration}>
                소요 시간 {formatDuration(screen.result.durationMs, true)}{screen.result.score === screen.result.total && " · 전부 정답!"}
              </div>
            )}
            {(screen.save.kind === "nickname" || (screen.save.kind === "saving" && screen.save.asGuest)) && (
              <GuestRankingForm saving={screen.save.kind === "saving"} onSave={(guestName) => void saveResult(screen.result, guestName)} />
            )}
            {screen.result.wrongQuestions.length > 0 && (
              <button
                type="button"
                id="retry-wrong-btn"
                className={`${styles.fullWidth} ${styles.retry}`}
                onClick={() => setScreen({
                  kind: "quiz",
                  run: { questions: shuffle(screen.result.wrongQuestions), startedAt: null, showFirstLetter: screen.result.showFirstLetter },
                })}
              >
                틀린 문제만 다시 풀기 ({screen.result.wrongQuestions.length}개)
              </button>
            )}
            <button type="button" className={`${styles.fullWidth} ${styles.muted}`} onClick={() => setScreen({ kind: "setup" })}>범위 다시 선택하기</button>
          </section>
        )}
        {screen.kind === "ranking" && <Ranking key={screen.visit} />}
      </main>
    </div>
  );
}
