// Звук вертолёта, синтезированный в браузере (без аудиофайлов):
// глухие хлопки лопастей — низкочастотный шум с амплитудной модуляцией ~5,5 Гц и басовым «тумом»;
// поток воздуха — полосовой шум, громкость растёт со скоростью.
export function makeRotorSound() {
  let ctx = null, master, wind, lfo, on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Коричневый шум, 3 с в петле.
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };

    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    // Лопасти: шум → ФНЧ → гейн, модулированный пилой (резкая атака, плавный спад).
    lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 5.5;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.55;
    lfo.connect(lfoDepth);
    lfo.start();

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.Q.value = 0.8;
    const blades = ctx.createGain();
    blades.gain.value = 0.6;
    lfoDepth.connect(blades.gain);
    noise().connect(lp).connect(blades).connect(master);

    // Бас: синус 44 Гц с той же модуляцией.
    const thump = ctx.createOscillator();
    thump.frequency.value = 44;
    const thumpGain = ctx.createGain();
    thumpGain.gain.value = 0.25;
    lfoDepth.connect(thumpGain.gain);
    thump.connect(thumpGain).connect(master);
    thump.start();

    // Турбина: тихий высокий тон.
    const turb = ctx.createOscillator();
    turb.type = 'triangle';
    turb.frequency.value = 2400;
    const turbGain = ctx.createGain();
    turbGain.gain.value = 0.006;
    turb.connect(turbGain).connect(master);
    turb.start();

    // Поток воздуха.
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.5;
    wind = ctx.createGain();
    wind.gain.value = 0.05;
    noise().connect(bp).connect(wind).connect(master);
  }

  return {
    get on() { return on; },
    start() {
      if (!ctx) build();
      ctx.resume();
      on = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    },
    stop() {
      on = false;
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    },
    // kmh — скорость полёта: ветер громче, лопасти чуть чаще.
    setSpeed(kmh) {
      if (!ctx || !on) return;
      const k = Math.min(1, kmh / 250);
      wind.gain.setTargetAtTime(0.04 + 0.3 * k, ctx.currentTime, 0.3);
      lfo.frequency.setTargetAtTime(5.3 + 0.6 * k, ctx.currentTime, 0.5);
    },
    dispose() { if (ctx) ctx.close(); ctx = null; on = false; },
  };
}
