import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../worker.mjs';
import {accountRole,emailFingerprint} from '../site-account.mjs';
import {D1} from './d1-helper.mjs';
const origin='https://cthulhugenius.technobio-portalworkersdev.workers.dev';
function setup(){
  const DB=new D1(),tokens={};
  for(const [id,email] of [['owner','owner@example.com'],['keeper','keeper@example.com'],['player','player@example.com'],['stale','stale@example.com']]){
    DB.db.prepare('INSERT INTO site_users(id,google_subject,email,display_name) VALUES(?,?,?,?)').run(id,'google-'+id,email,id);
    tokens[id]=id[0].repeat(43);DB.db.prepare('INSERT INTO site_sessions VALUES(?,?,?)').run(createHash('sha256').update(tokens[id]).digest('base64url'),id,Math.floor(Date.now()/1000)+3600);
  }
  DB.db.prepare("INSERT INTO account_roles(user_id,role) VALUES('keeper','keeper'),('stale','admin')").run();
  const env={DB,ASSETS:{fetch:()=>new Response('asset')},ADMIN_GOOGLE_EMAIL_SHA256:createHash('sha256').update('owner@example.com').digest('hex'),GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REDIRECT_URI:origin+'/api/migration/auth/google/callback'};
  async function call(user,path,input,method=input?'POST':'GET'){
    const headers={Origin:origin,'Content-Type':'application/json'};if(user)headers.Cookie='__Host-poklik-session='+tokens[user];
    const res=await worker.fetch(new Request(origin+path,{method,headers,body:method==='GET'?undefined:JSON.stringify(input)}),env);return {status:res.status,...await res.json()};
  }
  return {env,DB,call,rpc:(u,name,args={})=>call(u,'/api/migration/bridge',{kind:'rpc',name,args}),q:(u,table,op='select',values,filters=[])=>call(u,'/api/migration/bridge',{table,op,values,filters})};
}
test('Only the designated Google account is the site administrator, including existing sessions',async()=>{
  const {env,DB,call,rpc,q}=setup();
  assert.equal(await emailFingerprint(' OWNER@EXAMPLE.COM '),env.ADMIN_GOOGLE_EMAIL_SHA256);
  assert.equal((await call('owner','/api/migration/auth/session')).role,'admin');
  assert.equal(DB.db.prepare("SELECT role FROM account_roles WHERE user_id='owner'").get().role,'admin');
  assert.equal((await rpc('stale','my_account_role')).data,'keeper');
  for(const user of [null,'player','keeper','stale'])assert.equal((await call(user,'/api/migration/admin/overview')).status,user?403:401);
  assert.equal((await call('stale','/api/migration/rooms/admin')).status,403);
  assert.equal((await call('owner','/api/migration/admin/roles',{user_id:'player',role:'admin'})).status,400);
  assert.equal((await q('owner','account_roles','upsert',{user_id:'player',role:'admin'})).status,400);
  assert.equal((await call('owner','/api/migration/admin/roles',{user_id:'owner',role:'player'})).status,403);
  assert.equal((await call('player','/api/migration/admin/roles',{user_id:'player',role:'keeper',isAdmin:true})).status,403);
  assert.equal((await call('owner','/api/migration/admin/roles',{user_id:'player',role:'keeper'})).status,200);
  assert.equal((await rpc('player','my_account_role')).data,'keeper');
  assert.equal((await call('owner','/api/migration/admin/roles',{user_id:'player',role:'player'})).status,200);
  assert.equal((await rpc('player','my_account_role')).data,'player');
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS n FROM site_users').get().n,4);
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n,4);
});
test('Admin controls all rooms, creates characters and edits player sheets through the original workspace',async()=>{
  const {DB,call,rpc,q}=setup();
  const created=await rpc('keeper','create_game',{game_title:'Пригода іншого ведучого'});const game=created.data.id;
  const code=(await rpc('keeper','list_my_games')).data[0].room_code;assert.match(code,/^CTH-[A-F0-9]{4}$/);
  await rpc('player','join_game',{code_to_join:code.toLowerCase()});
  const list=await call('owner','/api/migration/admin/overview');assert.equal(list.status,200);assert.equal(list.rooms[0].id,game);
  assert.equal((await rpc('owner','get_room_state',{target_game:game})).status,403);
  const opened=await call('owner','/api/migration/admin/rooms/'+game+'/open',{});assert.equal(opened.status,200);assert.ok(opened.url.includes(game));
  assert.equal(DB.db.prepare('SELECT keeper_id FROM games WHERE id=?').get(game).keeper_id,'keeper');
  assert.equal((await rpc('owner','get_room_state',{target_game:game})).status,200);
  const character=await q('owner','game_character_sheets','insert',{game_id:game,character_name:'Артур',sheet:{Investigators_Name:'Артур',DEX:65}});assert.equal(character.status,200);
  assert.equal((await rpc('owner','assign_game_character_sheet',{target_sheet:character.data[0].id,target_user:'player'})).status,200);
  await q('player','investigator_sheets','upsert',{game_id:game,user_id:'player',sheet:{Investigators_Name:'Генрі',DEX:50}});
  assert.equal((await q('owner','investigator_sheets','update',{sheet:{Investigators_Name:'Генрі',DEX:70}},[['eq','game_id',game],['eq','user_id','player']])).status,200);
  const overview=await call('owner','/api/migration/admin/overview');assert.equal(overview.sheets.length,2);assert.equal(overview.rooms[0].sheet_count,2);
  assert.equal((await call('owner','/api/migration/admin/rooms/'+game+'/update',{title:'Оновлена назва',description:'Опис'})).status,200);
  assert.equal(DB.db.prepare('SELECT title FROM games WHERE id=?').get(game).title,'Оновлена назва');
  // Existing 20-character invitations keep working after short codes are restored.
  DB.db.prepare("UPDATE games SET room_code='ABCDEF0123456789ABCD' WHERE id=?").run(game);
  assert.equal((await rpc('stale','join_game',{code_to_join:'ABCDEF0123456789ABCD'})).status,200);
});
test('Reports reach the administrator and published quotes are available on the entry page',async()=>{
  const {call,rpc,q}=setup();
  const report=await rpc('player','submit_feedback',{kind:'Помилка',text:'Не відкривається лист'});assert.equal(report.status,200);
  assert.equal((await q('keeper','feedback')).data.length,0);
  const overview=await call('owner','/api/migration/admin/overview');assert.equal(overview.feedback[0].text,'Не відкривається лист');
  assert.equal((await call('owner','/api/migration/admin/feedback',{id:report.data.id,status:'reviewed'})).status,200);
  assert.equal((await call('owner','/api/migration/admin/overview')).feedback[0].status,'reviewed');
  const quote=await q('owner','homepage_quotes','insert',{quote_text:'Тестова цитата',author:'Автор',quote_date:'1926',created_by:'owner'});assert.equal(quote.status,200);
  const entry=await call(null,'/api/migration/entry');assert.equal(entry.quotes[0].text,'Тестова цитата');assert.equal(entry.quotes[0].created_by,undefined);
  assert.equal((await rpc('player','submit_feedback',{text:' '})).status,400);
});

