import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';

import { D1 } from './d1-helper.mjs';
const origin='https://cthulhugenius.technobio-portalworkersdev.workers.dev';
const db=new D1();
const env={DB:db,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REDIRECT_URI:origin+'/api/migration/auth/google/callback',ASSETS:{fetch:()=>new Response('asset')}};
const tokens={};
for(const [id,role] of [['keeper','admin'],['player','player'],['other','player']]){
  db.db.prepare('INSERT INTO site_users(id,google_subject,email,display_name) VALUES(?,?,?,?)').run(id,id,id+'@example.com',id);
  if(role==='admin')db.db.prepare('INSERT INTO account_roles(user_id,role) VALUES(?,?)').run(id,role);
  tokens[id]='a'.repeat(42)+(id==='keeper'?'b':id==='player'?'c':'d');
  db.db.prepare('INSERT INTO site_sessions VALUES(?,?,?)').run(createHash('sha256').update(tokens[id]).digest('base64url'),id,Math.floor(Date.now()/1000)+3600);
}
async function call(user,input,path='/api/migration/bridge',method='POST'){
  const res=await worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-poklik-session='+tokens[user],'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(input)}),env);
  return {status:res.status,...await res.json()};
}
const rpc=(user,name,args)=>call(user,{kind:'rpc',name,args});
const query=(user,table,op='select',values,filters=[])=>call(user,{table,op,values,filters});

test('Google session and non-destructive D1 migration',async()=>{
  // Match the actual session cookie without changing production authentication.
  const source=readFileSync(new URL('../google-auth.mjs',import.meta.url),'utf8');
  const cookie=/const sessionCookie = '([^']+)'/.exec(source)[1];
  assert.equal(cookie,'__Host-poklik-session');
  const session=await call('keeper',null,'/api/migration/auth/session','GET');assert.equal(session.user.id,'keeper');
  const created=await rpc('keeper','create_game',{game_title:'Тестова пригода',game_description:'Перевірка'});assert.equal(created.status,200,JSON.stringify(created));const game=created.data.id;
  const list=await rpc('keeper','list_my_games');assert.equal(list.data[0].id,game);assert.equal(list.data[0].room_code.length,20);
  assert.equal((await rpc('player','create_game',{game_title:'Forbidden'})).status,403);
  await rpc('player','join_game',{code_to_join:list.data[0].room_code});
  assert.equal((await rpc('other','get_room_state',{target_game:game})).status,403);
  assert.equal((await rpc('player','save_room_state',{target_game:game,next_scenes:[]})).status,403);
  const secret=await rpc('keeper','create_hidden_material',{target_game:game,material_data:{title:'Таємний матеріал',audience:'all',note:'Секрет'}});assert.equal(secret.status,200);
  assert.equal((await query('player','hidden_materials')).data.length,0);
  const card={id:'secret-card',sourceClueId:secret.data.id,targets:['all'],note:'Секрет'};
  await rpc('keeper','save_room_state',{target_game:game,next_scenes:[{name:'Дошка',cards:[card]}]});
  assert.equal((await rpc('player','get_room_state',{target_game:game})).data[0].cards.length,0);
  await query('keeper','hidden_materials','update',{revealed_at:new Date().toISOString()},[['eq','id',secret.data.id]]);
  assert.equal((await rpc('player','get_room_state',{target_game:game})).data[0].cards.length,1);
  const sheet={game_id:game,user_id:'player',sheet:{Investigators_Name:'Джон',DEX:'60'}};
  assert.equal((await query('player','investigator_sheets','upsert',sheet)).status,200);
  assert.equal((await query('keeper','investigator_sheets')).data[0].sheet.Investigators_Name,'Джон');
  assert.equal((await query('other','investigator_sheets')).data.length,0);
  assert.equal((await query('player','account_roles','upsert',{user_id:'player',role:'admin'})).status,403);
  assert.equal((await query('player','game_events','insert',{game_id:game,event_type:'messages-cleared'})).status,403);
  await rpc('player','send_room_message',{target_game:game,target_visibility:'all',message_body:'Привіт'});
  await rpc('player','send_room_message',{target_game:game,target_visibility:'private',target_recipient:'keeper',message_body:'Таємний чат'});
  const roll=await rpc('player','record_dice_roll',{target_game:game,target_visibility:'private',target_recipient:'player',roll_data:{sides:100,total:21,values:[21]}});assert.equal(typeof roll.data,'string');
  assert.equal((await query('keeper','dice_rolls')).data.length,0);
  assert.equal((await query('player','dice_rolls')).data.length,1);
  const rules=await call('player',null,'/api/portal-rules','GET');assert.ok(rules.cards.length>=3);assert.equal(rules.canEdit,false);
  const dm=await call('keeper',null,'/api/direct-messages/'+game,'GET');assert.equal(dm.rows[0].body,'Таємний чат');
  const prepared=await query('keeper','game_character_sheets','insert',{game_id:game,character_name:'Генрі',sheet:{Investigators_Name:'Генрі'}});
  const preparedId=prepared.data[0].id;
  assert.equal((await query('player','game_character_sheets')).data.length,0);
  assert.equal((await rpc('keeper','assign_game_character_sheet',{target_sheet:preparedId,target_user:'player'})).status,200);
  assert.equal((await query('player','game_character_sheets')).data.length,1);
  assert.equal((await query('player','game_character_sheets','update',{assigned_user_id:'other'},[['eq','id',preparedId]])).status,403);
  assert.equal((await query('player','game_character_sheets','update',{sheet:{DEX:70}},[['eq','id',preparedId]])).status,200);
  assert.equal((await call('player',null,'/api/migration/files?list=1&path='+game,'GET')).status,403);
  const filePath=game+'/example.pdf';
  const upload=await worker.fetch(new Request(origin+'/api/migration/files?path='+filePath,{method:'PUT',headers:{Origin:origin,Cookie:'__Host-poklik-session='+tokens.keeper,'Content-Type':'application/pdf'},body:'%PDF-1.4 test file'}),env);
  assert.equal(upload.status,200);
  const download=await worker.fetch(new Request(origin+'/api/migration/files?path='+filePath,{headers:{Cookie:'__Host-poklik-session='+tokens.player}}),env);
  assert.equal(await download.text(),'%PDF-1.4 test file');
  const foreignOrigin=await worker.fetch(new Request(origin+'/api/migration/bridge',{method:'POST',headers:{Origin:'https://other.example',Cookie:'__Host-poklik-session='+tokens.keeper,'Content-Type':'application/json'},body:JSON.stringify({kind:'rpc',name:'my_account_role'})}),env);
  assert.equal(foreignOrigin.status,403);
  // Existing board and chat rows survive initialization and are visible in the restored UI.
  await call('keeper',null,'/api/migration/rooms/'+game+'/board','GET');
  db.db.prepare('INSERT INTO migration_room_messages(game_id,sender_id,body) VALUES(?,?,?)').run(game,'keeper','Старий чат');
  db.db.prepare('INSERT INTO migration_room_boards VALUES(?,?,?)').run(game,'UklGRtest','v1');
  assert.ok((await query('player','room_messages')).data.some(r=>r.body==='Старий чат'));
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM migration_room_boards').get().n,1);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM site_users').get().n,3);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM site_sessions').get().n,3);
});
