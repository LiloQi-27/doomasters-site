// Страница расписания: сетка «дни × комнаты × часы», выбор свободных часов и форма заявки.
// В данных нет имён артистов и клиентов — только ник звукаря или служебная метка.
(function () {
  const S = window.DMSchedule;
  const cfg = window.DM_CONFIG;
  const $ = s => document.querySelector(s);

  const PALETTE = ['#8f78ff', '#5aa9ff', '#ffb15a', '#6fdc8c', '#4fd6d6', '#ff6f8a', '#b7d36a', '#f2d48a', '#ff8a65', '#f07ad8', '#7fc4b8', '#c9a7ff'];
  const LABEL = { rent: 'Аренда', closed: 'Закрыто', busy: 'Занято' };
  const SHORT_MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  const state = { data: null, room: 'all', start: 0, focus: null, sel: null };
  const colorOf = {};

  const grid = $('#grid');
  const daysEl = $('#days');
  const engsEl = $('#engs');

  // ---------- помощники ----------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const rub = n => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
  const kind = v => v == null ? 'free' : v === '@rent' ? 'rent' : v === '@closed' ? 'closed' : v === '@busy' ? 'busy' : 'eng';
  const roomById = id => cfg.ROOMS.find(r => r.id === id);
  const dayBy = date => state.data.days.find(d => d.date === date);
  const dateParts = iso => { const d = new Date(iso + 'T12:00:00Z'); return { wd: S.WD[d.getUTCDay()], day: d.getUTCDate(), mon: d.getUTCMonth(), dow: d.getUTCDay() }; };

  function isPast(date, h) {
    const now = S.mskNow();
    return date < now.date || (date === now.date && h <= now.hour);
  }
  function visibleRooms() {
    return state.room === 'all' ? cfg.ROOMS : cfg.ROOMS.filter(r => r.id === state.room);
  }
  function perView() {
    const w = window.innerWidth;
    let n = w >= 1180 ? 7 : w >= 900 ? 5 : w >= 640 ? 3 : 1;
    if (state.room !== 'all') n = w >= 640 ? Math.min(7, n + 2) : 2;
    return Math.min(n, state.data.days.length);
  }
  function clampStart() {
    const max = Math.max(0, state.data.days.length - perView());
    state.start = Math.min(Math.max(0, state.start), max);
  }

  // Сессии одного звукаря за весь период (по всем комнатам)
  function sessionsOf(name) {
    const out = [];
    state.data.days.forEach(day => {
      cfg.ROOMS.forEach(room => {
        const hours = day[room.id] || [];
        for (let h = 0; h < 24; h++) {
          if (hours[h] !== name) continue;
          let e = h + 1;
          while (e < 24 && hours[e] === name) e++;
          out.push({ date: day.date, room: room.id, start: h, end: e });
          h = e - 1;
        }
      });
    });
    return out;
  }

  // ---------- шапка: дни и звукари ----------
  function renderDays() {
    daysEl.innerHTML = '';
    const rooms = visibleRooms();
    const n = perView();
    state.data.days.forEach((day, i) => {
      const p = dateParts(day.date);
      let free = 0, total = 0;
      rooms.forEach(r => {
        for (let h = 0; h < 24; h++) {
          if (isPast(day.date, h)) continue;
          total++;
          if (!day.missing && S.isFree((day[r.id] || [])[h])) free++;
        }
      });
      const b = el('button', 'day');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      if (i >= state.start && i < state.start + n) b.classList.add('in-view');
      if (p.dow === 0 || p.dow === 6) b.classList.add('is-weekend');
      b.append(el('small', '', p.wd), el('b', '', p.day));
      const fill = el('span', 'fill');
      const bar = el('i');
      bar.style.width = total ? Math.round(free / total * 100) + '%' : '0%';
      fill.append(bar);
      b.append(fill);
      b.setAttribute('aria-label', `${S.fmtDay(day.date, { relative: false })}: свободно ${free} ч`);
      b.addEventListener('click', () => { state.start = i; clampStart(); render(); });
      daysEl.append(b);
    });
  }

  function renderEngs() {
    engsEl.innerHTML = '';
    const hoursBy = {};
    state.data.days.forEach(d => cfg.ROOMS.forEach(r => (d[r.id] || []).forEach(v => {
      if (kind(v) === 'eng') hoursBy[v] = (hoursBy[v] || 0) + 1;
    })));
    const names = Object.keys(hoursBy).sort((a, b) => hoursBy[b] - hoursBy[a]);
    if (!names.length) return;

    const all = el('button', 'chip', 'Все звукари');
    all.type = 'button';
    all.setAttribute('aria-pressed', String(!state.focus));
    all.addEventListener('click', () => setFocus(null));
    engsEl.append(all);

    names.forEach(name => {
      const c = el('button', 'chip');
      c.type = 'button';
      c.style.setProperty('--c', colorOf[name]);
      c.append(el('i'), document.createTextNode(name));
      c.setAttribute('aria-pressed', String(state.focus === name));
      c.addEventListener('click', () => setFocus(state.focus === name ? null : name));
      engsEl.append(c);
    });
  }

  function setFocus(name) {
    state.focus = name;
    const note = $('#engNote');
    if (name) {
      const list = sessionsOf(name).filter(s => !isPast(s.date, s.end - 1));
      if (list.length) {
        const idx = state.data.days.findIndex(d => d.date === list[0].date);
        if (idx < state.start || idx >= state.start + perView()) { state.start = idx; clampStart(); }
      }
      note.textContent = '';
      note.append(el('b', '', name), document.createTextNode(list.length
        ? ' на смене: ' + list.slice(0, 6).map(s => {
          const p = dateParts(s.date);
          return `${p.wd} ${p.day} · ${S.hh(s.start)}–${S.hh(s.end)} · ${roomById(s.room).name}`;
        }).join('  /  ') + (list.length > 6 ? `  и ещё ${list.length - 6}` : '')
        : ' — ближайших смен в расписании нет.'));
      note.hidden = false;
    } else {
      note.hidden = true;
    }
    render();
  }

  // ---------- сетка ----------
  function render() {
    clampStart();
    renderDays();
    renderEngs();

    const rooms = visibleRooms();
    const n = perView();
    const vis = state.data.days.slice(state.start, state.start + n);
    const now = S.mskNow();

    grid.innerHTML = '';
    grid.setAttribute('aria-busy', 'false');
    grid.classList.toggle('has-focus', !!state.focus);
    grid.style.setProperty('--cols', vis.length * rooms.length);
    grid.style.setProperty('--colmin', rooms.length > 1 ? '64px' : '110px');

    const frag = document.createDocumentFragment();
    frag.append(el('div', 'g-corner'));

    vis.forEach((day, di) => {
      const col0 = 2 + di * rooms.length;
      const p = dateParts(day.date);
      const head = el('div', 'g-day' + (day.date === now.date ? ' is-today' : ''));
      head.style.gridColumn = `${col0} / span ${rooms.length}`;
      head.append(document.createTextNode(`${p.wd} ${p.day}`), el('small', '', day.date === now.date ? 'сегодня' : SHORT_MON[p.mon]));
      frag.append(head);

      rooms.forEach((room, ri) => {
        const col = col0 + ri;
        const rh = el('div', 'g-room' + (ri === 0 ? ' first' : ''), room.name);
        rh.style.gridColumn = col;
        frag.append(rh);

        const bg = el('div', 'g-colbg' + (ri === 0 ? ' first' : ''));
        bg.style.gridColumn = col;
        frag.append(bg);

        renderColumn(frag, day, room, col);
      });
    });

    for (let h = 0; h < 24; h++) {
      const t = el('div', 'g-time' + (h < 8 ? ' is-night' : ''), S.hh(h));
      t.style.gridRow = 3 + h;
      frag.append(t);
    }

    if (vis.some(d => d.date === now.date)) {
      const line = el('div', 'now-line');
      line.style.gridRow = 3 + now.hour;
      line.style.marginTop = `calc(var(--row) * ${(now.minute / 60).toFixed(3)})`;
      frag.append(line);
    }

    grid.append(frag);
    paintSelection();

    const first = state.data.days[state.start], last = vis[vis.length - 1];
    const a = dateParts(first.date), b = dateParts(last.date);
    $('#rangeLabel').textContent = vis.length === 1
      ? `${a.wd}, ${a.day} ${SHORT_MON[a.mon]}`
      : `${a.day}${a.mon !== b.mon ? ' ' + SHORT_MON[a.mon] : ''}–${b.day} ${SHORT_MON[b.mon]}`;
    $('#prev').disabled = state.start === 0;
    $('#next').disabled = state.start + n >= state.data.days.length;
  }

  function renderColumn(frag, day, room, col) {
    if (day.missing) {
      const m = el('div', 'block missing', 'Нет данных — уточните по телефону');
      m.style.gridColumn = col;
      m.style.gridRow = '3 / 27';
      frag.append(m);
      return;
    }
    const hours = day[room.id] || [];
    for (let h = 0; h < 24;) {
      const v = hours[h];
      const k = kind(v);
      if (k === 'free') {
        const b = el('button', 'cell free' + (isPast(day.date, h) ? ' past' : ''));
        b.type = 'button';
        b.style.gridColumn = col;
        b.style.gridRow = 3 + h;
        b.dataset.date = day.date;
        b.dataset.room = room.id;
        b.dataset.h = h;
        b.setAttribute('aria-label', `${room.name}, ${S.fmtDay(day.date, { relative: false })}, ${S.hh(h)} — свободно`);
        if (isPast(day.date, h)) b.disabled = true;
        b.append(el('span', 'plus', S.hh(h)));
        frag.append(b);
        h++;
        continue;
      }
      let e = h + 1;
      while (e < 24 && hours[e] === v) e++;
      const blk = el('div', 'block ' + k);
      blk.style.gridColumn = col;
      blk.style.gridRow = `${3 + h} / ${3 + e}`;
      const span = `${S.hh(h)}–${S.hh(e)}`;
      if (k === 'eng') {
        blk.style.setProperty('--c', colorOf[v] || PALETTE[0]);
        blk.append(el('b', '', v));
        if (state.focus === v) blk.classList.add('is-focus');
        blk.title = `${room.name} · ${span} · сессия со звукорежиссёром ${v}`;
      } else {
        blk.append(document.createTextNode(LABEL[k]));
        blk.title = `${room.name} · ${span} · ${LABEL[k].toLowerCase()}`;
      }
      if (e - h >= 2) blk.append(el('small', '', span));
      blk.setAttribute('aria-label', blk.title);
      if (isPast(day.date, e - 1)) blk.classList.add('past');
      frag.append(blk);
      h = e;
    }
  }

  // ---------- выбор времени ----------
  function freeRange(date, room, a, b) {
    const hours = dayBy(date)[room] || [];
    for (let i = a; i < b; i++) if (!S.isFree(hours[i]) || isPast(date, i)) return false;
    return true;
  }

  function onCellClick(btn) {
    const date = btn.dataset.date, room = btn.dataset.room, h = +btn.dataset.h;
    const sel = state.sel;
    if (sel && sel.date === date && sel.room === room) {
      if (h >= sel.start && h < sel.end) {
        if (h === sel.start) state.sel = null;
        else sel.end = h + 1;
      } else if (h >= sel.end && freeRange(date, room, sel.end, h + 1)) {
        sel.end = h + 1;
      } else if (h < sel.start && freeRange(date, room, h, sel.start)) {
        sel.start = h;
      } else {
        state.sel = { date, room, start: h, end: h + 1 };
      }
    } else {
      state.sel = { date, room, start: h, end: h + 1 };
    }
    paintSelection();
  }

  function paintSelection() {
    const sel = state.sel;
    grid.querySelectorAll('button.cell.free').forEach(b => {
      const on = sel && b.dataset.date === sel.date && b.dataset.room === sel.room && +b.dataset.h >= sel.start && +b.dataset.h < sel.end;
      b.classList.toggle('is-sel', !!on);
      b.classList.toggle('sel-start', !!on && +b.dataset.h === sel.start);
      b.classList.toggle('sel-end', !!on && +b.dataset.h === sel.end - 1);
      b.setAttribute('aria-pressed', String(!!on));
    });
    const bar = $('#bookbar');
    document.body.classList.toggle('has-sel', !!sel);
    bar.hidden = !sel;
    if (!sel) return;
    const room = roomById(sel.room);
    const n = sel.end - sel.start;
    $('#bbRoom').textContent = room.name;
    $('#bbWhen').textContent = `${S.fmtDay(sel.date, { relative: false })} · ${S.hh(sel.start)}–${S.hh(sel.end)} · ${n} ч`;
    $('#bbPrice').textContent = `${rub(n * room.rate)} без звукаря · со звукарём от ${rub(n * room.rateEng)}`;
  }

  grid.addEventListener('click', e => {
    const b = e.target.closest('button.cell.free');
    if (b && !b.disabled) onCellClick(b);
  });
  $('#bbClear').addEventListener('click', () => { state.sel = null; paintSelection(); });

  // ---------- переход в бота ----------
  const sheet = $('#sheet');

  function busyEngineers(sel) {
    const day = dayBy(sel.date);
    const busy = new Set();
    cfg.ROOMS.forEach(r => {
      for (let h = sel.start; h < sel.end; h++) {
        const v = (day[r.id] || [])[h];
        if (kind(v) === 'eng') busy.add(v);
      }
    });
    return busy;
  }

  // Что бот получит: параметр /start (латиница, цифры, _ и -, до 64 знаков) и текст для копирования
  function botPayload(sel, engineer) {
    const eng = engineer && engineer !== 'any' && engineer !== 'none' ? engineer.replace(/[^A-Za-z0-9]/g, '').slice(0, 20) : engineer || 'any';
    return ['site', sel.room, sel.date.replace(/-/g, ''), String(sel.start).padStart(2, '0'), String(sel.end % 24).padStart(2, '0'), eng || 'any'].join('_');
  }
  function engineerLabel(v) {
    return v === 'any' ? 'любой свободный' : v === 'none' ? 'без звукорежиссёра' : v;
  }
  function botMessage(sel, engineer) {
    const room = roomById(sel.room);
    return `Хочу записаться: ${room.name}, ${S.fmtDay(sel.date, { relative: false })}, ${S.hh(sel.start)}–${S.hh(sel.end)} (${sel.end - sel.start} ч). Звукорежиссёр: ${engineerLabel(engineer)}.`;
  }

  function refreshBotLink() {
    const sel = state.sel;
    const engineer = $('#fEngineer').value;
    const go = $('#botGo');
    if (cfg.BOT_USERNAME) {
      go.href = `https://t.me/${cfg.BOT_USERNAME}?start=${botPayload(sel, engineer)}`;
      go.removeAttribute('aria-disabled');
    } else {
      go.removeAttribute('href');
      go.setAttribute('aria-disabled', 'true');
      $('#botHint').textContent = 'Ник бота ещё не задан в config.js (BOT_USERNAME).';
    }
  }

  function openSheet() {
    const sel = state.sel;
    if (!sel) return;
    const room = roomById(sel.room);
    const n = sel.end - sel.start;
    const sum = $('#sheetSummary');
    sum.textContent = '';
    sum.append(
      el('b', '', `${room.name} · ${S.fmtDay(sel.date, { relative: false })}`),
      el('span', '', `${S.hh(sel.start)}–${S.hh(sel.end)}, ${n} ч · ${rub(n * room.rate)} без звукаря, со звукарём от ${rub(n * room.rateEng)}`)
    );

    const select = $('#fEngineer');
    select.innerHTML = '';
    select.append(new Option('Любой свободный', 'any'), new Option('Без звукорежиссёра — аренда', 'none'));
    const busy = busyEngineers(sel);
    (state.data.engineers || []).forEach(name => {
      const o = new Option(busy.has(name) ? `${name} — занят в это время` : name, name);
      o.disabled = busy.has(name);
      select.append(o);
    });
    if (state.focus && !busy.has(state.focus)) select.value = state.focus;

    refreshBotLink();
    sheet.showModal();
  }

  $('#bbGo').addEventListener('click', openSheet);
  $('#fEngineer').addEventListener('change', refreshBotLink);
  $('#sheetClose').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
  $('#botGo').addEventListener('click', e => {
    if (!cfg.BOT_USERNAME) { e.preventDefault(); return; }
    // сообщение копируем заранее: если бот не разберёт параметр, его останется только вставить
    if (navigator.clipboard && state.sel) navigator.clipboard.writeText(botMessage(state.sel, $('#fEngineer').value)).catch(() => {});
  });
  $('#copyMsg').addEventListener('click', async () => {
    if (!state.sel) return;
    try {
      await navigator.clipboard.writeText(botMessage(state.sel, $('#fEngineer').value));
      window.dmToast('Сообщение скопировано');
    } catch (x) {
      window.dmToast('Не удалось скопировать');
    }
  });

  // ---------- управление ----------
  document.querySelectorAll('#roomSeg button').forEach(b => b.addEventListener('click', () => {
    state.room = b.dataset.room;
    document.querySelectorAll('#roomSeg button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    render();
  }));
  $('#prev').addEventListener('click', () => { state.start -= perView(); render(); });
  $('#next').addEventListener('click', () => { state.start += perView(); render(); });

  let lastPer = 0;
  window.addEventListener('resize', () => {
    if (!state.data) return;
    const p = perView();
    if (p !== lastPer) { lastPer = p; render(); }
  });

  function setUpdated(data) {
    const t = data.updated ? new Date(data.updated).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '';
    $('#updated').textContent = (data.demo ? 'Демо-данные · ' : '') + (t ? 'обновлено в ' + t + ' МСК' : '');
  }

  async function reload(fresh) {
    try {
      const data = await S.load(fresh);
      state.data = data;
      (data.engineers || []).forEach((n, i) => { colorOf[n] = PALETTE[i % PALETTE.length]; });
      setUpdated(data);
      lastPer = perView();
      render();
    } catch (e) {
      grid.innerHTML = '';
      const msg = el('div', 'grid-state', `Не удалось загрузить расписание. Позвоните нам: ${cfg.PHONE_HUMAN}`);
      grid.append(msg);
    }
  }

  grid.append(el('div', 'grid-state skeleton', 'Загружаем расписание…'));
  reload();
  if (cfg.API_URL) setInterval(() => { if (!sheet.open) reload(true); }, 5 * 60 * 1000);
})();
