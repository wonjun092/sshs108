import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NextResponse } from 'next/server.js';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadTS(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: name => {
      assert.ok(name in imports, 'Unexpected import ' + name);
      return imports[name];
    },
    Date,
    process,
    URL,
  });
  return exports;
}

const rules = loadTS('src/lib/english-quiz.ts');
const { WEDNESDAY_WARS_PART2_TOTAL: total, WEDNESDAY_WARS_RANKING_BOOK: book } = rules;
const learner = { userId: 'u1', loginId: 'learner' };
const guestCookieName = 'sshs108_english_guest';
const apiPath = '/api/english-ranking';
const apiOrigin = 'http://localhost';

function matches(entry, filter) {
  return Object.entries(filter).every(([field, value]) => {
    if (field === '$or') return value.some(condition => matches(entry, condition));
    if (value && typeof value === 'object') {
      if ('$lt' in value) return entry[field] < value.$lt;
      if ('$gt' in value) return entry[field] > value.$gt;
      assert.fail('Unexpected comparison for ' + field);
    }
    return entry[field] === value;
  });
}

function api(existing = [], session = learner, guestCookie) {
  const records = existing.map(entry => ({ ...entry }));
  const model = {
    find(filter) {
      let sortFields;
      let maxRows;
      const query = {
        sort(fields) {
          sortFields = fields;
          return query;
        },
        limit(count) {
          maxRows = count;
          return query;
        },
        async lean() {
          return records.filter(entry => matches(entry, filter)).sort((a, b) => {
            for (const [field, direction] of Object.entries(sortFields)) {
              if (a[field] < b[field]) return -direction;
              if (a[field] > b[field]) return direction;
            }
            return 0;
          }).slice(0, maxRows);
        },
      };
      return query;
    },
    async updateOne(filter, update, options) {
      const matching = records.find(entry => matches(entry, filter));
      if (!matching && options?.upsert) {
        records.push({ ...update.$setOnInsert });
        return { upsertedCount: 1, modifiedCount: 0 };
      }
      if (matching && update.$set) {
        Object.assign(matching, update.$set);
        return { upsertedCount: 0, modifiedCount: 1 };
      }
      return { upsertedCount: 0, modifiedCount: 0 };
    },
  };
  const route = loadTS('src/app/api/english-ranking/route.ts', {
    'node:crypto': { randomUUID },
    'next/server': { NextResponse },
    'next/headers': { cookies: async () => ({
      get: name => name === guestCookieName && guestCookie ? { name, value: guestCookie } : undefined,
    }) },
    '@/lib/auth': { getSession: async () => session },
    '@/lib/db': { connectDatabase: async () => {} },
    '@/models/EnglishQuizScore': { EnglishQuizScore: model },
    '@/lib/english-quiz': rules,
  });
  return {
    read: route.GET,
    submit: route.POST,
    post: (body, origin = apiOrigin, fetchSite) => route.POST(new Request(apiOrigin + apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...(fetchSite ? { 'Sec-Fetch-Site': fetchSite } : {}) },
      body: JSON.stringify(body),
    })),
    records,
  };
}

test('a Part 2 result requires an integer score and a positive integer duration', () => {
  assert.equal(total, 193);
  assert.ok(rules.parseEnglishQuizRecord({ score: total, total, durationMs: 120000 }));
  assert.ok(rules.parseEnglishQuizRecord({ score: 0, total, durationMs: 120000 }));
  const invalid = [
    null,
    {},
    { score: 120, total },
    { score: total + 1, total, durationMs: 120000 },
    { score: 1.5, total, durationMs: 120000 },
    { score: -1, total, durationMs: 120000 },
    ...[159, 192, 352].map(otherTotal => ({ score: 120, total: otherTotal, durationMs: 120000 })),
    ...[null, 0, -1, 1.5, Infinity, NaN, '10', Number.MAX_SAFE_INTEGER + 1]
      .map(durationMs => ({ score: 120, total, durationMs })),
  ];
  for (const body of invalid) assert.equal(rules.parseEnglishQuizRecord(body), null);
});

test('the ranking API rejects invalid or older results', async () => {
  const app = api();
  assert.equal((await app.post({ score: total, total: 352, durationMs: 120000 })).status, 400);
  assert.equal((await app.post({ score: 159, total: 159, durationMs: 120000 })).status, 400);
  assert.equal((await app.submit({ json: async () => { throw Error('bad JSON'); } })).status, 400);
  assert.equal(app.records.length, 0);
});

