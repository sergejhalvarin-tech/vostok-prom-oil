// Раздел, который ещё не сделан: название, о чём он будет, ссылка на готовый первый этап.
export function mountStub(root, s, next) {
  root.innerHTML = `
    <section class="stub">
      ${s.n ? `<div class="kicker">Этап ${s.n} из 6</div>` : ''}
      <h1>${s.title}</h1>
      <p>${s.text}</p>
      <p class="muted">Раздел в разработке.</p>
      <div class="stub-links">
        <a class="btn" href="#shelf">← Этап 1: добыча на шельфе</a>
        ${next ? `<a class="btn ghost" href="#${next.id}">${next.title} →</a>` : ''}
      </div>
    </section>`;
  return () => {};
}
