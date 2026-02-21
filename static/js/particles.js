(() => {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");

  const css     = getComputedStyle(document.documentElement);
  const ACCENT  = css.getPropertyValue("--accent").trim()  || "#51a2e9";
  const ACCENT2 = css.getPropertyValue("--accent2").trim() || "#ff4d5a";

  const S = {
    density:   5000,
    maxDots:   300,
    linkDist:    130,
    mouseRadius: 200,
    dotMinR:   1.2,
    dotMaxR:   2.8,
    dotAlpha:  0.45,
    lineWidth:       0.9,
    lineMaxAlpha:    0.75,
    mouseLineWidth:  1.1,
    mouseLineAlpha:  0.90,
    speed:    0.25,
    jitter:   0.08,
    maxSpeed: 0.6,
    fpsCap:   60,
  };

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

  let w = 0, h = 0;
  let dots = [];
  let raf = 0, last = 0;

  const mouse = { x: -99999, y: -99999, active: false };
  const drift = { x: 0, y: 0, tx: 0, ty: 0, t: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(S.maxDots, Math.max(80, Math.floor((w * h) / S.density)));
    dots = Array.from({ length: count }, () => ({
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: (Math.random() - 0.5) * S.speed,
      vy: (Math.random() - 0.5) * S.speed,
      r:  S.dotMinR + Math.random() * (S.dotMaxR - S.dotMinR),
      c:  Math.random() < 0.88 ? 0 : 1,
      n:  Math.random() * Math.PI * 2,
    }));

    drift.x  = w * 0.5;
    drift.y  = h * 0.4;
    drift.tx = drift.x;
    drift.ty = drift.y;
  }

  function updateDrift() {
    drift.t  += 0.004;
    drift.tx  = w * (0.20 + 0.60 * (0.5 + 0.5 * Math.sin(drift.t * 1.3)));
    drift.ty  = h * (0.15 + 0.60 * (0.5 + 0.5 * Math.sin(drift.t * 0.9 + 1.2)));
    drift.x  += (drift.tx - drift.x) * 0.012;
    drift.y  += (drift.ty - drift.y) * 0.012;
  }

  function tick(ts) {
    raf = requestAnimationFrame(tick);

    const minF = 1000 / S.fpsCap;
    if (ts - last < minF) return;
    last += minF;
    if (ts - last > minF * 5) last = ts;

    ctx.clearRect(0, 0, w, h);

    updateDrift();

    const cx = mouse.active ? mouse.x : drift.x;
    const cy = mouse.active ? mouse.y : drift.y;

    const mx2 = S.mouseRadius * S.mouseRadius;
    const ld2 = S.linkDist   * S.linkDist;

    const proximity = new Float32Array(dots.length);
    for (let i = 0; i < dots.length; i++) {
      const d  = dots[i];
      const dx = d.x - cx;
      const dy = d.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < mx2) proximity[i] = 1 - Math.sqrt(d2) / S.mouseRadius;
    }

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.n  += 0.015;
      d.vx += Math.cos(d.n) * S.jitter * 0.006;
      d.vy += Math.sin(d.n) * S.jitter * 0.006;

      const sp = Math.hypot(d.vx, d.vy);
      if (sp > S.maxSpeed) {
        d.vx = (d.vx / sp) * S.maxSpeed;
        d.vy = (d.vy / sp) * S.maxSpeed;
      }

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

  window.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const rect   = canvas.getBoundingClientRect();
    mouse.x      = e.clientX - rect.left;
    mouse.y      = e.clientY - rect.top;
    mouse.active = true;
  }, { passive: true });

  window.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse") return;
    mouse.active = false;
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
