import { accountRole } from './site-account.mjs';
import { sessionUser } from './google-auth.mjs';

const route = '/api/migration/rooms';

function json(data, status = 200) {
  return Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
}

async function listRooms(db, user, env) {
  const {results} = await db.prepare(
    'SELECT g.id, g.title, g.description, m.role, ' +
    "g.room_code AS code " +
    'FROM game_members m JOIN games g ON g.id = m.game_id WHERE m.user_id = ? ' +
    'ORDER BY g.created_at DESC, g.id'
  ).bind(user.id).all();
  const role = await accountRole(db,user.id,env);
  return json({rooms: results, accountRole:role, canCreate:role !== 'player'});
}

async function createRoom(db, user, data) {
  const title = typeof data?.title === 'string' ? data.title.trim() : '';
  const description = typeof data?.description === 'string' ? data.description.trim() : '';
  if (!title || title.length > 100 || description.length > 1000) {
    return json({error: 'Введи назву до 100 символів і опис до 1000 символів.'}, 400);
  }
  const id = crypto.randomUUID();
  for(let attempt=0;attempt<8;attempt++){
  const code = 'CTH-'+Array.from(crypto.getRandomValues(new Uint8Array(2)),
    value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  let result;
  try{result = await db.batch([
    db.prepare(
      'INSERT INTO games (id, title, description, room_code, keeper_id) ' +
      "SELECT ?, ?, ?, ?, user_id FROM account_roles WHERE user_id = ? AND role IN ('admin', 'keeper')"
    ).bind(id, title, description, code, user.id),
    db.prepare(
      'INSERT INTO game_members (game_id, user_id, display_name, role) ' +
      "SELECT id, keeper_id, ?, 'keeper' FROM games WHERE id = ? AND keeper_id = ?"
    ).bind(memberName(user), id, user.id),
  ]);}catch(error){if(/unique.*(?:room_code|games)/i.test(error.message))continue;throw error;}
  if (!result[0].meta.changes) return json({error: 'Створювати кімнати можуть ведучі й адміністратори.'}, 403);
  return json({id}, 201);
  }
  return json({error:'Не вдалося створити унікальний код. Спробуй ще раз.'},503);
}

function memberName(user) {
  return Array.from(user.display_name.trim()).slice(0, 24).join('') || 'Гравець';
}

async function joinRoom(db, user, data) {
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  if (!/^(?:CTH-[A-F0-9]{4}|[A-F0-9]{20})$/.test(code)) return json({error:'Введи код кімнати, наприклад CTH-A8DA.'},400);
  await ensureRoomSchema(db);
  const windowStart=Math.floor(Date.now()/60000);
  const attempts=await db.prepare('INSERT INTO migration_join_attempts(user_id,window_start,attempts) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts').bind(user.id,windowStart).first();
  if(attempts.attempts>10)return json({error:'Забагато спроб. Спробуй приєднатися через хвилину.'},429);
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
    'SELECT m.user_id, m.display_name, m.role FROM game_members own ' +
    'JOIN game_members m ON m.game_id = own.game_id WHERE own.game_id = ? AND own.user_id = ? ' +
    'ORDER BY m.joined_at, m.user_id'
  ).bind(id, user.id).all();
  return results.length ? json({members: results}) : json({error: 'Кімнату не знайдено.'}, 404);
}

const createMessages = `CREATE TABLE IF NOT EXISTS migration_room_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT,
  body TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
)`;

const roomSchemas = new WeakMap();

function ensureRoomSchema(db) {
  if (!roomSchemas.has(db)) {
    const initialization = (async () => {
      await db.prepare('CREATE TABLE IF NOT EXISTS migration_join_attempts(user_id TEXT PRIMARY KEY NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL)').run();
      await db.prepare(createMessages).run();
      await db.prepare(
        'CREATE INDEX IF NOT EXISTS migration_room_messages_game ON migration_room_messages(game_id, id)'
      ).run();
      await db.prepare(
        'CREATE TABLE IF NOT EXISTS migration_room_boards (' +
        'game_id TEXT PRIMARY KEY NOT NULL REFERENCES games(id) ON DELETE CASCADE, ' +
        'map TEXT NOT NULL, updated_at TEXT NOT NULL)'
      ).run();
    })().catch(error => {
      roomSchemas.delete(db);
      throw error;
    });
    roomSchemas.set(db, initialization);
  }
  return roomSchemas.get(db);
}

