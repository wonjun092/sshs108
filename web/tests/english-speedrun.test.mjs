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
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }, Date });
  return exports;
}
const rules = loadTS('src/lib/english-quiz.ts');

function api(existing, session = { userId: 'u1', loginId: 'learner' }) {
  let stored = existing && { ...existing };
  const queries = [];
  const model = {
    find: filter => {
      const query = { filter };
      queries.push(query);
      return {
        sort: sort => { query.sort = sort; return {
          limit: limit => { query.limit = limit; return { lean: async () =>
            stored && (!filter.speedrunDurationMs || (stored.score === 159 && stored.total === 159 && stored.speedrunDurationMs > 0)) ? [stored] : [],
          }; },
        }; },
      };
    },
    updateOne: async (filter, update, options) => {
      assert.equal(filter.userId, session.userId);
      assert.equal(filter.book, 'wednesdayWars');
      if (options?.upsert) {
        if (stored) return { upsertedCount: 0, modifiedCount: 0 };
        stored = { ...update.$setOnInsert };
        return { upsertedCount: 1, modifiedCount: 0 };
      }
      if (filter.score) {
        if (stored.score >= filter.score.$lt) return { modifiedCount: 0 };
        Object.assign(stored, update.$set);
        return { modifiedCount: 1 };
      }
      const duration = filter.$or[2].speedrunDurationMs.$gt;
      if (stored.speedrunDurationMs == null || stored.speedrunDurationMs > duration) {
        Object.assign(stored, update.$set);
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    },
  };
  const route = loadTS('src/app/api/english-ranking/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/auth': { getSession: async () => session },
    '@/lib/db': { connectDatabase: async () => {} },
    '@/models/EnglishQuizScore': { EnglishQuizScore: model },
    '@/lib/english-quiz': rules,
  });
  return { ...route, get stored() { return stored; }, queries,
    post: body => route.POST({ json: async () => body }),
  };
}

test('only valid full-range records and positive integer durations are accepted', () => {
  assert.ok(rules.parseEnglishQuizRecord({ score: 159, total: 159, durationMs: 120000 }));
  assert.ok(rules.parseEnglishQuizRecord({ score: 120, total: 159 }));
  for (const body of [null, {}, {score:160,total:159}, {score:159,total:158}, {score:1.5,total:159},
    ...[null, 0, -1, 1.5, Infinity, NaN, '10', Number.MAX_SAFE_INTEGER + 1].map(durationMs => ({score:159,total:159,durationMs}))]) {
    assert.equal(rules.parseEnglishQuizRecord(body), null);
  }
});

test('API requires login and rejects malformed input', async () => {
  assert.equal((await api(null, null).post({score:159,total:159,durationMs:10})).status, 401);
  assert.equal((await api().post({score:159,total:10})).status, 400);
  assert.equal((await api().POST({json: async () => { throw Error('bad JSON'); }})).status, 400);
});

test('perfect timed runs keep only the fastest personal best and preserve score ranking', async () => {
  const app = api({score:159,total:159,loginId:'learner'});
  let response = await (await app.post({score:159,total:159,durationMs:100000})).json();
  assert.equal(response.improved, false);
  assert.equal(response.speedrunImproved, true);
  const firstDate = app.stored.speedrunAchievedAt;
  for (const durationMs of [120000,100000]) {
    response = await (await app.post({score:159,total:159,durationMs})).json();
    assert.equal(response.speedrunImproved, false);
    assert.equal(app.stored.speedrunDurationMs, 100000);
    assert.equal(app.stored.speedrunAchievedAt, firstDate);
  }
  response = await (await app.post({score:159,total:159,durationMs:90000})).json();
  assert.equal(response.speedrunImproved, true);
  assert.equal(app.stored.speedrunDurationMs, 90000);
  await app.post({score:158,total:159,durationMs:1000});
  assert.equal(app.stored.speedrunDurationMs, 90000);
  assert.equal(app.stored.score, 159);
});

test('new perfect run records both boards; incomplete and legacy runs do not create speedruns', async () => {
  const perfect = api();
  const result = await (await perfect.post({score:159,total:159,durationMs:80000})).json();
  assert.equal(result.improved, true);
  assert.equal(result.speedrunImproved, true);
  for (const body of [{score:158,total:159,durationMs:50000},{score:159,total:159}]) {
    const app = api();
    const result = await (await app.post(body)).json();
    assert.equal(result.recorded, true);
    assert.equal(result.speedrunEligible, false);
    assert.equal(app.stored.speedrunDurationMs, undefined);
  }
});

test('GET sorts times ascending and excludes untimed historical scores', async () => {
  const app = api({score:159,total:159,loginId:'learner'});
  let response = await (await app.GET()).json();
  assert.equal(response.rankings.length, 1);
  assert.equal(response.speedruns.length, 0);
  assert.equal(app.queries[1].filter.score, 159);
  assert.equal(app.queries[1].sort.speedrunDurationMs, 1);
  assert.equal(app.queries[0].sort.score, -1);
  await app.post({score:159,total:159,durationMs:80000});
  response = await (await app.GET()).json();
  assert.deepEqual(response.speedruns, [{rank:1,loginId:'learner',durationMs:80000}]);
});

