import test from 'node:test';
import assert from 'node:assert/strict';
import { hasProblemAnswerAttempted } from '../src/utils/battle/problemResultUtils.ts';

const attempt = (question: string, blanks: string[], extra: Record<string, unknown> = {}) =>
  hasProblemAnswerAttempted({
    problem: { id: 'qa-space', type: 'fill_blank', question, ...extra },
    problemIndex: 0, langKey: 'PYTHON', blankAnswers: [blanks], selectedOption: null,
  });

test('server snapshots without answers allow a literal space code blank but reject empty and incomplete input', () => {
  assert.equal(attempt('print("_____")', [' ']), true);
  assert.equal(attempt('print("_____")', ['']), false);
  assert.equal(attempt('print("_____")', []), false);
  assert.equal(attempt('print(_____ + _____)', ['1', '']), false);
  assert.equal(attempt('print(_____ + _____)', ['1', '2']), true);
});

test('short-answer whitespace and local answer-aware validation keep their previous behavior', () => {
  assert.equal(attempt('Enter a number', [' '], { type: 'short_answer' }), false);
  assert.equal(attempt('print("_____")', [' '], { answer: { PYTHON: [' '] } }), true);
  assert.equal(attempt('print(_____)', [' '], { answer: { PYTHON: ['value'] } }), false);
});
