import { sessionUser } from './google-auth.mjs';

const route = '/api/migration/rooms';

function json(data, status = 200) {
  return Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
}

async function listRooms(db, user) {
  const {results} = await db.prepare(
    'SELECT g.id, g.title, g.description, m.role, ' +
    "CASE WHEN m.role = 'keeper' THEN g.room_code END AS code " +
    'FROM game_members m JOIN games g ON g.id = m.game_id WHERE m.user_id = ? ' +
    'ORDER BY g.created_at DESC, g.id'
  ).bind(user.id).all();
  const role = await db.prepare('SELECT role FROM account_roles WHERE user_id = ?').bind(user.id).first();
  return json({rooms: results, canCreate: ['admin', 'keeper'].includes(role?.role)});
}

async function createRoom(db, user, data) {
  const title = typeof data?.title === 'string' ? data.title.trim() : '';
  const description = typeof data?.description === 'string' ? data.description.trim() : '';
  if (!title || title.length > 100 || description.length > 1000) {
    return json({error: 'Введи назву до 100 символів і опис до 1000 символів.'}, 400);
  }
  const id = crypto.randomUUID();
  const code = Array.from(crypto.getRandomValues(new Uint8Array(10)),
    value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  const result = await db.batch([
    db.prepare(
      'INSERT INTO games (id, title, description, room_code, keeper_id) ' +
      "SELECT ?, ?, ?, ?, user_id FROM account_roles WHERE user_id = ? AND role IN ('admin', 'keeper')"
    ).bind(id, title, description, code, user.id),
    db.prepare(
      'INSERT INTO game_members (game_id, user_id, display_name, role) ' +
      "SELECT id, keeper_id, ?, 'keeper' FROM games WHERE id = ? AND keeper_id = ?"
    ).bind(memberName(user), id, user.id),
  ]);
  if (!result[0].meta.changes) return json({error: 'Створювати кімнати можуть ведучі й адміністратори.'}, 403);
  return json({id}, 201);
}

function memberName(user) {
  return Array.from(user.display_name.trim()).slice(0, 24).join('') || 'Гравець';
}

async function joinRoom(db, user, data) {
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  if (!/^[A-F0-9]{20}$/.test(code)) return json({error: 'Введи код запрошення з 20 символів.'}, 400);
  const game = await db.prepare('SELECT id FROM games WHERE room_code = ?').bind(code).first();
  if (!game) return json({error: 'Кімнату за цим кодом не знайдено.'}, 404);
  await db.prepare(
    'INSERT INTO game_members (game_id, user_id, display_name, role) ' +
    "SELECT id, ?, ?, 'player' FROM games WHERE id = ? ON CONFLICT (game_id, user_id) DO NOTHING"
  ).bind(user.id, memberName(user), game.id).run();
  return json({id: game.id});
}

async function roomMembers(db, user, id) {
  const {results} = await db.prepare(
    'SELECT m.display_name, m.role FROM game_members own ' +
    'JOIN game_members m ON m.game_id = own.game_id WHERE own.game_id = ? AND own.user_id = ? ' +
    'ORDER BY m.joined_at, m.user_id'
  ).bind(id, user.id).all();
  return results.length ? json({members: results}) : json({error: 'Кімнату не знайдено.'}, 404);
}

export async function handleRooms(request, db, url) {
  try {
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) {
      return json({error: 'Запит відхилено.'}, 403);
    }
    const user = await sessionUser(request, db);
    if (!user) return json({error: 'Спочатку увійди через Google.'}, 401);
    if (request.method === 'GET') {
      if (url.pathname === route) return await listRooms(db, user);
      const id = url.pathname.slice(route.length + 1);
      if (/^[a-f0-9-]{36}$/.test(id)) return await roomMembers(db, user, id);
    }
    if (request.method === 'POST' && [route, route + '/join'].includes(url.pathname)) {
      const data = await request.json().catch(() => null);
      return url.pathname === route ? await createRoom(db, user, data) : await joinRoom(db, user, data);
    }
    return json({error: 'Сторінку не знайдено.'}, 404);
  } catch {
    return json({error: 'Не вдалося виконати запит до кімнат. Спробуй ще раз.'}, 503);
  }
}