test('simultaneous results cannot downgrade a perfect score or a faster time', async () => {
  const app = api({score:150,total:159,loginId:'learner'});
  await Promise.all([
    app.post({score:159,total:159,durationMs:50000}),
    app.post({score:158,total:159,durationMs:40000}),
    app.post({score:159,total:159,durationMs:60000}),
  ]);
  assert.equal(app.stored.score,159);
  assert.equal(app.stored.speedrunDurationMs,50000);
});

class Element {
  constructor() {
    this.classes = new Set(); this.attributes = {}; this.children = []; this.value = ''; this.innerText = '';
    this.classList = {
      add: x => this.classes.add(x), remove: x => this.classes.delete(x), contains: x => this.classes.has(x),
      toggle: (x, on) => (on ?? !this.classes.has(x)) ? this.classes.add(x) : this.classes.delete(x),
    };
  }
  set className(value) { this.classes = new Set(value.split(' ')); }
  get className() { return [...this.classes].join(' '); }
  setAttribute(k,v) { this.attributes[k]=v; }
  getAttribute(k) { return this.attributes[k]; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = children; }
  focus() {}
  addEventListener() {}
}
function quiz() {
  const html = fs.readFileSync(path.join(root,'public/legacy/english.html'),'utf8');
  const elements = {};
  for (const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = elements[tag[1]] = new Element();
    element.className = tag[0].match(/class="([^"]*)"/)?.[1] || '';
    const controls = tag[0].match(/aria-controls="([^"]*)"/)?.[1];
    if (controls) element.setAttribute('aria-controls',controls);
  }
  const requests = [], intervals = new Set();
  let time = 0;
  const context = vm.createContext({
    document: { getElementById: id => { assert.ok(elements[id],id); return elements[id]; }, querySelectorAll: () => [], createElement: () => new Element() },
    window: { addEventListener: () => {} }, performance: {now: () => time},
    setInterval: callback => { intervals.add(callback); return callback; }, clearInterval: callback => intervals.delete(callback),
    setTimeout: callback => callback(),
    fetch: async (url, options) => {
      requests.push({url, options});
      return {ok:true, json: async () => ({rankings:[],speedruns:[],recorded:true,improved:true,speedrunEligible:true,speedrunImproved:true})};
    },
  });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/      renderBookSetup\(\);\s*$/, '');
  vm.runInContext(script,context);
  const run = code => vm.runInContext(code,context);
  return { elements, requests, intervals, run,
    advance: ms => { time += ms; for (const fn of intervals) fn(); },
    start: (record = true, count = 159) => run(`quizData = wednesdayWarsVocabulary.slice(0, ${count}); shouldRecordCurrentQuiz = ${record}; initQuiz();`),
    answer: correct => { elements['answer-input'].value = correct ? run('quizData[currentIdx].correctFill') : 'wrong'; run('checkAnswer()'); },
  };
}

test('159 correct answers freeze time at the last answer and submit once', async () => {
  const app = quiz(); app.start();
  assert.equal(app.elements['quiz-timer'].classList.contains('hidden'),false);
  for (let i=0;i<159;i++) {
    app.advance(1000); app.answer(true);
    app.run('checkAnswer()'); // duplicate clicks must not increase the score
    if (i<158) app.run('nextQuestion()');
  }
  assert.equal(app.run('score'),159);
  assert.equal(app.intervals.size,0);
  app.advance(30000);
  assert.equal(app.elements['elapsed-time'].innerText,'02:39');
  app.run('nextQuestion(); nextQuestion();');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.requests.length,1);
  assert.deepEqual(JSON.parse(app.requests[0].options.body), {score:159,total:159,durationMs:159000});
});

test('untimed practice, wrong answers, retries, and navigation preserve timing eligibility', async () => {
  const practice = quiz(); practice.start(false,1); practice.answer(true); practice.run('nextQuestion()');
  assert.equal(practice.requests.length,0);
  assert.equal(practice.intervals.size,0);
  assert.equal(practice.elements['quiz-timer'].classList.contains('hidden'),true);
  const timed = quiz(); timed.start();
  for(let i=0;i<159;i++) { timed.advance(1000); timed.answer(i!==0); timed.run('nextQuestion()'); }
  assert.equal(JSON.parse(timed.requests[0].options.body).score,158);
  timed.run('retryWrong()');
  assert.equal(timed.run('shouldRecordCurrentQuiz'),false);
  assert.equal(timed.elements['quiz-timer'].classList.contains('hidden'),true);
  timed.answer(true); timed.run('nextQuestion()');
  assert.equal(timed.requests.length,1);
  const abandoned = quiz(); abandoned.start(); abandoned.advance(61000);
  assert.equal(abandoned.elements['elapsed-time'].innerText,'01:01');
  await abandoned.run('showRanking()');
  assert.equal(abandoned.intervals.size,0);
  assert.equal(abandoned.run('completedDurationMs'),null);
  assert.equal(abandoned.run('shouldRecordCurrentQuiz'),false);
  abandoned.start(); abandoned.run('resetToSetup()');
  assert.equal(abandoned.intervals.size,0);
});
