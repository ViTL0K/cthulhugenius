import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../public/migration/index.html',import.meta.url),'utf8');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
test('account settings save nickname with escaped value and restore button after failure',async()=>{
 const {document}=parseHTML('<html><body><main></main></body></html>');const state={name:'Довге "ім’я"',email:'',accountRole:'player',members:[{user_id:'alice',display_name:'Старе'}],userId:'alice',gameId:'room'};let saved,notice;
 const ctx=vm.createContext({state,document,$:s=>document.querySelector(s),esc,uiText:x=>x,settingsFooter:()=>'',openInterfaceModal:(title,html)=>document.querySelector('main').innerHTML=html,interfaceLanguage:'uk',safeStore:()=>{},refreshMemberNames:async()=>{},players:()=>{},updateName:()=>{},toast:x=>notice=x,supabase:{rpc:async(name,args)=>{saved={name,args};return {data:{display_name:'Віт'}};}}});
 vm.runInContext(source.slice(source.indexOf('  function settings(){'),source.indexOf('  function appearanceChoices('))+';settings();',ctx);
 assert.equal(document.querySelector('#accountDisplayName').value,state.name);document.querySelector('#accountDisplayName').value='Віт';await document.querySelector('#saveAccountName').onclick();
 assert.equal(saved.name,'update_account_name');assert.equal(saved.args.display_name,'Віт');assert.equal(state.members[0].display_name,'Віт');assert.equal(notice,'Ім’я збережено.');assert.equal(document.querySelector('#saveAccountName').disabled,false);
 ctx.supabase.rpc=async()=>({error:{message:'Мережа недоступна'}});await document.querySelector('#saveAccountName').onclick();assert.equal(notice,'Мережа недоступна');assert.equal(document.querySelector('#saveAccountName').disabled,false);
});
test('shared text is safe, preserves sheet, survives errors and does not reopen dismissed revision',async()=>{
 const {document}=parseHTML('<html><body><section id="roomView" class="active"></section><dialog id="sheet" open>Чернетка листа</dialog></body></html>');const create=document.createElement.bind(document);document.createElement=name=>{const node=create(name);if(name==='dialog'){node.showModal=()=>node.setAttribute('open','');node.close=()=>node.removeAttribute('open');}return node;};
 let data={revision:'a',title:'Записка',body:'<script>bad()</script>'},error=null;const state={cloud:true,userId:'alice',gameId:'room',role:'player'};
 const ctx=vm.createContext({document,state,adminEmbedded:false,$:s=>document.querySelector(s),setInterval:()=>{},supabase:{rpc:async()=>({data,error})}});
 vm.runInContext(source.slice(source.indexOf("  let announcementScope="),source.indexOf('  function settings(){')),ctx);
 const poll=()=>vm.runInContext('pollRoomAnnouncement()',ctx);await poll();const viewer=document.querySelector('.room-announcement');assert.ok(viewer.hasAttribute('open'));assert.equal(viewer.querySelector('p').textContent,data.body);assert.equal(viewer.querySelector('script'),null);assert.equal(document.querySelector('#sheet').textContent,'Чернетка листа');
 viewer.close();await poll();assert.equal(viewer.hasAttribute('open'),false);
 data={...data,revision:'b'};await poll();assert.ok(document.querySelector('.room-announcement').hasAttribute('open'));
 error={message:'offline'};data=null;await poll();assert.ok(document.querySelector('.room-announcement'));
 error=null;data={hidden:true};await poll();assert.equal(document.querySelector('.room-announcement'),null);
});
