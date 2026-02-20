(() => {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const ctx = canvas.getContext("2d");

  // Farben aus CSS-Variablen ziehen
  const css = getComputedStyle(document.documentElement);
  const ACCENT = css.getPropertyValue("--accent").trim() || "#51a2e9";
  const ACCENT2 = css.getPropertyValue("--accent2").trim() || "#ff4d5a";

  // ---- TUNING (wenn du es noch stärker willst) ----
  const SETTINGS = {
    // mehr Partikel -> dichteres Netz
    density: 9500,          // kleiner = mehr Partikel (z.B. 8000 dichter, 12000 dünner)
    maxDots: 520,           // Obergrenze

    // Verbindung
    linkDist: 115,          // größer = mehr Linien
    baseLineWidth: 0.9,     // dicker
    minAlpha: 0.18,         // Linien nie zu "unsichtbar"
    maxAlpha: 0.95,         // maximale Intensität

    // Maus-Effekt
    mouseRadius: 360,       // größer = stärkere Maus-"Blase"
    mouseBoost: 0.55,       // mehr = kräftiger bei Maus

    // Bewegung
    speed: 0.42,            // Grundgeschwindigkeit
    jitter: 0.18,           // Micro-Noise (lebendiger)
    dotMinR: 1.0,
    dotMaxR: 2.6,

    // Performance
    fpsCap: 60,             // 60 oder 45, wenn du es sparsamer willst
  };
  // -----------------------------------------------

  let w = 0, h = 0, dpr = 1;
  let dots = [];
  let raf = 0;
  let last = 0;

  const mouse = { x: -99999, y: -99999, active: false };

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // cap = 2 (perf)
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const area = w * h;
    const count = Math.min(SETTINGS.maxDots, Math.max(160, Math.floor(area / SETTINGS.density)));

    dots = Array.from({ length: count }, () => {
      const c = Math.random() < 0.86 ? ACCENT : ACCENT2;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SETTINGS.speed,
        vy: (Math.random() - 0.5) * SETTINGS.speed,
        r: SETTINGS.dotMinR + Math.random() * (SETTINGS.dotMaxR - SETTINGS.dotMinR),
        c,
        // kleine Individualität
        n: Math.random() * Math.PI * 2
      };
    });
  }

  // Grid Hashing: nur Nachbarzellen prüfen
  function buildGrid(cellSize) {
    const cols = Math.ceil(w / cellSize);
    const rows = Math.ceil(h / cellSize);
    const grid = new Map();

    function key(cx, cy) {
      return cx + "," + cy;
    }

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const cx = Math.floor(d.x / cellSize);
      const cy = Math.floor(d.y / cellSize);
      const k = key(cx, cy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }

    return { grid, cols, rows, cellSize, key };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function tick(ts) {
    raf = requestAnimationFrame(tick);

    // FPS cap
    const minFrame = 1000 / SETTINGS.fpsCap;
    if (ts - last < minFrame) return;
    last = ts;

    ctx.clearRect(0, 0, w, h);

    // Update positions + tiny noise
    for (const d of dots) {
      d.n += 0.02;
      d.vx += (Math.cos(d.n) * SETTINGS.jitter) * 0.01;
      d.vy += (Math.sin(d.n) * SETTINGS.jitter) * 0.01;

      // Mouse "pull" subtle
      if (mouse.active) {
        const dxm = mouse.x - d.x;
        const dym = mouse.y - d.y;
        const md = Math.hypot(dxm, dym);
        if (md < SETTINGS.mouseRadius) {
          const f = (1 - md / SETTINGS.mouseRadius) * 0.015;
          d.vx += dxm * f * 0.03;
          d.vy += dym * f * 0.03;
        }
      }

      d.x += d.vx;
      d.y += d.vy;

      // Bounce
      if (d.x < 0) { d.x = 0; d.vx *= -1; }
      if (d.x > w) { d.x = w; d.vx *= -1; }
      if (d.y < 0) { d.y = 0; d.vy *= -1; }
      if (d.y > h) { d.y = h; d.vy *= -1; }

      // Draw dot (slightly stronger)
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(d.c, 0.95);
      ctx.fill();
    }

    // Draw lines
    const { grid, cellSize, key } = buildGrid(SETTINGS.linkDist);

    const linkDist = SETTINGS.linkDist;
    const linkDist2 = linkDist * linkDist;

    const mouseR = SETTINGS.mouseRadius;
    const mouseR2 = mouseR * mouseR;

    // For each cell, compare with neighbors (9 cells)
    for (let cx = 0; cx <= Math.ceil(w / cellSize); cx++) {
      for (let cy = 0; cy <= Math.ceil(h / cellSize); cy++) {
        const base = grid.get(key(cx, cy));
        if (!base) continue;

        for (let nx = cx - 1; nx <= cx + 1; nx++) {
          for (let ny = cy - 1; ny <= cy + 1; ny++) {
            const neigh = grid.get(key(nx, ny));
            if (!neigh) continue;

            for (let i = 0; i < base.length; i++) {
              const a = dots[base[i]];
              for (let j = 0; j < neigh.length; j++) {
                const bi = neigh[j];
                // avoid duplicates when same cell neighborhood
                if (base === neigh && base[i] >= bi) continue;

                const b = dots[bi];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > linkDist2) continue;

                // base alpha by distance
                let t = 1 - (d2 / linkDist2);
                // make lines more visible overall
                let alpha = SETTINGS.minAlpha + (SETTINGS.maxAlpha - SETTINGS.minAlpha) * (t * t);

                // mouse boost if both are near mouse
                if (mouse.active) {
                  const ax = a.x - mouse.x, ay = a.y - mouse.y;
                  const bx = b.x - mouse.x, by = b.y - mouse.y;
                  const am2 = ax*ax + ay*ay;
                  const bm2 = bx*bx + by*by;
                  if (am2 < mouseR2 || bm2 < mouseR2) {
                    const mm = 1 - (Math.min(am2, bm2) / mouseR2);
                    alpha = clamp(alpha + mm * SETTINGS.mouseBoost, SETTINGS.minAlpha, 1);
                  }
                }

                ctx.lineWidth = SETTINGS.baseLineWidth;
                ctx.strokeStyle = hexToRgba(ACCENT, alpha);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        }
      }
    }
  }

  function toLocal(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }

  window.addEventListener("mousemove", toLocal, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!e.touches || !e.touches[0]) return;
    const t = e.touches[0];
    toLocal({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: true });

  window.addEventListener("mouseleave", () => {
    mouse.active = false;
    mouse.x = -99999;
    mouse.y = -99999;
  });

  window.addEventListener("resize", resize);

  resize();
  raf = requestAnimationFrame(tick);

  // cleanup on page unload
  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
})();