async function roomMessages(request, db, user, gameId) {
  const membership = await db.prepare(
    'SELECT 1 AS allowed FROM game_members WHERE game_id = ? AND user_id = ?'
  ).bind(gameId, user.id).first();
  if (!membership) return json({error: 'Кімнату не знайдено.'}, 404);

  await ensureRoomSchema(db);

  if (request.method === 'GET') {
    const {results} = await db.prepare(
      'SELECT msg.id, msg.sender_id, msg.recipient_id, msg.body, m.display_name ' +
      'FROM migration_room_messages msg JOIN game_members m ' +
      'ON m.game_id = msg.game_id AND m.user_id = msg.sender_id ' +
      'WHERE msg.game_id = ? AND (msg.recipient_id IS NULL OR msg.recipient_id = ? OR msg.sender_id = ?) ' +
      'ORDER BY msg.id DESC LIMIT 100'
    ).bind(gameId, user.id, user.id).all();
    return json({messages: results.reverse()});
  }

  const data = await request.json().catch(() => null);
  const body = typeof data?.text === 'string' ? data.text.trim() : '';
  const recipient = data?.recipient ?? null;
  if (!body || body.length > 2000 || (recipient !== null && typeof recipient !== 'string')) {
    return json({error: 'Введи повідомлення до 2000 символів.'}, 400);
  }
  const result = await db.prepare(
    'INSERT INTO migration_room_messages (game_id, sender_id, recipient_id, body) ' +
    'SELECT game_id, user_id, ?, ? FROM game_members own WHERE game_id = ? AND user_id = ? ' +
    'AND (? IS NULL OR EXISTS (SELECT 1 FROM game_members target ' +
    'WHERE target.game_id = own.game_id AND target.user_id = ? AND target.user_id <> own.user_id))'
  ).bind(recipient, body, gameId, user.id, recipient, recipient).run();
  return result.meta.changes ? json({sent: true}, 201) : json({error: 'Одержувача не знайдено.'}, 404);
}

async function roomBoard(request, db, user, gameId) {
  const member = await db.prepare('SELECT role FROM game_members WHERE game_id = ? AND user_id = ?')
    .bind(gameId, user.id).first();
  if (!member) return json({error: 'Кімнату не знайдено.'}, 404);
  if (request.method === 'POST' && member.role !== 'keeper') {
    return json({error: 'Карту може додати ведучий кімнати.'}, 403);
  }
  await ensureRoomSchema(db);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT updated_at FROM migration_room_boards WHERE game_id = ?')
      .bind(gameId).first();
    if (!row) return json({map: null});
    const known = new URL(request.url).searchParams.get('known');
    if (known === row.updated_at) return json({updated: row.updated_at});
    const map = await db.prepare('SELECT map, updated_at FROM migration_room_boards WHERE game_id = ?')
      .bind(gameId).first();
    return json({map: map?.map ?? null, updated: map?.updated_at});
  }

  const data = await request.json().catch(() => null);
  const map = data?.map;
  if (typeof map !== 'string' || map.length > 800000 || !/^UklGR[A-Za-z0-9+/]+={0,2}$/.test(map)) {
    return json({error: 'Не вдалося підготувати зображення карти.'}, 400);
  }
  const updated = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO migration_room_boards (game_id, map, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(game_id) DO UPDATE SET map = excluded.map, updated_at = excluded.updated_at'
  ).bind(gameId, map, updated).run();
  return json({map, updated});
}

async function adminOverview(db, user, env) {
  if(await accountRole(db,user.id,env)!=='admin')return json({error:'Цей розділ доступний адміністратору сайту.'},403);

  const [rooms, accounts] = await db.batch([
    db.prepare(
      'SELECT g.title, g.created_at, u.display_name AS keeper_name, ' +
      '(SELECT COUNT(*) FROM game_members m WHERE m.game_id = g.id) AS member_count ' +
      'FROM games g JOIN site_users u ON u.id = g.keeper_id ORDER BY g.created_at DESC LIMIT 100'
    ),
    db.prepare(
      "SELECT u.id, u.display_name, COALESCE(r.role, 'player') AS role " +
      'FROM site_users u LEFT JOIN account_roles r ON r.user_id = u.id ' +
      'ORDER BY u.created_at DESC LIMIT 100'
    ),
  ]);
  return json({rooms:rooms.results,accounts:accounts.results.map(u=>({...u,role:u.id===user.id?'admin':u.role==='admin'?'keeper':u.role}))});
}

export async function handleRooms(request, db, url, env={}) {
  try {
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) {
      return json({error: 'Запит відхилено.'}, 403);
    }
    const user = await sessionUser(request, db);
    if (!user) return json({error: 'Спочатку увійди через Google.'}, 401);
    await accountRole(db,user.id,env);
    const messageRoom = /^([a-f0-9-]{36})\/messages$/.exec(url.pathname.slice(route.length + 1));
    if (messageRoom && (request.method === 'GET' || request.method === 'POST')) {
      return await roomMessages(request, db, user, messageRoom[1]);
    }
    const boardRoom = /^([a-f0-9-]{36})\/board$/.exec(url.pathname.slice(route.length + 1));
    if (boardRoom && (request.method === 'GET' || request.method === 'POST')) {
      return await roomBoard(request, db, user, boardRoom[1]);
    }
    if (request.method === 'GET') {
      if (url.pathname === route) return await listRooms(db, user, env);
      if (url.pathname === route + '/admin') return await adminOverview(db, user, env);
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

