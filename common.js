// Shared code for the public site (index.html) and the owner panel (admin.html).
// Prototype storage: owner changes live in localStorage of the current browser.
// For a real client this becomes a tiny API (e.g. Cloudflare Worker + D1).
(function () {
  'use strict';

  var KEY = 'stroytech.fleet.v2';     // full fleet list saved by the owner panel
  var OLD_KEY = 'stroytech.fleet.v1'; // older format: per-item overrides only

  var STATUS = {
    free: { label: 'Свободна' },
    busy: { label: 'Занята' },
    confirm: { label: 'Требует подтверждения' }
  };

  // Rental period the owner picks for each machine: price and minimal term use this unit
  var UNITS = {
    hour: {
      name: 'Почасовая', tariff: 'почасовой', price: 'Цена за час', per: '/час',
      minLabel: 'Минимальная смена, ч', minText: 'мин. смена', minNote: 'Минимальная смена',
      qty: 'Количество часов', forms: ['час', 'часа', 'часов'], maxMin: 24, maxQty: 720, start: 8
    },
    day: {
      name: 'Посуточная', tariff: 'посуточный', price: 'Цена за сутки', per: '/сутки',
      minLabel: 'Мин. срок, суток', minText: 'мин. срок', minNote: 'Минимальный срок аренды',
      qty: 'Количество суток', forms: ['сутки', 'суток', 'суток'], maxMin: 31, maxQty: 365, start: 1
    },
    month: {
      name: 'Помесячная', tariff: 'помесячный', price: 'Цена за месяц', per: '/мес',
      minLabel: 'Мин. срок, мес.', minText: 'мин. срок', minNote: 'Минимальный срок аренды',
      qty: 'Количество месяцев', forms: ['месяц', 'месяца', 'месяцев'], maxMin: 24, maxQty: 36, start: 1
    }
  };

  function clampTerm(v, unit, fallback) {
    v = Math.round(Number(v));
    return v >= 1 ? Math.min(UNITS[unit].maxMin, v) : fallback;
  }

  var MAX_QTY = 99; // machines of one kind in the fleet

  function clampQty(v, fallback) {
    v = Math.round(Number(v));
    return v >= 1 ? Math.min(MAX_QTY, v) : fallback;
  }

  // Default fleet. price = tenge per rental unit (hour / day / month), minTerm = minimal paid term in that unit,
  // qty = how many machines of this kind the company has.
  var DEFAULTS = [
    { id: 'mini', name: 'Мини-экскаватор', desc: 'Траншеи, фундамент и работы в ограниченном пространстве', photo: 'img/mini.jpg', model: 'Caterpillar 302.7D · 2,7 т', price: 8000, unit: 'hour', minTerm: 4, qty: 2, status: 'free' },
    { id: 'crawler', name: 'Гусеничный экскаватор', desc: 'Котлованы, демонтаж и большие объёмы грунта', photo: 'img/crawler.jpg', model: 'Hyundai 140LC · 14 т', price: 14000, unit: 'hour', minTerm: 8, qty: 2, status: 'busy' },
    { id: 'backhoe', name: 'Экскаватор-погрузчик', desc: 'Копает и грузит: траншеи, засыпка, благоустройство', photo: 'img/backhoe.jpg', model: 'JCB 3CX · 8 т', price: 10000, unit: 'hour', minTerm: 4, qty: 3, status: 'free' },
    { id: 'loader', name: 'Фронтальный погрузчик', desc: 'Погрузка грунта, планировка и уборка территории', photo: 'img/loader.jpg', model: 'Caterpillar 950K · ковш 3 м³', price: 11000, unit: 'hour', minTerm: 4, qty: 1, status: 'free' },
    { id: 'manip', name: 'Манипулятор', desc: 'Перевозка материалов и погрузочные работы', photo: 'img/manip.jpg', model: 'Mercedes-Benz Atego · кран-манипулятор', price: 11000, unit: 'hour', minTerm: 4, qty: 2, status: 'confirm' },
    { id: 'dump', name: 'Самосвал', desc: 'Вывоз грунта, доставка песка и щебня', photo: 'img/dump.jpg', model: 'Tatra 815 · кузов 12 м³', price: 12000, unit: 'hour', minTerm: 4, qty: 4, status: 'free' }
  ];

  // Items saved before quantities existed get the demo count for known machines, otherwise 1
  function defaultQty(id) {
    var d = DEFAULTS.filter(function (x) { return x.id === id; })[0];
    return d ? d.qty : 1;
  }

  // Escape text before putting it into HTML (names and descriptions are typed by the owner)
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Only our own image files or uploaded images (data URLs) are allowed
  function cleanPhoto(p) {
    if (typeof p !== 'string') return null;
    if (/^img\/[\w.-]+\.(jpe?g|png|webp)$/i.test(p)) return p;
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) && p.length < 600000) return p;
    return null;
  }

  function text(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

  function cleanItem(x) {
    if (!x || typeof x !== 'object') return null;
    var id = typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id) ? x.id : null;
    var name = text(x.name, 90);
    if (!id || !name || !(x.price > 0)) return null; // the calculator needs a price
    var unit = UNITS[x.unit] ? x.unit : 'hour';      // items saved before periods existed are hourly
    return {
      id: id,
      name: name,
      desc: text(x.desc, 160),
      model: text(x.model, 80),
      photo: cleanPhoto(x.photo),
      price: Math.round(x.price),
      unit: unit,
      minTerm: clampTerm(x.minTerm != null ? x.minTerm : x.minHours, unit, 1),
      qty: clampQty(x.qty, defaultQty(id)),
      status: STATUS[x.status] ? x.status : 'free',
      hidden: x.hidden === true // switched off by the owner: kept in the panel, not shown on the site
    };
  }

  // Defaults with the older per-item overrides (price, shift, status) applied
  function fromOldFormat() {
    var o;
    try { o = JSON.parse(localStorage.getItem(OLD_KEY)) || {}; } catch (e) { o = {}; }
    return DEFAULTS.map(function (d) {
      var e = Object.assign({}, d), x = o[d.id] || {};
      if (x.price > 0) e.price = Math.round(x.price);
      if (x.minHours >= 1 && x.minHours <= 24) e.minTerm = Math.round(x.minHours);
      if (STATUS[x.status]) e.status = x.status;
      return e;
    });
  }

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* broken data: use defaults */ }
    if (!raw || !Array.isArray(raw.items)) return fromOldFormat();
    var seen = {};
    return raw.items.map(cleanItem).filter(function (e) {
      if (!e || seen[e.id]) return false;
      seen[e.id] = true;
      return true;
    });
  }

  // Returns false when the browser storage is full (e.g. too many uploaded photos)
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify({ items: list })); return true; } catch (e) { return false; }
  }

  function reset() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch (e) { /* storage unavailable */ }
  }

  function newId() {
    return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Fires when the other page (site or panel in another tab) changes the data
  function onChange(cb) {
    window.addEventListener('storage', function (ev) {
      if (ev.key === KEY || ev.key === OLD_KEY || ev.key === null) cb();
    });
  }

  function money(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₸'; }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function hours(n) { return n + ' ' + plural(n, 'час', 'часа', 'часов'); }

  // "4 часа", "2 суток", "3 месяца"
  function term(n, unit) {
    var f = (UNITS[unit] || UNITS.hour).forms;
    return n + ' ' + plural(n, f[0], f[1], f[2]);
  }

  // Line icons (Lucide-style), inserted into <i data-icon="name"></i>
  var ICONS = {
    truck: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.3a4 4 0 0 0-1.2-2.9L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M16 14v4M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    garage: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9M7 15h10M7 18h10"/>',
    hardhat: '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1Z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5M4 15v-3a6 6 0 0 1 6-6M14 6a6 6 0 0 1 6 6v3"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
    pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/>'
  };

  function icon(name, extraClass) {
    return '<svg class="ico' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach(function (el) {
      el.outerHTML = icon(el.getAttribute('data-icon'), el.className);
    });
  }

  // Photo or a neutral placeholder when the owner has not added one yet
  function photoHtml(e, cls) {
    return e.photo
      ? '<img class="' + cls + '" src="' + esc(e.photo) + '" alt="' + esc(e.name) + '" loading="lazy">'
      : '<span class="' + cls + ' no-photo">' + icon('camera') + '<small>Фото скоро</small></span>';
  }

  // ---------- Light / dark theme ----------
  // The initial theme is set by a tiny inline script in <head> (no flash).
  var THEME_KEY = 'stroytech.theme';
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function savedTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return t === 'light' || t === 'dark' ? t : null;
    } catch (e) { return null; }
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
      b.title = b.getAttribute('aria-label');
    });
  }

  function initTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-theme-toggle]')) return;
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
    });
    // Follow the system setting until the visitor picks a theme by hand
    if (media && media.addEventListener) {
      media.addEventListener('change', function (ev) {
        if (!savedTheme()) applyTheme(ev.matches ? 'dark' : 'light');
      });
    }
    // Keep the site and the owner panel in sync across tabs
    window.addEventListener('storage', function (ev) {
      if (ev.key === THEME_KEY && savedTheme()) applyTheme(savedTheme());
    });
  }

  initTheme();

  window.Fleet = {
    STATUS: STATUS, load: load, save: save, reset: reset, onChange: onChange,
    UNITS: UNITS, clampTerm: clampTerm, term: term, MAX_QTY: MAX_QTY, clampQty: clampQty,
    cleanItem: cleanItem, newId: newId, esc: esc, photoHtml: photoHtml,
    money: money, plural: plural, hours: hours, icon: icon, hydrateIcons: hydrateIcons
  };
})();
