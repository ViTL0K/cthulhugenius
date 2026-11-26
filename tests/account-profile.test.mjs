import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import {setup,origin,game} from './library-helper.mjs';
function bridge(f,user,name,args={}){return worker.fetch(new Request(origin+'/api/migration/bridge',{method:'POST',headers:{Origin:origin,Cookie:'__Host-poklik-session='+f.tokens[user],'Content-Type':'application/json'},body:JSON.stringify({kind:'rpc',name,args})}),f.env);}
test('nickname updates only caller and persists across Google login',async()=>{
 const f=setup();
 let r=await bridge(f,'alice','update_account_name',{display_name:'  Віт  '});assert.equal(r.status,200);assert.equal((await r.json()).data.display_name,'Віт');
 assert.equal(f.DB.db.prepare("SELECT display_name FROM site_users WHERE id='alice'").get().display_name,'Віт');
 assert.equal(f.DB.db.prepare("SELECT display_name FROM game_members WHERE user_id='alice'").get().display_name,'Віт');
 assert.equal(f.DB.db.prepare("SELECT display_name FROM site_users WHERE id='bob'").get().display_name,'bob');
 // Exercise the real OAuth callback with mocked Google transport.
 const original=globalThis.fetch;globalThis.fetch=async url=>Response.json(String(url).includes('/token')?{access_token:'test'}:{sub:'google-alice',email:'alice@example.com',email_verified:true,name:'Довге ім’я Google'});
 try{
  const state='a'.repeat(43),verifier='b'.repeat(43);
  r=await worker.fetch(new Request(origin+'/api/migration/auth/google/callback?state='+state+'&code=test',{headers:{Cookie:'__Host-poklik-oauth='+state+'.'+verifier}}),{...f.env,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REDIRECT_URI:origin+'/api/migration/auth/google/callback'});
  assert.equal(r.status,303);assert.equal(f.DB.db.prepare("SELECT display_name FROM site_users WHERE id='alice'").get().display_name,'Віт');
 }finally{globalThis.fetch=original;}
 for(const name of ['', 'x'.repeat(25),'a\nb'])assert.equal((await bridge(f,'alice','update_account_name',{display_name:name})).status,400);
 assert.equal(f.DB.db.prepare("SELECT display_name FROM site_users WHERE id='alice'").get().display_name,'Віт');
 assert.equal((await bridge(f,'alice','update_account_name',{display_name:'я'.repeat(24)})).status,200);
});
test('room code belongs to members; only keeper may publish shared information',async()=>{
 const f=setup();
 let r=await bridge(f,'alice','list_my_games');assert.equal((await r.json()).data[0].room_code,'CTH-A111');
 const args={target_game:game,title:'Записка',body:'Текст для всіх <script>alert(1)</script>'};
 assert.equal((await bridge(f,'alice','set_room_announcement',args)).status,403);
 assert.equal((await bridge(f,'outside','get_room_announcement',{target_game:game})).status,403);
 r=await bridge(f,'keeper','set_room_announcement',args);assert.equal(r.status,200);const announcement=(await r.json()).data;
 const first=await (await bridge(f,'alice','get_room_announcement',{target_game:game})).json();assert.equal(first.data.body,args.body);assert.equal(first.data.revision,announcement.revision);
 const reconnect=await (await bridge(f,'bob','get_room_announcement',{target_game:game})).json();assert.equal(reconnect.data.revision,announcement.revision);
 await bridge(f,'keeper','set_room_announcement',{target_game:game,hidden:true});
 assert.equal((await (await bridge(f,'alice','get_room_announcement',{target_game:game})).json()).data.hidden,true);
});
