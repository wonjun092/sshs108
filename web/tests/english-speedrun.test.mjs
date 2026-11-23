import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
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
  });
  return exports;
}

const rules = loadTS('src/lib/english-quiz.ts');
const { WEDNESDAY_WARS_PART2_TOTAL: total, WEDNESDAY_WARS_RANKING_BOOK: book } = rules;
const learner = { userId: 'u1', loginId: 'learner' };

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

function api(existing = [], session = learner) {
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
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/auth': { getSession: async () => session },
    '@/lib/db': { connectDatabase: async () => {} },
    '@/models/EnglishQuizScore': { EnglishQuizScore: model },
    '@/lib/english-quiz': rules,
  });
  return {
    read: route.GET,
    submit: route.POST,
    post: body => route.POST({ json: async () => body }),
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

test('the ranking API requires a login and rejects invalid or older results', async () => {
  assert.equal((await api([], null).post({ score: total, total, durationMs: 10 })).status, 401);
  const app = api();
  assert.equal((await app.post({ score: total, total: 352, durationMs: 120000 })).status, 400);
  assert.equal((await app.post({ score: 159, total: 159, durationMs: 120000 })).status, 400);
  assert.equal((await app.submit({ json: async () => { throw Error('bad JSON'); } })).status, 400);
  assert.equal(app.records.length, 0);
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
    { book, loginId: 'fasterLowerScore', score: 140, total, durationMs: 30000 },
    { book, loginId: 'slowerEqualScore', score: 141, total, durationMs: 80000 },
    { book, loginId: 'fasterEqualScore', score: 141, total, durationMs: 70000 },
    { book: 'wednesdayWars', loginId: 'original', score: 159, total: 159, durationMs: 20000 },
    { book: 'wednesdayWarsFullYear', loginId: 'fullYear', score: 352, total: 352, durationMs: 10000 },
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

class Element {
  constructor() {
    this.classes = new Set();
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.value = '';
    this.innerText = '';
    this.dataset = {};
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
      toggle: (name, on) => {
        if (on ?? !this.classes.has(name)) this.classes.add(name);
        else this.classes.delete(name);
      },
    };
  }

  set className(value) { this.classes = new Set(value.split(' ')); }
  get className() { return [...this.classes].join(' '); }
  set innerHTML(value) {
    assert.equal(value, '');
    this.replaceChildren();
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = children; }
  focus() {}
  addEventListener(type, listener) { this.listeners[type] = listener; }
  dispatch(type) { this.listeners[type]?.({ target: this }); }
}

function quiz() {
  const html = fs.readFileSync(path.join(root, 'public/legacy/english.html'), 'utf8');
  const elements = {};
  for (const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = elements[tag[1]] = new Element();
    element.className = tag[0].match(/class="([^"]*)"/)?.[1] || '';
    const controls = tag[0].match(/aria-controls="([^"]*)"/)?.[1];
    if (controls) element.setAttribute('aria-controls', controls);
  }

  const requests = [];
  const intervals = new Set();
  let time = 0;
  const getChapters = () => elements['chapter-grid'].children.map(label => label.children[0]);
  const context = vm.createContext({
    document: {
      getElementById: id => {
        assert.ok(elements[id], id);
        return elements[id];
      },
      querySelectorAll: selector => {
        if (selector === '#chapter-grid input') return getChapters();
        if (selector === '#chapter-grid input:checked') return getChapters().filter(input => input.checked);
        if (selector === '.book-tab') return [];
        assert.fail('Unexpected selector ' + selector);
      },
      createElement: () => new Element(),
      createTextNode: text => text,
    },
    window: { addEventListener: () => {} },
    performance: { now: () => time },
    setInterval: callback => {
      intervals.add(callback);
      return callback;
    },
    clearInterval: callback => intervals.delete(callback),
    setTimeout: callback => callback(),
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ rankings: [], total, recorded: true, improved: true }) };
    },
  });
  const run = code => vm.runInContext(code, context);
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  return {
    elements,
    requests,
    intervals,
    run,
    setChapter(chapter, checked) {
      const input = getChapters().find(input => input.value === chapter);
      assert.ok(input, chapter);
      input.checked = checked;
      input.dispatch('change');
    },
    setCount(count) {
      elements['question-count'].value = String(count);
      elements['question-count'].dispatch('input');
    },
    advance(ms) {
      time += ms;
      for (const callback of intervals) callback();
    },
    answer(correct) {
      elements['answer-input'].value = correct ? run('quizData[currentIdx].correctFill') : 'wrong';
      run('checkAnswer()');
    },
  };
}

