(function () {
  'use strict';

  var WHATSAPP_PHONE = '77712267768'; // orders go here (8 771 226 77 68)

  var ZONES = [
    { id: 'city', name: 'В пределах города', price: 10000 },
    { id: 'near', name: 'До 30 км от города', price: 18000 },
    { id: 'far', name: 'До 60 км от города', price: 28000 }
  ];

  var F = window.Fleet;
  // Machines the owner switched off stay in the panel but never reach the site
  function shownFleet() { return F.load().filter(function (e) { return !e.hidden; }); }
  var fleet = shownFleet();
  var selectedId = '';

  function $(id) { return document.getElementById(id); }
  function byId(id) { return fleet.filter(function (e) { return e.id === id; })[0] || null; }

  F.hydrateIcons();

  // ---------- Hero counters ----------
  // Machines, not catalog positions: "Самосвал × 4" counts as 4
  function units(list) { return list.reduce(function (n, e) { return n + e.qty; }, 0); }

  function renderStats() {
    var total = units(fleet);
    var free = units(fleet.filter(function (e) { return e.status === 'free'; }));
    $('statTotal').textContent = total;
    $('statTotalLabel').textContent = F.plural(total, 'единица', 'единицы', 'единиц') + ' техники';
    $('statFree').textContent = free;
    $('statMin').textContent = minOrderText();
  }

  // Smallest minimal order across the fleet, e.g. "от 4 ч" (hours win over days, days over months)
  function minOrderText() {
    var short = { hour: 'ч', day: 'сут.', month: 'мес.' };
    var units = ['hour', 'day', 'month'];
    for (var i = 0; i < units.length; i++) {
      var list = fleet.filter(function (e) { return e.unit === units[i]; });
      if (list.length) return 'от ' + Math.min.apply(null, list.map(function (e) { return e.minTerm; })) + ' ' + short[units[i]];
    }
    return '—';
  }

  // ---------- Fleet cards ----------
  function badge(status) {
    var ic = status === 'free' ? 'checkCircle' : status === 'busy' ? 'clock' : 'info';
    return '<span class="status status--' + status + '">' + F.icon(ic) + F.STATUS[status].label + '</span>';
  }

  // The count is shown only when there are several machines and they are not all busy
  function stock(e) {
    if (e.qty < 2 || e.status === 'busy') return '';
    return '<p class="unit__stock">' + F.icon('garage') + '<span>В наличии: <b>' + e.qty + ' шт.</b></span></p>';
  }

  function renderFleet() {
    $('fleet').innerHTML = fleet.map(function (e) {
      var busy = e.status === 'busy';
      var selected = e.id === selectedId;
      var btn = busy
        ? '<button type="button" class="btn btn--muted btn--block" disabled>Сейчас занята</button>'
        : selected
          ? '<button type="button" class="btn btn--dark btn--block" data-pick="' + e.id + '">Техника выбрана ' + F.icon('check') + '</button>'
          : '<button type="button" class="btn btn--accent btn--block" data-pick="' + e.id + '">Выбрать ' + F.icon('check') + '</button>';
      return '<article class="unit' + (busy ? ' is-busy' : '') + (selected ? ' is-selected' : '') + '">' +
        '<div class="unit__photo">' + F.photoHtml(e, 'unit__img') +
          (selected ? '<span class="unit__picked">' + F.icon('check') + 'Выбрано</span>' : '') + '</div>' +
        '<div class="unit__body">' +
          '<div class="unit__title"><h3>' + F.esc(e.name) + '</h3>' + badge(e.status) + '</div>' +
          (e.desc ? '<p class="unit__desc">' + F.esc(e.desc) + '</p>' : '') +
          stock(e) +
          '<p class="unit__price"><b>' + F.money(e.price) + '</b> ' + F.UNITS[e.unit].per +
            ' <span>· ' + F.UNITS[e.unit].minText + ' — ' + F.term(e.minTerm, e.unit) + '</span></p>' +
          btn +
        '</div></article>';
    }).join('');
  }

  $('fleet').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pick]');
    if (!b) return;
    select(b.getAttribute('data-pick'));
    $('calc').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- Calculator ----------
  var machineEl = $('machine'), amountEl = $('amount'), zoneEl = $('zone');
  var amountUnit = 'hour'; // unit the "amount" field currently counts in

  zoneEl.innerHTML = ZONES.map(function (z) {
    return '<option value="' + z.id + '">' + z.name + ' — ' + F.money(z.price) + '</option>';
  }).join('');

  function renderSelect() {
    machineEl.innerHTML = '<option value="">Выберите технику</option>' + fleet.map(function (e) {
      var busy = e.status === 'busy';
      return '<option value="' + e.id + '"' + (busy ? ' disabled' : '') + '>' +
        F.esc(e.name) + ' · ' + F.money(e.price) + ' ' + F.UNITS[e.unit].per + (busy ? ' — занята' : '') + '</option>';
    }).join('');
    machineEl.value = selectedId;
  }

  function select(id) {
    var e = byId(id);
    selectedId = e && e.status !== 'busy' ? id : '';
    machineEl.value = selectedId;
    setError('machine', '');
    syncAmountUnit();
    renderFleet();
    update();
  }

  // The amount field counts hours, days or months depending on the chosen machine.
  // When the unit changes, start from a sensible value instead of e.g. "8 months".
  function syncAmountUnit() {
    var e = byId(selectedId);
    var unit = e ? e.unit : amountUnit;
    var u = F.UNITS[unit];
    $('amountLabel').textContent = u.qty;
    amountEl.max = u.maxQty;
    if (unit !== amountUnit) {
      amountEl.value = Math.max(u.start, e ? e.minTerm : 1);
      amountUnit = unit;
    }
  }

  function calc() {
    var e = byId(selectedId);
    if (!e) return null;
    var max = F.UNITS[e.unit].maxQty;
    var n = parseInt(amountEl.value, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > max) n = max;
    var billed = Math.max(n, e.minTerm);
    var zone = ZONES.filter(function (z) { return z.id === zoneEl.value; })[0] || ZONES[0];
    var rent = billed * e.price;
    return { e: e, amount: n, billed: billed, zone: zone, rent: rent, total: rent + zone.price };
  }

  function update() {
    var c = calc();
    var notice = [];
    if (!c) {
      $('rows').innerHTML = '<div class="summary__empty">Выберите технику в каталоге или в списке слева</div>';
      $('total').textContent = F.money(0);
      $('notice').hidden = true;
      return;
    }
    $('rows').innerHTML =
      '<div><dt>Техника</dt><dd>' + F.esc(c.e.name) + '</dd></div>' +
      '<div><dt>Тариф</dt><dd>' + F.UNITS[c.e.unit].tariff + '</dd></div>' +
      '<div><dt>Продолжительность</dt><dd>' + F.term(c.amount, c.e.unit) +
        (c.billed !== c.amount ? '<small>К расчёту: ' + F.term(c.billed, c.e.unit) + '</small>' : '') + '</dd></div>' +
      '<div class="summary__gap"><dt>Стоимость аренды</dt><dd>' + F.money(c.rent) + '</dd></div>' +
      '<div><dt>Доставка: ' + c.zone.name.toLowerCase() + '</dt><dd>' + F.money(c.zone.price) + '</dd></div>';
    $('total').textContent = F.money(c.total);

    if (c.billed !== c.amount) {
      notice.push(F.UNITS[c.e.unit].minNote + ' для этой техники — ' + F.term(c.e.minTerm, c.e.unit) + '. Расчёт выполнен с его учётом.');
    }
    if (c.e.status === 'confirm') {
      notice.push('Наличие этой техники на выбранную дату менеджер подтвердит отдельно.');
    }
    $('notice').hidden = !notice.length;
    $('noticeText').innerHTML = notice.join('<br>');
  }

  machineEl.addEventListener('change', function () { select(machineEl.value); });
  [amountEl, zoneEl].forEach(function (el) {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });

  // ---------- Submit: validate, then open a prepared WhatsApp message ----------
  function setError(field, msg) {
    var el = document.querySelector('[data-err="' + field + '"]');
    if (el) el.textContent = msg || '';
    var input = $(field);
    if (input) input.closest('.input').classList.toggle('is-invalid', !!msg);
    return !msg;
  }

  // The client writes from their own WhatsApp, so no phone field is needed
  $('orderForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var c = calc();

    var ok = setError('machine', c ? '' : 'Выберите технику');
    ok = setError('address', $('address').value.trim() ? '' : 'Укажите адрес объекта') && ok;
    ok = setError('name', $('name').value.trim() ? '' : 'Укажите имя') && ok;
    if (!ok) {
      var bad = document.querySelector('.is-invalid');
      if (bad) bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var lines = [
      'Заявка на аренду спецтехники',
      '',
      'Техника: ' + c.e.name + (c.e.status === 'confirm' ? ' (нужно подтвердить наличие)' : ''),
      'Адрес: ' + $('address').value.trim(),
      'Тариф: ' + F.UNITS[c.e.unit].tariff,
      'Продолжительность: ' + F.term(c.amount, c.e.unit) + (c.billed !== c.amount ? ' (к расчёту ' + F.term(c.billed, c.e.unit) + ')' : ''),
      'Доставка: ' + c.zone.name.toLowerCase(),
      'Предварительная стоимость: ' + F.money(c.total),
      '',
      'Имя: ' + $('name').value.trim()
    ];
    var comment = $('comment').value.trim();
    if (comment) lines.push('Комментарий: ' + comment);

    window.open('https://wa.me/' + WHATSAPP_PHONE + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');

    var st = $('status');
    st.hidden = false;
    st.textContent = 'Открылся WhatsApp с готовой заявкой. Нажмите «Отправить», и мы свяжемся с вами.';
  });

  ['machine', 'address', 'name'].forEach(function (id) {
    $(id).addEventListener('input', function () { setError(id, ''); });
  });

  // ---------- Live updates from the owner panel ----------
  function refresh() {
    fleet = shownFleet(); // a hidden machine also drops out of the calculator
    var e = byId(selectedId);
    if (!e || e.status === 'busy') selectedId = '';
    syncAmountUnit();
    renderStats();
    renderFleet();
    renderSelect();
    update();
  }
  F.onChange(refresh);

  refresh();
})();
