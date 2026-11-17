(function () {
  'use strict';

  // Demo password. Client-side check only: it is NOT real protection.
  // A production panel needs a server-side login.
  var DEMO_PIN = '1234';
  var SESSION_KEY = 'stroytech.owner';
  // Uploaded photos are cropped to 4:3 and stored as JPEG data URLs
  var PHOTO_W = 720, PHOTO_H = 540, PHOTO_QUALITY = 0.78;

  var F = window.Fleet;
  var fleet = F.load();
  // Starting values when the owner switches a machine to another rental period
  var DEF_MIN = { hour: 4, day: 1, month: 1 };
  var PRICE_HINT = { hour: '10000', day: '70000', month: '1500000' };
  var PRICE_STEP = { hour: 500, day: 1000, month: 10000 };

  function $(id) { return document.getElementById(id); }
  function byId(id) { return fleet.filter(function (x) { return x.id === id; })[0] || null; }
  F.hydrateIcons();

  // ---------- Login ----------
  function isLogged() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }

  function showDash(on) {
    $('login').hidden = on;
    $('dash').hidden = !on;
    $('logout').hidden = !on;
    if (on) render();
  }

  $('loginForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if ($('pin').value === DEMO_PIN) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* storage unavailable */ }
      $('pinError').textContent = '';
      showDash(true);
    } else {
      $('pinError').textContent = 'Неверный пароль';
      $('pin').closest('.input').classList.add('is-invalid');
    }
  });
  $('pin').addEventListener('input', function () {
    $('pinError').textContent = '';
    $('pin').closest('.input').classList.remove('is-invalid');
  });

  $('logout').addEventListener('click', function () {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* storage unavailable */ }
    $('pin').value = '';
    showDash(false);
  });

  // ---------- Dashboard ----------
  function renderCounters() {
    var n = { free: 0, busy: 0, confirm: 0 };
    // Machines (not catalog positions) that clients see on the site
    fleet.forEach(function (e) { if (!e.hidden) n[e.status] += e.qty; });
    $('counters').innerHTML = ['free', 'busy', 'confirm'].map(function (s) {
      return '<div class="counter counter--' + s + '"><b>' + n[s] + '</b><span>' + F.STATUS[s].label + '</span></div>';
    }).join('');
  }

  function visibleHint(e) {
    return e.hidden ? 'Скрыта: на сайте её нет, настройки сохранены' : 'Клиенты видят технику на сайте';
  }

  function applyVisibility(card, e) {
    card.classList.toggle('is-hidden', e.hidden);
    card.querySelector('.hidden-tag').hidden = !e.hidden;
    card.querySelector('[data-visible-hint]').textContent = visibleHint(e);
  }

  function settingCard(e) {
    return '<article class="panel setting' + (e.hidden ? ' is-hidden' : '') + '" data-id="' + e.id + '">' +
      '<div class="setting__top">' + F.photoHtml(e, 'setting__img') +
        '<div class="setting__info"><span class="hidden-tag"' + (e.hidden ? '' : ' hidden') + '>' + F.icon('eyeOff') + 'Скрыта с сайта</span>' +
          '<p class="eyebrow eyebrow--small">Техника</p><h3>' + F.esc(e.name) + '</h3>' +
          (e.desc ? '<p>' + F.esc(e.desc) + '</p>' : '') + '</div>' +
        '<button type="button" class="icon-btn" data-edit="' + e.id + '" title="Редактировать" aria-label="Редактировать: ' + F.esc(e.name) + '">' + F.icon('pencil') + '</button>' +
      '</div>' +
      '<div class="setting__fields setting__fields--4">' +
        '<label class="field"><span class="field__label">Период аренды</span>' +
          '<span class="input input--plain"><select data-field="unit">' +
            Object.keys(F.UNITS).map(function (u) {
              return '<option value="' + u + '"' + (u === e.unit ? ' selected' : '') + '>' + F.UNITS[u].name + '</option>';
            }).join('') +
          '</select></span></label>' +
        '<label class="field"><span class="field__label">Количество, шт.</span>' +
          '<span class="input">' + F.icon('garage') + '<input type="number" min="1" max="' + F.MAX_QTY + '" data-field="qty" value="' + e.qty + '" inputmode="numeric"></span></label>' +
        '<label class="field"><span class="field__label">' + F.UNITS[e.unit].price + '</span>' +
          '<span class="input"><span class="input__prefix">₸</span><input type="number" min="1" step="' + PRICE_STEP[e.unit] + '" data-field="price" value="' + e.price + '" inputmode="numeric"></span></label>' +
        '<label class="field"><span class="field__label">' + F.UNITS[e.unit].minLabel + '</span>' +
          '<span class="input">' + F.icon('clock') + '<input type="number" min="1" max="' + F.UNITS[e.unit].maxMin + '" data-field="minTerm" value="' + e.minTerm + '" inputmode="numeric"></span></label>' +
      '</div>' +
      '<p class="field__label">Статус техники</p>' +
      '<div class="status-switch" role="radiogroup" aria-label="Статус: ' + F.esc(e.name) + '">' +
        ['free', 'busy', 'confirm'].map(function (s) {
          return '<button type="button" role="radio" aria-checked="' + (e.status === s) + '" class="status-switch__btn is-' + s + (e.status === s ? ' is-on' : '') + '" data-status="' + s + '">' + F.STATUS[s].label + '</button>';
        }).join('') +
      '</div>' +
      (e.model ? '<p class="setting__model">' + F.icon('gauge') + F.esc(e.model) + '</p>' : '') +
      '<label class="visible-switch"><input type="checkbox" role="switch" data-visible' + (e.hidden ? '' : ' checked') + '>' +
        '<span><b>Показывать на сайте</b><small data-visible-hint>' + visibleHint(e) + '</small></span></label>' +
    '</article>';
  }

  function render() {
    renderCounters();
    $('settings').innerHTML = fleet.length
      ? fleet.map(settingCard).join('')
      : '<div class="empty">В парке пока нет техники. <button type="button" class="btn btn--accent" data-add>' + F.icon('plus') + ' Добавить технику</button></div>';
  }

  var toastTimer;
  function toast(msg, isError) {
    var t = $('toast');
    t.lastChild.textContent = ' ' + msg;
    t.classList.toggle('is-error', !!isError);
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  // Save after a quick inline change; roll back if the browser storage is full
  function persist(msg) {
    if (F.save(fleet)) { toast(msg || 'Сохранено'); return true; }
    toast('Не удалось сохранить: хранилище браузера переполнено', true);
    fleet = F.load();
    render();
    return false;
  }

  function flash(id) {
    var card = document.querySelector('.setting[data-id="' + id + '"]');
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-flash');
    setTimeout(function () { card.classList.remove('is-flash'); }, 1800);
  }

  $('settings').addEventListener('click', function (ev) {
    var edit = ev.target.closest('[data-edit]');
    if (edit) { openEditor(edit.getAttribute('data-edit')); return; }
    if (ev.target.closest('[data-add]')) { openEditor(null); return; }
    var b = ev.target.closest('[data-status]');
    if (!b) return;
    var card = b.closest('[data-id]');
    var e = byId(card.getAttribute('data-id'));
    e.status = b.getAttribute('data-status');
    card.querySelectorAll('[data-status]').forEach(function (x) {
      var on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-checked', on);
    });
    renderCounters();
    persist();
  });

  // Save numbers when the owner leaves the field (or presses Enter)
  $('settings').addEventListener('change', function (ev) {
    // "Show on the site" switch: the card stays in the panel either way
    var vis = ev.target.closest('[data-visible]');
    if (vis) {
      var vcard = vis.closest('[data-id]');
      var item = byId(vcard.getAttribute('data-id'));
      item.hidden = !vis.checked;
      applyVisibility(vcard, item);
      renderCounters();
      persist(item.hidden ? 'Скрыта с сайта' : 'Снова на сайте');
      return;
    }
    var input = ev.target.closest('[data-field]');
    if (!input) return;
    var card = input.closest('[data-id]');
    var e = byId(card.getAttribute('data-id'));
    var field = input.getAttribute('data-field');

    // New rental period: the old price was for another unit, so ask to check it
    if (field === 'unit') {
      if (!F.UNITS[input.value]) return;
      e.unit = input.value;
      e.minTerm = DEF_MIN[e.unit];
      card.outerHTML = settingCard(e);
      if (!persist()) return;
      toast('Период изменён — проверьте цену за ' + F.UNITS[e.unit].per.slice(1));
      var price = document.querySelector('.setting[data-id="' + e.id + '"] [data-field="price"]');
      if (price) { price.focus(); price.select(); }
      return;
    }

    var v = Math.round(Number(input.value));
    if (field === 'price') v = Math.max(1, v || e.price);
    if (field === 'minTerm') v = F.clampTerm(v, e.unit, e.minTerm);
    if (field === 'qty') v = F.clampQty(v, e.qty);
    input.value = v;
    e[field] = v;
    if (field === 'qty') renderCounters();
    persist();
  });

  // ---------- Add / edit dialog ----------
  var editor = $('editor');
  var editingId = null, draftPhoto = null;
  var delArmed = false, delTimer;

  $('fStatus').innerHTML = ['free', 'busy', 'confirm'].map(function (s) {
    return '<button type="button" role="radio" class="status-switch__btn is-' + s + '" data-fstatus="' + s + '">' + F.STATUS[s].label + '</button>';
  }).join('');

  // Rental period switch in the dialog: relabels price and minimal term fields
  $('fUnit').innerHTML = Object.keys(F.UNITS).map(function (u) {
    return '<button type="button" role="radio" class="unit-switch__btn" data-funit="' + u + '">' + F.UNITS[u].name + '</button>';
  }).join('');

  function setUnitUI(unit) {
    var u = F.UNITS[unit];
    $('fUnit').querySelectorAll('[data-funit]').forEach(function (b) {
      var on = b.getAttribute('data-funit') === unit;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on);
    });
    $('fPriceLabel').textContent = u.price;
    $('fMinLabel').textContent = u.minLabel;
    $('fPrice').placeholder = PRICE_HINT[unit];
    $('fPrice').step = PRICE_STEP[unit];
    $('fMin').max = u.maxMin;
  }
  function currentUnit() {
    var b = $('fUnit').querySelector('.is-on');
    return b ? b.getAttribute('data-funit') : 'hour';
  }
  $('fUnit').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-funit]');
    if (!b || b.getAttribute('data-funit') === currentUnit()) return;
    var unit = b.getAttribute('data-funit');
    setUnitUI(unit);
    $('fMin').value = DEF_MIN[unit]; // "4 hours" makes no sense as "4 months"
    $('fPrice').focus();
  });

  function setStatusUI(s) {
    $('fStatus').querySelectorAll('[data-fstatus]').forEach(function (b) {
      var on = b.getAttribute('data-fstatus') === s;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on);
    });
  }
  function currentStatus() {
    var b = $('fStatus').querySelector('.is-on');
    return b ? b.getAttribute('data-fstatus') : 'free';
  }
  $('fStatus').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-fstatus]');
    if (b) setStatusUI(b.getAttribute('data-fstatus'));
  });

  function renderPreview() {
    $('photoPreview').innerHTML = F.photoHtml({ photo: draftPhoto, name: $('fName').value || 'Фото техники' }, 'photo-field__img');
    $('photoRemove').hidden = !draftPhoto;
    $('photoBtnText').textContent = draftPhoto ? 'Заменить фото' : 'Загрузить фото';
  }

  function setFieldError(input, errEl, msg) {
    $(errEl).textContent = msg;
    $(input).closest('.input').classList.toggle('is-invalid', !!msg);
  }

  function disarmDelete() {
    delArmed = false;
    clearTimeout(delTimer);
    $('deleteBtn').classList.remove('is-armed');
    $('deleteBtn').querySelector('span').textContent = 'Удалить';
  }

  function openEditor(id) {
    var e = id ? byId(id) : null;
    editingId = e ? e.id : null;
    $('editorTitle').textContent = e ? 'Редактировать технику' : 'Новая техника';
    $('fName').value = e ? e.name : '';
    $('fDesc').value = e ? e.desc : '';
    $('fModel').value = e ? e.model : '';
    $('fQty').value = e ? e.qty : 1;
    $('fPrice').value = e ? e.price : '';
    setUnitUI(e ? e.unit : 'hour');
    $('fMin').value = e ? e.minTerm : DEF_MIN.hour;
    setStatusUI(e ? e.status : 'free');
    $('fVisible').checked = e ? !e.hidden : true;
    draftPhoto = e ? e.photo : null;
    $('photoInput').value = '';
    $('editorErr').textContent = '';
    setFieldError('fName', 'fNameErr', '');
    setFieldError('fPrice', 'fPriceErr', '');
    disarmDelete();
    $('deleteBtn').hidden = !e;
    renderPreview();
    editor.showModal();
    $('fName').focus();
  }

  function closeEditor() {
    disarmDelete();
    editor.close();
  }

  // Close on the X / "Отмена" buttons and on a click outside the card
  editor.addEventListener('click', function (ev) {
    if (ev.target === editor || ev.target.closest('[data-close]')) closeEditor();
  });
  $('addBtn').addEventListener('click', function () { openEditor(null); });
  $('fName').addEventListener('input', function () { setFieldError('fName', 'fNameErr', ''); });
  $('fPrice').addEventListener('input', function () { setFieldError('fPrice', 'fPriceErr', ''); });

  // Crop the picked image to 4:3 (center), scale to 720×540 and encode as JPEG
  function readPhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('type')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var sw = img.naturalWidth, sh = img.naturalHeight;
        var scale = Math.max(PHOTO_W / sw, PHOTO_H / sh);
        var cw = PHOTO_W / scale, ch = PHOTO_H / scale;
        var canvas = document.createElement('canvas');
        canvas.width = PHOTO_W;
        canvas.height = PHOTO_H;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
        ctx.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, PHOTO_W, PHOTO_H);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  $('photoInput').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    $('editorErr').textContent = '';
    readPhoto(file).then(function (dataUrl) {
      draftPhoto = dataUrl;
      renderPreview();
    }).catch(function () {
      $('editorErr').textContent = 'Не получилось открыть фото. Выберите файл JPG, PNG или WebP.';
    });
  });

  $('photoRemove').addEventListener('click', function () {
    draftPhoto = null;
    $('photoInput').value = '';
    renderPreview();
  });

  $('editorForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = $('fName').value.trim();
    var price = Math.round(Number($('fPrice').value));
    var ok = true;
    if (!name) { setFieldError('fName', 'fNameErr', 'Укажите название'); ok = false; }
    if (!(price > 0)) { setFieldError('fPrice', 'fPriceErr', 'Укажите ' + F.UNITS[currentUnit()].price.toLowerCase()); ok = false; }
    if (!ok) { (name ? $('fPrice') : $('fName')).focus(); return; }

    var item = F.cleanItem({
      id: editingId || F.newId(),
      name: name,
      desc: $('fDesc').value,
      model: $('fModel').value,
      photo: draftPhoto,
      price: price,
      unit: currentUnit(),
      minTerm: F.clampTerm($('fMin').value, currentUnit(), DEF_MIN[currentUnit()]),
      qty: F.clampQty($('fQty').value, 1),
      status: currentStatus(),
      hidden: !$('fVisible').checked
    });
    var isEdit = !!(editingId && byId(editingId));
    var before = fleet.slice();
    fleet = isEdit
      ? fleet.map(function (x) { return x.id === editingId ? item : x; })
      : fleet.concat([item]);
    if (!F.save(fleet)) {
      fleet = before;
      $('editorErr').textContent = 'Не хватает места в хранилище браузера. Возьмите фото поменьше или удалите ненужную технику.';
      return;
    }
    closeEditor();
    render();
    toast(isEdit ? 'Изменения сохранены' : 'Техника добавлена');
    flash(item.id);
  });

  // Delete needs a second click within 4 seconds
  $('deleteBtn').addEventListener('click', function () {
    if (!delArmed) {
      delArmed = true;
      this.classList.add('is-armed');
      this.querySelector('span').textContent = 'Точно удалить?';
      delTimer = setTimeout(disarmDelete, 4000);
      return;
    }
    var before = fleet.slice();
    fleet = fleet.filter(function (x) { return x.id !== editingId; });
    if (!F.save(fleet)) {
      fleet = before;
      $('editorErr').textContent = 'Не удалось сохранить изменения.';
      return;
    }
    closeEditor();
    render();
    toast('Техника удалена');
  });

  // ---------- Reset (also needs a second click) ----------
  var resetArmed = false, resetTimer;
  function disarmReset() {
    resetArmed = false;
    clearTimeout(resetTimer);
    $('resetBtn').classList.remove('is-armed');
    $('resetBtn').lastChild.textContent = ' Сбросить к исходным';
  }
  $('resetBtn').addEventListener('click', function () {
    if (!resetArmed) {
      resetArmed = true;
      this.classList.add('is-armed');
      this.lastChild.textContent = ' Точно сбросить? Добавленная техника удалится';
      resetTimer = setTimeout(disarmReset, 5000);
      return;
    }
    disarmReset();
    F.reset();
    fleet = F.load();
    render();
    toast('Парк сброшен к исходному списку');
  });

  // If another tab changes the data, show the fresh values
  F.onChange(function () {
    fleet = F.load();
    if (!$('dash').hidden && !editor.open) render();
  });

  showDash(isLogged());
})();
