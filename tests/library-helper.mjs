import {createHash} from 'node:crypto';
import worker from '../worker.mjs';
import {D1} from './d1-helper.mjs';
export const origin='https://cthulhugenius.technobio-portalworkersdev.workers.dev';
export const game='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',otherGame='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
export const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
export function setup(){
 const DB=new D1(),tokens={};
 for(const [i,id] of ['keeper','alice','bob','outside'].entries()){
  DB.db.prepare('INSERT INTO site_users(id,google_subject,email,display_name) VALUES(?,?,?,?)').run(id,'google-'+id,id+'@example.com',id);
  tokens[id]=String(i).repeat(43);DB.db.prepare('INSERT INTO site_sessions VALUES(?,?,?)').run(createHash('sha256').update(tokens[id]).digest('base64url'),id,Math.floor(Date.now()/1000)+3600);
 }
 DB.db.prepare("INSERT INTO account_roles(user_id,role) VALUES('keeper','keeper')").run();
 for(const id of [game,otherGame])DB.db.prepare('INSERT INTO games(id,title,room_code,keeper_id) VALUES(?,?,?,?)').run(id,'Пригода',id==='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'?'CTH-A111':'CTH-B222','keeper');
 for(const id of ['keeper','alice','bob'])DB.db.prepare('INSERT INTO game_members(game_id,user_id,display_name,role) VALUES(?,?,?,?)').run(game,id,id,id==='keeper'?'keeper':'player');
 DB.db.prepare("INSERT INTO game_members(game_id,user_id,display_name,role) VALUES(?,?,?,'keeper')").run(otherGame,'keeper','keeper');
 const env={DB,ASSETS:{fetch:()=>new Response('asset')}};
 async function call(user,tail='',method='GET',body,room=game){
  const res=await worker.fetch(new Request(origin+'/api/migration/library/'+room+tail,{method,headers:{Origin:origin,Cookie:'__Host-poklik-session='+tokens[user],'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
  return {status:res.status,...await res.json()};
 }
 const create=(body,room=game)=>call('keeper','','POST',body,room);
 const edit=(card,changes)=>call('keeper','/cards/'+card.id,'PUT',{...card,...changes});
 return {DB,env,tokens,call,create,edit};
}
