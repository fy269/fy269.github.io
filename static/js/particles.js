(() => {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");

  const css     = getComputedStyle(document.documentElement);
  const ACCENT  = css.getPropertyValue("--accent").trim()  || "#51a2e9";
  const ACCENT2 = css.getPropertyValue("--accent2").trim() || "#ff4d5a";

  // ── Einstellungen ─────────────────────────────────────────────────────────
  const S = {
    density:       4500,   // ↓ kleiner = mehr Partikel (war 8000)
    maxDots:       380,    // ↑ mehr Partikel (war 200)

    linkDist:      130,
    mouseRadius:   220,

    dotMinR:       1.2,
    dotMaxR:       2.8,
    dotAlpha:      0.55,

    lineWidth:     0.9,
    lineMinAlpha:  0.0,
    lineMaxAlpha:  0.75,

    mouseLineWidth:  1.1,
    mouseLineAlpha:  0.90,

    speed:    0.25,
    jitter:   0.08,
    maxSpeed: 0.6,

    fpsCap:   60,
  };

  // ── Farb-Cache ────────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const s = h.length === 3 ? h.split("").map(c => c+c).join("") : h;
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const [ar, ag, ab] = hexToRgb(ACCENT);
  const [r2, g2, b2] = hexToRgb(ACCENT2);

  function rgba(r, g, b, a) {
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let w = 0, h = 0;
  let dots = [];
  let raf = 0, last = 0;
  const mouse = { x: -99999, y: -99999, active: false };

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(S.maxDots, Math.max(120, Math.floor((w * h) / S.density)));
    dots = Array.from({ length: count }, () => ({
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: (Math.random() - 0.5) * S.speed,
      vy: (Math.random() - 0.5) * S.speed,
      r:  S.dotMinR + Math.random() * (S.dotMaxR - S.dotMinR),
      c:  Math.random() < 0.88 ? 0 : 1,
      n:  Math.random() * Math.PI * 2,
    }));
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  function tick(ts) {
    raf = requestAnimationFrame(tick);

    const minF = 1000 / S.fpsCap;
    if (ts - last < minF) return;
    last += minF;
    if (ts - last > minF * 5) last = ts;

    ctx.clearRect(0, 0, w, h);

    const mx2 = S.mouseRadius * S.mouseRadius;
    const ld2 = S.linkDist * S.linkDist;

    const proximity = new Float32Array(dots.length);
    if (mouse.active) {
      for (let i = 0; i < dots.length; i++) {
        const d  = dots[i];
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < mx2) proximity[i] = 1 - Math.sqrt(d2) / S.mouseRadius;
      }
    }

    // ── 1. Partikel bewegen & zeichnen ────────────────────────────────────
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.n  += 0.015;
      d.vx += Math.cos(d.n) * S.jitter * 0.006;
      d.vy += Math.sin(d.n) * S.jitter * 0.006;

      const sp = Math.hypot(d.vx, d.vy);
      if (sp > S.maxSpeed) { d.vx = (d.vx / sp) * S.maxSpeed; d.vy = (d.vy / sp) * S.maxSpeed; }

      d.x += d.vx; d.y += d.vy;
      if (d.x < 0)  { d.x = 0;  d.vx =  Math.abs(d.vx); }
      if (d.x > w)  { d.x = w;  d.vx = -Math.abs(d.vx); }
      if (d.y < 0)  { d.y = 0;  d.vy =  Math.abs(d.vy); }
      if (d.y > h)  { d.y = h;  d.vy = -Math.abs(d.vy); }

      const pAlpha = S.dotAlpha + proximity[i] * (1 - S.dotAlpha);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.c === 0
        ? rgba(ar, ag, ab, pAlpha)
        : rgba(r2, g2, b2, pAlpha);
      ctx.fill();
    }

    // ── 2. Partikel–Partikel Linien (nur nahe der Maus) ───────────────────
    ctx.lineWidth = S.lineWidth;
    for (let i = 0; i < dots.length; i++) {
      const a  = dots[i];
      const pi = proximity[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b  = dots[j];
        const p  = Math.max(pi, proximity[j]);
        if (p <= 0) continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= ld2) continue;

        const alpha = (S.lineMaxAlpha * (1 - d2 / ld2)) * p;
        ctx.strokeStyle = rgba(ar, ag, ab, alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // ── 3. Maus → Partikel Linien ─────────────────────────────────────────
    if (mouse.active) {
      ctx.lineWidth = S.mouseLineWidth;
      for (let i = 0; i < dots.length; i++) {
        const p = proximity[i];
        if (p <= 0) continue;
        const d = dots[i];
        ctx.strokeStyle = rgba(ar, ag, ab, p * p * S.mouseLineAlpha);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function toLocal(clientX, clientY) {
    const rect   = canvas.getBoundingClientRect();
    mouse.x      = clientX - rect.left;
    mouse.y      = clientY - rect.top;
    mouse.active = true;
  }

  window.addEventListener("mousemove",  e => toLocal(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove",  e => {
    if (e.touches?.[0]) toLocal(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("mouseleave", () => {
    mouse.active = false;
    mouse.x = mouse.y = -99999;
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });

  resize();
  raf = requestAnimationFrame(tick);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
})();

