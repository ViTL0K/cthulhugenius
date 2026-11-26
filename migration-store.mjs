import { sessionUser } from './google-auth.mjs';
import { handleRooms } from './rooms.mjs';
import { initialCards } from './rule-seed.mjs';

const schemas = new WeakMap();
const tables = new Set(['homepage_quotes','hidden_materials','private_notes','investigator_sheets','game_character_sheets','dice_rolls','room_messages','keeper_access_requests','game_events','covers','boards','files','broadcasts','presence','rules']);
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const now = () => new Date().toISOString();
async function ensure(db) {
  if(!schemas.has(db)) schemas.set(db,(async()=>{
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS migration_records (seq INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT NOT NULL, game_id TEXT, owner_id TEXT, data TEXT NOT NULL, UNIQUE(table_name,record_id))`),
      db.prepare('CREATE INDEX IF NOT EXISTS migration_records_game ON migration_records(table_name,game_id)'),
      db.prepare('CREATE TABLE IF NOT EXISTS migration_file_chunks (path TEXT NOT NULL, part INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(path,part))')
    ]);
  })().catch(e=>{schemas.delete(db);throw e}));
  return schemas.get(db);
}
export async function context(request,env) {
  const user=await sessionUser(request,env.DB);if(!user)fail('Спочатку увійди через Google.',401);
  await ensure(env.DB);
  const role=await env.DB.prepare('SELECT role FROM account_roles WHERE user_id=?').bind(user.id).first();
  const {results:members}=await env.DB.prepare('SELECT * FROM game_members WHERE user_id=?').bind(user.id).all();
  return {db:env.DB,user,role:role?.role||'player',members};
}
const member=(ctx,game) => ctx.members.find(m=>m.game_id===game);
function access(ctx,game,keeper=false) {const m=member(ctx,game);if(!m||keeper&&m.role!=='keeper')fail('Кімната недоступна.',403);return m;}
const admin=ctx=>{if(ctx.role!=='admin')fail('Потрібні права адміністратора.',403)};
async function raw(ctx,table,game) {
  const q=game===undefined?'SELECT seq,data FROM migration_records WHERE table_name=? ORDER BY seq':'SELECT seq,data FROM migration_records WHERE table_name=? AND game_id=? ORDER BY seq';
  const {results}=await ctx.db.prepare(q).bind(...(game===undefined?[table]:[table,game])).all();
  return results.map(r=>({...JSON.parse(r.data),seq:r.seq}));
}
async function put(ctx,table,row,id=row.id||crypto.randomUUID()) {
  const data={...row,id};delete data.seq;
  await ctx.db.prepare('INSERT INTO migration_records(table_name,record_id,game_id,owner_id,data) VALUES(?,?,?,?,?) ON CONFLICT(table_name,record_id) DO UPDATE SET game_id=excluded.game_id,owner_id=excluded.owner_id,data=excluded.data')
    .bind(table,id,data.game_id||null,data.user_id||data.created_by||null,JSON.stringify(data)).run();
  return data;
}
async function remove(ctx,table,id){await ctx.db.prepare('DELETE FROM migration_records WHERE table_name=? AND record_id=?').bind(table,id).run();}
async function event(ctx,game,event_type){await put(ctx,'game_events',{game_id:game,event_type,created_at:now()});}
function visible(ctx,table,row){
  const m=member(ctx,row.game_id);
  if(['homepage_quotes'].includes(table))return true;
  if(table==='keeper_access_requests')return ctx.role==='admin'||row.user_id===ctx.user.id;
  if(!m)return false;
  if(table==='private_notes')return m.role==='keeper'&&row.user_id===ctx.user.id;
  if(table==='investigator_sheets')return m.role==='keeper'||row.user_id===ctx.user.id;
  if(table==='game_character_sheets')return m.role==='keeper'||row.assigned_user_id===ctx.user.id;
  if(table==='hidden_materials')return m.role==='keeper'||Boolean(row.revealed_at&&(row.audience==='all'||row.target_user_id===ctx.user.id));
  if(table==='room_messages'||table==='dice_rolls')return row.visibility==='all'||row.sender_id===ctx.user.id||row.actor_id===ctx.user.id||row.recipient_id===ctx.user.id;
  if(table==='broadcasts')return Date.parse(row.created_at)>Date.now()-45000;
  if(table==='presence')return Date.parse(row.created_at)>Date.now()-70000;
  return true;
}
function matches(row,filters=[]) {return filters.every(([op,key,value])=>{
  if(op==='eq')return row[key]===value;if(op==='neq')return row[key]!==value;if(op==='in')return Array.isArray(value)&&value.includes(row[key]);
  if(op==='gt')return row[key]>value;if(op==='gte')return row[key]>=value;if(op==='lt')return row[key]<value;
  if(op==='is')return value===null?row[key]==null:row[key]===value;
  if(op==='not')return value===null?row[key]!=null:row[key]!==value;
  fail('Непідтримуваний фільтр.');
});}
async function rows(ctx,table) {
  if(table==='account_roles'){admin(ctx);return (await ctx.db.prepare('SELECT * FROM account_roles').all()).results;}
  if(table==='games'){
    const {results}=await ctx.db.prepare('SELECT g.* FROM games g JOIN game_members m ON m.game_id=g.id WHERE m.user_id=?').bind(ctx.user.id).all();
    const covers=await raw(ctx,'covers');return results.map(g=>({...g,cover_data:covers.find(c=>c.game_id===g.id)?.cover_data||''}));
  }
  if(table==='game_members')return (await ctx.db.prepare('SELECT m.* FROM game_members m JOIN game_members own ON own.game_id=m.game_id WHERE own.user_id=?').bind(ctx.user.id).all()).results;
  if(!tables.has(table)||['boards','covers','files','rules'].includes(table))fail('Невідомий розділ.',404);
  const data=(await raw(ctx,table)).filter(r=>visible(ctx,table,r));
  if(table==='room_messages'){
    // The existing table is retained: old public and direct chat remains readable.
    const found=await ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_room_messages'").first();
    if(found){const {results}=await ctx.db.prepare('SELECT msg.* FROM migration_room_messages msg JOIN game_members own ON own.game_id=msg.game_id WHERE own.user_id=? AND (msg.recipient_id IS NULL OR msg.recipient_id=? OR msg.sender_id=?)').bind(ctx.user.id,ctx.user.id,ctx.user.id).all();
      data.unshift(...results.map(r=>({...r,id:'legacy:'+r.id,seq:-r.id,visibility:r.recipient_id?'private':'all',created_at:'2026-11-01T00:00:00.000Z'})));}
  }
  return data;
}
function canWrite(ctx,table,row,op){
  if(table==='homepage_quotes'){if(!['admin','keeper'].includes(ctx.role))fail('Потрібні права ведучого.',403);return;}
  if(table==='keeper_access_requests'){if(ctx.role==='admin')return;if(op!=='insert'||row.user_id!==ctx.user.id)fail('Запит недоступний.',403);return;}
  const m=access(ctx,row.game_id);
  if(table==='private_notes'){if(m.role!=='keeper'||row.user_id!==ctx.user.id)fail('Нотатка недоступна.',403);return;}
  if(table==='investigator_sheets'){if(m.role!=='keeper'&&row.user_id!==ctx.user.id)fail('Лист недоступний.',403);return;}
  if(table==='game_character_sheets'){if(m.role==='keeper')return;if(op!=='update'||row.assigned_user_id!==ctx.user.id)fail('Лист недоступний.',403);return;}
  if(table==='room_messages'||table==='dice_rolls'){if(op!=='insert')fail('Дія недоступна.',403);return;}
  if(table==='hidden_materials'){access(ctx,row.game_id,true);return;}
  fail('Дія недоступна.',403);
}
async function query(ctx,q){
  const {table,op='select',filters=[],order=[],offset=0,limit=1000}=q;
  if(!Array.isArray(filters)||filters.length>20)fail('Некоректний запит.');
  if(op==='select'){
    let data=(await rows(ctx,table)).filter(r=>matches(r,filters));
    for(const [key,asc] of [...order].reverse())data.sort((a,b)=>a[key]===b[key]?0:(a[key]>b[key]?1:-1)*(asc?1:-1));
    data=data.slice(Math.max(0,offset),Math.max(0,offset)+Math.min(1000,Math.max(0,limit)));
    return data;
  }
  if(table==='account_roles'){
    admin(ctx);if(op!=='upsert'||!['keeper','admin'].includes(q.values?.role))fail('Некоректна роль.');
    await ctx.db.prepare('INSERT INTO account_roles(user_id,role,assigned_by) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,assigned_by=excluded.assigned_by').bind(q.values.user_id,q.values.role,ctx.user.id).run();return [q.values];
  }
  if(!tables.has(table))fail('Невідомий розділ.',404);
  const incoming=Array.isArray(q.values)?q.values:[q.values];
  if(incoming.length>100)fail('Забагато записів.');
  if(op==='insert'||op==='upsert'){
    const result=[];
    for(let row of incoming){
      if(!row||typeof row!=='object'||Array.isArray(row))fail('Некоректні дані.');
      row={...row,created_at:row.created_at||now()};
      if(['room_messages','dice_rolls'].includes(table)){
        row=await validateMessage(ctx,table,row);
      }
      canWrite(ctx,table,row,'insert');
      let id=row.id;
      if(table==='investigator_sheets')id=row.game_id+':'+row.user_id;
      if(table==='keeper_access_requests')id=row.user_id;
      const existing=id?(await raw(ctx,table)).find(r=>r.id===id):null;
      if(existing){if(op!=='upsert')fail('Запис уже існує.',409);canWrite(ctx,table,existing,'update');row={...existing,...row};}
      result.push(await put(ctx,table,row,id));
      if(row.game_id)await event(ctx,row.game_id,table==='hidden_materials'?'materials-updated':'record-updated');
    }return result;
  }
  if(!['update','delete'].includes(op)||!filters.length)fail('Вкажи запис для зміни.');
  const selected=(await rows(ctx,table)).filter(r=>matches(r,filters));const result=[];
  for(const row of selected){
    canWrite(ctx,table,row,op);
    if(op==='delete'){await remove(ctx,table,row.id);result.push(row);}
    else{
      const patch={...q.values};
      for(const key of ['id','game_id','user_id','created_by','actor_id','sender_id'])if(key in patch&&patch[key]!==row[key])fail('Не можна змінити власника запису.',403);
      if(table==='game_character_sheets'&&member(ctx,row.game_id).role!=='keeper')for(const key of Object.keys(patch))if(!['sheet','updated_at'].includes(key))fail('Можна редагувати лише власний лист.',403);
      result.push(await put(ctx,table,{...row,...patch},row.id));
    }
    if(row.game_id)await event(ctx,row.game_id,table==='hidden_materials'?'materials-updated':'record-updated');
  }return result;
}
async function validateMessage(ctx,table,row){
  const m=access(ctx,row.game_id);
  const visibility=row.visibility||'all';if(!['all','keeper','self','private'].includes(visibility))fail('Некоректна видимість.');
  let recipient=row.recipient_id||null;
  if(visibility==='keeper')recipient=(await ctx.db.prepare("SELECT user_id FROM game_members WHERE game_id=? AND role='keeper'").bind(row.game_id).first())?.user_id;
  if(visibility==='self')recipient=ctx.user.id;
  if(visibility==='all')recipient=null;
  if(recipient&&!await ctx.db.prepare('SELECT 1 FROM game_members WHERE game_id=? AND user_id=?').bind(row.game_id,recipient).first())fail('Одержувача не знайдено.');
  if(table==='room_messages'&&(!String(row.body||'').trim()||String(row.body).length>2000))fail('Повідомлення має містити до 2000 символів.');
  if(table==='dice_rolls'&&(!row.roll||JSON.stringify(row.roll).length>8000))fail('Некоректний кидок.');
  return {...row,visibility,recipient_id:recipient,[table==='dice_rolls'?'actor_id':'sender_id']:ctx.user.id};
}
async function roomCall(ctx,request,env,path,data){
  const response=await handleRooms(new Request(new URL('/api/migration/rooms'+path,request.url),{method:data?'POST':'GET',headers:{Cookie:request.headers.get('Cookie')||'',Origin:new URL(request.url).origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env.DB,new URL('/api/migration/rooms'+path,request.url));
  const result=await response.json();if(!response.ok)fail(result.error,response.status);return result;
}
async function rpc(ctx,name,a,request,env){
  if(name==='my_account_role')return ctx.role;
  if(name==='list_my_games'){const r=await roomCall(ctx,request,env,'');return r.rooms.map(g=>({...g,room_code:g.code}));}
  if(name==='create_game')return roomCall(ctx,request,env,'',{title:a.game_title,description:a.game_description});
  if(name==='join_game')return roomCall(ctx,request,env,'/join',{code:a.code_to_join});
  if(name==='assign_game_character_sheet'){
    const sheet=(await raw(ctx,'game_character_sheets')).find(r=>r.id===a.target_sheet);if(!sheet)fail('Лист не знайдено.',404);access(ctx,sheet.game_id,true);
    if(a.target_user&&!await ctx.db.prepare("SELECT 1 FROM game_members WHERE game_id=? AND user_id=? AND role='player'").bind(sheet.game_id,a.target_user).first())fail('Гравця не знайдено.');
    if(a.target_user){const assigned=(await raw(ctx,'game_character_sheets',sheet.game_id)).filter(r=>r.assigned_user_id===a.target_user);for(const r of assigned)await put(ctx,'game_character_sheets',{...r,assigned_user_id:null});}
    await put(ctx,'game_character_sheets',{...sheet,assigned_user_id:a.target_user||null});await event(ctx,sheet.game_id,'character-sheet-assigned');return null;
  }
  const game=a.target_game;const m=access(ctx,game);
  if(name==='get_room_state'){
    const stored=(await raw(ctx,'boards',game))[0];let scenes=stored?.scenes;
    if(!scenes){const found=await ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_room_boards'").first();
      const old=found?await ctx.db.prepare('SELECT map FROM migration_room_boards WHERE game_id=?').bind(game).first():null;
      scenes=[{name:'Дошка',cards:old?.map?[{id:'existing-map',title:'Карта пригоди',type:'image/webp',url:'data:image/webp;base64,'+old.map,x:10,y:10,w:700,h:500,zoom:1,rotation:0,targets:['all']}]:[]}];
    }
    if(m.role==='keeper')return scenes;
    const revealed=(await raw(ctx,'hidden_materials',game)).filter(r=>visible(ctx,'hidden_materials',r));
    return scenes.map(s=>({...s,cards:(s.cards||[]).filter(c=>(!c.sourceClueId||revealed.some(r=>r.id===c.sourceClueId))&&(!c.targets||c.targets.includes('all')||c.targets.includes(ctx.user.id)||c.targets.includes(m.display_name)))}));
  }
  if(name==='save_room_state'){access(ctx,game,true);if(!Array.isArray(a.next_scenes)||JSON.stringify(a.next_scenes).length>1900000)fail('Дошка завелика для збереження.');await put(ctx,'boards',{game_id:game,scenes:a.next_scenes},game);await event(ctx,game,'scenes-updated');return null;}
  if(name==='send_room_message'||name==='record_dice_roll'){const row=(await query(ctx,{table:name==='send_room_message'?'room_messages':'dice_rolls',op:'insert',values:{game_id:game,recipient_id:a.target_recipient,visibility:a.target_visibility,body:a.message_body,roll:a.roll_data}}))[0];return name==='record_dice_roll'?row.id:row;}
  if(name==='set_my_display_name'||name==='keeper_rename_player'){
    if(name==='keeper_rename_player')access(ctx,game,true);const target=name==='set_my_display_name'?ctx.user.id:a.target_player;
    const n=String(a.new_name||'').trim();if(!n||Array.from(n).length>24)fail('Вкажи ім’я до 24 символів.');
    await ctx.db.prepare("UPDATE game_members SET display_name=? WHERE game_id=? AND user_id=? AND (user_id=? OR role='player')").bind(n,game,target,ctx.user.id).run();await event(ctx,game,'member-updated');return null;
  }
  if(name==='keeper_room_account_names'){access(ctx,game,true);return (await ctx.db.prepare('SELECT m.user_id,u.display_name AS account_name FROM game_members m JOIN site_users u ON u.id=m.user_id WHERE m.game_id=?').bind(game).all()).results;}
  access(ctx,game,true);
  if(name==='set_game_cover'){if(typeof a.cover_data!=='string'||a.cover_data.length>550000||!a.cover_data.startsWith('data:image/'))fail('Некоректна обкладинка.');await put(ctx,'covers',{game_id:game,cover_data:a.cover_data},game);await event(ctx,game,'cover-updated');return null;}
  if(name==='create_hidden_material')return (await query(ctx,{table:'hidden_materials',op:'insert',values:{...a.material_data,game_id:game,created_by:ctx.user.id,revealed_at:null}}))[0];
  if(name==='keeper_kick_player'){
    await ctx.db.prepare("DELETE FROM game_members WHERE game_id=? AND user_id=? AND role='player'").bind(game,a.target_user).run();await event(ctx,game,'member-removed');return null;
  }
  if(name==='keeper_clear_room_messages'||name==='keeper_clear_dice_rolls'){
    const table=name==='keeper_clear_room_messages'?'room_messages':'dice_rolls';await ctx.db.prepare('DELETE FROM migration_records WHERE table_name=? AND game_id=?').bind(table,game).run();
    if(table==='room_messages'){const found=await ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_room_messages'").first();if(found)await ctx.db.prepare('DELETE FROM migration_room_messages WHERE game_id=?').bind(game).run();}
    await event(ctx,game,table==='room_messages'?'messages-cleared':'rolls-cleared');return null;
  }
  if(name==='keeper_delete_game'){
    await ctx.db.batch([ctx.db.prepare('DELETE FROM migration_file_chunks WHERE path IN (SELECT record_id FROM migration_records WHERE table_name=\'files\' AND game_id=?)').bind(game),ctx.db.prepare('DELETE FROM migration_records WHERE game_id=?').bind(game),ctx.db.prepare('DELETE FROM game_members WHERE game_id=?').bind(game),ctx.db.prepare('DELETE FROM games WHERE id=? AND keeper_id=?').bind(game,ctx.user.id)]);return null;
  }
  fail('Невідома дія.',404);
}
async function fileApi(ctx,request,url) {
  const path=url.searchParams.get('path')||'';const game=path.split('/')[0];
  access(ctx,game,url.searchParams.has('list')||request.method!=='GET');
  if(request.method==='GET'&&url.searchParams.has('list'))return json({data:(await raw(ctx,'files',game)).map(f=>({id:f.id,name:f.id.slice(game.length+1),created_at:f.created_at,metadata:{mimetype:f.type}}))});
  const existing=(await raw(ctx,'files',game)).find(r=>r.id===path);
  if(request.method==='GET'){
    if(!existing)fail('Файл не знайдено.',404);
    const {results}=await ctx.db.prepare('SELECT bytes FROM migration_file_chunks WHERE path=? ORDER BY part').bind(path).all();
    const parts=results.map(r=>new Uint8Array(r.bytes));const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
    return new Response(bytes,{headers:{'Content-Type':existing.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(!/^[a-f0-9-]{36}\/[A-Za-z0-9_.-]+$/.test(path))fail('Некоректний шлях.');
  if(request.method==='DELETE'){
    await ctx.db.prepare('DELETE FROM migration_file_chunks WHERE path=?').bind(path).run();await remove(ctx,'files',path);return json({data:[]});
  }
  if(request.method!=='PUT')fail('Метод недоступний.',405);
  if(existing)fail('Файл уже існує.',409);
  const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>26214400)fail('Максимальний розмір файлу — 25 МБ.');
  const type=request.headers.get('Content-Type')||'application/octet-stream';
  if(!['application/pdf','image/png','image/jpeg','image/webp','image/gif','image/avif','image/heic','image/heif','image/bmp'].includes(type))fail('Дозволені зображення та PDF.');
  const chunkStatements=[];for(let i=0;i<bytes.byteLength;i+=262144)chunkStatements.push(ctx.db.prepare('INSERT INTO migration_file_chunks(path,part,bytes) VALUES(?,?,?)').bind(path,i/262144,bytes.slice(i,i+262144)));
  for(let i=0;i<chunkStatements.length;i+=20)await ctx.db.batch(chunkStatements.slice(i,i+20));
  await put(ctx,'files',{game_id:game,type,size:bytes.byteLength,created_at:now()},path);return json({data:{path}});
}
async function realtime(ctx,request,input){
  const game=input.game;access(ctx,game);
  if(input.action==='send'){
    if(!input.event||typeof input.event!=='string'||JSON.stringify(input.payload).length>900000)fail('Некоректна подія.');
    if(['scene-marker','audio-state'].includes(input.event))access(ctx,game,true);
    if(input.event==='participant-photo'&&input.payload?.user_id!==ctx.user.id)access(ctx,game,true);
    await put(ctx,'broadcasts',{game_id:game,event:input.event,payload:input.payload,created_at:now(),sender_id:ctx.user.id});return {status:'ok'};
  }
  if(input.action==='track'){
    await put(ctx,'presence',{game_id:game,payload:{...input.payload,user_id:ctx.user.id},created_at:now()},game+':'+ctx.user.id);return {status:'ok'};
  }
  const result={};
  for(const table of input.tables||[])if(tables.has(table))result[table]=(await rows(ctx,table)).filter(r=>r.game_id===game);
  result.broadcasts=(await raw(ctx,'broadcasts',game)).filter(r=>visible(ctx,'broadcasts',r));
  result.presence=(await raw(ctx,'presence',game)).filter(r=>visible(ctx,'presence',r));
  // Bound transient storage; persistent game history is untouched.
  await ctx.db.prepare("DELETE FROM migration_records WHERE table_name IN ('broadcasts','presence') AND json_extract(data,'$.created_at') < ?").bind(new Date(Date.now()-120000).toISOString()).run();
  return result;
}
async function rulesApi(ctx,request,url){
  const canEdit=['admin','keeper'].includes(ctx.role);
  const stored=await raw(ctx,'rules');const map=new Map(initialCards.map((c,i)=>[c.id,{...c,sort_order:i}]));for(const c of stored)map.set(c.id,c);
  if(request.method==='GET')return json({cards:[...map.values()].filter(c=>canEdit||c.visibility==='all').sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),canEdit});
  if(request.method!=='PUT')fail('Метод недоступний.',405);if(!canEdit)fail('Правила редагує ведучий.',403);
  const id=decodeURIComponent(url.pathname.slice('/api/portal-rules/'.length));const data=await request.json();
  if(!/^[\w-]{1,100}$/.test(id)||!data.title?.trim()||data.title.length>200||typeof data.body!=='string'||data.body.length>40000||!['all','keeper'].includes(data.visibility))fail('Перевір назву, текст і видимість.');
  if(!Array.isArray(data.examples)||data.examples.length>10||data.examples.some(e=>!Number.isFinite(Number(e.value))||Number(e.value)<1||Number(e.value)>99))fail('Перевір приклади кидків.');
  const card=await put(ctx,'rules',{...map.get(id),title:data.title.trim(),body:data.body,visibility:data.visibility,examples:data.examples,updated_at:now()},id);return json({card});
}
export async function handleMigration(request,env){
  try{
    const url=new URL(request.url);
    if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)fail('Запит відхилено.',403);
    if(Number(request.headers.get('Content-Length'))>27000000)fail('Файл завеликий.',413);
    const ctx=await context(request,env);
    if(url.pathname==='/api/migration/files')return await fileApi(ctx,request,url);
    if(url.pathname.startsWith('/api/portal-rules'))return await rulesApi(ctx,request,url);
    if(url.pathname==='/api/migration/bridge'&&request.method==='POST'){
      const input=await request.json();if(JSON.stringify(input).length>2000000)fail('Запис завеликий.',413);
      const data=input.kind==='rpc'?await rpc(ctx,input.name,input.args||{},request,env):input.kind==='realtime'?await realtime(ctx,request,input):await query(ctx,input);
      return json({data,error:null});
    }
    if(url.pathname.startsWith('/api/direct-messages/')){
      const game=url.pathname.slice('/api/direct-messages/'.length);access(ctx,game);
      if(request.method==='DELETE'){access(ctx,game,true);return json({ok:true});}
      if(request.method==='POST'){const a=await request.json();const row=(await query(ctx,{table:'room_messages',op:'insert',values:{...a,game_id:game,visibility:'private'}}))[0];return json({row});}
      const after=Number(url.searchParams.get('after')||0);const data=(await rows(ctx,'room_messages')).filter(r=>r.game_id===game&&r.visibility!=='all'&&r.seq>after).sort((a,b)=>a.seq-b.seq).slice(0,250);return json({rows:data});
    }
    if(url.pathname==='/api/migration/source-download'){admin(ctx);return Response.redirect('https://github.com/ViTL0K/cthulhugenius/archive/refs/heads/main.zip',302);}
    return json({error:'Сторінку не знайдено.'},404);
  }catch(e){const message=e.status?e.message:'Не вдалося виконати запит. Спробуй ще раз.';return json({data:null,error:new URL(request.url).pathname==='/api/migration/bridge'?{message}:message},e.status||503);}
}
