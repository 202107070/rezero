import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleCode, buildPreviewSource } from '../src/utils/battle/codeUtils.ts';
test('blank assembly preserves adjacent identifiers, quoted whitespace, and literal replacement text', () => {
  assert.equal(assembleCode('i_____\nprint("_____")', ['-=1', ' ']), 'i-=1\nprint(" ")');
  assert.equal(assembleCode('print(_____)', ['$&']), 'print($&)');
});
test('build source uses the server language template without heuristic translation', () => {
  assert.equal(buildPreviewSource('print("#" if True else "_____")', [' '], 'PYTHON'), 'print("#" if True else " ")');
});
