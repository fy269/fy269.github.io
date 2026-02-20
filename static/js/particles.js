(() => {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");

  const css     = getComputedStyle(document.documentElement);
  const ACCENT  = css.getPropertyValue("--accent").trim()  || "#51a2e9";
  const ACCENT2 = css.getPropertyValue("--accent2").trim() || "#ff4d5a";

  // Mobil erkennen (kein echter Mauszeiger)
  const isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  // ── Einstellungen ─────────────────────────────────────────────────────────
  const S = {
    density:      isMobile ? 9000  : 4500,  // weniger Partikel auf Mobile
    maxDots:      isMobile ? 120   : 380,

    linkDist:     130,
    mouseRadius:  isMobile ? 160   : 220,   // kleinerer Cluster auf Mobile

    dotMinR:      1.2,
    dotMaxR:      2.8,
    dotAlpha:     0.55,

    lineWidth:       0.9,
    lineMaxAlpha:    0.75,
    mouseLineWidth:  1.1,
    mouseLineAlpha:  0.90,

    speed:    0.25,
    jitter:   0.08,
    maxSpeed: 0.6,

    fpsCap: isMobile ? 45 : 60,   // auf Mobile etwas sparsamer

    // Auto-Drift (nur Mobile): wie schnell der virtuelle Cursor wandert
    driftSpeed: 0.4,
  };

  // ── Farben ────────────────────────────────────────────────────────────────
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

  // Desktop: echter Mauszeiger
  const mouse = { x: -99999, y: -99999, active: false };

  // Mobile: virtueller Cursor der automatisch driftet
  const drift = {
    x: 0, y: 0,       // aktuelle Position
    tx: 0, ty: 0,     // Zielposition
    t: 0,             // Noise-Timer
  };

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    const dpr = Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(S.maxDots, Math.max(60, Math.floor((w * h) / S.density)));
    dots = Array.from({ length: count }, () => ({
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: (Math.random() - 0.5) * S.speed,
      vy: (Math.random() - 0.5) * S.speed,
      r:  S.dotMinR + Math.random() * (S.dotMaxR - S.dotMinR),
      c:  Math.random() < 0.88 ? 0 : 1,
      n:  Math.random() * Math.PI * 2,
    }));

    // Drift-Start mittig setzen
    if (isMobile) {
      drift.x = w * 0.5;
      drift.y = h * 0.4;
      drift.tx = drift.x;
      drift.ty = drift.y;
    }
  }

  // ── Auto-Drift Logik (Mobile) ─────────────────────────────────────────────
  // Lissajous-ähnliche Kurve: wandert organisch über den Canvas
  function updateDrift() {
    drift.t += 0.004;

    // Sanft ein neues Ziel ansteuern alle paar Sekunden
    drift.tx = w  * (0.25 + 0.50 * (0.5 + 0.5 * Math.sin(drift.t * 1.3)));
    drift.ty = h  * (0.20 + 0.55 * (0.5 + 0.5 * Math.sin(drift.t * 0.9 + 1.2)));

    // Träges Folgen zum Ziel (Lerp)
    drift.x += (drift.tx - drift.x) * 0.012;
    drift.y += (drift.ty - drift.y) * 0.012;
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  function tick(ts) {
    raf = requestAnimationFrame(tick);

    const minF = 1000 / S.fpsCap;
    if (ts - last < minF) return;
    last += minF;
    if (ts - last > minF * 5) last = ts;

    ctx.clearRect(0, 0, w, h);

    // Effektive Mausposition: Desktop = echter Mauszeiger, Mobile = Drift
    let cx, cy, cActive;
    if (isMobile) {
      updateDrift();
      cx = drift.x;
      cy = drift.y;
      cActive = true;
    } else {
      cx = mouse.x;
      cy = mouse.y;
      cActive = mouse.active;
    }

    const mx2 = S.mouseRadius * S.mouseRadius;
    const ld2 = S.linkDist   * S.linkDist;

    // Proximity pro Partikel berechnen
    const proximity = new Float32Array(dots.length);
    if (cActive) {
      for (let i = 0; i < dots.length; i++) {
        const d  = dots[i];
        const dx = d.x - cx;
        const dy = d.y - cy;
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

    // ── 2. Partikel–Partikel Linien ───────────────────────────────────────
    ctx.lineWidth = S.lineWidth;
    for (let i = 0; i < dots.length; i++) {
      const a  = dots[i];
      const pi = proximity[i];
      for (let j = i + 1; j < dots.length; j++) {
        const p = Math.max(pi, proximity[j]);
        if (p <= 0) continue;

        const dx = a.x - dots[j].x;
        const dy = a.y - dots[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= ld2) continue;

        const alpha = S.lineMaxAlpha * (1 - d2 / ld2) * p;
        ctx.strokeStyle = rgba(ar, ag, ab, alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(dots[j].x, dots[j].y);
        ctx.stroke();
      }
    }

    // ── 3. Cursor → Partikel Linien ───────────────────────────────────────
    if (cActive) {
      ctx.lineWidth = S.mouseLineWidth;
      for (let i = 0; i < dots.length; i++) {
        const p = proximity[i];
        if (p <= 0) continue;
        const d = dots[i];
        ctx.strokeStyle = rgba(ar, ag, ab, p * p * S.mouseLineAlpha);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    }
  }

  // ── Events (nur Desktop) ──────────────────────────────────────────────────
  if (!isMobile) {
    window.addEventListener("mousemove", e => {
      const rect   = canvas.getBoundingClientRect();
      mouse.x      = e.clientX - rect.left;
      mouse.y      = e.clientY - rect.top;
      mouse.active = true;
    }, { passive: true });

    window.addEventListener("mouseleave", () => {
      mouse.active = false;
      mouse.x = mouse.y = -99999;
    });
  }
  // Kein touchmove-Listener → kein Kollabieren beim Scrollen!

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });

  resize();
  raf = requestAnimationFrame(tick);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
})();
