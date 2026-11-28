import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import {setup,game,otherGame,tiny,origin} from './library-helper.mjs';
function bridge(f,user,name,args){return worker.fetch(new Request(origin+'/api/migration/bridge',{method:'POST',headers:{Origin:origin,Cookie:'__Host-poklik-session='+f.tokens[user],'Content-Type':'application/json'},body:JSON.stringify({kind:'rpc',name,args})}),f.env);}
test('keeper publishes a room map; only room members may view it and only keeper may replace it',async()=>{
 const f=setup(),args={target_game:game,title:'Бостон',image:tiny};assert.equal((await bridge(f,'alice','set_room_map',args)).status,403);assert.equal((await bridge(f,'outside','get_room_map',{target_game:game})).status,403);
 assert.equal((await bridge(f,'keeper','set_room_map',args)).status,200);const row=(await(await bridge(f,'alice','get_room_map',{target_game:game})).json()).data;assert.equal(row.image,tiny);assert.equal(row.title,'Бостон');assert.equal((await(await bridge(f,'keeper','get_room_map',{target_game:otherGame})).json()).data,null);
 assert.equal((await bridge(f,'keeper','set_room_map',{...args,image:'https://unsafe.example/image.png'})).status,400);assert.equal((await(await bridge(f,'bob','get_room_map',{target_game:game})).json()).data.image,tiny);
 assert.equal((await bridge(f,'keeper','set_room_map',{...args,image:''})).status,200);assert.equal((await(await bridge(f,'alice','get_room_map',{target_game:game})).json()).data.image,'');
});
test('keeper portrait is persistent, shared only within its room and cannot target another account',async()=>{
 const f=setup(),args={target_game:game,portrait:tiny,zoom:2,x:20,y:-10,user_id:'alice'};
 assert.equal((await bridge(f,'alice','set_my_room_portrait',args)).status,403);assert.equal((await bridge(f,'keeper','set_my_room_portrait',args)).status,200);
 const rows=(await(await bridge(f,'alice','get_room_profiles',{target_game:game})).json()).data;assert.equal(rows.length,1);assert.equal(rows[0].user_id,'keeper');assert.equal(rows[0].portrait,tiny);assert.equal(rows[0].zoom,2);assert.equal((await bridge(f,'outside','get_room_profiles',{target_game:game})).status,403);
 assert.equal((await bridge(f,'keeper','set_my_room_portrait',{...args,zoom:4})).status,400);assert.equal((await(await bridge(f,'keeper','get_room_profiles',{target_game:otherGame})).json()).data.length,0);
 assert.equal((await bridge(f,'keeper','set_my_room_portrait',{...args,portrait:''})).status,200);assert.equal((await(await bridge(f,'bob','get_room_profiles',{target_game:game})).json()).data[0].portrait,'');
});
