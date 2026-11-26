import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../public/migration/index.html',import.meta.url),'utf8');
test('room receiver handles seek, stale commands and paused restoration without replaying',async()=>{
 const source=html.slice(html.indexOf('  async function receiveRoomAudio('),html.indexOf("  $('#audioListenHere').onclick"));
 const calls=[],state={gameId:'room',userId:'alice',role:'player',members:[{user_id:'keeper',role:'keeper'}],audioTracks:[],audioPlaying:false,audioSharedTrack:{kind:'video',id:'ab_def-1234'},audioCommandAt:0};
 const ctx=vm.createContext({state,Date,audioTimeline:{seek:(position,share)=>calls.push(['seek',position,share])},refreshMemberNames:async()=>{},pauseRoomAudio:()=>{state.audioPlaying=false;},playTrackLocally:(track,position,share,playing=true)=>{calls.push(['load',position,playing]);state.audioPlaying=playing;},saveAudioTracks(){},renderAudioTrackList(){}});vm.runInContext(source,ctx);
 await ctx.receiveRoomAudio({action:'seek',user_id:'keeper',sent_at:Date.now(),command_id:'seek1',track:{kind:'video',id:'ab_def-1234',position:84},playing:false},'room');assert.deepEqual(calls[0],['seek',84,false]);
 const stamp=Date.now()+10;await ctx.receiveRoomAudio({action:'pause',user_id:'keeper',sent_at:stamp,command_id:'pause1',track:{kind:'video',id:'ab_def-1234',position:45}},'room');assert.deepEqual(calls.at(-1),['load',45,false]);const count=calls.length;
 await ctx.receiveRoomAudio({action:'seek',user_id:'keeper',sent_at:1,command_id:'old',track:{kind:'video',id:'ab_def-1234',position:2}},'room');assert.equal(calls.length,count);
 state.userId='keeper';state.audioCommandAt=0;state.audioLastCommand='';await ctx.receiveRoomAudio({action:'pause',user_id:'keeper',restore:true,sent_at:stamp,command_id:'restore',track:{kind:'video',id:'ab_def-1234',position:55}},'room');assert.deepEqual(calls.at(-1),['load',55,false]);
});
test('a paused YouTube snapshot cues at its saved time without starting playback',()=>{
 const source=html.slice(html.indexOf('  function cueYouTubeTrack('),html.indexOf('  function loadYTTrack(')),calls=[],nodes={};const state={audioPlayerReady:true,audioPlaying:false,audioPendingTrack:{kind:'video',id:'ab_def-1234',position:45,startedAt:0},audioPlayer:{cueVideoById:d=>calls.push(['cue',d]),loadVideoById:d=>calls.push(['play',d])}};
 const ctx=vm.createContext({state,Date,$:id=>nodes[id]??={replaceChildren(){}},applyAudioVolume(){},audioTimeline:{stopSpotify(){}}});vm.runInContext(source+';cueYouTubeTrack();',ctx);assert.equal(calls[0][0],'cue');assert.equal(calls[0][1].startSeconds,45);
});
