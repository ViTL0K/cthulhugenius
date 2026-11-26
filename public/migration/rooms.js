const api = '/api/migration/rooms';
const section = document.getElementById('rooms');
const list = document.getElementById('room-list');
const detail = document.getElementById('room-detail');
const status = document.getElementById('rooms-status');
const create = document.getElementById('create-room');
const join = document.getElementById('join-room');

async function request(path, options) {
  const response = await fetch(api + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не вдалося завантажити кімнати.');
  return data;
}

function roleName(role) {
  return role === 'keeper' ? 'Ведучий' : 'Гравець';
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
  section.hidden = false;
  status.textContent = 'Завантажуємо кімнати…';
  try {
    const {rooms, canCreate} = await request('');
    list.replaceChildren();
    for (const room of rooms) {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = room.title;
      button.addEventListener('click', () => openRoom(room));
      row.append(button, ' · ' + roleName(room.role));
      if (room.code) row.append(' · Код: ' + room.code);
      list.append(row);
    }
    create.hidden = !canCreate;
    status.textContent = rooms.length ? '' : 'У тебе ще немає кімнат.';
  } catch (error) {
    status.textContent = error.message;
  }
}

for (const [form, path] of [[create, ''], [join, '/join']]) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await request(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      await showRooms();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
