type PaintEntry = { canvas: HTMLCanvasElement; rafId: number };

const paintCanvases: Record<string, PaintEntry> = {};

export function clearPaintCanvas(botId: string): void {
  const entry = paintCanvases[botId];
  if (!entry) return;
  cancelAnimationFrame(entry.rafId);
  const c = entry.canvas;
  if (c) {
    c.style.transition = 'opacity 0.4s';
    c.style.opacity = '0';
    setTimeout(() => {
      try {
        c.remove();
      } catch {
        /* ignore */
      }
    }, 400);
  }
  delete paintCanvases[botId];
}

export function startPaintCanvas(containerEl: HTMLElement | null, botId: string): void {
  if (!containerEl || !botId) return;
  clearPaintCanvas(botId);

  const dpr = window.devicePixelRatio || 1;
  const W = containerEl.clientWidth;
  const H = containerEl.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:14;border-radius:6px';
  containerEl.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const context = ctx;
  context.scale(dpr, dpr);

  const colors = ['#EE5A24', '#FF6B6B', '#FFE66D', '#4ECDC4', '#A78BFA', '#F472B6', '#38BDF8', '#FB923C', '#10AC84', '#FF9F43', '#E74C3C'];
  const startTime = performance.now();
  const ix = W * (0.46 + Math.random() * 0.08);
  const iy = H * (0.4 + Math.random() * 0.1);

  const splats = Array.from({ length: 35 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 90;
    return {
      x: Math.max(5, Math.min(W - 5, ix + Math.cos(angle) * dist * (0.6 + Math.random() * 0.4))),
      y: Math.max(2, Math.min(H - 2, iy + Math.sin(angle) * dist * (0.5 + Math.random() * 0.5))),
      rx: 15 + Math.random() * 45,
      ry: 8 + Math.random() * 28,
      rot: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.55 + Math.random() * 0.35,
      delay: Math.random() * 0.4,
    };
  });

  const rays = Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const len = 80 + Math.random() * 200;
    return {
      x1: ix,
      y1: iy,
      x2: ix + Math.cos(angle) * len,
      y2: iy + Math.sin(angle) * len * (0.4 + Math.random() * 0.6),
      width: 2 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.4 + Math.random() * 0.4,
      delay: Math.random() * 0.2,
    };
  });

  const particles = Array.from({ length: 60 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 500;
    return {
      x: ix,
      y: iy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * (0.3 + Math.random() * 0.7) - 40,
      r: 2 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      settled: false,
      stime: 0,
      sr: 0,
      delay: Math.random() * 0.15,
    };
  });

  const drips = Array.from({ length: 12 }, (_, i) => {
    const ref = i < 4 ? { x: ix, y: iy + 8 } : splats[Math.floor(Math.random() * splats.length)];
    return {
      x: ref.x + (Math.random() - 0.5) * 30,
      y: ref.y + 2,
      len: 0,
      maxLen: H * (0.08 + Math.random() * 0.25),
      w: 3 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 15 + Math.random() * 40,
      startDelay: 0.4 + Math.random() * 1.5,
    };
  });

  const poolColor = colors[Math.floor(Math.random() * colors.length)];
  let poolHeight = 0;

  function tick(ts: number) {
    const elapsed = (ts - startTime) / 1000;
    const dt = Math.min(0.04, 0.016);
    context.clearRect(0, 0, W, H);

    for (const r of rays) {
      if (elapsed < r.delay) continue;
      const prog = Math.min(1, (elapsed - r.delay) / 0.3);
      context.save();
      context.globalAlpha = r.alpha * prog * (1 - elapsed / 5);
      context.strokeStyle = r.color;
      context.lineWidth = r.width;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(r.x1, r.y1);
      context.lineTo(r.x1 + (r.x2 - r.x1) * prog, r.y1 + (r.y2 - r.y1) * prog);
      context.stroke();
      context.restore();
    }

    for (const s of splats) {
      if (elapsed < s.delay) continue;
      const scale = Math.min(1, (elapsed - s.delay) / 0.35);
      context.save();
      context.globalAlpha = s.alpha * (1 - elapsed / 10);
      context.fillStyle = s.color;
      context.beginPath();
      context.ellipse(s.x, s.y, s.rx * scale, s.ry * scale, s.rot, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    for (const p of particles) {
      if (elapsed < p.delay) continue;
      if (!p.settled) {
        p.vy += 180 * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < p.r) {
          p.x = p.r;
          p.vx *= -0.3;
        }
        if (p.x > W - p.r) {
          p.x = W - p.r;
          p.vx *= -0.3;
        }
        if (p.y < p.r) {
          p.y = p.r;
          p.vy *= -0.3;
        }
        if (p.y > H - p.r) {
          p.y = H - p.r;
          p.vy *= -0.4;
          p.vx *= 0.15;
        }
        if (Math.abs(p.vx) + Math.abs(p.vy) < 25 && p.y > 4) {
          p.settled = true;
          p.stime = elapsed;
          p.sr = p.r * 2.5;
        }
      }
      if (p.settled) {
        const age = Math.max(0, elapsed - p.stime);
        const a = Math.max(0.2, 0.7 - age * 0.06);
        context.save();
        context.globalAlpha = a;
        context.fillStyle = p.color;
        context.beginPath();
        context.ellipse(p.x, p.y, p.sr * (1 + age * 0.2), p.sr * 0.5 * (1 + age * 0.2), 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      } else {
        context.save();
        context.globalAlpha = 0.7;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    for (const d of drips) {
      if (elapsed < d.startDelay) continue;
      if (d.len < d.maxLen) d.len += d.speed * dt;
      context.save();
      context.globalAlpha = 0.5;
      context.strokeStyle = d.color;
      context.lineWidth = d.w;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(d.x, d.y);
      context.lineTo(d.x, d.y + d.len);
      context.stroke();
      context.fillStyle = d.color;
      context.beginPath();
      context.arc(d.x, d.y + d.len, d.w * 1.3, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    if (elapsed > 1.5) {
      poolHeight = Math.min(H * 0.08, poolHeight + 1.5 * dt);
      if (poolHeight > 1) {
        context.save();
        context.globalAlpha = 0.35;
        context.fillStyle = poolColor;
        context.fillRect(0, H - poolHeight, W, poolHeight);
        context.restore();
      }
    }

    if (elapsed < 0.6) {
      const burstR = 15 + elapsed * 300;
      const burstAlpha = Math.max(0, 0.5 - elapsed * 0.85);
      context.save();
      context.globalAlpha = burstAlpha;
      const grad = context.createRadialGradient(ix, iy, 0, ix, iy, burstR);
      grad.addColorStop(0, 'rgba(255,255,255,0.4)');
      grad.addColorStop(0.3, 'rgba(255,200,100,0.3)');
      grad.addColorStop(1, 'rgba(255,100,50,0)');
      context.fillStyle = grad;
      context.beginPath();
      context.arc(ix, iy, burstR, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    if (elapsed > 6.0) {
      const fadeAlpha = Math.min(1, (elapsed - 6.0) / 1.0);
      context.save();
      context.globalAlpha = fadeAlpha * 0.12;
      context.fillStyle = '#1a1e21';
      context.fillRect(0, 0, W, H);
      context.restore();
    }

    if (elapsed >= 7.5) {
      canvas.remove();
      delete paintCanvases[botId];
      return;
    }

    const rid = requestAnimationFrame(tick);
    paintCanvases[botId] = { canvas, rafId: rid };
  }

  const rid = requestAnimationFrame(tick);
  paintCanvases[botId] = { canvas, rafId: rid };
}

export interface ScribbleStroke {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  erasing?: boolean;
  /** 0~1 정규화 좌표 (컨테이너 크기 차이 보정) */
  nx0?: number;
  ny0?: number;
  nx1?: number;
  ny1?: number;
}

type ScribbleEntry = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  container: HTMLElement;
  timerId?: ReturnType<typeof setTimeout>;
  cleanup?: () => void;
  interactive: boolean;
  onStroke?: (stroke: ScribbleStroke) => void;
  clearAt: number;
};

const scribbleRefs: Record<string, ScribbleEntry> = {};

export function isScribbleInteractive(botId: string): boolean {
  const entry = scribbleRefs[botId];
  return Boolean(entry?.interactive && entry.canvas.isConnected);
}

export function getScribbleOnStroke(botId: string): ((stroke: ScribbleStroke) => void) | undefined {
  return scribbleRefs[botId]?.onStroke;
}

export function clearScribbleCanvas(botId: string): void {
  const entry = scribbleRefs[botId];
  if (!entry) return;
  if (entry.timerId) clearTimeout(entry.timerId);
  entry.cleanup?.();
  try {
    entry.canvas.remove();
  } catch {
    /* ignore */
  }
  delete scribbleRefs[botId];
}

function scheduleScribbleClear(entry: ScribbleEntry, botId: string, durationMs: number, stack: boolean): void {
  const now = Date.now();
  entry.clearAt = stack && entry.clearAt > now ? entry.clearAt + durationMs : now + durationMs;
  if (entry.timerId) clearTimeout(entry.timerId);
  entry.timerId = setTimeout(() => clearScribbleCanvas(botId), Math.max(0, entry.clearAt - Date.now()));
}

function syncScribbleCanvasSize(entry: ScribbleEntry): boolean {
  const w = Math.floor(entry.container.clientWidth);
  const h = Math.floor(entry.container.clientHeight);
  if (w <= 0 || h <= 0) return false;
  if (entry.canvas.width !== w || entry.canvas.height !== h) {
    // 비트맵 리사이즈 시 기존 낙서 보존
    const prev = document.createElement('canvas');
    prev.width = entry.canvas.width;
    prev.height = entry.canvas.height;
    const prevCtx = prev.getContext('2d');
    if (prevCtx && entry.canvas.width > 0 && entry.canvas.height > 0) {
      prevCtx.drawImage(entry.canvas, 0, 0);
    }
    entry.canvas.width = w;
    entry.canvas.height = h;
    entry.ctx.drawImage(prev, 0, 0, w, h);
  }
  return true;
}

function pointerToCanvasPoint(canvas: HTMLCanvasElement, e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function ensureScribbleCanvas(
  containerEl: HTMLElement,
  botId: string,
  durationMs: number,
  extendDuration: boolean,
): ScribbleEntry | null {
  const existing = scribbleRefs[botId];
  if (existing && existing.container === containerEl && existing.canvas.isConnected) {
    // 새 아이템 사용일 때만 페인트처럼 지속 시간 누적 (큐 재시작은 연장하지 않음)
    if (extendDuration) {
      scheduleScribbleClear(existing, botId, durationMs, true);
    }
    syncScribbleCanvasSize(existing);
    return existing;
  }
  clearScribbleCanvas(botId);

  const w = Math.floor(containerEl.clientWidth);
  const h = Math.floor(containerEl.clientHeight);
  // 패널 확장 직후 레이아웃 전이면 캔버스를 만들지 않음 (호출측에서 재시도)
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  // lock(z=18)·lightning(z=17)보다 위에 두어 동시 사용 시에도 보이·조작 가능
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:20;touch-action:none;';
  canvas.classList.add('cursor-crosshair');
  if (getComputedStyle(containerEl).position === 'static') {
    containerEl.style.position = 'relative';
  }
  containerEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const entry: ScribbleEntry = {
    canvas,
    ctx,
    container: containerEl,
    interactive: false,
    clearAt: 0,
  };
  scheduleScribbleClear(entry, botId, durationMs, false);
  scribbleRefs[botId] = entry;
  return entry;
}

/** @returns false면 패널 크기가 아직 0이라 호출측에서 재시도 필요 */
export function applyScribbleStroke(botId: string, stroke: ScribbleStroke): boolean {
  let entry = scribbleRefs[botId];
  if (!entry || !entry.canvas.isConnected) {
    const panelEl =
      document.querySelector(
        `.opponent-code-panel-mini.expanded[data-opponent-id="${botId}"] [data-opponent-canvas="${botId}"]`,
      ) ||
      document.querySelector(`[data-opponent-canvas="${botId}"]`) ||
      (botId === 'self'
        ? document.querySelector('.code-card .fill-blank-code, .code-card .fill-blank-area, .code-card')
        : null);
    if (panelEl) {
      // 원격 스트로크만 — 시간 연장 없이 캔버스만 확보 (스트로크마다 중첩되면 안 됨)
      startScribbleCanvas(panelEl as HTMLElement, botId, 7000, {
        interactive: false,
        extendDuration: false,
      });
      entry = scribbleRefs[botId];
    }
  }
  if (!entry) return false;
  if (!syncScribbleCanvasSize(entry)) return false;
  const { ctx, canvas } = entry;
  const w = canvas.width;
  const h = canvas.height;
  const x0 = stroke.nx0 != null ? stroke.nx0 * w : stroke.x0;
  const y0 = stroke.ny0 != null ? stroke.ny0 * h : stroke.y0;
  const x1 = stroke.nx1 != null ? stroke.nx1 * w : stroke.x1;
  const y1 = stroke.ny1 != null ? stroke.ny1 * h : stroke.y1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke.erasing ? '#1a1e21' : stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.stroke();
  return true;
}

/** @returns false면 패널 미준비(크기 0 등) — 호출측에서 재시도 */
export function startScribbleCanvas(
  containerEl: HTMLElement | null,
  botId: string,
  durationMs = 7000,
  options?: {
    interactive?: boolean;
    onStroke?: (stroke: ScribbleStroke) => void;
    /** false면 지속시간 누적 없음(큐 재시작 등). 기본 true */
    extendDuration?: boolean;
  },
): boolean {
  if (!containerEl || !botId) return false;
  const entry = ensureScribbleCanvas(
    containerEl,
    botId,
    durationMs,
    options?.extendDuration !== false,
  );
  if (!entry) return false;
  if (!syncScribbleCanvasSize(entry)) return false;

  const wantInteractive = options?.interactive !== false;
  const onStroke = options?.onStroke;

  // 원격 낙서 시작/큐 재시작이 로컬 그리기를 끄지 않음 (다인 동시 낙서)
  if (!wantInteractive) {
    if (entry.interactive) return true;
    entry.canvas.style.pointerEvents = 'none';
    return true;
  }

  // 이미 같은 콜백으로 인터랙티브면 리스너 재부착 없이 시간만 연장된 상태 유지
  if (entry.interactive && entry.onStroke === onStroke && entry.cleanup) {
    return true;
  }

  entry.cleanup?.();
  entry.interactive = true;
  entry.onStroke = onStroke;
  entry.canvas.style.pointerEvents = 'auto';
  const { canvas, ctx } = entry;
  let drawing = false;
  let erasing = false;
  let lastX = 0;
  let lastY = 0;
  const strokeColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#F472B6'];
  let currentColor = strokeColors[0];

  const onDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 2) erasing = true;
    else drawing = true;
    const pt = pointerToCanvasPoint(canvas, e);
    lastX = pt.x;
    lastY = pt.y;
    currentColor = strokeColors[Math.floor(Math.random() * strokeColors.length)];
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.strokeStyle = erasing ? '#1a1e21' : currentColor;
    ctx.lineWidth = erasing ? 14 : 3;
    ctx.lineCap = 'round';
  };

  const onMove = (e: MouseEvent) => {
    if (!drawing && !erasing) return;
    const pt = pointerToCanvasPoint(canvas, e);
    const x = pt.x;
    const y = pt.y;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = erasing ? '#1a1e21' : currentColor;
    ctx.lineWidth = erasing ? 14 : 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    const emit = entry.onStroke;
    if (emit) {
      emit({
        x0: lastX,
        y0: lastY,
        x1: x,
        y1: y,
        color: currentColor,
        width: erasing ? 14 : 3,
        erasing,
        nx0: lastX / Math.max(1, canvas.width),
        ny0: lastY / Math.max(1, canvas.height),
        nx1: x / Math.max(1, canvas.width),
        ny1: y / Math.max(1, canvas.height),
      });
    }
    lastX = x;
    lastY = y;
  };

  const onUp = () => {
    drawing = false;
    erasing = false;
  };

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  entry.cleanup = () => {
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    entry.interactive = false;
  };
  return true;
}
