// Общее поведение страниц: меню, появление блоков, копирование номера, мобильная панель,
// и виджет «ближайшее свободное» на главной.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Мобильное меню
  const nav = $('#nav');
  const burger = $('.nav-burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open);
    });
    $$('.nav-links a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', false);
    }));
  }

  // Подсветка текущего раздела в меню
  const links = $$('.nav-links a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.remove('is-active'));
        const a = byId.get(e.target.id);
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Вордмарк DOOMASTERS во всю ширину контейнера
  const wordmark = $('#wordmark');
  if (wordmark) {
    const fit = () => {
      wordmark.style.fontSize = '';
      const box = wordmark.parentElement.clientWidth - parseFloat(getComputedStyle(wordmark.parentElement).paddingLeft) * 2;
      const size = parseFloat(getComputedStyle(wordmark).fontSize);
      wordmark.style.fontSize = Math.floor(size * box / wordmark.scrollWidth * 0.995) + 'px';
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);
    window.addEventListener('resize', fit);
  }

  // Появление блоков при скролле
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  // Уведомление
  const toast = $('#toast');
  let toastTimer;
  window.dmToast = msg => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2400);
  };

  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      window.dmToast('Номер скопирован');
    } catch (e) {
      window.dmToast(btn.dataset.copy);
    }
  }));

  // Мобильная панель записи появляется после первого экрана
  const mbar = $('#mbar');
  if (mbar) {
    const onScroll = () => mbar.classList.toggle('is-on', window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Ссылки на Telegram-бота (ник задаётся в config.js)
  $$('[data-bot]').forEach(a => {
    const bot = window.DM_CONFIG && window.DM_CONFIG.BOT_USERNAME;
    if (bot) a.href = 'https://t.me/' + bot; else a.hidden = true;
  });

  // Виджет «ближайшее свободное» на главной
  const liveRows = $('#liveRows');
  if (liveRows && window.DMSchedule) {
    const S = window.DMSchedule;
    S.load().then(data => {
      liveRows.innerHTML = '';
      window.DM_CONFIG.ROOMS.forEach(room => {
        const slot = S.nextFree(data, room.id, 2);
        const li = document.createElement('li');
        let text = 'всё занято на 2 недели';
        if (slot) {
          const span = slot.start === 0 && slot.end === 24 ? 'весь день'
            : slot.end === 24 ? `с ${S.hh(slot.start)}`
            : `${S.hh(slot.start)}–${S.hh(slot.end)}`;
          text = `${S.fmtDay(slot.date)}, ${span}`;
        }
        li.innerHTML = `<b>${room.name}</b><span>${text}</span>`;
        liveRows.appendChild(li);
      });
      if (data.demo) {
        const note = document.createElement('li');
        note.innerHTML = '<span class="mono" style="color:var(--faint)">демо-данные</span>';
        liveRows.appendChild(note);
      }
    }).catch(() => {
      $('#live').hidden = true;
    });
  }
})();
