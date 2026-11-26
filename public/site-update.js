(() => {
  const messages = {
    uk: [
      ['Я відведу тебе на Місяць, обіцяю.', 'Але спершу натисни «Оновити», щоб завантажити нову версію сайту!', 'Cyberpunk: Edgerunners'],
      ['Даттебайо!', 'Я стану Хокаге, а ти просто онови сторінку, щоб побачити свіжі зміни!', 'Наруто'],
      ['Присвятіть свої серця!', 'І свою кнопку F5 — на сайті вийшло нове оновлення!', 'Атака титанів'],
      ['Плюс Ультра!', 'Пробий межі старого кешу та онови сторінку прямо зараз!', 'Моя геройська академія'],
      ['Банкай!', 'Розрубай цю застарілу вкладку одним натисканням на «Оновити»!', 'Бліч'],
      ['Я стану богом нового світу!', 'А ти просто перезавантаж сторінку, щоб у нього потрапити.', 'Зошит смерті'],
      ['Ти не пройдеш!', 'Поки не натиснеш кнопку оновлення на цьому сайті!', 'Володар перснів'],
      ['У мене є план, Артуре!', 'Нам просто треба натиснути «Оновити» і поїхати на Таїті!', 'Red Dead Redemption 2'],
      ['Війна. Війна ніколи не змінюється.', 'А от наш сайт щойно оновився — тисни F5!', 'Fallout'],
      ['Семпай, ти що, знову не помітив?!', 'На сайті вийшло оновлення, швиденько перезавантаж сторінку, бака!', 'Хентай'],
    ],
    ru: [
      ['Проснись, самурай! Нам нужно сжечь город.', 'Но сначала нажми «Обновить», чтобы загрузить свежую версию сайта!', 'Cyberpunk 2077'],
      ['Не тормози, чумба, выходим на край!', 'На сайте вышло новое обновление — жми F5!', 'Cyberpunk: Edgerunners'],
      ['Вубба-лубба-даб-даб!', 'Сайт обновился, Морти, срочно перезагрузи страницу!', 'Рик и Морти'],
      ['Д’оу!', 'Ты всё ещё сидишь на старой версии сайта — нажми «Обновить»!', 'Симпсоны'],
      ['Это просто царапина!', 'А вот устаревший кэш — серьёзная проблема. Жми F5!', 'Монти Пайтон и Священный Грааль'],
      ['Я — скорость!', 'Будь таким же быстрым и обнови страницу прямо сейчас!', 'Тачки'],
      ['Чёрт побери, Мистер Уайт, это же наука!', 'Свежий код уже на сайте, нажми «Обновить»!', 'Во все тяжкие'],
      ['Зараза...', 'Придётся снова нажать F5, потому что вышло свежее обновление.', 'Ведьмак'],
      ['Потрачено.', 'Старая версия вкладки устарела — перезагрузи страницу!', 'GTA: San Andreas'],
      ['Я ни за что не стану твоей девушкой, извращенец!', 'Но если обновишь сайт, я, так и быть, сделаю вид, что ничего не было!', 'Хентай'],
    ],
    en: [
      ['Wake the f*ck up, Samurai! We have a city to burn.', 'Right after you hit F5 to load the latest site update!', 'Cyberpunk 2077'],
      ["You're my favorite parasite.", "Wait, no — ringworms are my favorite parasite, you're right below them. Now hit refresh!", 'Red Dead Redemption 2'],
      ['Wubba Lubba Dub-Dub!', 'The site just updated, Morty, hit F5 before reality collapses!', 'Rick and Morty'],
      ['Shut up and take my money!', "And click that refresh button to see what's new on the site!", 'Futurama'],
      ['Winter is coming.', "Don't get frozen on an outdated tab — press F5 now!", 'Game of Thrones'],
      ['Toss a coin to your Witcher!', 'Or just hit the refresh button — a brand-new update just dropped!', 'The Witcher'],
      ["You're gonna need a bigger boat.", 'And a fresh page reload to handle all these new features!', 'Jaws'],
      ['Everything is awesome!', 'Especially the new update waiting behind that refresh button!', 'The Lego Movie'],
      ['Why so serious?', 'Just press F5 and enjoy the shiny new version of the website!', 'The Dark Knight'],
      ["It's not like I updated the site for you or anything, b-baka!", 'Just click refresh already!', 'Tsundere'],
    ],
  };
  const actionLabels = {uk: 'Оновити', ru: 'Обновить', en: 'Refresh'};
  const selectedMessages = new Map();

  const notice = document.getElementById('siteUpdateNotice');
  const modal = document.getElementById('modal');
  let loadedVersion = '';
  let checking = false;
  let updateAvailable = false;

  function showNotice() {
    const currentLanguage = document.documentElement.lang;
    const language = Object.hasOwn(messages, currentLanguage) ? currentLanguage : 'uk';
    if (notice.lang !== language) {
      if (!selectedMessages.has(language)) {
        const variants = messages[language];
        selectedMessages.set(language, variants[Math.floor(Math.random() * variants.length)]);
      }
      const [quote, message, source] = selectedMessages.get(language);
      notice.querySelector('[data-update-quote]').textContent = quote;
      notice.querySelector('[data-update-message]').textContent = message;
      notice.querySelector('[data-update-source]').textContent = source;
      notice.querySelector('[data-update-action]').textContent = actionLabels[language];
      notice.lang = language;
    }

    const parent = modal.open ? modal : document.body;
    if (notice.parentElement !== parent) parent.append(notice);
    notice.hidden = false;
  }

  async function checkForUpdate() {
    if (checking || updateAvailable || document.hidden) return;
    checking = true;
    try {
      const response = await fetch('/api/site-version', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return;
      const {version} = await response.json();
      if (typeof version !== 'string' || !version) return;
      if (!loadedVersion) loadedVersion = version;
      else if (version !== loadedVersion) {
        updateAvailable = true;
        showNotice();
      }
    } catch {
      // A temporarily unavailable connection should never interrupt a session.
    } finally {
      checking = false;
    }
  }

  const noticeObserver = new MutationObserver(() => {
    if (updateAvailable) showNotice();
  });
  noticeObserver.observe(modal, {attributeFilter:['open']});
  noticeObserver.observe(document.documentElement, {attributeFilter:['lang']});

  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  window.addEventListener('pageshow', checkForUpdate);
  setInterval(checkForUpdate, 30000);
  void checkForUpdate();
})();
