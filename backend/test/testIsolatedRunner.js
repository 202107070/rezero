import assert from 'node:assert/strict';
import { createIsolatedRunner } from '../src/infra/docker/worker/isolatedRunner.js';
import { applyLanguageVariant, wrapExecutionSource } from '../src/api/problem/variants.js';
import { readProblemFixture } from './problemFixture.js';

const runner = createIsolatedRunner();
assert.equal(await runner.ready(), true, 'Isolated runner must be provisioned before this test');
let count = 0;
for (const problem of readProblemFixture()) for (const language of Object.keys(problem.answer)) {
  const variant = applyLanguageVariant(problem, language);
  if (!variant?.executionKind) continue;
  let index = 0;
  const code = wrapExecutionSource(variant.question.replace(/_{5,}/g, () => variant.answer[language][index++]), language, variant.executionKind);
  const result = await runner.run({ code, language });
  assert.equal(result.status, 'SUCCESS', `${problem.id}/${language}: ${result.error}`);
  count++;
  if (count % 10 === 0) console.log(`Validated ${count} templates`);
}
console.log(`PASS: ${count} templates execute inside isolated containers`);
for (const [language, code] of [['PYTHON', 'print('], ['JAVA', 'public class Main { syntax error }'], ['CPP', 'int main( {']]) {
  assert.equal((await runner.run({ language, code })).status, 'COMPILE_ERROR');
}
assert.equal((await runner.run({ language: 'PYTHON', code: 'raise RuntimeError("fixture")' })).status, 'RUNTIME_ERROR');
assert.equal((await runner.run({ language: 'PYTHON', code: 'while True: pass' })).status, 'TIMEOUT');
assert.equal((await runner.run({ language: 'PYTHON', code: 'while True: print("x" * 10000, flush=True)' })).status, 'OUTPUT_LIMIT');
console.log('PASS: syntax/runtime errors, timeout, and output limit');
const isolation = await runner.run({ language: 'PYTHON', code: `import os, socket
assert os.getuid() != 0
assert not os.path.exists('/home/user1/rezero/backend/.env')
try:
    socket.create_connection(('1.1.1.1', 80), timeout=1)
    raise AssertionError('network enabled')
except OSError: pass
try:
    open('/should-not-write', 'w').write('bad')
    raise AssertionError('root filesystem writable')
except OSError: pass
open('/work/only-this-job', 'w').write('fixture')
print('isolated')` });
assert.equal(isolation.status, 'SUCCESS', isolation.error);
const separate = await runner.run({ language: 'PYTHON', code: 'import os; assert not os.path.exists("/work/only-this-job"); print("separate")' });
assert.equal(separate.status, 'SUCCESS', separate.error);
const concurrent = await Promise.all(['first', 'second'].map(value => runner.run({ language: 'PYTHON', code: `print('${value}')` })));
assert.deepEqual(concurrent.map(r => r.output.trim()), ['first', 'second']);
assert.equal((await createIsolatedRunner({ image: 'localhost/rezero-missing-test-image:0' }).run({ language: 'PYTHON', code: 'print(1)' })).status, 'UNAVAILABLE');
console.log('PASS: non-root, no network, read-only root, separate workspaces, concurrency, unavailable image');
