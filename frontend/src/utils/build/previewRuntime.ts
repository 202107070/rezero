type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'bin'; op: string; left: Expr; right: Expr }
  | { kind: 'tern'; cond: Expr; yes: Expr; no: Expr };

type Stmt =
  | { kind: 'for'; name: string; start: Expr; stop: Expr; step: number; inclusive: boolean; body: Stmt[] }
  | { kind: 'pyfor'; name: string; args: Expr[]; body: Stmt[] }
  | { kind: 'while'; cond: Expr; body: Stmt[] }
  | { kind: 'if'; cond: Expr; yes: Stmt[]; no: Stmt[] }
  | { kind: 'print'; args: Expr[]; newline: boolean }
  | { kind: 'assign'; name: string; expr: Expr }
  | { kind: 'step'; name: string; delta: number };

const MAX_STEPS = 4000;
const MAX_LINES = 80;

function indentToBraces(code: string): string {
  if (!/:\s*(#.*)?$/m.test(code) && !/\bfor\s+\w+\s+in\s+range\s*\(/.test(code)) return code;
  const lines = code.replace(/\t/g, '    ').split('\n');
  const out: string[] = [];
  const stack = [0];
  let pending: string | null = null;

  const closeTo = (indent: number) => {
    while (stack.length > 1 && indent < stack[stack.length - 1]) {
      stack.pop();
      out.push('}');
    }
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    closeTo(indent);
    if (pending != null) {
      out.push(`${pending} {`);
      stack.push(indent);
      pending = null;
    }
    if (trimmed.endsWith(':')) {
      pending = trimmed.slice(0, -1).trim();
      continue;
    }
    out.push(trimmed);
  }
  if (pending != null) out.push(`${pending} {`, '}');
  closeTo(0);
  return out.join('\n');
}

class Parser {
  private index = 0;
  private readonly source: string;
  constructor(source: string) {
    this.source = source;
  }

  parseProgram(): Stmt[] {
    const body: Stmt[] = [];
    this.skip();
    while (!this.done()) {
      if (this.peek() === '}') break;
      body.push(this.parseStmt());
      this.skip();
    }
    return body;
  }

  private done() {
    return this.index >= this.source.length;
  }

  private peek() {
    return this.source[this.index] || '';
  }

  private skip() {
    while (!this.done()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        this.index += 1;
        continue;
      }
      if (ch === '/' && this.source[this.index + 1] === '/') {
        while (!this.done() && this.peek() !== '\n') this.index += 1;
        continue;
      }
      break;
    }
  }

  private parseStmt(): Stmt {
    this.skip();
    if (this.source.startsWith('for', this.index) && /\s|\(/.test(this.source[this.index + 3] || '')) {
      return this.parseFor();
    }
    if (this.source.startsWith('while', this.index) && /\s|\(/.test(this.source[this.index + 5] || '')) {
      return this.parseWhile();
    }
    if (this.source.startsWith('if', this.index) && /\s|\(/.test(this.source[this.index + 2] || '')) {
      return this.parseIf();
    }
    if (this.source.startsWith('System.out.print', this.index)) {
      return this.parseJavaPrint();
    }
    if (this.source.startsWith('print', this.index) && /\s|\(/.test(this.source[this.index + 5] || '')) {
      return this.parsePythonPrint();
    }
    if (this.source.startsWith('cout', this.index) && /\s|<</.test(this.source.slice(this.index + 4, this.index + 6))) {
      return this.parseCout();
    }
    const assign = this.source.slice(this.index).match(/^(?:int\s+)?([A-Za-z_]\w*)\s*(\+\+|--|\+=|-=|=)/);
    if (assign) {
      const name = assign[1];
      const op = assign[2];
      this.index += assign[0].length;
      if (op === '++' || op === '--') {
        this.consumeSemi();
        return { kind: 'step', name, delta: op === '++' ? 1 : -1 };
      }
      if (op === '+=' || op === '-=') {
        const expr = this.parseExpr();
        this.consumeSemi();
        return {
          kind: 'assign',
          name,
          expr: { kind: 'bin', op: op === '+=' ? '+' : '-', left: { kind: 'name', value: name }, right: expr },
        };
      }
      const expr = this.parseExpr();
      this.consumeSemi();
      return { kind: 'assign', name, expr };
    }
    throw new Error('실행할 수 없는 문장입니다.');
  }

  private parseFor(): Stmt {
    this.index += 3;
    this.skip();
    if (this.peek() !== '(') {
      const name = this.readIdent();
      this.skip();
      this.expectWord('in');
      this.skip();
      this.expectWord('range');
      this.skip();
      this.expect('(');
      const args = this.parseArgList();
      this.expect(')');
      const body = this.parseBody();
      return { kind: 'pyfor', name, args, body };
    }
    this.expect('(');
    this.skip();
    if (this.source.startsWith('int', this.index) && /\s/.test(this.source[this.index + 3] || '')) {
      this.index += 3;
    }
    this.skip();
    const name = this.readIdent();
    this.skip();
    this.expect('=');
    const start = this.parseExpr();
    this.expect(';');
    const cond = this.parseExpr();
    this.expect(';');
    this.skip();
    const stepName = this.readIdent();
    this.skip();
    let delta = 1;
    if (this.source.startsWith('++', this.index)) {
      this.index += 2;
      delta = 1;
    } else if (this.source.startsWith('--', this.index)) {
      this.index += 2;
      delta = -1;
    } else if (this.source.startsWith('+=', this.index) || this.source.startsWith('-=', this.index)) {
      const sign = this.source.startsWith('+=', this.index) ? 1 : -1;
      this.index += 2;
      const amount = this.parseExpr();
      if (amount.kind !== 'num') throw new Error('반복 증감은 숫자만 미리보기할 수 있습니다.');
      delta = sign * amount.value;
    } else {
      throw new Error('반복 증감을 해석할 수 없습니다.');
    }
    if (stepName !== name) throw new Error('반복 변수가 서로 다릅니다.');
    this.skip();
    this.expect(')');
    const { stop, inclusive } = this.rangeFromCond(name, cond, delta);
    const body = this.parseBody();
    return { kind: 'for', name, start, stop, step: delta || 1, inclusive, body };
  }

  private rangeFromCond(name: string, cond: Expr, delta: number): { stop: Expr; inclusive: boolean } {
    if (cond.kind === 'bin' && (cond.left.kind === 'name' ? cond.left.value === name : false)) {
      if (cond.op === '<=' && delta > 0) return { stop: cond.right, inclusive: true };
      if (cond.op === '<' && delta > 0) return { stop: cond.right, inclusive: false };
      if (cond.op === '>=' && delta < 0) return { stop: cond.right, inclusive: true };
      if (cond.op === '>' && delta < 0) return { stop: cond.right, inclusive: false };
    }
    return { stop: cond, inclusive: false };
  }

  private parseWhile(): Stmt {
    this.index += 5;
    this.skip();
    const wrapped = this.peek() === '(';
    if (wrapped) this.expect('(');
    const cond = this.parseExpr();
    if (wrapped) this.expect(')');
    const body = this.parseBody();
    return { kind: 'while', cond, body };
  }

  private parseIf(): Stmt {
    this.index += 2;
    this.skip();
    this.expect('(');
    const cond = this.parseExpr();
    this.expect(')');
    const yes = this.parseBodyList();
    this.skip();
    let no: Stmt[] = [];
    if (this.source.startsWith('else', this.index) && /\s|\{/.test(this.source[this.index + 4] || '')) {
      this.index += 4;
      no = this.parseBodyList();
    }
    return { kind: 'if', cond, yes, no };
  }

  private parseBodyList(): Stmt[] {
    this.skip();
    if (this.peek() === '{') return this.parseBody();
    return [this.parseStmt()];
  }

  private parseBody(): Stmt[] {
    this.skip();
    if (this.peek() !== '{') return [this.parseStmt()];
    this.expect('{');
    const body: Stmt[] = [];
    this.skip();
    while (!this.done() && this.peek() !== '}') {
      body.push(this.parseStmt());
      this.skip();
    }
    this.expect('}');
    return body;
  }

  private parseJavaPrint(): Stmt {
    const newline = this.source.startsWith('System.out.println', this.index);
    this.index += newline ? 'System.out.println'.length : 'System.out.print'.length;
    this.skip();
    this.expect('(');
    const args = this.peek() === ')' ? [] : this.parseArgList();
    this.expect(')');
    this.consumeSemi();
    return { kind: 'print', args, newline };
  }

  private parsePythonPrint(): Stmt {
    this.index += 5;
    this.skip();
    this.expect('(');
    if (this.peek() === ')') {
      this.expect(')');
      this.consumeSemi();
      return { kind: 'print', args: [], newline: true };
    }
    const args: Expr[] = [];
    let newline = true;
    while (!this.done() && this.peek() !== ')') {
      this.skip();
      if (this.source.startsWith('end', this.index) && /\s*=/.test(this.source.slice(this.index + 3, this.index + 6))) {
        this.index += 3;
        this.skip();
        this.expect('=');
        const end = this.parseExpr();
        newline = !(end.kind === 'str' && end.value === '');
      } else {
        args.push(this.parseExpr());
      }
      this.skip();
      if (this.peek() === ',') {
        this.index += 1;
        continue;
      }
      break;
    }
    this.expect(')');
    this.consumeSemi();
    return { kind: 'print', args, newline };
  }

  private parseCout(): Stmt {
    this.index += 4;
    const args: Expr[] = [];
    let newline = false;
    while (true) {
      this.skip();
      if (!this.source.startsWith('<<', this.index)) break;
      this.index += 2;
      this.skip();
      if (this.source.startsWith('endl', this.index) && !/[A-Za-z0-9_]/.test(this.source[this.index + 4] || '')) {
        this.index += 4;
        newline = true;
        continue;
      }
      args.push(this.parseExpr());
    }
    this.consumeSemi();
    return { kind: 'print', args, newline };
  }

  private parseArgList(): Expr[] {
    const args: Expr[] = [];
    while (!this.done() && this.peek() !== ')') {
      args.push(this.parseExpr());
      this.skip();
      if (this.peek() === ',') {
        this.index += 1;
        continue;
      }
      break;
    }
    return args;
  }

  private parseExpr(): Expr {
    return this.parseTernary();
  }

  private parseTernary(): Expr {
    const cond = this.parseOr();
    this.skip();
    if (this.peek() !== '?') return cond;
    this.index += 1;
    const yes = this.parseExpr();
    this.skip();
    this.expect(':');
    const no = this.parseExpr();
    return { kind: 'tern', cond, yes, no };
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (true) {
      this.skip();
      if (!this.source.startsWith('||', this.index)) break;
      this.index += 2;
      left = { kind: 'bin', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEq();
    while (true) {
      this.skip();
      if (!this.source.startsWith('&&', this.index)) break;
      this.index += 2;
      left = { kind: 'bin', op: '&&', left, right: this.parseEq() };
    }
    return left;
  }

  private parseEq(): Expr {
    let left = this.parseRel();
    while (true) {
      this.skip();
      const op = this.source.startsWith('==', this.index) ? '==' : this.source.startsWith('!=', this.index) ? '!=' : '';
      if (!op) break;
      this.index += 2;
      left = { kind: 'bin', op, left, right: this.parseRel() };
    }
    return left;
  }

  private parseRel(): Expr {
    let left = this.parseAdd();
    while (true) {
      this.skip();
      const op = this.source.startsWith('<=', this.index)
        ? '<='
        : this.source.startsWith('>=', this.index)
          ? '>='
          : this.peek() === '<'
            ? '<'
            : this.peek() === '>'
              ? '>'
              : '';
      if (!op) break;
      this.index += op.length;
      left = { kind: 'bin', op, left, right: this.parseAdd() };
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (true) {
      this.skip();
      const op = this.peek() === '+' || this.peek() === '-' ? this.peek() : '';
      if (!op) break;
      this.index += 1;
      left = { kind: 'bin', op, left, right: this.parseMul() };
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parseUnary();
    while (true) {
      this.skip();
      const op = this.peek() === '*' || this.peek() === '/' || this.peek() === '%' ? this.peek() : '';
      if (!op) break;
      this.index += 1;
      left = { kind: 'bin', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    this.skip();
    if (this.peek() === '!') {
      this.index += 1;
      return { kind: 'bin', op: '==', left: this.parseUnary(), right: { kind: 'num', value: 0 } };
    }
    if (this.peek() === '-' && /[0-9(A-Za-z_]/.test(this.source[this.index + 1] || '')) {
      this.index += 1;
      return { kind: 'bin', op: '-', left: { kind: 'num', value: 0 }, right: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    this.skip();
    const ch = this.peek();
    if (ch === '(') {
      this.index += 1;
      const expr = this.parseExpr();
      this.expect(')');
      return this.parseRepeat(expr);
    }
    if (ch === '"' || ch === "'") {
      return this.parseRepeat(this.readString());
    }
    if (/[0-9]/.test(ch)) {
      const start = this.index;
      while (/[0-9.]/.test(this.peek())) this.index += 1;
      return { kind: 'num', value: Number(this.source.slice(start, this.index)) };
    }
    const name = this.readIdent();
    return this.parseRepeat({ kind: 'name', value: name });
  }

  private parseRepeat(expr: Expr): Expr {
    this.skip();
    if (!this.source.startsWith('.repeat', this.index)) return expr;
    this.index += '.repeat'.length;
    this.skip();
    this.expect('(');
    const count = this.parseExpr();
    this.expect(')');
    return { kind: 'bin', op: '*', left: expr, right: count };
  }

  private readIdent() {
    this.skip();
    const start = this.index;
    if (!/[A-Za-z_]/.test(this.peek())) throw new Error('이름을 읽을 수 없습니다.');
    this.index += 1;
    while (/[A-Za-z0-9_]/.test(this.peek())) this.index += 1;
    return this.source.slice(start, this.index);
  }

  private readString(): Expr {
    const quote = this.peek();
    this.index += 1;
    let value = '';
    while (!this.done() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.index += 1;
        const esc = this.peek();
        value += esc === 'n' ? '\n' : esc;
        this.index += 1;
        continue;
      }
      value += this.peek();
      this.index += 1;
    }
    this.expect(quote);
    return { kind: 'str', value };
  }

  private expect(ch: string) {
    this.skip();
    if (this.peek() !== ch) throw new Error(`'${ch}' 가 필요합니다.`);
    this.index += 1;
  }

  private expectWord(word: string) {
    this.skip();
    if (!this.source.startsWith(word, this.index)) throw new Error(`${word} 가 필요합니다.`);
    this.index += word.length;
  }

  private consumeSemi() {
    this.skip();
    if (this.peek() === ';') this.index += 1;
  }
}

function truthy(value: string | number) {
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  return value !== '';
}

function asNumber(value: string | number) {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evalExpr(expr: Expr, env: Map<string, string | number>): string | number {
  if (expr.kind === 'num' || expr.kind === 'str') return expr.value;
  if (expr.kind === 'name') {
    if (!env.has(expr.value)) return 0;
    return env.get(expr.value) ?? 0;
  }
  if (expr.kind === 'tern') {
    return truthy(evalExpr(expr.cond, env)) ? evalExpr(expr.yes, env) : evalExpr(expr.no, env);
  }
  const left = evalExpr(expr.left, env);
  const right = evalExpr(expr.right, env);
  if (expr.op === '*') {
    if (typeof left === 'string' || typeof right === 'string') {
      const text = typeof left === 'string' ? left : String(right);
      const count = Math.max(0, Math.min(200, Math.floor(asNumber(typeof left === 'string' ? right : left))));
      return text.repeat(count);
    }
    return asNumber(left) * asNumber(right);
  }
  if (expr.op === '+') {
    if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right);
    return asNumber(left) + asNumber(right);
  }
  if (expr.op === '-') return asNumber(left) - asNumber(right);
  if (expr.op === '/') {
    const den = asNumber(right);
    return den === 0 ? 0 : Math.trunc(asNumber(left) / den);
  }
  if (expr.op === '%') {
    const den = asNumber(right);
    return den === 0 ? 0 : asNumber(left) % den;
  }
  if (expr.op === '==') return String(left) === String(right) ? 1 : 0;
  if (expr.op === '!=') return String(left) !== String(right) ? 1 : 0;
  if (expr.op === '<') return asNumber(left) < asNumber(right) ? 1 : 0;
  if (expr.op === '>') return asNumber(left) > asNumber(right) ? 1 : 0;
  if (expr.op === '<=') return asNumber(left) <= asNumber(right) ? 1 : 0;
  if (expr.op === '>=') return asNumber(left) >= asNumber(right) ? 1 : 0;
  if (expr.op === '&&') return truthy(left) && truthy(right) ? 1 : 0;
  if (expr.op === '||') return truthy(left) || truthy(right) ? 1 : 0;
  return 0;
}

function execStmts(stmts: Stmt[], env: Map<string, string | number>, lines: string[], budget: { left: number }) {
  let row = '';
  const flush = () => {
    if (lines.length < MAX_LINES) lines.push(row);
    row = '';
  };
  const write = (text: string, newline: boolean) => {
    row += text;
    if (newline) flush();
  };
  const walk = (list: Stmt[]) => {
    for (const stmt of list) {
      if (budget.left <= 0) return;
      budget.left -= 1;
      if (stmt.kind === 'assign') {
        env.set(stmt.name, evalExpr(stmt.expr, env));
      } else if (stmt.kind === 'step') {
        env.set(stmt.name, asNumber(env.get(stmt.name) ?? 0) + stmt.delta);
      } else if (stmt.kind === 'print') {
        const text = stmt.args.map((arg) => String(evalExpr(arg, env))).join('');
        write(text, stmt.newline);
      } else if (stmt.kind === 'if') {
        walk(truthy(evalExpr(stmt.cond, env)) ? stmt.yes : stmt.no);
      } else if (stmt.kind === 'while') {
        let guard = 0;
        while (truthy(evalExpr(stmt.cond, env))) {
          walk(stmt.body);
          guard += 1;
          if (guard > 300 || budget.left <= 0) break;
        }
      } else if (stmt.kind === 'pyfor') {
        const [a, b, c] = stmt.args;
        const start = b ? asNumber(evalExpr(a, env)) : 0;
        const stop = b ? asNumber(evalExpr(b, env)) : asNumber(evalExpr(a, env));
        const step = c ? asNumber(evalExpr(c, env)) || 1 : 1;
        let guard = 0;
        for (let value = start; step > 0 ? value < stop : value > stop; value += step) {
          env.set(stmt.name, value);
          walk(stmt.body);
          guard += 1;
          if (guard > 300 || budget.left <= 0) break;
        }
      } else if (stmt.kind === 'for') {
        let value = asNumber(evalExpr(stmt.start, env));
        const stop = asNumber(evalExpr(stmt.stop, env));
        const step = stmt.step || 1;
        let guard = 0;
        const keep = () => (step > 0 ? (stmt.inclusive ? value <= stop : value < stop) : stmt.inclusive ? value >= stop : value > stop);
        while (keep()) {
          env.set(stmt.name, value);
          walk(stmt.body);
          value += step;
          guard += 1;
          if (guard > 300 || budget.left <= 0) break;
        }
      }
    }
  };
  walk(stmts);
  if (row) flush();
}

export function parsePreview(code: string): Stmt[] {
  const normalized = indentToBraces(code);
  return new Parser(normalized).parseProgram();
}

export function runPreviewProgram(code: string): string[] {
  const stmts = parsePreview(code);
  const lines: string[] = [];
  execStmts(stmts, new Map(), lines, { left: MAX_STEPS });
  return lines;
}

function emitExpr(expr: Expr, lang: string): string {
  if (expr.kind === 'num') return String(expr.value);
  if (expr.kind === 'str') return JSON.stringify(expr.value);
  if (expr.kind === 'name') return expr.value;
  if (expr.kind === 'tern') {
    return `(${emitExpr(expr.cond, lang)} ? ${emitExpr(expr.yes, lang)} : ${emitExpr(expr.no, lang)})`;
  }
  const left = emitExpr(expr.left, lang);
  const right = emitExpr(expr.right, lang);
  return `(${left} ${expr.op} ${right})`;
}

function emitPrint(stmt: Extract<Stmt, { kind: 'print' }>, lang: string): string {
  const args = stmt.args.map((arg) => emitExpr(arg, lang)).join(' + ');
  const shown = args || (lang === 'PYTHON' ? '' : '""');
  if (lang === 'PYTHON') {
    return stmt.newline ? `print(${args})` : `print(${args || '""'}, end='')`;
  }
  if (lang === 'CPP') {
    return `cout << ${shown || '""'}${stmt.newline ? ' << endl' : ''};`;
  }
  return stmt.newline ? `System.out.println(${shown || '""'});` : `System.out.print(${shown || '""'});`;
}

function emitBlock(stmts: Stmt[], lang: string, indent: string): string[] {
  const lines: string[] = [];
  for (const stmt of stmts) {
    if (stmt.kind === 'print') {
      lines.push(indent + emitPrint(stmt, lang));
    } else if (stmt.kind === 'assign') {
      const text = `${stmt.name} = ${emitExpr(stmt.expr, lang)}`;
      lines.push(indent + (lang === 'PYTHON' ? text : `int ${text};`));
    } else if (stmt.kind === 'step') {
      lines.push(indent + (lang === 'PYTHON' ? `${stmt.name} ${stmt.delta < 0 ? '-=' : '+='} ${Math.abs(stmt.delta)}` : `${stmt.name}${stmt.delta < 0 ? '--' : '++'};`));
    } else if (stmt.kind === 'if') {
      if (lang === 'PYTHON') {
        lines.push(`${indent}if ${emitExpr(stmt.cond, lang)}:`);
        lines.push(...emitBlock(stmt.yes, lang, `${indent}    `));
        if (stmt.no.length) {
          lines.push(`${indent}else:`);
          lines.push(...emitBlock(stmt.no, lang, `${indent}    `));
        }
      } else {
        lines.push(`${indent}if (${emitExpr(stmt.cond, lang)}) {`);
        lines.push(...emitBlock(stmt.yes, lang, `${indent}    `));
        if (stmt.no.length) {
          lines.push(`${indent}} else {`);
          lines.push(...emitBlock(stmt.no, lang, `${indent}    `));
        }
        lines.push(`${indent}}`);
      }
    } else if (stmt.kind === 'pyfor' || stmt.kind === 'for') {
      lines.push(...emitLoop(stmt, lang, indent));
    } else if (stmt.kind === 'while') {
      if (lang === 'PYTHON') {
        lines.push(`${indent}while ${emitExpr(stmt.cond, lang)}:`);
        lines.push(...emitBlock(stmt.body, lang, `${indent}    `));
      } else {
        lines.push(`${indent}while (${emitExpr(stmt.cond, lang)}) {`);
        lines.push(...emitBlock(stmt.body, lang, `${indent}    `));
        lines.push(`${indent}}`);
      }
    }
  }
  return lines;
}

function emitLoop(stmt: Extract<Stmt, { kind: 'for' | 'pyfor' }>, lang: string, indent: string): string[] {
  if (lang === 'PYTHON') {
    if (stmt.kind === 'pyfor') {
      const args = stmt.args.map((arg) => emitExpr(arg, lang)).join(', ');
      return [`${indent}for ${stmt.name} in range(${args}):`, ...emitBlock(stmt.body, lang, `${indent}    `)];
    }
    const start = emitExpr(stmt.start, lang);
    const stop = emitExpr(stmt.stop, lang);
    const end = stmt.inclusive ? `(${stop}) + ${stmt.step > 0 ? 1 : -1}` : stop;
    const step = Math.abs(stmt.step) === 1 ? '' : `, ${stmt.step}`;
    const range = stmt.step > 0 ? `${start}, ${end}${step}` : `${start}, ${end}, ${stmt.step}`;
    return [`${indent}for ${stmt.name} in range(${range}):`, ...emitBlock(stmt.body, lang, `${indent}    `)];
  }
  if (stmt.kind === 'pyfor') {
    const [a, b, c] = stmt.args;
    const start = b ? emitExpr(a, lang) : '0';
    const stop = b ? emitExpr(b, lang) : emitExpr(a, lang);
    const step = c ? emitExpr(c, lang) : '1';
    if (lang === 'CPP') {
      return [
        `${indent}for (int ${stmt.name} = ${start}; ${stmt.name} < ${stop}; ${stmt.name} += ${step}) {`,
        ...emitBlock(stmt.body, lang, `${indent}    `),
        `${indent}}`,
      ];
    }
    return [
      `${indent}for (int ${stmt.name} = ${start}; ${stmt.name} < ${stop}; ${stmt.name} += ${step}) {`,
      ...emitBlock(stmt.body, lang, `${indent}    `),
      `${indent}}`,
    ];
  }
  const op = stmt.step > 0 ? (stmt.inclusive ? '<=' : '<') : stmt.inclusive ? '>=' : '>';
  const update = stmt.step === 1 ? '++' : stmt.step === -1 ? '--' : stmt.step > 0 ? `+= ${stmt.step}` : `-= ${Math.abs(stmt.step)}`;
  const stepText = update === '++' || update === '--' ? `${stmt.name}${update}` : `${stmt.name} ${update}`;
  const header = `for (int ${stmt.name} = ${emitExpr(stmt.start, lang)}; ${stmt.name} ${op} ${emitExpr(stmt.stop, lang)}; ${stepText}) {`;
  return [indent + header, ...emitBlock(stmt.body, lang, `${indent}    `), `${indent}}`];
}

export function renderForRoom(code: string, lang: string): string {
  const key = String(lang || 'JAVA').toUpperCase();
  try {
    const stmts = parsePreview(code);
    if (stmts.length === 0) return code;
    return emitBlock(stmts, key === 'C++' ? 'CPP' : key, '').join('\n');
  } catch {
    return code;
  }
}
