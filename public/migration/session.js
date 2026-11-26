import { showPortal } from './rooms.js?v=92';

const status = document.getElementById('status');
const login = document.getElementById('google-login');
const logout = document.getElementById('logout');
const messages = new Map([
  ['expired', 'Час на вхід минув. Спробуй ще раз.'],
  ['cancelled', 'Вхід скасовано.'],
  ['google', 'Не вдалося підтвердити акаунт Google. Спробуй ще раз.'],
  ['unavailable', 'Вхід тимчасово недоступний. Спробуй пізніше.'],
]);

async function showSession() {
  try {
    const response = await fetch('/api/migration/auth/session', { cache: 'no-store' });
    if (!response.ok) throw new Error('Session unavailable');
    const { user } = await response.json();
    const result = new URLSearchParams(location.search).get('signin');
    if (result) history.replaceState(null, '', location.pathname);
    status.textContent = messages.get(result) ??
      (user ? `Ти увійшов як ${user.display_name}.` : 'Увійди через Google, щоб відкрити головне меню.');
    document.getElementById('entryView').hidden = Boolean(user);
    login.hidden = Boolean(user);
    logout.hidden = !user;
    if (user) showPortal(user);
  } catch {
    status.textContent = 'Вхід через Google зараз недоступний.';
  }
}

showSession();

