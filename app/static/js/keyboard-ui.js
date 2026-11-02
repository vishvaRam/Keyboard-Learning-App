/* Reusable on-screen piano. Renders notes in a MIDI range and reports pointer presses with a velocity guess. */
(function () {
  const Piano = (window.Piano = {});
  const BLACK = new Set([1, 3, 6, 8, 10]);

  Piano.isBlack = (midi) => BLACK.has(((midi % 12) + 12) % 12);
  Piano.label = (midi) => Audio.midiToName(midi);

  Piano.create = function (container, options) {
    const opts = Object.assign(
      { low: 48, high: 84, compact: false, onNote: null, onRelease: null, velocityFromPointer: false },
      options || {}
    );
    container.innerHTML = "";
    const root = document.createElement("div");
    root.className = "piano" + (opts.compact ? " piano-compact" : "");
    container.appendChild(root);

    const whites = [];
    for (let m = opts.low; m <= opts.high; m++) if (!Piano.isBlack(m)) whites.push(m);
    const whiteWidth = 100 / whites.length;

    const keyEls = new Map();
    whites.forEach((midi) => {
      const el = document.createElement("div");
      el.className = "key-white key";
      el.dataset.midi = midi;
      // label Cs only, so the keys are not crowded
      if (midi % 12 === 0) el.textContent = Audio.midiToName(midi);
      root.appendChild(el);
      keyEls.set(midi, el);
    });

    for (let m = opts.low; m <= opts.high; m++) {
      if (!Piano.isBlack(m)) continue;
      const el = document.createElement("div");
      el.className = "key-black key";
      el.dataset.midi = m;
      // centred on the boundary between the two white keys it sits between
      const whiteIndex = whites.indexOf(m - 1);
      const centre = (whiteIndex + 1) * whiteWidth;
      const blackWidth = whiteWidth * 0.62;
      el.style.left = `calc(${centre}% - ${blackWidth / 2}%)`;
      el.style.width = `${blackWidth}%`;
      root.appendChild(el);
      keyEls.set(m, el);
    }

    const pressed = new Map();

    // CSS colours keys via key-white-held / key-black-held, not a bare "held" class
    function heldClass(midi) {
      return Piano.isBlack(midi) ? "key-black-held" : "key-white-held";
    }

    function press(midi, velocity) {
      if (pressed.has(midi)) return;
      pressed.set(midi, velocity);
      const el = keyEls.get(midi);
      if (el) el.classList.add(heldClass(midi));
      if (opts.onNote) opts.onNote(midi, velocity);
    }

    function release(midi) {
      if (!pressed.has(midi)) return;
      const velocity = pressed.get(midi);
      pressed.delete(midi);
      const el = keyEls.get(midi);
      if (el) el.classList.remove(heldClass(midi));
      if (opts.onRelease) opts.onRelease(midi, velocity);
    }

    function pointerVelocity(event, el) {
      if (!opts.velocityFromPointer) return 90;
      const rect = el.getBoundingClientRect();
      // lower on the key = harder press, like pushing deeper into the keybed
      const rel = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      return Math.round(35 + rel * 85);
    }

    // track which pointer started which key, so a release always reaches the right one
    const byPointer = new Map();

    function releasePointer(pointerId) {
      const midi = byPointer.get(pointerId);
      if (midi === undefined) return;
      byPointer.delete(pointerId);
      release(midi);
    }

    root.addEventListener("pointerdown", (event) => {
      const el = event.target.closest(".key");
      if (!el || !root.contains(el)) return;
      event.preventDefault();
      const midi = Number(el.dataset.midi);
      byPointer.set(event.pointerId, midi);
      try {
        el.setPointerCapture(event.pointerId);
      } catch (_) {
        /* capture is best-effort */
      }
      // start the note immediately so it never depends on an async context resume
      const velocity = pointerVelocity(event, el);
      Audio.init()
        .catch(() => {})
        .then(() => press(midi, velocity));
    });

    const endPointer = (event) => releasePointer(event.pointerId);
    root.addEventListener("pointerup", endPointer);
    root.addEventListener("pointercancel", endPointer);
    // capture can lose the pointer if the window loses focus - never leave a key stuck
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    window.addEventListener("blur", () => {
      for (const id of Array.from(byPointer.keys())) releasePointer(id);
    });

    const api = {
      root,
      externalPress: press,
      externalRelease: release,
      keyEl: (midi) => keyEls.get(midi),
      highlight(midis, className = "hint") {
        keyEls.forEach((el) => el.classList.remove(className));
        (midis || []).forEach((m) => {
          const el = keyEls.get(m);
          if (el) el.classList.add(className);
        });
      },
      clearHighlight() {
        keyEls.forEach((el) => el.classList.remove("hint"));
      },
      range: () => ({ low: opts.low, high: opts.high }),
    };
    return api;
  };
})();
