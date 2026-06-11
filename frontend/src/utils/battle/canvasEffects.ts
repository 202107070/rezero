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
  const ix = W * (0.2 + Math.random() * 0.35);
  const iy = H * (0.08 + Math.random() * 0.18);

  const splats = Array.from({ length: 35 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 180;
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

const scribbleRefs: Record<string, { canvas: HTMLCanvasElement; timerId?: ReturnType<typeof setTimeout> }> = {};

export function clearScribbleCanvas(botId: string): void {
  const entry = scribbleRefs[botId];
  if (!entry) return;
  if (entry.timerId) clearTimeout(entry.timerId);
  try {
    entry.canvas.remove();
  } catch {
    /* ignore */
  }
  delete scribbleRefs[botId];
}

export function startScribbleCanvas(
  containerEl: HTMLElement | null,
  botId: string,
  durationMs = 7000,
): void {
  if (!containerEl || !botId) return;
  clearScribbleCanvas(botId);

  const canvas = document.createElement('canvas');
  canvas.width = containerEl.clientWidth;
  canvas.height = containerEl.clientHeight;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:15';
  canvas.classList.add('cursor-crosshair');
  containerEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let drawing = false;
  let erasing = false;
  const strokeColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#F472B6'];

  const onDown = (e: MouseEvent) => {
    if (e.button === 2) erasing = true;
    else drawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = erasing ? '#1a1e21' : strokeColors[Math.floor(Math.random() * strokeColors.length)];
    ctx.lineWidth = erasing ? 14 : 3;
    ctx.lineCap = 'round';
  };

  const onMove = (e: MouseEvent) => {
    if (!drawing && !erasing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onUp = () => {
    drawing = false;
    erasing = false;
    ctx.closePath();
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const timerId = setTimeout(() => clearScribbleCanvas(botId), durationMs);
  scribbleRefs[botId] = { canvas, timerId };
}
