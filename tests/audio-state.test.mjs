import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import {normalizeAudioCommand} from '../room-audio-state.mjs';
import {setup,game,otherGame,origin} from './library-helper.mjs';
test('audio normalizes sender, URL and timing; rejects invalid positions',()=>{
 const v=normalizeAudioCommand({action:'seek',user_id:'fake',track:{kind:'video',id:'ab_def-1234',url:'javascript:bad',position:81,duration:100},command_id:'seek1',playing:false},'keeper',1000);
 assert.equal(v.user_id,'keeper');assert.equal(v.sent_at,1000);assert.equal(v.track.url,'https://www.youtube.com/watch?v=ab_def-1234');assert.equal(v.playing,false);
 for(const changes of [{position:-1},{position:NaN},{duration:Infinity},{playlistIndex:-1}])assert.throws(()=>normalizeAudioCommand({action:'seek',track:{...v.track,...changes}},'keeper'));
 assert.throws(()=>normalizeAudioCommand({action:'seek',track:{kind:'spotify',spotifyType:'bad',id:'x'}},'keeper'));
});
test('room members share audio; audio position survives broadcast cleanup and stays in its room',async()=>{
 const f=setup();const bridge=async(user,input)=>{const res=await worker.fetch(new Request(origin+'/api/migration/bridge',{method:'POST',headers:{Origin:origin,Cookie:'__Host-poklik-session='+f.tokens[user],'Content-Type':'application/json'},body:JSON.stringify(input)}),f.env);return {status:res.status,...await res.json()};};
 const track={kind:'video',id:'ab_def-1234',label:'Дощ',position:90,duration:240},command={kind:'realtime',action:'send',game,event:'audio-state',payload:{action:'seek',track,playing:false,command_id:'command-seek'}};
 assert.equal((await bridge('alice',command)).status,200);assert.equal((await bridge('keeper',command)).status,200);f.DB.db.prepare("DELETE FROM migration_records WHERE table_name='broadcasts'").run();
 const r=await bridge('bob',{kind:'realtime',game,tables:[]});assert.equal(r.data.audioState.track.position,90);assert.equal(r.data.audioState.playing,false);assert.equal(r.data.audioState.user_id,'keeper');assert.equal((await bridge('outside',{kind:'realtime',game,tables:[]})).status,403);
 assert.equal((await bridge('keeper',{kind:'realtime',game:otherGame,tables:[]})).data.audioState,null);
 assert.equal((await bridge('keeper',{...command,payload:{...command.payload,track:{...track,position:-1}}})).status,400);assert.equal((await bridge('alice',{kind:'realtime',game,tables:[]})).data.audioState.track.position,90);
});