test('only owner bans accounts, revokes sessions, prevents Google login and can unblock without data loss',async()=>{
 const {DB,env,call,rpc}=setup();
 assert.equal((await call('keeper','/api/migration/admin/bans',{user_id:'player',blocked:true})).status,403);
 assert.equal((await call('owner','/api/migration/admin/bans',{user_id:'owner',blocked:true})).status,403);
 assert.equal((await call('owner','/api/migration/admin/bans',{user_id:'missing',blocked:true})).status,404);
 assert.equal((await call('owner','/api/migration/admin/bans',{user_id:'player',blocked:'yes'})).status,400);
 assert.equal((await call('owner','/api/migration/admin/bans',{user_id:'player',blocked:true,reason:'Тест'})).status,200);
 assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM site_sessions WHERE user_id='player'").get().n,0);
 assert.equal((await call('owner','/api/migration/admin/overview')).accounts.find(u=>u.id==='player').banned,true);
 assert.equal((await rpc('player','my_account_role')).status,401);
 // Even an accidentally retained token is rejected centrally across API routes.
 const hash=createHash('sha256').update('p'.repeat(43)).digest('base64url');DB.db.prepare('INSERT INTO site_sessions VALUES(?,?,?)').run(hash,'player',Math.floor(Date.now()/1000)+3600);
 assert.equal((await call('player','/api/migration/auth/session')).status,403);assert.equal((await call('player','/api/migration/rooms')).status,403);assert.equal((await rpc('player','my_account_role')).status,403);DB.db.prepare('DELETE FROM site_sessions WHERE token_hash=?').run(hash);
 const original=globalThis.fetch;globalThis.fetch=async url=>Response.json(String(url).includes('/token')?{access_token:'test'}:{sub:'google-player',email:'player@example.com',email_verified:true,name:'player'});
 try{
  const callback=()=>worker.fetch(new Request(origin+'/api/migration/auth/google/callback?state='+ 'a'.repeat(43)+'&code=test',{headers:{Cookie:'__Host-poklik-oauth='+'a'.repeat(43)+'.'+'b'.repeat(43)}}),env);
  assert.equal((await callback()).status,403);assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM site_sessions WHERE user_id='player'").get().n,0);
  assert.equal((await call('owner','/api/migration/admin/bans',{user_id:'player',blocked:false})).status,200);assert.equal((await call('owner','/api/migration/admin/overview')).accounts.find(u=>u.id==='player').banned,false);
  assert.equal((await callback()).status,303);assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM site_sessions WHERE user_id='player'").get().n,1);
 }finally{globalThis.fetch=original;}
 assert.equal(DB.db.prepare('SELECT COUNT(*) AS n FROM site_users').get().n,4);assert.equal((await call('owner','/api/migration/auth/session')).role,'admin');
});
