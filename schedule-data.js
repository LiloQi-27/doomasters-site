// Загрузка обезличенного расписания: только студия, час и ник звукаря.
// Значение часа: null — свободно, "<ник>" — сессия со звукарём,
// "@rent" — аренда без звукаря, "@closed" — закрыто, "@busy" — занято.
(function () {
  const cfg = window.DM_CONFIG;

  // Текущие дата и час по Москве, независимо от часового пояса посетителя
  function mskNow() {
    const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Moscow', hour12: false });
    const [date, time] = s.split(' ');
    const [hour, minute] = time.split(':').map(Number);
    return { date, hour, minute };
  }

  function addDays(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Демо-данные переезжают на сегодняшнюю дату, чтобы превью не устаревало
  function shiftToToday(data) {
    const today = mskNow().date;
    if (!data.days.length || data.days[0].date >= today) return data;
    data.days = data.days.map((d, i) => ({ ...d, date: addDays(today, i) }));
    return data;
  }

  let cache = null;
  async function load(fresh) {
    if (cache && !fresh) return cache;
    cache = (async () => {
      if (cfg.API_URL) {
        const res = await fetch(cfg.API_URL + '?days=' + cfg.DAYS, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'API error');
        return { ...data, demo: false };
      }
      const res = await fetch(cfg.SAMPLE_URL, { cache: 'no-store' });
      const data = await res.json();
      return { ...shiftToToday(data), demo: true };
    })();
    cache.catch(() => { cache = null; });
    return cache;
  }

  function isFree(v) { return v === null || v === undefined; }

  // Ближайшее свободное окно (минимум minHours подряд) начиная с текущего часа
  function nextFree(data, roomId, minHours = 2) {
    const now = mskNow();
    for (const day of data.days) {
      if (day.missing || day.date < now.date) continue;
      const hours = day[roomId] || [];
      const from = day.date === now.date ? now.hour + 1 : 0;
      for (let h = from; h < 24; h++) {
        let len = 0;
        while (h + len < 24 && isFree(hours[h + len])) len++;
        if (len >= minHours) return { date: day.date, start: h, end: h + len };
        h += len;
      }
    }
    return null;
  }

  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function fmtDay(iso, opts = {}) {
    const d = new Date(iso + 'T12:00:00Z');
    const today = mskNow().date;
    if (opts.relative !== false) {
      if (iso === today) return 'сегодня';
      if (iso === addDays(today, 1)) return 'завтра';
    }
    return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  }
  const hh = h => String(h % 24).padStart(2, '0') + ':00';

  window.DMSchedule = { load, mskNow, addDays, nextFree, isFree, fmtDay, hh, WD, MON };
})();
