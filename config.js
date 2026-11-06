// Настройки сайта.
// API_URL — адрес веб-приложения Apps Script (apps-script/Code.gs). Пока он пустой,
// расписание показывает демо-данные из schedule-sample.json.
// BOT_USERNAME — ник существующего Telegram-бота для брони, без @ (например 'doomasters_bot').
// Бронь идёт через него: сайт передаёт выбранные студию и время в параметре /start.
window.DM_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycby27O_Cm8lKAY5BTfBieuxNGJhKUcLVrtmY9TvOqLPZGsOpLuYE-2T-xmrX18afqD_2SQ/exec',
  BOT_USERNAME: 'doo_masters_bot',
  SAMPLE_URL: 'schedule-sample.json',
  DAYS: 14,
  PHONE: '+79808747366',
  PHONE_HUMAN: '+7 980 874-73-66',
  ROOMS: [
    { id: 'big', name: 'Big Stu', rate: 2000, rateEng: 4000 },
    { id: 'small', name: 'Small Stu', rate: 1500, rateEng: 3500 },
  ],
};
