/* Demo phrases so the ear learns what dynamics do before the drills start. */
(function () {
  const Demos = (window.Demos = {});

  const PHRASE = [60, 62, 64, 65, 67, 65, 64, 62, 60];
  const BEAT_MS = 340;

  function interpolate(values, index, count) {
    const x = count <= 1 ? 0 : index / (count - 1);
    return values[Math.round(x * (values.length - 1))];
  }

  const PROFILES = {
    flat: () => 64,
    even: () => 78,
    expressive: (_midi, index, count) =>
      interpolate([40, 58, 82, 104, 112, 96, 72, 52, 36], index, count),
  };

  Demos.play = async function (profile, onNote) {
    const velocityFor = PROFILES[profile] || PROFILES.even;
    await Audio.init();
    await Audio.prefetch(PHRASE);
    PHRASE.forEach((midi, index) => {
      const velocity = Math.round(velocityFor(midi, index, PHRASE.length));
      setTimeout(async () => {
        const stop = await Audio.play(midi, velocity);
        setTimeout(() => stop && stop(0.35), 420);
        if (onNote) onNote({ midi, velocity, index });
      }, index * BEAT_MS);
    });
    return PHRASE.length * BEAT_MS;
  };

  Demos.phrase = () => PHRASE.slice();
})();