test('group selection only enables recording for all of Part 2 and no Part 1 chapters', () => {
  const app = quiz();
  const part1 = app.elements['part1-select'];
  const part2 = app.elements['part2-select'];
  const recordOption = app.elements['record-option'];
  const count = () => Number(app.elements['question-count'].value);
  assert.equal(part1.checked, true);
  assert.equal(part2.checked, true);
  assert.equal(count(), 352);
  assert.equal(recordOption.classList.contains('hidden'), true);

  app.run('togglePart(1, false)');
  assert.equal(part1.checked, false);
  assert.equal(part2.checked, true);
  assert.equal(count(), total);
  assert.equal(recordOption.classList.contains('hidden'), false);

  app.setCount(total - 1);
  assert.equal(recordOption.classList.contains('hidden'), true);
  app.setCount(total + 1);
  assert.equal(recordOption.classList.contains('hidden'), true);
  app.setCount(total);
  assert.equal(recordOption.classList.contains('hidden'), false);

  app.setChapter('February-1', false);
  assert.equal(part2.checked, false);
  assert.equal(part2.indeterminate, true);
  assert.equal(recordOption.classList.contains('hidden'), true);
  app.setChapter('February-1', true);
  assert.equal(part2.checked, true);
  assert.equal(part2.indeterminate, false);
  assert.equal(recordOption.classList.contains('hidden'), false);

  app.setChapter('January-1', true);
  assert.equal(part1.indeterminate, true);
  app.setCount(total);
  assert.equal(recordOption.classList.contains('hidden'), true);

  app.run('toggleAll(false); togglePart(1, true)');
  assert.equal(part1.checked, true);
  assert.equal(part2.checked, false);
  assert.equal(count(), 159);
  assert.equal(recordOption.classList.contains('hidden'), true);

  app.run("selectBook('holes')");
  assert.equal(app.elements['wednesday-parts'].classList.contains('hidden'), true);
  assert.equal(recordOption.classList.contains('hidden'), true);
});

test('a scored Part 2 run submits the non-perfect score and frozen time once', async () => {
  const app = quiz();
  app.run('togglePart(1, false); startQuiz()');
  assert.equal(app.elements['quiz-timer'].classList.contains('hidden'), false);
  for (let i = 0; i < total; i++) {
    app.advance(1000);
    app.answer(i !== 0);
    app.run('checkAnswer()'); // A double click cannot add another point.
    if (i < total - 1) app.run('nextQuestion()');
  }
  assert.equal(app.run('score'), total - 1);
  assert.equal(app.intervals.size, 0);
  const finishedTime = app.elements['elapsed-time'].innerText;
  app.advance(30000);
  assert.equal(app.elements['elapsed-time'].innerText, finishedTime);
  app.run('nextQuestion(); nextQuestion()');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.requests.length, 1);
  assert.deepEqual(JSON.parse(app.requests[0].options.body), {
    score: total - 1, total, durationMs: total * 1000,
  });

  app.run('retryWrong()');
  assert.equal(app.elements['quiz-timer'].classList.contains('hidden'), true);
  app.answer(true);
  app.run('nextQuestion()');
  assert.equal(app.requests.length, 1);
});

test('mixed runs and opted-out Part 2 runs are practice, and leaving a scored run clears the timer', async () => {
  const mixed = quiz();
  mixed.setCount(total);
  mixed.run('startQuiz()');
  assert.equal(mixed.intervals.size, 0);
  assert.equal(mixed.elements['quiz-timer'].classList.contains('hidden'), true);

  const optedOut = quiz();
  optedOut.run('togglePart(1, false)');
  optedOut.elements['record-score'].checked = false;
  optedOut.run('startQuiz()');
  assert.equal(optedOut.intervals.size, 0);

  const abandoned = quiz();
  abandoned.run('togglePart(1, false); startQuiz()');
  abandoned.advance(61000);
  assert.equal(abandoned.elements['elapsed-time'].innerText, '01:01');
  await abandoned.run('showRanking()');
  assert.equal(abandoned.intervals.size, 0);
  assert.equal(abandoned.requests[0].options.method ?? 'GET', 'GET');
});
