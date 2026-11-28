import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {tiny} from './library-helper.mjs';
const flush=()=>new Promise(r=>setTimeout(r,5));
function ui(){
 const {document,window}=parseHTML('<html><body><dialog id="modal"><main></main></dialog></body></html>');const dialog=document.querySelector('dialog');dialog.close=()=>dialog.open=false;
 Object.defineProperty(window.HTMLInputElement.prototype,'files',{configurable:true,writable:true,value:[]});window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});window.HTMLCanvasElement.prototype.toDataURL=()=>tiny;
 class Image{constructor(){this.naturalWidth=800;this.naturalHeight=600;}async decode(){}}class FileReader{readAsDataURL(){this.result=tiny;queueMicrotask(()=>this.onload());}}
 const host={},state={cloud:true,gameId:'room',userId:'keeper',role:'keeper',roomSub:{send:async()=> 'ok'}},stored={map:null,profiles:[]},calls=[],portraits=[],opened=[],errors=[];
 vm.runInNewContext(readFileSync(new URL('../public/room-extras.js',import.meta.url),'utf8'),{window:host,document,Image,FileReader,setInterval:()=>1,clearInterval(){}});host.openMaterialImage=async args=>opened.push(args);
 const extras=host.createRoomExtras({state,isActive:()=>true,onPortrait:row=>portraits.push(row),toast:error=>errors.push(error),openModal:(title,html)=>{dialog.open=true;document.querySelector('main').innerHTML=html;},rpc:async(name,args)=>{calls.push({name,args});if(name==='get_room_map')return stored.map;if(name==='set_room_map')return stored.map={...args};if(name==='get_room_profiles')return stored.profiles;if(name==='set_my_room_portrait'){const row={...args,user_id:state.userId};stored.profiles=[row];return row;}throw Error(name);}});
 const upload=()=>{const file=document.querySelector('input[type=file]');file.files=[{type:'image/png',size:100}];file.dispatchEvent(new window.Event('change'));};const click=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label).click();
 return {document,window,state,stored,calls,portraits,opened,errors,extras,dialog,upload,click};
}
test('room map editor uploads once, opens a zoomable image for players and prevents stale room writes',async()=>{
 const view=ui();await view.extras.editMap();view.upload();await flush();view.document.querySelector('input[type=text]').value='Бостон';view.click('Зберегти');await flush();assert.equal(view.stored.map.image,tiny);assert.equal(view.stored.map.title,'Бостон');assert.equal(view.dialog.open,false);view.state.role='player';await view.extras.openMap();assert.equal(view.opened[0].src,tiny);const count=view.calls.length;await view.extras.editMap();assert.equal(view.calls.length,count);
 view.state.role='keeper';await view.extras.editMap();view.state.gameId='different';view.click('Зберегти');await flush();assert.equal(view.stored.map.target_game,'room');view.extras.dispose();
});
test('keeper portrait editor saves image and crop and refreshes avatars for room members',async()=>{
 const view=ui();await view.extras.editPortrait();view.upload();await flush();const zoom=view.document.querySelector('input[type=range]');zoom.value='2';zoom.dispatchEvent(new view.window.Event('input'));view.click('Зберегти');await flush();assert.equal(view.stored.profiles[0].portrait,tiny);assert.equal(view.stored.profiles[0].zoom,2);assert.equal(view.portraits.at(-1).user_id,'keeper');view.state.role='player';await view.extras.refreshProfiles(true);assert.equal(view.portraits.at(-1).portrait,tiny);view.extras.dispose();
});
