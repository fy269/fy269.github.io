(() => {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");

  // ── CSS-Variablen auslesen ──────────────────────────────────────────────
  const css    = getComputedStyle(document.documentElement);
  const ACCENT = css.getPropertyValue("--accent").trim()  || "#51a2e9";
  const ACCENT2= css.getPropertyValue("--accent2").trim() || "#ff4d5a";

  // ── Einstellungen ───────────────────────────────────────────────────────
  const S = {
    density:      9500,   // kleiner = mehr Partikel
    maxDots:      480,
    linkDist:     115,
    baseLineWidth: 0.85,
    minAlpha:     0.08,
    maxAlpha:     0.90,
    mouseRadius:  300,
    mouseBoost:   0.45,
    speed:        0.38,
    jitter:       0.15,
    dotMinR:      1.0,
    dotMaxR:      2.4,
    maxSpeed:     1.2,    // ← NEU: verhindert unkontrolliertes Beschleunigen
    fpsCap:       60,
    // Alpha-Stufen fürs Batching: weniger = schneller, mehr = weicher
    alphaBuckets: 24,
  };

  // ── Farb-Cache (verhindert String-Erzeugung im Hot Loop) ────────────────
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const s = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const [ar, ag, ab] = hexToRgb(ACCENT);

  // Alle Alpha-Strings vorberechnen
  const alphaCache = Array.from({ length: S.alphaBuckets + 1 }, (_, i) => {
    const a = (i / S.alphaBuckets).toFixed(3);
    return `rgba(${ar},${ag},${ab},${a})`;
  });

  function cachedAlpha(alpha) {
    const i = Math.round(alpha * S.alphaBuckets);
    return alphaCache[Math.max(0, Math.min(S.alphaBuckets, i))];
  }

  // ── State ───────────────────────────────────────────────────────────────
  let w = 0, h = 0, dpr = 1;
  let dots = [];
  let raf  = 0;
  let last = 0;

  const mouse = { x: -99999, y: -99999, active: false };

  // ── Resize ──────────────────────────────────────────────────────────────
  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);

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
      c:  Math.random() < 0.86 ? ACCENT : ACCENT2,
      n:  Math.random() * Math.PI * 2,
    }));
  }

  // ── Grid-Hashing ─────────────────────────────────────────────────────────
  function buildGrid(cellSize) {
    const grid = new Map();
    for (let i = 0; i < dots.length; i++) {
      const d  = dots[i];
      const cx = Math.floor(d.x / cellSize);
      const cy = Math.floor(d.y / cellSize);
      const k  = `${cx},${cy}`;
      let cell = grid.get(k);
      if (!cell) { cell = []; grid.set(k, cell); }
      cell.push(i);
    }
    return grid;
  }

  // ── Haupt-Loop ───────────────────────────────────────────────────────────
  function tick(ts) {
    raf = requestAnimationFrame(tick);

    const minFrame = 1000 / S.fpsCap;
    if (ts - last < minFrame) return;
    // FIX: last += minFrame statt last = ts → gleichmäßiger Rhythmus
    last += minFrame;
    if (ts - last > minFrame * 4) last = ts; // Reset nach Tab-Pause

    ctx.clearRect(0, 0, w, h);

    // ── 1. Partikel bewegen & zeichnen ───────────────────────────────────
    for (const d of dots) {
      // Sanftes Noise-Jitter
      d.n  += 0.018;
      d.vx += Math.cos(d.n) * S.jitter * 0.008;
      d.vy += Math.sin(d.n) * S.jitter * 0.008;

      // Maus-Anziehung
      if (mouse.active) {
        const dx = mouse.x - d.x;
        const dy = mouse.y - d.y;
        const md = Math.hypot(dx, dy);
        if (md > 0 && md < S.mouseRadius) {
          const f = (1 - md / S.mouseRadius) * 0.012;
          d.vx += dx * f;
          d.vy += dy * f;
        }
      }

      // FIX: Max-Speed clampen → Partikel fliegen nicht weg
      const speed = Math.hypot(d.vx, d.vy);
      if (speed > S.maxSpeed) {
        d.vx = (d.vx / speed) * S.maxSpeed;
        d.vy = (d.vy / speed) * S.maxSpeed;
      }

      d.x += d.vx;
      d.y += d.vy;

      // Bounce
      if (d.x < 0)  { d.x = 0;  d.vx = Math.abs(d.vx); }
      if (d.x > w)  { d.x = w;  d.vx = -Math.abs(d.vx); }
      if (d.y < 0)  { d.y = 0;  d.vy = Math.abs(d.vy); }
      if (d.y > h)  { d.y = h;  d.vy = -Math.abs(d.vy); }

      // Punkt zeichnen
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.c === ACCENT
        ? cachedAlpha(0.9)
        : `rgba(255,77,90,0.85)`;
      ctx.fill();
    }

    // ── 2. Linien – GEBATCHT ─────────────────────────────────────────────
    //    Alle Linien einer Alpha-Stufe in EINEM einzigen Path → kein Flimmern
    const linkDist  = S.linkDist;
    const linkDist2 = linkDist * linkDist;
    const mouseR2   = S.mouseRadius * S.mouseRadius;

    // Buckets: pro Alpha-Bucket eine Liste von Liniensegmenten sammeln
    // Wir nutzen ein Float32Array als Ring-Buffer für maximale Performance
    // Einfacher Ansatz: Map<alphaIndex, Float32Array-Segmente>
    const buckets = new Array(S.alphaBuckets + 1);

    const grid = buildGrid(linkDist);
    const cw   = Math.ceil(w / linkDist);
    const ch   = Math.ceil(h / linkDist);

    for (let cx = 0; cx <= cw; cx++) {
      for (let cy = 0; cy <= ch; cy++) {
        const base = grid.get(`${cx},${cy}`);
        if (!base) continue;

        for (let nx = cx - 1; nx <= cx + 1; nx++) {
          for (let ny = cy - 1; ny <= cy + 1; ny++) {
            const neigh = grid.get(`${nx},${ny}`);
            if (!neigh) continue;

            const sameCell = (nx === cx && ny === cy);

            for (let i = 0; i < base.length; i++) {
              const a  = dots[base[i]];
              const ai = base[i];

              for (let j = 0; j < neigh.length; j++) {
                const bi = neigh[j];
                // Duplikate vermeiden: nur ein Richtung prüfen
                if (sameCell && ai >= bi) continue;

                const b  = dots[bi];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 >= linkDist2) continue;

                const t     = 1 - d2 / linkDist2;
                let   alpha = S.minAlpha + (S.maxAlpha - S.minAlpha) * (t * t);

                // Maus-Boost
                if (mouse.active) {
                  const ax2 = (a.x - mouse.x) ** 2 + (a.y - mouse.y) ** 2;
                  const bx2 = (b.x - mouse.x) ** 2 + (b.y - mouse.y) ** 2;
                  if (ax2 < mouseR2 || bx2 < mouseR2) {
                    const mm = 1 - Math.min(ax2, bx2) / mouseR2;
                    alpha = Math.min(1, alpha + mm * S.mouseBoost);
                  }
                }

                // In den richtigen Bucket einordnen
                const idx = Math.round(alpha * S.alphaBuckets);
                const clamped = Math.max(0, Math.min(S.alphaBuckets, idx));
                if (!buckets[clamped]) buckets[clamped] = [];
                buckets[clamped].push(a.x, a.y, b.x, b.y);
              }
            }
          }
        }
      }
    }

    // ── Alle Buckets in je EINEM Path rendern ────────────────────────────
    ctx.lineWidth = S.baseLineWidth;
    for (let i = 0; i <= S.alphaBuckets; i++) {
      const segs = buckets[i];
      if (!segs || segs.length === 0) continue;

      ctx.strokeStyle = alphaCache[i];
      ctx.beginPath();
      for (let k = 0; k < segs.length; k += 4) {
        ctx.moveTo(segs[k],     segs[k + 1]);
        ctx.lineTo(segs[k + 2], segs[k + 3]);
      }
      ctx.stroke(); // ← NUR 1× pro Alpha-Stufe statt 1× pro Linie!
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────
  function toLocal(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;
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
    resizeTimer = setTimeout(resize, 80); // Debounce
  });

  resize();
  raf = requestAnimationFrame(tick);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
})();
