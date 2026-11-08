// Дикторская озвучка облёта: мужской голос читает текст главы.
// Основной путь — заранее синтезированные файлы audio/narration/0.mp3 … 7.mp3 и finale.mp3
// (делаются скриптом tools/make-narration.py по тексту из narration.json).
// Пока файлов нет — синтез речи браузера: лучший доступный русский мужской голос
// (в Edge это нейросетевой «Microsoft Dmitry Online (Natural)»).
import TEXT from './narration.json';

const PREFERRED = [/Dmitry.*Natural/i, /Dmitry/i, /Pavel/i, /Maxim/i, /Yuri/i, /male/i, /муж/i];

export function makeNarration() {
  let on = false, files = null, audio = null, current = -1;
  const synth = window.speechSynthesis;
  let voice = null;

  // Готовые файлы озвучки есть, если скрипт синтеза отметил это в narration.json.
  files = !!TEXT.files;

  function pickVoice() {
    if (!synth) return null;
    const ru = synth.getVoices().filter((v) => /^ru/i.test(v.lang));
    for (const re of PREFERRED) { const v = ru.find((x) => re.test(x.name)); if (v) return v; }
    return ru[0] || null;
  }
  if (synth) { voice = pickVoice(); synth.onvoiceschanged = () => { voice = pickVoice(); }; }

  function stop() {
    if (audio) { audio.pause(); audio = null; }
    if (synth) synth.cancel();
  }

  // key: номер главы или 'finale'.
  function play(key) {
    current = key;
    stop();
    if (!on) return;
    const text = key === 'finale' ? TEXT.finale : TEXT.chapters[key];
    if (!text) return;
    if (files) {
      audio = new Audio(`audio/narration/${key}.mp3`);
      audio.volume = 0.95;
      audio.play().catch(() => {});
    } else if (synth) {
      const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, '…'));
      u.lang = 'ru-RU';
      if (voice) u.voice = voice;
      u.rate = 0.92;
      u.pitch = 0.88;
      synth.speak(u);
    }
  }

  return {
    get on() { return on; },
    get hasVoice() { return files || !!voice; },
    set(v) { on = v; if (!on) stop(); else if (current !== -1) play(current); },
    play,
    pause() { if (audio) audio.pause(); if (synth) synth.pause(); },
    resume() { if (!on) return; if (audio) audio.play().catch(() => {}); if (synth) synth.resume(); },
    dispose() { on = false; stop(); },
  };
}
