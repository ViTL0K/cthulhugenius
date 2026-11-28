import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../public/audio-timeline.js',import.meta.url),'utf8');
function setup(role='keeper'){
 const {window,document}=parseHTML('<html><head></head><body><section id="roomView" class="active"></section><div id="spotifyPlayerHost"></div><div id="youtubePlayerHost"></div><input id="audioVolume"><span id="audioVolumeValue"></span><input id="audioSeek"><output id="audioTime"></output><button id="audioToggle"></button></body></html>');let current=12;const commands=[],calls=[],host={};
 const state={role,gameId:'room',audioPlaying:false,audioPosition:12,audioSharedTrack:{kind:'video',id:'ab_def-1234',label:'Дощ'},audioPlayerReady:true,audioPlayer:{getCurrentTime:()=>current,getDuration:()=>240,getPlaylistIndex:()=>0,seekTo:n=>{current=n;calls.push(['seek',n]);},pauseVideo:()=>calls.push(['pause'])}};
 vm.runInNewContext(source,{window:host,document,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout});
 const api=host.createAudioTimeline({state,$:s=>document.querySelector(s),send:(action,track)=>commands.push({action,track,playing:state.audioPlaying}),loadTrack:(...args)=>calls.push(['load',...args])});return {state,api,window,document,commands,calls,host};
}
test('timeline seeks once, preserves pause and allows player control',()=>{
 const ui=setup();ui.api.update();assert.equal(ui.document.querySelector('#audioSeek').disabled,false);assert.equal(ui.document.querySelector('#audioTime').textContent,'00:12 / 04:00');
 const range=ui.document.querySelector('#audioSeek');range.value='84';range.dispatchEvent(new ui.window.Event('input'));assert.equal(ui.commands.length,0);range.dispatchEvent(new ui.window.Event('change'));assert.deepEqual(ui.calls[0],['seek',84]);assert.ok(ui.calls.some(c=>c[0]==='pause'));assert.equal(ui.commands[0].action,'seek');assert.equal(ui.commands[0].playing,false);assert.equal(ui.commands[0].track.position,84);ui.api.dispose();
 const p=setup('player');p.api.update();assert.equal(p.document.querySelector('#audioSeek').disabled,false);p.api.seek(50,true);assert.equal(p.commands.length,1);p.api.seek(90,false);assert.equal(p.calls.at(-2)[1],90);p.api.dispose();
});
test('Spotify episodes report milliseconds and receive seek in seconds',async()=>{
 const ui=setup(),listeners={},seeks=[];const controller={addListener:(event,fn)=>listeners[event]=fn,seek:n=>seeks.push(n),play(){},pause(){},destroy(){}};ui.host.portalSpotifyApi={createController:(mount,options,fn)=>fn(controller)};
 const track={kind:'spotify',spotifyType:'episode',id:'abc123',position:20};ui.state.audioSharedTrack=track;ui.state.audioPosition=20;await ui.api.loadSpotify(track);listeners.ready();listeners.playback_update({data:{position:20000,duration:120000,isPaused:true}});assert.equal(ui.document.querySelector('#audioTime').textContent,'00:20 / 02:00');ui.api.seek(60,true);assert.ok(seeks.includes(60));assert.equal(ui.commands.at(-1).track.position,60);ui.api.dispose();
});
