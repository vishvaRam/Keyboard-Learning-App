/* Audio engine: sampled grand piano only. */
(function () {
  const Audio = (window.Audio = {});

  const state = {
    ctx: null,
    master: null,
    dry: null,
    reverb: null,
    reverbGain: null,
    sustain: false,
    sounding: new Map(),
  };

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SAMPLE_BASE = "https://tonejs.github.io/audio/salamander/";
  // Salamander names sharps with "s": Ds3.mp3, Fs4.mp3 - never "#"
  const SAMPLES = [
    "A0", "C1", "Ds1", "Fs1", "A1",
    "C2", "Ds2", "Fs2", "A2",
    "C3", "Ds3", "Fs3", "A3",
    "C4", "Ds4", "Fs4", "A4",
    "C5", "Ds5", "Fs5", "A5",
    "C6", "Ds6", "Fs6", "A6",
    "C7", "Ds7", "Fs7", "A7", "C8",
  ];

  Audio.buffers = new Map();
  Audio.loading = new Map();

  Audio.midiToName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

  /** "Ds3" -> 51, "C4" -> 60. Accepts both "s" and "#" spellings. */
  Audio.sampleNameToMidi = function (name) {
    const m = /^([A-G])(s|#|b)?(-?\d+)$/.exec(name);
    if (!m) return null;
    const letter = m[1];
    const accidental = m[2] === "s" || m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
    return NOTE_NAMES.indexOf(letter) + accidental + (parseInt(m[3], 10) + 1) * 12;
  };

  function makeImpulse(ctx, seconds = 2.6, decay = 3.2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  Audio.init = async function () {
    if (state.ctx) {
      if (state.ctx.state === "suspended") await state.ctx.resume();
      return state.ctx;
    }
    const ctx = (state.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" }));

    state.master = ctx.createGain();
    state.master.gain.value = 0.75;

    // only catches stacked chords clipping - it must not colour single notes
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 30;
    comp.ratio.value = 2;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;

    state.dry = ctx.createGain();
    state.dry.gain.value = 1;
    state.reverb = makeImpulse(ctx);
    state.reverbGain = ctx.createGain();
    state.reverbGain.gain.value = 0.1;

    state.dry.connect(comp);
    state.reverb.connect(state.reverbGain).connect(comp);
    comp.connect(state.master).connect(ctx.destination);
    return ctx;
  };

  Audio.ctx = () => state.ctx;

  // The pedal itself does not release notes here: the app keeps pedal-held keys
  // alive and calls their stop functions when the pedal lifts.
  Audio.setSustain = (on) => {
    state.sustain = on;
  };

  /** Stop everything currently sounding (e.g. when switching tabs mid-chord). */
  Audio.allOff = function () {
    for (const stop of Array.from(state.sounding.values())) stop();
    state.sounding.clear();
  };

  /* ---------------- piano ---------------- */
  function nearestSample(midi) {
    let best = SAMPLES[0];
    let bestDist = Infinity;
    for (const name of SAMPLES) {
      const d = Math.abs(Audio.sampleNameToMidi(name) - midi);
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
      if (d === 0) break;
    }
    return best;
  }

  function loadSample(name) {
    if (Audio.buffers.has(name)) return Promise.resolve(Audio.buffers.get(name));
    if (Audio.loading.has(name)) return Audio.loading.get(name);
    const job = (async () => {
      try {
        const res = await fetch(SAMPLE_BASE + name + ".mp3", { mode: "cors" });
        if (!res.ok) throw new Error(res.status + " for " + name);
        const buf = await state.ctx.decodeAudioData(await res.arrayBuffer());
        Audio.buffers.set(name, buf);
        return buf;
      } catch (err) {
        console.warn("piano sample unavailable:", name, err);
        Audio.buffers.set(name, null);
        return null;
      } finally {
        Audio.loading.delete(name);
      }
    })();
    Audio.loading.set(name, job);
    return job;
  }

  function playPiano(midi, velocity) {
    const name = nearestSample(midi);
    const buf = Audio.buffers.get(name);
    if (!buf) return null; // caller retries once the sample has loaded

    const ctx = state.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (midi - Audio.sampleNameToMidi(name)) / 12);

    const vel = Math.min(1, Math.max(0.05, velocity / 127));
    const g = ctx.createGain();
    g.gain.value = Math.pow(vel, 1.5);

    // only a gentle top-end tamer: the samples are already a real piano
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 4000 + vel * 6000;

    src.connect(tone).connect(g);
    g.connect(state.dry);
    g.connect(state.reverb);

    const now = ctx.currentTime;
    src.start(now);
    // hard cap: never outlive the sample, even if note-off is lost
    src.stop(now + 8);

    let stopped = false;
    const stop = (release = 0.22) => {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + release);
        src.stop(t + release);
      } catch (_) {
        /* already stopped */
      }
    };
    return stop;
  }

  /* ---------------- public ---------------- */
  /**
   * Play a note. Resolves with the stop function, or a no-op if the sample
   * could not be loaded (the note is simply silent rather than sounding wrong).
   */
  Audio.play = async function (midi, velocity = 80) {
    await Audio.init();
    const name = nearestSample(midi);
    if (!Audio.buffers.has(name)) {
      await loadSample(name);
    }
    const stop = playPiano(midi, velocity);
    return stop || (() => {});
  };

  Audio.playBlocking = async function (midi, velocity, ms) {
    const stop = await Audio.play(midi, velocity);
    setTimeout(() => stop && stop(0.35), ms);
    return stop;
  };

  Audio.prefetch = async function (midis) {
    await Audio.init();
    await Promise.all(Array.from(new Set(midis.map(nearestSample))).map(loadSample));
  };

  Audio.prefetchAll = function () {
    return Audio.prefetch(SAMPLES.map(Audio.sampleNameToMidi));
  };

  Audio.sampleReport = function () {
    const loaded = Array.from(Audio.buffers.values()).filter(Boolean).length;
    const failed = Array.from(Audio.buffers.values()).filter((b) => b === null).length;
    return { loaded, failed, total: SAMPLES.length };
  };

  /* ---------------- audio-input velocity (PSR over line-in) ---------------- */
  const input = {
    stream: null,
    analyser: null,
    timer: null,
    data: null,
    recentPeak: 0,
    lastAttack: 0,
    onAttack: null,
    sensitivity: 0.55,
  };

  function sampleInput() {
    input.analyser.getFloatTimeDomainData(input.data);
    let sum = 0;
    for (let i = 0; i < input.data.length; i++) sum += input.data[i] * input.data[i];
    const rms = Math.sqrt(sum / input.data.length);
    const now = performance.now();
    if (rms < 0.004) {
      input.recentPeak *= 0.92;
      return;
    }
    if (rms >= input.recentPeak) {
      input.recentPeak = rms;
      if (now - input.lastAttack > 45 && input.onAttack) {
        input.lastAttack = now;
        input.onAttack(Audio.audioInput.toVelocity(rms));
      }
    }
  }

  Audio.audioInput = {
    async enable() {
      if (input.stream) return true;
      try {
        input.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (err) {
        return { error: err.message || "Permission denied" };
      }
      const ctx = await Audio.init();
      const src = ctx.createMediaStreamSource(input.stream);
      input.analyser = ctx.createAnalyser();
      input.analyser.fftSize = 2048;
      input.data = new Float32Array(input.analyser.fftSize);
      src.connect(input.analyser);
      input.timer = setInterval(sampleInput, 25);
      return true;
    },
    toVelocity(level) {
      const sens = 0.2 + input.sensitivity * 2.4;
      const db = 20 * Math.log10(Math.max(level, 0.00004));
      return Math.max(1, Math.min(127, Math.round(((db + 55) / 47) * 127 * sens)));
    },
    setSensitivity(v) {
      input.sensitivity = v;
    },
    setHandler(fn) {
      input.onAttack = fn;
    },
    level() {
      return input.recentPeak;
    },
    active() {
      return Boolean(input.stream);
    },
  };

  Audio.state = state;
})();
