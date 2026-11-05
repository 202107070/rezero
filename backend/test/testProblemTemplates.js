// Only checked-in fixture answers run here; never accepts user code or queries a DB.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { readProblemFixture } from './problemFixture.js';
import { applyLanguageVariant, wrapExecutionSource } from '../src/api/problem/variants.js';

const exec = promisify(execFile);
const directory = await mkdtemp(path.join(tmpdir(), 'rezero-template-audit-'));
let count = 0;
const outputs = new Map();
try {
  for (const problem of readProblemFixture()) for (const language of Object.keys(problem.answer)) {
    const variant = applyLanguageVariant(problem, language);
    if (!variant?.executionKind) continue;
    let index = 0;
    const source = wrapExecutionSource(variant.question.replace(/_{5,}/g, () => variant.answer[language][index++]), language, variant.executionKind);
    const options = { cwd: directory, timeout: 15000, maxBuffer: 32768 };
    const file = language === 'JAVA' ? 'Main.java' : language === 'CPP' ? 'main.cpp' : 'main.py';
    await writeFile(path.join(directory, file), source);
    let result;
    try {
      if (language === 'JAVA') {
        await exec('javac', ['Main.java'], options);
        result = await exec('java', ['-cp', directory, 'Main'], options);
      } else if (language === 'CPP') {
        await exec('g++', ['-std=c++17', 'main.cpp', '-o', 'program'], options);
        result = await exec(path.join(directory, 'program'), [], options);
      } else result = await exec('python3', ['main.py'], options);
    } catch (error) { throw new Error(`${problem.id}/${language}: ${error.stderr || error.message}`); }
    const output = result.stdout.trimEnd().toLowerCase();
    const previous = outputs.get(problem.id);
    if (previous !== undefined) {
      if (problem.id === 'SV03') assert.ok(Math.abs(Number(output) - Number(previous)) < 0.001);
      else assert.equal(output, previous, `${problem.id}/${language} output differs`);
    }
    outputs.set(problem.id, output);
    count++;
  }
  console.log(`PASS: ${count} explicit templates compiled/executed; cross-language output agrees.`);
} finally { await rm(directory, { recursive: true, force: true }); }
