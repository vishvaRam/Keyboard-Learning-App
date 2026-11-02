/* Piano roll: time runs bottom -> top, pitch runs left -> right (low keys on the left).
   Colour and brightness come from velocity. No targets, no scoring.
   Each PianoRoll.create() is an independent canvas; the app renders one per tab. */
(function () {
  const Roll = (window.PianoRoll = {});

  const MIN_MIDI = 36; // C2
  const MAX_MIDI = 84; // C6
  const PX_PER_SECOND = 140;
  const PAD_LEFT = 30; // room for the octave labels

  const COLORS = {
    ghost: [100, 116, 139],
    soft: [96, 165, 250],
    medium: [167, 139, 250],
    strong: [251, 191, 36],
    hard: [244, 114, 182],
  };

  Roll.LABELS = {
    ghost: "barely pressed",
    soft: "soft",
    medium: "medium",
    strong: "strong",
    hard: "hard",
  };

  function colorFor(velocity) {
    if (velocity <= 14) return COLORS.ghost;
    if (velocity <= 45) return COLORS.soft;
    if (velocity <= 80) return COLORS.medium;
    if (velocity <= 110) return COLORS.strong;
    return COLORS.hard;
  }
  Roll.colorFor = colorFor;

  const clock = () => performance.now();

  Roll.create = function (canvas, options = {}) {
    const s = {
      canvas,
      ctx: canvas.getContext("2d"),
      live: [],
      history: [],
      pedals: [],
      pedalDownAt: 0,
      raf: null,
      paused: false,
      frozenAt: 0,
      onStats: options.onStats || null,
      lastStatsAt: 0,
    };

    if (!s.ctx.roundRect) {
      s.ctx.roundRect = function (x, y, w, h) {
        this.rect(x, y, w, h);
      };
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    const api = { state: s, resize };

    // one live note per pitch: a retrigger closes the previous bar instead of
    // leaving an orphan that would render as a permanent stub
    api.noteOn = (midi, velocity) => {
      const startedAt = clock();
      for (let i = s.live.length - 1; i >= 0; i--) {
        if (s.live[i].midi === midi) {
          const stale = s.live.splice(i, 1)[0];
          stale.end = startedAt;
          s.history.push(stale);
        }
      }
      s.live.push({ midi, velocity, start: startedAt });
    };

    api.noteOff = (midi) => {
      const end = clock();
      for (let i = s.live.length - 1; i >= 0; i--) {
        if (s.live[i].midi === midi) {
          const note = s.live.splice(i, 1)[0];
          note.end = end;
          s.history.push(note);
          break;
        }
      }
    };

    api.sustain = (on) => {
      if (on) {
        if (!s.pedalDownAt) s.pedalDownAt = clock();
      } else if (s.pedalDownAt) {
        s.pedals.push({ start: s.pedalDownAt, end: clock() });
        s.pedalDownAt = 0;
      }
    };

    api.clear = () => {
      s.live = [];
      s.history = [];
      s.pedals = [];
      s.pedalDownAt = 0;
      api.refreshStats();
    };

    api.togglePause = () => {
      s.paused = !s.paused;
      s.frozenAt = s.paused ? clock() : 0;
      return s.paused;
    };

    api.stats = () => {
      const notes = s.history;
      if (!notes.length) return null;
      const velocities = notes.map((n) => n.velocity);
      const min = Math.min(...velocities);
      const max = Math.max(...velocities);
      return {
        count: notes.length,
        min,
        max,
        avg: Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length),
        span: max - min,
        ghosts: velocities.filter((v) => v <= 14).length,
        pedals: s.pedals.length,
      };
    };

    api.refreshStats = () => {
      if (s.onStats) s.onStats(api.stats());
    };

    function draw() {
      const ctx = s.ctx;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) {
        s.raf = requestAnimationFrame(draw);
        return;
      }
      const plotH = h - PAD_LEFT;
      const plotW = w - 8;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0f0b1a";
      ctx.fillRect(0, 0, w, h);

      const rows = MAX_MIDI - MIN_MIDI + 1;
      const colW = plotW / rows;
      const t = s.paused ? s.frozenAt : clock();

      // octave grid lines, running upward
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "center";
      for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
        if (midi % 12 !== 0) continue;
        const x = PAD_LEFT + (midi - MIN_MIDI) * colW;
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        ctx.fillRect(x, 0, 1, plotH);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillText(Audio.midiToName(midi), x + colW * 0.5, h - 8);
      }

      // time gridlines
      for (let sec = 0; sec < 60; sec++) {
        const y = plotH - sec * PX_PER_SECOND;
        if (y < -PX_PER_SECOND) break;
        ctx.fillStyle = sec % 5 === 0 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)";
        ctx.fillRect(PAD_LEFT, y, plotW - PAD_LEFT, 1);
      }

      // pedal bands sit behind the notes
      const drawBand = (from, to) => {
        const y1 = plotH - ((t - from) / 1000) * PX_PER_SECOND;
        const y2 = plotH - ((t - to) / 1000) * PX_PER_SECOND;
        const top = Math.max(0, Math.min(y1, y2));
        const bottom = Math.max(y1, y2);
        if (bottom < 0 || bottom - top < 0.5) return;
        ctx.fillStyle = "rgba(110, 231, 183, 0.10)";
        ctx.fillRect(PAD_LEFT, top, plotW - PAD_LEFT, bottom - top);
      };
      for (const p of s.pedals) drawBand(p.start, p.end);
      if (s.pedalDownAt) drawBand(s.pedalDownAt, t);

      function drawNote(note, endTime) {
        const x = PAD_LEFT + (note.midi - MIN_MIDI) * colW;
        // Time flows upward: a note's onset is its top edge, its release is its bottom edge.
        // While the key is held the release edge is the now-line, so the bar keeps stretching up.
        const speed = PX_PER_SECOND / 1000;
        // older = higher on screen (smaller y): onset is older than the note's end
        const onsetY = plotH - (t - note.start) * speed;
        const endY = plotH - (t - endTime) * speed;
        if (onsetY < 0 || endY > plotH) return;
        const y = Math.max(0, onsetY);
        // held notes have endY == plotH, so the bar keeps h = (now - start) * speed
        const h = Math.max(1.5, Math.min(plotH, endY) - y);
        const [r, g, b] = colorFor(note.velocity);
        const alpha = 0.35 + (note.velocity / 127) * 0.65;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x + 0.5, y, Math.max(3, colW - 1), h, Math.min(2.5, colW / 3));
        ctx.fill();
      }

      for (const note of s.history) drawNote(note, note.end);
      for (const note of s.live) drawNote(note, t);

      // "now" line at the bottom edge
      ctx.fillStyle = "rgba(255,179,107,0.85)";
      ctx.fillRect(PAD_LEFT, plotH - 1, plotW - PAD_LEFT, 1);
      ctx.textAlign = "start";

      if (t - s.lastStatsAt > 400) {
        s.lastStatsAt = t;
        api.refreshStats();
      }

      s.raf = requestAnimationFrame(draw);
    }

    api.start = () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      draw();
    };

    return api;
  };

  Roll.renderLegend = function (container) {
    if (!container) return;
    container.innerHTML = "";
    for (const [name, rgb] of Object.entries(COLORS)) {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 text-xs text-slate-400";
      row.innerHTML =
        `<span class="h-2.5 w-6 rounded-sm" style="background:rgb(${rgb.join(",")})"></span>` +
        `<span>${Roll.LABELS[name]}</span>`;
      container.appendChild(row);
    }
  };
})();
