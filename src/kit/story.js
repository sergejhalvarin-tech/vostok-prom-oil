// Раздел-история: 3D-сцена слева, панель с шагами справа.
//   cfg = {stageNo, title, lead, steps: [{title, html, cam, tgt, focus, also}], names, hotspots,
//          next, credits, tools: [{id, label, title}], build(stage, api) → {onStep(i, byUser), dispose}}
// api: {go(i, opts), progress(loaded, total, text), loaded(), error(text), $(id), step()}
import * as THREE from 'three';
import {createStage} from './stage.js';

export function mountStory(root, cfg) {
  const {steps} = cfg;
  root.innerHTML = `
    <section class="stage">
      <div class="viewport" id="vp">
        <div class="labels"></div>
        <div class="tip"></div>
        <div class="hud" id="hud"></div>
        <div class="loading" id="loading"><div class="bar"><i id="lbar"></i></div><span id="ltext">Загрузка 3D-моделей…</span></div>
        <div class="vp-tools">${(cfg.tools || []).map((t) => `<button class="chip" id="${t.id}" title="${t.title || ''}">${t.label}</button>`).join('')}
          <button class="chip" id="bReset" title="Вернуться к первому шагу">Сначала</button></div>
      </div>
      <aside class="panel">
        <div class="kicker">Этап ${cfg.stageNo} из 6 · Путь нефти</div>
        <h1>${cfg.title}</h1>
        <p class="lead">${cfg.lead}</p>
        <ol class="steps" id="steps">${steps.map((s, i) => `<li><button data-i="${i}"><i>${i + 1}</i>${s.title}</button></li>`).join('')}</ol>
        <article class="card" id="card"></article>
        <div class="nav-row">
          <button class="btn ghost" id="bPrev">←</button>
          <span id="counter"></span>
          <button class="btn" id="bNext">Дальше →</button>
        </div>
        ${cfg.next ? `<a class="next-stage" href="#${cfg.next.id}"><small>Этап ${cfg.next.n}</small>${cfg.next.title} →</a>` : ''}
        <footer class="credits">${cfg.credits}</footer>
      </aside>
    </section>`;

  let disposed = false;
  // После ухода из раздела его загрузчики не должны трогать разметку нового раздела.
  const $ = (id) => (disposed ? null : root.querySelector('#' + id));
  let step = -1;
  const stage = createStage($('vp'), {
    cam: steps[0].cam, tgt: steps[0].tgt, names: cfg.names,
    onPick: (key) => {
      const i = steps.findIndex((s) => s.focus === key || s.also?.includes(key));
      if (i >= 0) go(i);
    },
  });

  if (location.hostname === 'localhost') window.__stage = stage; // для отладки ракурсов

  for (const h of cfg.hotspots || []) {
    stage.addLabel({
      html: `<i>${h.step + 1}</i><span>${h.text || cfg.names[h.key]}</span>`,
      at: typeof h.p === 'function' ? h.p : new THREE.Vector3(...h.p),
      visible: h.visible || (() => true),
      onClick: () => go(h.step),
      active: () => step === h.step,
    });
  }

  const stepBtns = [...$('steps').querySelectorAll('button')];
  let ctrl = {};

  // byUser: шаг выбран человеком (а не сменился по ходу анимации).
  function go(i, {byUser = true, fly = true} = {}) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    step = i;
    const s = steps[i];
    stepBtns.forEach((b, j) => b.classList.toggle('on', j === i));
    $('card').innerHTML = `<h2><i>${i + 1}</i>${s.title}</h2>${s.html}`;
    $('counter').textContent = `${i + 1} / ${steps.length}`;
    $('bPrev').disabled = i === 0;
    $('bNext').textContent = i === steps.length - 1 ? 'Сначала ↺' : 'Дальше →';
    stage.setFocus(s.focus, s.also || []);
    ctrl.onStep?.(i, byUser);
    if (fly && s.cam && !s.follow) { stage.setFollow(null); stage.flyTo(s.cam, s.tgt); }
    if (byUser && matchMedia('(max-width: 900px)').matches) $('card').scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }

  stepBtns.forEach((b) => (b.onclick = () => go(+b.dataset.i)));
  $('bPrev').onclick = () => go(step - 1);
  $('bNext').onclick = () => go(step === steps.length - 1 ? 0 : step + 1);
  $('bReset').onclick = () => go(0);

  const api = {
    go, $, step: () => step,
    progress(loaded, total, text = 'Загрузка 3D-моделей…') {
      if (!$('lbar')) return;
      $('lbar').style.width = ((loaded / total) * 100).toFixed(0) + '%';
      $('ltext').textContent = `${text} ${(loaded / 1e6).toFixed(1)} из ${(total / 1e6).toFixed(1)} МБ`;
    },
    loaded: () => $('loading')?.classList.add('done'),
    error: (text) => { const el = $('ltext'); if (el) el.textContent = text; },
  };
  ctrl = cfg.build(stage, api) || {};
  go(0, {byUser: false});

  return () => {
    disposed = true;
    ctrl.dispose?.();
    stage.dispose();
  };
}