test('guest records require a valid nickname and the same Part 2 result as signed-in records', async () => {
  const app = api([], null);
  const result = { score: 140, total, durationMs: 60000 };
  const missing = await app.post(result);
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).requiresNickname, true);
  for (const guestName of [null, 42, ' ', 'X', 'a'.repeat(21), 'user@example.com', '<b>name</b>']) {
    assert.equal((await app.post({ ...result, guestName })).status, 400);
  }
  assert.equal((await app.post({ ...result, total: 352, guestName: 'Star' })).status, 400);
  assert.equal((await app.post({ ...result, guestName: 'Star' }, 'http://elsewhere.invalid')).status, 403);
  assert.equal((await app.post({ ...result, guestName: 'Star' }, apiOrigin, 'cross-site')).status, 403);
  assert.equal(app.records.length, 0);
});

test('guest nicknames are public while the browser cookie only updates its own best', async () => {
  const firstBrowser = api([], null);
  const firstResult = await firstBrowser.post(
    { score: 140, total, durationMs: 60000, guestName: '  별빛  수달  ' },
    'https://public-quiz.example',
    'same-origin',
  );
  assert.equal(firstResult.status, 200);
  assert.deepEqual(await firstResult.json(), { recorded: true, improved: true });

  const cookie = firstResult.cookies.get(guestCookieName);
  assert.ok(cookie);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'lax');
  assert.equal(cookie.path, apiPath);
  assert.equal(firstBrowser.records[0].userId, `guest:${cookie.value}`);

  const returningBrowser = api(firstBrowser.records, null, cookie.value);
  const best = await returningBrowser.post({ score: 140, total, durationMs: 50000, guestName: '별빛 수달' });
  assert.deepEqual(await best.json(), { recorded: true, improved: true });
  const worse = await returningBrowser.post({ score: 139, total, durationMs: 40000, guestName: '별빛 수달' });
  assert.deepEqual(await worse.json(), { recorded: true, improved: false });
  assert.equal(returningBrowser.records.length, 1);
  assert.equal(returningBrowser.records[0].userId, firstBrowser.records[0].userId);

  const secondBrowser = api(returningBrowser.records, null);
  const secondResult = await secondBrowser.post({ score: 141, total, durationMs: 55000, guestName: '별빛 수달' });
  assert.equal(secondResult.status, 200);
  assert.equal(secondBrowser.records.length, 2);
  assert.notEqual(secondResult.cookies.get(guestCookieName)?.value, cookie.value);
  assert.notEqual(secondBrowser.records[0].userId, secondBrowser.records[1].userId);
  const { rankings } = await (await secondBrowser.read()).json();
  assert.deepEqual(rankings, [
    { rank: 1, loginId: '별빛 수달', score: 141, total, durationMs: 55000, isGuest: true },
    { rank: 2, loginId: '별빛 수달', score: 140, total, durationMs: 50000, isGuest: true },
  ]);
});

test('the signed-in account takes priority over a guest nickname and cookie', async () => {
  const app = api([], learner, randomUUID());
  const response = await app.post({ score: 140, total, durationMs: 60000, guestName: 'Star' });
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get(guestCookieName), undefined);
  assert.equal(app.records[0].userId, learner.userId);
  const { rankings } = await (await app.read()).json();
  assert.deepEqual(rankings, [{ rank: 1, loginId: learner.loginId, score: 140, total, durationMs: 60000 }]);
});

test('a personal best prefers a better score and then a faster run at that score', async () => {
  const app = api();
  for (const [score, durationMs, improved] of [
    [140, 60000, true],
    [139, 50000, false],
    [141, 80000, true],
    [141, 81000, false],
    [141, 80000, false],
    [141, 70000, true],
  ]) {
    const response = await app.post({ score, total, durationMs });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { recorded: true, improved });
  }
  const { rankings } = await (await app.read()).json();
  assert.deepEqual(rankings, [{ rank: 1, loginId: 'learner', score: 141, total, durationMs: 70000 }]);
});

test('the leaderboard sorts Part 2 records by score before elapsed time', async () => {
  const app = api([
    { book, userId: 'u2', loginId: 'fasterLowerScore', score: 140, total, durationMs: 30000 },
    { book, userId: 'u3', loginId: 'slowerEqualScore', score: 141, total, durationMs: 80000 },
    { book, userId: 'u4', loginId: 'fasterEqualScore', score: 141, total, durationMs: 70000 },
    { book: 'wednesdayWars', userId: 'u5', loginId: 'original', score: 159, total: 159, durationMs: 20000 },
    { book: 'wednesdayWarsFullYear', userId: 'u6', loginId: 'fullYear', score: 352, total: 352, durationMs: 10000 },
  ]);
  const data = await (await app.read()).json();
  assert.equal(data.total, total);
  assert.deepEqual(data.rankings, [
    { rank: 1, loginId: 'fasterEqualScore', score: 141, total, durationMs: 70000 },
    { rank: 2, loginId: 'slowerEqualScore', score: 141, total, durationMs: 80000 },
    { rank: 3, loginId: 'fasterLowerScore', score: 140, total, durationMs: 30000 },
  ]);
});

