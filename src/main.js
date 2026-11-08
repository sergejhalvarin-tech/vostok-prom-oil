// Одно приложение, разделы переключаются по хешу в адресе (#shelf, #transport …).
import {mountShelf} from './sections/shelf.js';
import {mountStub} from './sections/stub.js';
import {mountTransport} from './sections/transport.js';

// Путь нефти — сквозная история сайта. Готов первый этап, остальные пока заглушки.
const SECTIONS = [
  {id: 'shelf', n: 1, title: 'Добыча на шельфе', mount: mountShelf},
  {id: 'transport', n: 2, title: 'Транспорт', mount: mountTransport},
  {id: 'refinery', n: 3, title: 'Переработка', mount: mountStub,
    text: 'Атмосферная и вакуумная перегонка мазута: откуда берутся масляные фракции.'},
  {id: 'base-oils', n: 4, title: 'Базовые масла', mount: mountStub,
    text: 'Очистка масляных фракций, депарафинизация, гидрокрекинг — группы базовых масел I–III.'},
  {id: 'blending', n: 5, title: 'Смешение', mount: mountStub,
    text: 'Базовое масло + пакет присадок: реакторы смешения, контроль вязкости и чистоты.'},
  {id: 'packing', n: 6, title: 'Фасовка и отгрузка', mount: mountStub,
    text: 'Бочки 216,5 л, кубы IBC 1000 л, налив в автоцистерны. Доставка по России.'},
  {id: 'catalog', title: 'Каталог', mount: mountStub,
    text: 'Гидравлические, трансмиссионные, турбинные, компрессорные и индустриальные масла: свой бренд и дистрибуция.'},
  {id: 'contacts', title: 'Контакты', mount: mountStub,
    text: 'Запрос коммерческого предложения для заводов, автопарков, дилеров и частных клиентов.'},
];

const menu = document.getElementById('menu');
const app = document.getElementById('app');

menu.innerHTML = SECTIONS.map((s) =>
  `<a href="#${s.id}" data-id="${s.id}">${s.n ? `<i>${s.n}</i>` : ''}${s.title}</a>`).join('');

let current = null; // {id, dispose}

function route() {
  const id = location.hash.slice(1) || 'shelf';
  const s = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
  if (current?.id === s.id) return;
  current?.dispose?.();
  app.innerHTML = '';
  for (const a of menu.children) a.classList.toggle('on', a.dataset.id === s.id);
  const next = SECTIONS[SECTIONS.indexOf(s) + 1];
  current = {id: s.id, dispose: s.mount(app, s, next)};
  document.title = `${s.title} — ВостокПромОйл`;
}

addEventListener('hashchange', route);
route();
