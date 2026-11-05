import test from 'node:test';
import assert from 'node:assert/strict';
import { readProblemFixture } from './problemFixture.js';
import { applyLanguageVariant } from '../src/api/problem/variants.js';
import { chooseProblems, judgeProblemAnswer } from '../src/api/problem/service.js';
import { pool } from '../src/config/dbConfig.js';

const problems = readProblemFixture();
test.after(() => pool.end());
test('all 168 source problems are preserved; executable variants have matching blanks and answers', () => {
  assert.equal(problems.length, 168);
  const before = JSON.stringify(problems);
  let executable = 0;
  for (const problem of problems) for (const language of Object.keys(problem.answer)) {
    const variant = applyLanguageVariant(problem, language);
    if (!variant?.executionKind) continue;
    executable++;
    assert.equal(variant.question.match(/_{5,}/g)?.length, variant.answer[language].length, `${problem.id}/${language}`);
    if (language === 'PYTHON') assert.doesNotMatch(variant.question, /System\.out|\bboolean\b|\?\s*"/);
    if (language === 'CPP') assert.doesNotMatch(variant.question, /System\.out|\bboolean\b|\.charAt\(/);
    assert.equal(judgeProblemAnswer({ problem: variant, language, answers: variant.answer[language] }), true);
  }
  assert.equal(executable, 43);
  assert.equal(JSON.stringify(problems), before);
});
test('every supported language/difficulty can start minimum-size matches; shortage never silently shrinks a match', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) for (const language of ['JAVA', 'PYTHON', 'CPP', 'HTML', 'CSS']) {
    const selected = chooseProblems(problems.filter(p => p.difficulty === difficulty), language, 3);
    assert.equal(selected.length, 3);
    assert.equal(new Set(selected.map(p => p.id)).size, 3);
    assert.ok(selected.every(p => p.language === language));
  }
  assert.throws(() => chooseProblems(problems.filter(p => p.difficulty === 'medium'), 'HTML', 10), { code: 'INSUFFICIENT_PROBLEMS' });
  assert.throws(() => chooseProblems([], 'PYTHON', 3), { code: 'INSUFFICIENT_PROBLEMS' });
});
test('invalid language concepts are excluded and RANDOM chooses one consistent supported language', () => {
  const boolean = applyLanguageVariant(problems.find(p => p.id === 'M18'), 'PYTHON');
  assert.equal(boolean.options[boolean.correctIndex], 'True');
  assert.equal(new Set(boolean.options.map(option => option.toLowerCase())).size, boolean.options.length);
  for (const id of ['E17', 'E18', 'X06', 'X09', 'X11', 'X27', 'H01', 'H04', 'H18']) {
    assert.equal(applyLanguageVariant(problems.find(p => p.id === id), 'PYTHON'), null);
  }
  for (const random of [() => 0, () => 0.7, () => 0.999]) {
    const selected = chooseProblems(problems, 'RANDOM', 10, random);
    assert.equal(new Set(selected.map(p => p.language)).size, 1);
  }
});
