import { configurePreferences } from './preferences.js?v=92';

const api = '/api/migration/rooms';
const list = document.getElementById('room-list');
const status = document.getElementById('rooms-status');
const create = document.getElementById('create-room');
const join = document.getElementById('join-room');
const portal = document.getElementById('portal');
const back = document.getElementById('back-home');
const joinStatus = document.getElementById('join-status');
let currentView = 'home';
let currentRoom;
let viewer;
let roomRequest = 0;
let chatTimer;
const viewButtons = Array.from(portal.querySelectorAll('[data-view]'));
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
  const version = ++roomRequest;
  try {
    const {members} = await request('/' + encodeURIComponent(room.id));
    if (currentView !== 'rooms' || version !== roomRequest) return;
    currentRoom = room;
    document.getElementById('gameTitle').textContent = room.title;
    document.getElementById('table-code').textContent = room.code ? 'Кімната · ' + room.code : '';
    document.getElementById('table-description').textContent = room.description;
    document.getElementById('table-roll').textContent = '';
    document.getElementById('table-keeper').replaceChildren();
    document.getElementById('table-players').replaceChildren();
    const recipient = document.getElementById('chat-recipient');
    recipient.replaceChildren();
    for (const member of members) {
      const row = document.createElement('div');
      row.className = 'person';
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = Array.from(member.display_name)[0];
      row.append(avatar, member.display_name);
      document.getElementById(member.role === 'keeper' ? 'table-keeper' : 'table-players').append(row);
      if (member.user_id !== viewer.id) recipient.add(new Option(member.display_name, member.user_id));
    }
    document.querySelector('#private-chat button').disabled = !recipient.options.length;
    for (const id of ['public-chat-log', 'private-chat-log']) {
      const log = document.getElementById(id);
      delete log.dataset.messages;
      log.replaceChildren();
    }
    selectView('tabletop');
    void refreshChat();
  } catch (error) {
    if (version === roomRequest) status.textContent = error.message;
  }
}

const chatRecipient = document.getElementById('chat-recipient');
const chatStatus = document.getElementById('chat-status');

async function refreshChat() {
  if (currentView !== 'tabletop') return;
  const room = currentRoom;
  const recipient = chatRecipient.value;
  try {
    const {messages} = await request('/' + encodeURIComponent(room.id) + '/messages');
    if (currentView !== 'tabletop' || currentRoom !== room || chatRecipient.value !== recipient) return;
    renderChat('public-chat-log', messages.filter(message => !message.recipient_id));
    renderChat('private-chat-log', messages.filter(message => message.recipient_id && (
      message.sender_id === viewer.id ? message.recipient_id === recipient : message.sender_id === recipient
    )));
    chatStatus.textContent = '';
  } catch (error) {
    if (currentView === 'tabletop' && currentRoom === room) chatStatus.textContent = error.message;
  }
}

function renderChat(id, messages) {
  const log = document.getElementById(id);
  const signature = messages.map(message => message.id).join(',');
  if (log.dataset.messages === signature) return;
  log.dataset.messages = signature;
  const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  const rows = messages.map(message => {
    const row = document.createElement('p');
    const author = document.createElement('strong');
    author.textContent = message.display_name;
    row.append(author, ' · ', message.body);
    return row;
  });
  log.replaceChildren(...rows);
  if (atEnd) log.scrollTop = log.scrollHeight;
}

chatRecipient.addEventListener('change', () => { void refreshChat(); });
for (const id of ['public-chat', 'private-chat']) {
  const form = document.getElementById(id);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const input = form.elements.text;
    const room = currentRoom;
    button.disabled = true;
    try {
      await request('/' + encodeURIComponent(room.id) + '/messages', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: input.value, recipient: id === 'private-chat' ? chatRecipient.value : null}),
      });
      if (currentRoom === room) {
        form.reset();
        void refreshChat();
      }
    } catch (error) {
      if (currentRoom === room) chatStatus.textContent = error.message;
    } finally {
      button.disabled = id === 'private-chat' && !chatRecipient.value;
    }
  });
}

document.getElementById('table-dice').addEventListener('submit', event => {
  event.preventDefault();
  const {count, sides} = event.currentTarget.elements;
  const rolls = Array.from({length: Number(count.value)}, () => Math.floor(Math.random() * Number(sides.value)) + 1);
  document.getElementById('table-roll').textContent =
    rolls.join(' + ') + ' = ' + rolls.reduce((sum, roll) => sum + roll, 0);
});

document.getElementById('leave-table').addEventListener('click', () => selectView('rooms'));
document.getElementById('create-game-shortcut').addEventListener('click', () => selectView('keeper'));

async function loadRooms(openId) {
  status.textContent = 'Завантажуємо кімнати…';
  try {
    const {rooms, canCreate, accountRole} = await request('');
    viewButtons.find(button => button.dataset.view === 'keeper').hidden = !canCreate;
    viewButtons.find(button => button.dataset.view === 'admin').hidden = accountRole !== 'admin';
    if (viewButtons.some(button => button.dataset.view === currentView && button.hidden)) selectView('home');
    document.getElementById('create-shortcut').hidden = !canCreate;
    document.getElementById('portalUser').textContent = roleName(accountRole) + ' · ' + viewer.display_name;
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
    const opened = rooms.find(room => room.id === openId);
    if (opened) await openRoom(opened);
  } catch (error) {
    status.textContent = error.message;
  }
}

for (const [form, path] of [[create, ''], [join, '/join']]) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const formStatus = form === create ? keeperStatus : joinStatus;
    formStatus.textContent = '';
    button.disabled = true;
    try {
      const {id} = await request(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      if (form === join && currentView === 'join') {
        selectView('rooms');
        await loadRooms(id);
      } else {
        await loadRooms();
        if (form === create) keeperStatus.textContent = 'Кімнату створено.';
      }
    } catch (error) {
      formStatus.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function selectView(view) {
  ++roomRequest;
  currentView = view;
  clearInterval(chatTimer);
  const playing = view === 'tabletop';
  document.body.classList.toggle('table-open', playing);
  document.getElementById('portal-top').hidden = playing;
  if (playing) chatTimer = setInterval(refreshChat, 3500);
  for (const panel of portal.querySelectorAll(':scope > section')) panel.hidden = panel.id !== view;
  back.hidden = view === 'home' || playing;
  const heading = document.getElementById(view)?.querySelector('h1, h2, #leave-table');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
  if (view === 'join') join.elements.code.focus();
}

export function showPortal(user) {
  viewer = user;
  document.getElementById('portalUser').textContent = user.display_name;
  configurePreferences(user.id);
  portal.hidden = false;
  void loadRooms();
}

back.addEventListener('click', () => selectView('home'));

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
    if (view === 'rooms' || view === 'keeper') void loadRooms();
    if (view === 'admin') void showAdmin();
  });
}

