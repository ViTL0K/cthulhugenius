const api = '/api/migration/rooms';
const section = document.getElementById('rooms');
const list = document.getElementById('room-list');
const detail = document.getElementById('room-detail');
const status = document.getElementById('rooms-status');
const create = document.getElementById('create-room');
const join = document.getElementById('join-room');
const nav = document.getElementById('dashboard-nav');
const viewButtons = Array.from(nav.querySelectorAll('[data-view]'));
const keeperList = document.getElementById('keeper-rooms');
const keeperStatus = document.getElementById('keeper-status');
const adminStatus = document.getElementById('admin-status');

async function request(path, options) {
  const response = await fetch(api + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не вдалося завантажити кімнати.');
  return data;
}

function roleName(role) {
  return {admin: 'Адміністратор', keeper: 'Ведучий'}[role] ?? 'Гравець';
}

async function openRoom(room) {
  try {
    const {members} = await request('/' + encodeURIComponent(room.id));
    const heading = document.createElement('h3');
    heading.textContent = room.title;
    const description = document.createElement('p');
    description.textContent = room.description;
    const memberList = document.createElement('ul');
    for (const member of members) {
      const row = document.createElement('li');
      row.textContent = member.display_name + ' · ' + roleName(member.role);
      memberList.append(row);
    }
    detail.replaceChildren(heading, description, memberList);
    detail.hidden = false;
  } catch (error) {
    status.textContent = error.message;
  }
}

export async function showRooms() {
  if (nav.hidden) section.hidden = false;
  status.textContent = 'Завантажуємо кімнати…';
  try {
    const {rooms, canCreate, accountRole} = await request('');
    const current = viewButtons.find(button => button.getAttribute('aria-pressed') === 'true');
    nav.hidden = !canCreate;
    viewButtons.find(button => button.dataset.view === 'keeper').hidden = !canCreate;
    viewButtons.find(button => button.dataset.view === 'admin').hidden = accountRole !== 'admin';
    if (current?.hidden) selectView('rooms');
    keeperList.replaceChildren();
    keeperStatus.textContent = '';
    list.replaceChildren();
    for (const room of rooms) {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = room.title;
      button.addEventListener('click', () => openRoom(room));
      row.append(button, ' · ' + roleName(room.role));
      list.append(row);
      if (room.role === 'keeper') {
        const managed = document.createElement('li');
        managed.textContent = room.title + ' · Код запрошення: ' + room.code;
        keeperList.append(managed);
      }
    }
    status.textContent = rooms.length ? '' : 'У тебе ще немає кімнат.';
  } catch (error) {
    status.textContent = error.message;
  }
}

for (const [form, path] of [[create, ''], [join, '/join']]) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const formStatus = form === create ? keeperStatus : status;
    button.disabled = true;
    try {
      await request(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      await showRooms();
      if (form === create) keeperStatus.textContent = 'Кімнату створено.';
    } catch (error) {
      formStatus.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function selectView(view) {
  for (const button of viewButtons) {
    const selected = button.dataset.view === view;
    button.setAttribute('aria-pressed', String(selected));
    document.getElementById(button.dataset.view).hidden = !selected;
  }
}

function showList(id, rows) {
  const list = document.getElementById(id);
  list.replaceChildren();
  for (const text of rows.length ? rows : ['Поки порожньо.']) {
    const row = document.createElement('li');
    row.textContent = text;
    list.append(row);
  }
}

async function showAdmin() {
  adminStatus.textContent = 'Завантажуємо…';
  try {
    const {rooms, accounts} = await request('/admin');
    showList('admin-rooms', rooms.map(room =>
      room.title + ' · ' + room.keeper_name + ' · Учасників: ' + room.member_count));
    showList('admin-accounts', accounts.map(account =>
      account.display_name + ' · ' + roleName(account.role)));
    adminStatus.textContent = '';
  } catch (error) {
    adminStatus.textContent = error.message;
  }
}

for (const button of viewButtons) {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    selectView(view);
    if (view === 'admin') void showAdmin();
  });
}