test('simultaneous results keep the fastest time at the highest score', async () => {
  const app = api();
  await Promise.all([
    app.post({ score: 141, total, durationMs: 60000 }),
    app.post({ score: 141, total, durationMs: 50000 }),
    app.post({ score: 140, total, durationMs: 40000 }),
    app.post({ score: 141, total, durationMs: 70000 }),
  ]);
  assert.equal(app.records.length, 1);
  assert.equal(app.records[0].score, 141);
  assert.equal(app.records[0].durationMs, 50000);
});

const vocabulary = loadTS('src/app/english/vocabulary.ts');
const { books, wednesdayParts, isRankedRange, isCorrectAnswer, sentenceWithFirstLetterHint, formatDuration } =
  loadTS('src/app/english/quiz-rules.ts', {
    './vocabulary': vocabulary,
    '@/lib/english-quiz': rules,
  });

test('both book catalogs preserve their original chapters and question counts', () => {
  assert.equal(books.holes.vocabulary.length, 81);
  assert.equal(new Set(books.holes.vocabulary.map(question => question.ch)).size, 19);
  assert.equal(books.holes.chapterLabel('45-46'), 'Ch.45-46');
  assert.equal(books.holes.quizChapterLabel('45-46'), 'Chapter 45-46');

  const wednesdayWords = books.wednesdayWars.vocabulary;
  assert.equal(wednesdayWords.length, 352);
  assert.equal(wednesdayParts[1].size, 10);
  assert.deepEqual([...wednesdayParts[2]], [
    'February-1', 'February-2', 'March-1', 'March-2', 'April-1', 'April-2',
    'May-1', 'May-2', 'June-1', 'June-2',
  ]);
  assert.equal(wednesdayWords.filter(question => wednesdayParts[1].has(question.ch)).length, 159);
  assert.equal(wednesdayWords.filter(question => wednesdayParts[2].has(question.ch)).length, total);
  assert.equal([...wednesdayParts[1]].some(chapter => wednesdayParts[2].has(chapter)), false);
});

test('ranked quizzes require exactly the Part 2 chapters and every Part 2 question', () => {
  const part1 = wednesdayParts[1];
  const part2 = wednesdayParts[2];
  const mixed = new Set([...part1, ...part2]);
  const incomplete = new Set([...part2].filter(chapter => chapter !== 'February-1'));
  const sameSizeWrongChapters = new Set([...incomplete, 'January-1']);

  assert.equal(isRankedRange('wednesdayWars', part2, total), true);
  assert.equal(isRankedRange('wednesdayWars', part2, total - 1), false);
  assert.equal(isRankedRange('wednesdayWars', part2, total + 1), false);
  assert.equal(isRankedRange('wednesdayWars', part1, 159), false);
  assert.equal(isRankedRange('wednesdayWars', mixed, total), false);
  assert.equal(isRankedRange('wednesdayWars', incomplete, total), false);
  assert.equal(isRankedRange('wednesdayWars', sameSizeWrongChapters, total), false);
  assert.equal(isRankedRange('holes', part2, total), false);
});

test('answer checking preserves the original answers, accepted variants, and normalization', () => {
  const phrase = books.holes.vocabulary.find(question => question.word === 'keep an eye out');
  const verb = books.wednesdayWars.vocabulary.find(question => question.word === 'suspend');
  assert.ok(phrase);
  assert.ok(verb);
  assert.equal(isCorrectAnswer(phrase, ' kept  AN eye out '), true);
  assert.equal(isCorrectAnswer(phrase, 'keep an eye out'), true);
  assert.equal(isCorrectAnswer(phrase, 'keep an eye'), false);
  assert.equal(isCorrectAnswer(verb, 'SUSPEND'), true);
  assert.equal(isCorrectAnswer(verb, ''), false);
  assert.equal(isCorrectAnswer({ ...phrase, correctFill: "'take the eye'" }, '‘take the eye’'), true);
});

test('the first-letter hint reveals only the initial letter at the first blank', () => {
  assert.equal(sentenceWithFirstLetterHint({ sent: 'The _____ is _____.', correctFill: 'word' }), 'The w____ is _____.');
  assert.equal(sentenceWithFirstLetterHint({ sent: '____!', correctFill: '“Élan”' }), 'É___!');
  assert.equal(sentenceWithFirstLetterHint({ sent: 'No blank.', correctFill: 'word' }), 'No blank.');
  assert.equal(sentenceWithFirstLetterHint({ sent: '____!', correctFill: '123' }), '____!');
});

test('ranked results retain millisecond precision while the live clock shows whole seconds', () => {
  assert.equal(formatDuration(61005), '01:01');
  assert.equal(formatDuration(61005, true), '01:01.005');
  assert.equal(formatDuration(0, true), '00:00.000');
});
