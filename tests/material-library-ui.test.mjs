import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import worker from '../worker.mjs';
import {setup,game,tiny,origin} from './library-helper.mjs';
const flush=async()=>{for(let n=0;n<10;n++)await new Promise(resolve=>setTimeout(resolve,5));};
function dom(fixture,user,storage=new Map()){
 let network=null;
 const {window,document}=parseHTML('<html><body><section id="mount"></section></body></html>');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value||this.querySelector('option')?.value||'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',Boolean(v));}});
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 const draws=[];window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},fillText(){},drawImage(...args){draws.push(args);}});window.HTMLCanvasElement.prototype.toDataURL=()=>tiny;
 class Image{constructor(){this.naturalWidth=800;this.naturalHeight=1200;}async decode(){}}
 const ticks=[],errors=[];const fakeWindow={};
 const sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;}};
 const context=vm.createContext({sessionStorage,window:fakeWindow,document,Image,URLSearchParams,AbortSignal,console,confirm:()=>true,setInterval:fn=>{ticks.push(fn);return ticks.length;},clearInterval(){},fetch:(url,options={})=>network?network(url,options):worker.fetch(new Request(origin+url,{...options,headers:{...options.headers,Origin:origin,Cookie:'__Host-poklik-session='+fixture.tokens[user]}}),fixture.env)});
 vm.runInContext(readFileSync(new URL('../public/material-library.js',import.meta.url),'utf8'),context);
 const library=fakeWindow.createRoomMaterialLibrary({mount:document.querySelector('#mount'),onError:e=>errors.push(e)});library.activate({gameId:game,userId:user,role:user==='keeper'?'keeper':'player'});
 return {window,document,library,ticks,errors,draws,network:fn=>network=fn,storage};
}
test('player navigates nested cards and a revoked card disappears from the detail view',async()=>{
 const fixture=setup();const folder=(await fixture.create({title:'Локації',audience:'all'})).card;
 let entry=(await fixture.create({title:'Санаторій',kind:'entry',parent_id:folder.id,audience:'all',body:'**Секрет**\n<script>danger()</script>',image:tiny})).card;
 const ui=dom(fixture,'alice');await flush();assert.equal(ui.document.querySelector('.library-tools'),null);
 assert.match(ui.document.querySelector('.library-card-title').textContent,/Локації/);
 ui.document.querySelector('.library-card').click();await flush();assert.equal(ui.document.querySelector('.library-card-title').textContent,'Санаторій');
 ui.document.querySelector('.library-card').click();await flush();assert.ok(ui.document.querySelector('.library-detail'));assert.equal(ui.document.querySelector('.library-prose strong').textContent,'Секрет');assert.equal(ui.document.querySelector('.library-prose script'),null);assert.match(ui.document.querySelector('.library-prose').textContent,/<script>/);
 assert.ok(ui.document.querySelector('.library-detail-image'));
 entry=(await fixture.edit(entry,{audience:'hidden'})).card;ui.ticks[0]();await flush();assert.equal(ui.document.querySelector('.library-detail'),null);assert.ok(!ui.document.body.textContent.includes('danger()'));
 ui.library.dispose();
});
test('keeper creates a targeted entry through the editor and the API persists its access and text',async()=>{
 const fixture=setup(),ui=dom(fixture,'keeper');await flush();ui.document.querySelector('[aria-label="Додати вкладку"]').click();await flush();
 const form=ui.document.querySelector('.library-editor form');assert.ok(form);
 form.querySelector('input').value='Артур Вілмотт';form.querySelector('select').value='entry';form.querySelector('textarea').value='Опис персонажа';form.querySelector('textarea').dispatchEvent(new ui.window.Event('input',{bubbles:true}));
 const selects=[...form.querySelectorAll('select')];selects.at(-1).value='selected';selects.at(-1).dispatchEvent(new ui.window.Event('change'));
 form.querySelector('fieldset input[value="alice"]').checked=true;
 form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal(ui.errors.length,0);assert.equal(ui.document.querySelector('.library-editor').open,false);
 const list=await fixture.call('alice');assert.equal(list.cards[0].title,'Артур Вілмотт');assert.equal((await fixture.call('bob')).cards.length,0);
 const detail=(await fixture.call('keeper','/cards/'+list.cards[0].id)).card;assert.equal(detail.kind,'entry');assert.equal(detail.body,'Опис персонажа');assert.deepEqual(detail.targets,['alice']);ui.library.dispose();
});
test('an outdated editor preserves unsaved text and reports a conflict instead of overwriting another keeper',async()=>{
 const fixture=setup();let entry=(await fixture.create({title:'Підказка',kind:'entry',audience:'hidden',body:'Початковий опис',cover_source:tiny,cover_thumb:tiny,crop:{zoom:2,x:.2,y:.8}})).card;
 const ui=dom(fixture,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();[...ui.document.querySelectorAll('button')].find(b=>b.textContent==='Редагувати картку').click();await flush();
 const form=ui.document.querySelector('.library-editor form');form.querySelector('textarea').value='Мій незбережений опис';
 entry=(await fixture.edit(entry,{body:'Зміна в іншому вікні'})).card;
 form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal(ui.document.querySelector('.library-editor').open,true);assert.equal(form.querySelector('textarea').value,'Мій незбережений опис');assert.match(form.querySelector('.library-editor-status').textContent,/змінена/);
 assert.equal((await fixture.call('keeper','/cards/'+entry.id)).card.body,'Зміна в іншому вікні');ui.library.dispose();
});

test('cover controls keep the frame filled and persist the crop without replacing the original cover',async()=>{
 const fixture=setup();const card=(await fixture.create({title:'Портрет',kind:'entry',audience:'all',cover_source:tiny,cover_thumb:tiny,crop:{zoom:1,x:.5,y:.5},image:tiny})).card;
 const ui=dom(fixture,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();[...ui.document.querySelectorAll('button')].find(b=>b.textContent==='Редагувати картку').click();await flush();
 const form=ui.document.querySelector('.library-editor form'),ranges=[...form.querySelectorAll('input[type=range]')];
 for(const [i,value] of ['3','0.7','0.1'].entries()){ranges[i].value=value;ranges[i].dispatchEvent(new ui.window.Event('input',{bubbles:true}));}
 const [,x,y,w,h]=ui.draws.at(-1);assert.ok(x<=0&&y<=0&&x+w>=360&&y+h>=480);
 form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 const saved=(await fixture.call('keeper','/cards/'+card.id)).card;assert.deepEqual(saved.crop,{zoom:3,x:.7,y:.1});assert.equal(saved.cover_source,tiny);assert.equal(saved.image,tiny);ui.library.dispose();
});

test('keeper changes visibility from a card status without altering its content',async()=>{
 const fixture=setup();const card=(await fixture.create({title:'Архів',kind:'entry',body:'Збережений опис',audience:'hidden',cover_source:tiny,cover_thumb:tiny,image:tiny})).card;
 const ui=dom(fixture,'keeper');await flush();
 ui.document.querySelector('.library-access').click();await flush();
 let popup=ui.document.querySelector('.library-access-popup');assert.ok(popup.open);
 popup.querySelector('input[value="alice"]').checked=true;popup.querySelector('form').dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal((await fixture.call('alice')).cards.length,1);assert.equal((await fixture.call('bob')).cards.length,0);
 let saved=(await fixture.call('keeper','/cards/'+card.id)).card;assert.equal(saved.body,'Збережений опис');assert.equal(saved.image,tiny);assert.equal(saved.cover_source,tiny);
 ui.document.querySelector('.library-access').click();await flush();popup=ui.document.querySelector('.library-access-popup[open]');[...popup.querySelectorAll('button')].find(b=>b.textContent==='Відкрити всім').click();await flush();
 assert.equal((await fixture.call('bob')).cards.length,1);
 ui.document.querySelector('.library-access').click();await flush();popup=ui.document.querySelector('.library-access-popup[open]');[...popup.querySelectorAll('button')].find(b=>b.textContent==='Приховати від усіх').click();await flush();assert.equal((await fixture.call('alice')).cards.length,0);ui.library.dispose();
});
test('materials shortcut opens a separate browser and returns the library to its panel on close',async()=>{
 const fixture=setup();await fixture.create({title:'Локації',audience:'all'});const ui=dom(fixture,'alice');await flush();
 ui.library.show();await flush();const browser=ui.document.querySelector('.library-browser');assert.equal(browser.open,true);assert.equal(browser.querySelector('.library-card-title').textContent,'Локації');
 assert.equal(ui.document.querySelector('#mount .material-library'),null);
 browser.close();browser.dispatchEvent(new ui.window.Event('close'));assert.ok(ui.document.querySelector('#mount .material-library'));assert.equal(ui.document.querySelector('.library-browser'),null);ui.library.dispose();
});

test('loaded materials survive network errors and malformed replies, but a valid revocation removes them',async()=>{
 const f=setup();let card=(await f.create({title:'Відкритий лист',kind:'entry',audience:'all',body:'Текст'})).card;const ui=dom(f,'alice');await flush();
 ui.network(()=>Promise.reject(Error('Тимчасово немає мережі')));ui.ticks[0]();await flush();assert.equal(ui.document.querySelector('.library-card-title').textContent,'Відкритий лист');
 ui.network(()=>Promise.resolve(Response.json({cards:[]})));ui.ticks[0]();await flush();assert.equal(ui.document.querySelector('.library-card-title').textContent,'Відкритий лист');
 ui.network(null);await f.edit(card,{audience:'hidden'});ui.ticks[0]();await flush();assert.equal(ui.document.querySelector('.library-card'),null);assert.equal(ui.document.querySelector('.library-tools'),null);ui.library.dispose();
});
test('session snapshots are scoped to the player and restored before a fresh server reply',async()=>{
 const f=setup();await f.create({title:'Для Аліси',audience:'selected',targets:['alice']});const storage=new Map(),first=dom(f,'alice',storage);await flush();first.library.dispose();
 const next=dom(f,'alice',storage);assert.equal(next.document.querySelector('.library-card-title').textContent,'Для Аліси');await flush();next.library.dispose();
 const other=dom(f,'bob',storage);assert.equal(other.document.querySelector('.library-card-title'),null);await flush();assert.equal(other.document.querySelector('.library-card'),null);other.library.dispose();
});
test('block editor adds alternating text and photo blocks and renders their sizes in order',async()=>{
 const f=setup();const c=(await f.create({title:'Бібліотека',kind:'entry',audience:'all',blocks:[{type:'text',text:'Перший'},{type:'image',src:tiny,size:'small'}]})).card;
 const ui=dom(f,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();
 assert.ok(ui.document.querySelector('.library-image-small'));[...ui.document.querySelectorAll('button')].find(b=>b.textContent==='Редагувати картку').click();await flush();
 [...ui.document.querySelectorAll('button')].find(b=>b.textContent==='+ Додати текст').click();const form=ui.document.querySelector('.library-editor form'),text=[...form.querySelectorAll('textarea')].at(-1);text.value='Другий';text.dispatchEvent(new ui.window.Event('input',{bubbles:true}));
 form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();const saved=(await f.call('keeper','/cards/'+c.id)).card;assert.deepEqual(saved.blocks.map(b=>b.type),['text','image','text']);assert.equal(saved.blocks[2].text,'Другий');ui.library.dispose();
});

test('keeper drags a card to the end of the current list and players cannot reorder',async()=>{
 const f=setup();for(const title of ['Перша','Друга','Третя'])await f.create({title,audience:'all'});const ui=dom(f,'keeper');await flush();ui.document.querySelector('[aria-label="Налаштування матеріалів"]').click();const tiles=[...ui.document.querySelectorAll('.library-tile')];assert.equal(tiles[0].draggable,true);assert.ok(![...ui.document.querySelectorAll('button')].some(b=>['Раніше','Пізніше'].includes(b.textContent)));
 tiles[2].getBoundingClientRect=()=>({left:0,width:100});tiles[0].dispatchEvent(Object.assign(new ui.window.Event('dragstart'),{dataTransfer:{setData(){}}}));tiles[2].dispatchEvent(Object.assign(new ui.window.Event('drop',{cancelable:true}),{clientX:90}));await flush();assert.deepEqual((await f.call('keeper')).cards.map(c=>c.title),['Друга','Третя','Перша']);assert.deepEqual([...ui.document.querySelectorAll('.library-number')].map(n=>n.textContent),['1','2','3']);ui.library.dispose();
 const player=dom(f,'alice');await flush();assert.equal(player.document.querySelector('.library-tile').draggable,false);assert.equal(player.document.querySelector('.library-tile-tools'),null);player.library.dispose();
});

test('keeper snapshots are never reused after switching the same account to a player role',async()=>{
 const f=setup();await f.create({title:'Прихований секрет',audience:'hidden'});const ui=dom(f,'keeper');await flush();ui.library.activate({gameId:game,userId:'keeper',role:'player'});assert.equal(ui.document.querySelector('.library-card-title'),null);ui.library.dispose();
});
