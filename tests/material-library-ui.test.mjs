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
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){if(!this.open)return;this.open=false;this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
 const draws=[];window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},fillText(){},drawImage(...args){draws.push(args);}});window.HTMLCanvasElement.prototype.toDataURL=()=>tiny;
 class FileReader{readAsDataURL(file){this.result=file.dataURL||tiny;queueMicrotask(()=>this.onload?.());}}
 class Image{constructor(){this.naturalWidth=800;this.naturalHeight=1200;}async decode(){}}
 const ticks=[],errors=[];const fakeWindow={};
 const sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;}};
 const context=vm.createContext({sessionStorage,window:fakeWindow,document,Image,FileReader,URLSearchParams,AbortSignal,console,confirm:()=>true,setInterval:fn=>{ticks.push(fn);return ticks.length;},clearInterval(){},fetch:(url,options={})=>network?network(url,options):worker.fetch(new Request(origin+url,{...options,headers:{...options.headers,Origin:origin,Cookie:'__Host-poklik-session='+fixture.tokens[user]}}),fixture.env)});
 vm.runInContext(readFileSync(new URL('../public/material-image-viewer.js',import.meta.url),'utf8'),context);
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
 const fixture=setup(),ui=dom(fixture,'keeper');await flush();ui.document.querySelector('[aria-label="Додати матеріал"]').click();await flush();
 const form=ui.document.querySelector('.library-editor form');assert.ok(form);
 form.querySelector('input').value='Артур Вілмотт';form.querySelector('select').value='entry';form.querySelector('select').dispatchEvent(new ui.window.Event('change'));form.querySelector('.library-block-editor textarea').value='Опис персонажа';form.querySelector('.library-block-editor textarea').dispatchEvent(new ui.window.Event('input',{bubbles:true}));
 const selects=[...form.querySelectorAll('select')];selects.at(-1).value='selected';selects.at(-1).dispatchEvent(new ui.window.Event('change'));
 form.querySelector('fieldset input[value="alice"]').checked=true;
 form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal(ui.errors.length,0);assert.equal(ui.document.querySelector('.library-editor'),null);
 const list=await fixture.call('alice');assert.equal(list.cards[0].title,'Артур Вілмотт');assert.equal((await fixture.call('bob')).cards.length,0);
 const detail=(await fixture.call('keeper','/cards/'+list.cards[0].id)).card;assert.equal(detail.kind,'entry');assert.equal(detail.body,'Опис персонажа');assert.deepEqual(detail.targets,['alice']);ui.library.dispose();
});
test('an outdated editor preserves unsaved text and reports a conflict instead of overwriting another keeper',async()=>{
 const fixture=setup();let entry=(await fixture.create({title:'Підказка',kind:'entry',audience:'hidden',body:'Початковий опис',cover_source:tiny,cover_thumb:tiny,crop:{zoom:2,x:.2,y:.8}})).card;
 const ui=dom(fixture,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();[...ui.document.querySelectorAll('button')].find(b=>b.textContent==='Редагувати картку').click();await flush();
 const form=ui.document.querySelector('.library-editor form');form.querySelector('.library-block-editor textarea').value='Мій незбережений опис';form.querySelector('.library-block-editor textarea').dispatchEvent(new ui.window.Event('input',{bubbles:true}));
 entry=(await fixture.edit(entry,{body:'Зміна в іншому вікні'})).card;
 form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal(ui.document.querySelector('.library-editor').open,true);assert.equal(form.querySelector('.library-block-editor textarea').value,'Мій незбережений опис');assert.match(form.querySelector('.library-editor-status').textContent,/змінена/);
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
 assert.equal(popup.querySelector('[aria-pressed=true]').textContent,'Приховати від усіх');
 [...popup.querySelectorAll('button')].find(b=>b.textContent==='Обраним гравцям').click();
 assert.equal(popup.querySelector('[aria-pressed=true]').textContent,'Обраним гравцям');assert.equal(popup.querySelector('fieldset').hidden,false);
 popup.querySelector('input[value="alice"]').checked=true;popup.querySelector('form').dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal((await fixture.call('alice')).cards.length,1);assert.equal((await fixture.call('bob')).cards.length,0);
 let saved=(await fixture.call('keeper','/cards/'+card.id)).card;assert.equal(saved.body,'Збережений опис');assert.equal(saved.image,tiny);assert.equal(saved.cover_source,tiny);
 ui.document.querySelector('.library-access').click();await flush();popup=ui.document.querySelector('.library-access-popup[open]');[...popup.querySelectorAll('button')].find(b=>b.textContent==='Відкрити всім').click();await flush();
 assert.equal((await fixture.call('bob')).cards.length,1);
 ui.document.querySelector('.library-access').click();await flush();popup=ui.document.querySelector('.library-access-popup[open]');assert.equal(popup.querySelector('[aria-pressed=true]').textContent,'Відкрити всім');assert.equal(popup.querySelector('fieldset').hidden,true);[...popup.querySelectorAll('button')].find(b=>b.textContent==='Приховати від усіх').click();await flush();assert.equal((await fixture.call('alice')).cards.length,0);ui.library.dispose();
});
test('materials shortcut opens a separate browser and returns the library to its panel on close',async()=>{
 const fixture=setup();await fixture.create({title:'Локації',audience:'all'});const ui=dom(fixture,'alice');await flush();
 ui.library.show();await flush();const browser=ui.document.querySelector('.library-browser');assert.equal(browser.open,true);assert.equal(browser.querySelector('.library-card-title').textContent,'Локації');
 assert.equal(ui.document.querySelector('#mount .material-library'),null);
 browser.close();assert.ok(ui.document.querySelector('#mount .material-library'));assert.equal(ui.document.querySelector('.library-browser'),null);ui.library.dispose();
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

const namedButton=(host,name)=>[...host.querySelectorAll('button')].find(b=>b.textContent===name);
function type(ui,input,value){input.value=value;input.dispatchEvent(new ui.window.Event('input',{bubbles:true}));}
function select(ui,input,value){input.value=value;input.dispatchEvent(new ui.window.Event('change',{bubbles:true}));}
const submit=(ui,form)=>form.dispatchEvent(new ui.window.Event('submit',{bubbles:true,cancelable:true}));

test('folder form creates and manages leaf cards without losing its introduction or nesting',async()=>{
 const f=setup(),ui=dom(f,'keeper');await flush();ui.document.querySelector('[aria-label="Додати матеріал"]').click();await flush();
 let parentEditor=ui.document.querySelector('.library-editor[open]'),form=parentEditor.querySelector('form');
 assert.deepEqual([...form.querySelector('[aria-label="Тип матеріалу"]').options].map(o=>o.textContent),['Картка з підкартками','Кінцева картка з матеріалом','Картинка з назвою','Назва і текст']);
 assert.equal(form.querySelector('.library-block-editor').hidden,true);assert.equal(form.querySelector('.library-children-editor').hidden,false);
 namedButton(form,'+ Створити дод. матеріал').click();await flush();assert.equal((await f.call('keeper')).cards.length,0);assert.match(form.querySelector('.library-editor-status').textContent,/назву/);
 type(ui,form.querySelector('[aria-label="Назва матеріалу"]'),'Дім Корбіта');type(ui,form.querySelector('[aria-label="Вступний опис"]'),'Бостон. Біля будинку тихо.');type(ui,form.querySelector('[aria-label="Категорія матеріалу"]'),'Локації');select(ui,form.querySelector('[aria-label="Доступ для гравців"]'),'all');
 namedButton(form,'+ Створити дод. матеріал').click();await flush();
 let childEditor=[...ui.document.querySelectorAll('.library-editor[open]')].at(-1),childForm=childEditor.querySelector('form');
 assert.notEqual(childEditor,parentEditor);assert.equal(parentEditor.open,true);assert.equal(childForm.querySelector('[aria-label="Тип матеріалу"]').value,'entry');assert.equal(childForm.querySelector('[aria-label="Тип матеріалу"]').querySelector('option[value=category]'),null);assert.equal(childForm.querySelector('.library-children-editor').hidden,true);assert.equal(childForm.querySelector('.library-intro-field').hidden,true);assert.equal(childForm.querySelector('.library-block-editor').hidden,false);
 type(ui,childForm.querySelector('[aria-label="Назва матеріалу"]'),'Лист Нотта');type(ui,childForm.querySelector('.library-block-editor textarea'),'Перший абзац');namedButton(childForm,'+ Додати текст').click();type(ui,[...childForm.querySelectorAll('.library-block-editor textarea')].at(-1),'Другий абзац');select(ui,childForm.querySelector('[aria-label="Доступ для гравців"]'),'selected');childForm.querySelector('input[value="alice"]').checked=true;submit(ui,childForm);await flush();
 assert.equal(parentEditor.open,true);assert.equal(ui.document.querySelectorAll('.library-editor[open]').length,1);assert.match(form.querySelector('.library-children-list').textContent,/Лист Нотта/);
 const root=(await f.call('keeper')).cards;assert.equal(root.length,1);let folder=(await f.call('keeper','/cards/'+root[0].id)).card;assert.equal(folder.kind,'category');assert.equal(folder.body,'Бостон. Біля будинку тихо.');assert.deepEqual(folder.blocks,[]);
 let child=(await f.call('keeper','?parent='+folder.id)).cards[0];let detail=(await f.call('keeper','/cards/'+child.id)).card;assert.equal(detail.parent_id,folder.id);assert.deepEqual(detail.blocks.map(b=>b.text),['Перший абзац','Другий абзац']);assert.deepEqual(detail.targets,['alice']);assert.equal((await f.call('bob','/cards/'+child.id)).status,404);
 namedButton(form.querySelector('.library-child-row'),'Редагувати').click();await flush();childForm=[...ui.document.querySelectorAll('.library-editor[open]')].at(-1).querySelector('form');type(ui,childForm.querySelector('.library-block-editor textarea'),'Оновлений абзац');submit(ui,childForm);await flush();assert.equal((await f.call('keeper','/cards/'+child.id)).card.blocks[0].text,'Оновлений абзац');
 form.querySelector('.library-child-access').click();await flush();namedButton(ui.document.querySelector('.library-access-popup'),'Відкрити всім').click();await flush();assert.equal((await f.call('bob','/cards/'+child.id)).status,200);assert.match(form.querySelector('.library-child-row').textContent,/Відкрито всім/);
 namedButton(form.querySelector('.library-child-row'),'Видалити').click();await flush();assert.equal((await f.call('keeper','/cards/'+child.id)).status,404);assert.equal(form.querySelectorAll('.library-child-row').length,0);
 submit(ui,form);await flush();assert.equal(ui.document.querySelector('.library-editor[open]'),null);ui.document.querySelector('.library-card').click();await flush();namedButton(ui.document.querySelector('.library-folder-tools'),'Редагувати картку').click();await flush();form=ui.document.querySelector('.library-editor[open] form');type(ui,form.querySelector('[aria-label="Вступний опис"]'),'Новий вступ');submit(ui,form);await flush();folder=(await f.call('keeper','/cards/'+folder.id)).card;assert.equal(folder.parent_id,null);assert.equal(folder.body,'Новий вступ');assert.equal(ui.errors.length,0);ui.library.dispose();
});

test('players see a centered empty state and only individually allowed children of an allowed folder',async()=>{
 const f=setup();await f.create({title:'Таємний корінь',audience:'hidden',category:'Таємна категорія'});let ui=dom(f,'alice');await flush();assert.equal(ui.document.querySelector('.library-empty-player').textContent,'Вартовий ще не відкрив вам жодних матеріалів. Очікуйте на зачіпки під час розслідування');assert.ok(!ui.document.body.textContent.includes('Таємний корінь'));assert.ok(!ui.document.body.textContent.includes('Таємна категорія'));ui.library.dispose();
 let folder=(await f.create({title:'Дім Корбіта',body:'Вступ локації',audience:'all',cover_source:tiny,cover_thumb:tiny})).card;await f.create({title:'Прихована кімната',kind:'entry',parent_id:folder.id,audience:'hidden'});let child=(await f.create({title:'Особистий лист',kind:'entry',parent_id:folder.id,audience:'selected',targets:['alice'],blocks:[{type:'text',text:'Текст листа'},{type:'image',src:tiny,size:'large'}]})).card;
 ui=dom(f,'alice');await flush();assert.deepEqual([...ui.document.querySelectorAll('.library-card-title')].map(n=>n.textContent),['Дім Корбіта']);ui.document.querySelector('.library-card').click();await flush();assert.match(ui.document.querySelector('.library-folder-intro').textContent,/Вступ локації/);assert.deepEqual([...ui.document.querySelectorAll('.library-card-title')].map(n=>n.textContent),['Особистий лист']);assert.ok(!ui.document.body.textContent.includes('Прихована кімната'));ui.document.querySelector('.library-card').click();await flush();assert.equal(ui.document.querySelector('.library-detail .library-prose').textContent,'Текст листа');assert.ok(ui.document.querySelector('.library-image-large'));
 folder=(await f.edit(folder,{audience:'hidden'})).card;ui.ticks[0]();await flush();assert.equal(ui.document.querySelector('.library-detail'),null);assert.equal(ui.document.querySelector('.library-card'),null);assert.equal((await f.call('alice','/cards/'+child.id)).status,404);ui.library.dispose();
});

test('legacy folder blocks remain readable and move to a leaf only after successful saving',async()=>{
 const f=setup(),blocks=[{type:'text',text:'Давній вступ'},{type:'image',src:tiny,size:'small'},{type:'text',text:'Текст записки'}];const folder=(await f.create({title:'Старий дім',kind:'category',body:'Давній вступ',blocks,audience:'all'})).card;
 const ui=dom(f,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();assert.match(ui.document.querySelector('.library-legacy-content').textContent,/Текст записки/);namedButton(ui.document.querySelector('.library-folder-tools'),'Редагувати картку').click();await flush();const parentForm=ui.document.querySelector('.library-editor[open] form');assert.equal(parentForm.querySelector('.library-block-editor').hidden,true);namedButton(parentForm,'Перенести попередній вміст у підкартку').click();await flush();let childEditor=[...ui.document.querySelectorAll('.library-editor[open]')].at(-1);assert.equal(childEditor.querySelectorAll('.library-edit-block').length,3);
 namedButton(childEditor,'Скасувати').click();await flush();assert.deepEqual((await f.call('keeper','/cards/'+folder.id)).card.blocks,blocks);assert.equal((await f.call('keeper','?parent='+folder.id)).cards.length,0);
 namedButton(parentForm,'Перенести попередній вміст у підкартку').click();await flush();childEditor=[...ui.document.querySelectorAll('.library-editor[open]')].at(-1);submit(ui,childEditor.querySelector('form'));await flush();const children=(await f.call('keeper','?parent='+folder.id)).cards;assert.equal(children.length,1);const saved=(await f.call('keeper','/cards/'+children[0].id)).card;assert.deepEqual(saved.blocks,blocks);assert.equal(saved.kind,'entry');assert.equal(saved.parent_id,folder.id);assert.equal(saved.audience,'all');assert.deepEqual((await f.call('keeper','/cards/'+folder.id)).card.blocks,[]);assert.equal((await f.call('keeper','/cards/'+folder.id)).card.body,'Давній вступ');assert.equal(parentForm.querySelector('.library-legacy-editor').hidden,true);ui.library.dispose();
});

test('type switching changes the form and keeps both draft text and the children restriction',async()=>{
 const f=setup(),ui=dom(f,'keeper');await flush();ui.document.querySelector('[aria-label="Додати матеріал"]').click();await flush();let form=ui.document.querySelector('.library-editor[open] form');type(ui,form.querySelector('[aria-label="Вступний опис"]'),'Чернетка вступу');select(ui,form.querySelector('[aria-label="Тип матеріалу"]'),'entry');assert.equal(form.querySelector('.library-intro-field').hidden,true);assert.equal(form.querySelector('.library-children-editor').hidden,true);assert.equal(form.querySelector('.library-block-editor').hidden,false);assert.equal(form.querySelector('.library-block-editor textarea').value,'Чернетка вступу');select(ui,form.querySelector('[aria-label="Тип матеріалу"]'),'category');assert.equal(form.querySelector('[aria-label="Вступний опис"]').value,'Чернетка вступу');
 ui.library.activate({gameId:game,userId:'bob',role:'player'});assert.equal(ui.document.querySelector('.library-editor[open]'),null);ui.library.dispose();
});

test('a folder with children cannot become a leaf and failed child saving keeps both editors and old content',async()=>{
 const f=setup(),blocks=[{type:'text',text:'Вступ'},{type:'image',src:tiny,size:'medium'}];const folder=(await f.create({title:'Локація',body:'Вступ',blocks,audience:'all'})).card;const existing=(await f.create({title:'Існуюча підкартка',kind:'entry',parent_id:folder.id,audience:'all'})).card;
 const ui=dom(f,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();namedButton(ui.document.querySelector('.library-folder-tools'),'Редагувати картку').click();await flush();const parentForm=ui.document.querySelector('.library-editor[open] form');select(ui,parentForm.querySelector('[aria-label="Тип матеріалу"]'),'entry');submit(ui,parentForm);await flush();assert.match(parentForm.querySelector('.library-editor-status').textContent,/має підкартки/);assert.equal((await f.call('keeper','/cards/'+folder.id)).card.kind,'category');
 select(ui,parentForm.querySelector('[aria-label="Тип матеріалу"]'),'category');namedButton(parentForm,'Перенести попередній вміст у підкартку').click();await flush();const childForm=[...ui.document.querySelectorAll('.library-editor[open]')].at(-1).querySelector('form');
 ui.network(()=>Promise.resolve(Response.json({error:'Немає з’єднання для збереження'},{status:503})));submit(ui,childForm);await flush();assert.equal(ui.document.querySelectorAll('.library-editor[open]').length,2);assert.match(childForm.querySelector('.library-editor-status').textContent,/Немає з’єднання/);assert.equal(childForm.querySelector('.library-edit-block textarea').value,'Вступ');assert.deepEqual((await f.call('keeper','/cards/'+folder.id)).card.blocks,blocks);assert.deepEqual((await f.call('keeper','?parent='+folder.id)).cards.map(c=>c.id),[existing.id]);ui.library.dispose();
});

test('named image form saves one uploaded picture and displays it without text or child controls',async()=>{
 const f=setup(),ui=dom(f,'keeper');await flush();ui.document.querySelector('[aria-label="Додати матеріал"]').click();await flush();let form=ui.document.querySelector('.library-editor[open] form');
 select(ui,form.querySelector('[aria-label="Тип матеріалу"]'),'image');type(ui,form.querySelector('[aria-label="Назва матеріалу"]'),'Мапа будинку');assert.equal(form.querySelector('.library-block-editor').hidden,true);assert.equal(form.querySelector('.library-children-editor').hidden,true);assert.equal(form.querySelector('.library-intro-field').hidden,true);
 submit(ui,form);await flush();assert.match(form.querySelector('.library-editor-status').textContent,/Додай зображення/);assert.equal((await f.call('keeper')).cards.length,0);
 const upload=form.querySelector('.library-cover-editor input[type=file]');upload.files=[{type:'image/png',size:100,dataURL:tiny}];upload.dispatchEvent(new ui.window.Event('change',{bubbles:true}));await flush();select(ui,form.querySelector('[aria-label="Доступ для гравців"]'),'selected');form.querySelector('input[value="alice"]').checked=true;submit(ui,form);await flush();
 const cards=(await f.call('keeper')).cards;assert.equal(cards.length,1);const card=(await f.call('keeper','/cards/'+cards[0].id)).card;assert.equal(card.kind,'image');assert.equal(card.image,tiny);assert.equal(card.body,'');assert.deepEqual(card.blocks,[]);assert.equal((await f.call('bob')).cards.length,0);
 ui.document.querySelector('.library-card').click();await flush();assert.equal(ui.document.querySelector('.library-detail h2').textContent,'Мапа будинку');assert.equal(ui.document.querySelectorAll('.library-detail img').length,1);assert.equal(ui.document.querySelector('.library-detail .library-prose'),null);namedButton(ui.document.querySelector('.library-detail'),'Редагувати картку').click();await flush();form=ui.document.querySelector('.library-editor[open] form');assert.equal(form.querySelector('[aria-label="Тип матеріалу"]').value,'image');assert.equal(form.querySelector('.library-block-editor').hidden,true);type(ui,form.querySelector('[aria-label="Назва матеріалу"]'),'План будинку');submit(ui,form);await flush();assert.equal((await f.call('keeper','/cards/'+card.id)).card.image,tiny);ui.library.dispose();
 const player=dom(f,'alice');await flush();player.document.querySelector('.library-card').click();await flush();assert.equal(player.document.querySelector('.library-picture').getAttribute('src'),tiny);assert.equal(player.document.querySelector('.library-detail .library-prose'),null);assert.equal(player.document.querySelector('.library-tools'),null);player.library.dispose();
});

test('card text and photo share a row and the chosen photo side survives editing',async()=>{
 const f=setup(),card=(await f.create({title:'Символ',kind:'entry',audience:'all',blocks:[{type:'text',text:'Опис знака'},{type:'image',src:tiny,size:'medium'},{type:'text',text:'Наступний опис'},{type:'image',src:tiny,size:'small',side:'left'}]})).card;
 const ui=dom(f,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();let pairs=[...ui.document.querySelectorAll('.library-content-pair')];assert.equal(pairs.length,2);assert.equal(pairs[0].dataset.imageSide,'right');assert.equal(pairs[1].dataset.imageSide,'left');assert.equal(pairs[0].querySelector('.library-content-text').textContent,'Опис знака');assert.equal(pairs[0].querySelector('.library-content-media img').getAttribute('src'),tiny);
 namedButton(ui.document.querySelector('.library-detail'),'Редагувати картку').click();await flush();const form=ui.document.querySelector('.library-editor[open] form'),side=form.querySelector('[aria-label="Розташування фото блоку 2"]');select(ui,side,'left');submit(ui,form);await flush();const saved=(await f.call('keeper','/cards/'+card.id)).card;assert.equal(saved.blocks[1].side,'left');assert.equal(saved.blocks[3].side,'left');assert.equal(saved.blocks[0].text,'Опис знака');assert.equal(ui.document.querySelector('.library-content-pair').dataset.imageSide,'left');ui.library.dispose();
 const player=dom(f,'alice');await flush();player.document.querySelector('.library-card').click();await flush();assert.equal(player.document.querySelector('.library-content-pair').dataset.imageSide,'left');assert.equal(player.document.querySelector('.library-content-text').textContent,'Опис знака');player.library.dispose();
 assert.equal((await f.edit(saved,{blocks:[{type:'image',src:tiny,size:'medium',side:'invalid'}]})).status,400);assert.equal((await f.call('keeper','/cards/'+card.id)).card.blocks[1].side,'left');
});

test('centered heading blocks separate text/photo pairs and remain ordered when edited',async()=>{
 const f=setup(),blocks=[{type:'text',text:'Перший опис'},{type:'image',src:tiny,size:'medium'},{type:'heading',text:'Таємниця старого будинку'},{type:'text',text:'Другий опис'},{type:'image',src:tiny,size:'medium',side:'left'}];
 const card=(await f.create({title:'Будинок',kind:'entry',audience:'all',blocks})).card;const ui=dom(f,'keeper');await flush();ui.document.querySelector('.library-card').click();await flush();let article=ui.document.querySelector('.library-detail');assert.deepEqual([...article.children].slice(1,4).map(n=>n.className),['library-content-pair','library-section-heading','library-content-pair']);assert.equal(article.querySelector('.library-section-heading').textContent,'Таємниця старого будинку');assert.equal(article.querySelectorAll('.library-content-pair')[1].querySelector('.library-content-text').textContent,'Другий опис');
 namedButton(article,'Редагувати картку').click();await flush();let form=ui.document.querySelector('.library-editor[open] form');namedButton(form,'+ Додати назву').click();const headingInput=form.querySelector('[aria-label="Назва розділу 6"]');type(ui,headingInput,'<script>Розв’язка</script>');const block=headingInput.closest('.library-edit-block');block.querySelector('[aria-label="Перемістити блок вище"]').click();submit(ui,form);await flush();const saved=(await f.call('keeper','/cards/'+card.id)).card;assert.equal(saved.blocks[4].type,'heading');assert.equal(saved.blocks[4].text,'<script>Розв’язка</script>');assert.equal(saved.blocks[5].type,'image');assert.equal(ui.document.querySelector('.library-detail script'),null);assert.equal(ui.document.querySelectorAll('.library-section-heading')[1].textContent,'<script>Розв’язка</script>');ui.library.dispose();
 const player=dom(f,'alice');await flush();player.document.querySelector('.library-card').click();await flush();assert.equal(player.document.querySelectorAll('.library-section-heading').length,2);assert.equal(player.document.querySelectorAll('.library-content-pair').length,1);assert.equal(player.document.querySelector('.library-detail script'),null);player.library.dispose();
 const access=(await f.call('keeper','/cards/'+saved.id,'PUT',{title:saved.title,revision:saved.revision,audience:'hidden'})).card;assert.deepEqual(access.blocks,saved.blocks);assert.equal((await f.edit(access,{blocks:[{type:'heading',text:' ' }]})).status,400);assert.equal((await f.edit(access,{blocks:[{type:'heading',text:'x'.repeat(201)}]})).status,400);assert.deepEqual((await f.call('keeper','/cards/'+saved.id)).card.blocks,saved.blocks);
});

test('material photos open the fullscreen viewer by mouse or keyboard and revoked access closes it',async()=>{
 const f=setup();let card=(await f.create({title:'Мапа',kind:'entry',audience:'all',blocks:[{type:'image',src:tiny,size:'large'}]})).card;const ui=dom(f,'alice');await flush();ui.document.querySelector('.library-card').click();await flush();const photo=ui.document.querySelector('.library-detail img');assert.equal(photo.getAttribute('role'),'button');
 const geometry=()=>{const viewport=ui.document.querySelector('.material-image-viewport');Object.defineProperty(viewport,'clientWidth',{value:800});Object.defineProperty(viewport,'clientHeight',{value:600});viewport.scrollLeft=viewport.scrollTop=0;viewport.getBoundingClientRect=()=>({left:0,top:0});};
 photo.click();geometry();await flush();let viewer=ui.document.querySelector('.material-image-viewer');assert.equal(viewer.open,true);assert.equal(viewer.querySelector('.material-image-status').textContent,'');assert.equal(viewer.querySelector('img').getAttribute('src'),tiny);viewer.querySelector('[aria-label="Закрити зображення"]').click();assert.equal(ui.document.querySelector('.material-image-viewer'),null);
 photo.dispatchEvent(Object.assign(new ui.window.Event('keydown',{cancelable:true}),{key:'Enter'}));geometry();await flush();assert.ok(ui.document.querySelector('.material-image-viewer'));card=(await f.edit(card,{audience:'hidden'})).card;ui.ticks[0]();await flush();assert.equal(ui.document.querySelector('.material-image-viewer'),null);assert.equal(ui.document.querySelector('.library-detail'),null);ui.library.dispose();
});

test('back and breadcrumb navigation restore the parent list instead of a cached leaf',async()=>{
 const f=setup(),folder=(await f.create({title:'Будинок',audience:'all'})).card;await f.create({title:'Лист',kind:'entry',parent_id:folder.id,audience:'all',body:'Текст'});const ui=dom(f,'alice');await flush();ui.document.querySelector('.library-card').click();await flush();ui.document.querySelector('.library-card').click();await flush();assert.ok(ui.document.querySelector('.library-detail'));namedButton(ui.document.querySelector('.material-library'),'Назад до вкладки').click();assert.equal(ui.document.querySelector('.library-detail'),null);assert.equal(ui.document.querySelector('.library-card-title').textContent,'Лист');namedButton(ui.document.querySelector('.library-crumbs'),'Матеріали гри').click();await flush();ui.document.querySelector('.library-card').click();await flush();assert.equal(ui.document.querySelector('.library-detail'),null);assert.equal(ui.document.querySelector('.library-card-title').textContent,'Лист');ui.library.show();await flush();ui.document.querySelector('.library-card').click();await flush();ui.document.querySelector('.library-card').click();await flush();ui.document.querySelector('.library-browser').close();assert.equal(ui.document.querySelector('.library-detail'),null);assert.equal(ui.document.querySelector('#mount .library-card-title').textContent,'Лист');ui.library.dispose();
});
test('text-only cards save and render without cover or photo blocks and retain their type after access edits',async()=>{
 const f=setup(),ui=dom(f,'keeper');await flush();ui.document.querySelector('[aria-label="Додати матеріал"]').click();await flush();const form=ui.document.querySelector('.library-editor[open] form');select(ui,form.querySelector('[aria-label="Тип матеріалу"]'),'text');assert.equal(form.querySelector('.library-cover-editor input[type=file]').closest('.library-field').hidden,true);assert.equal(form.querySelector('.library-add-photo').hidden,true);type(ui,form.querySelector('[aria-label="Назва матеріалу"]'),'Записка');type(ui,form.querySelector('.library-block-editor textarea'),'Важливий текст');select(ui,form.querySelector('[aria-label="Доступ для гравців"]'),'all');submit(ui,form);await flush();let card=(await f.call('keeper')).cards[0];assert.equal(card.kind,'text');assert.equal(card.excerpt,'Важливий текст');card=(await f.call('keeper','/cards/'+card.id)).card;assert.equal(card.cover_source,'');assert.equal(card.image,'');assert.equal(card.body,'Важливий текст');card=(await f.call('keeper','/cards/'+card.id,'PUT',{title:card.title,revision:card.revision,audience:'selected',targets:['alice']})).card;assert.equal(card.kind,'text');assert.equal((await f.call('bob')).cards.length,0);ui.library.dispose();const player=dom(f,'alice');await flush();player.document.querySelector('.library-card').click();await flush();assert.equal(player.document.querySelector('.library-detail .library-prose').textContent,'Важливий текст');assert.equal(player.document.querySelector('.library-detail img'),null);player.library.dispose();
});

test('a cover caption needs no upload, persists after access edits, and can be edited or cleared',async()=>{
 const f=setup(),ui=dom(f,'keeper');await flush();ui.document.querySelector('[aria-label="Додати матеріал"]').click();await flush();let form=ui.document.querySelector('.library-editor[open] form');select(ui,form.querySelector('[aria-label="Тип матеріалу"]'),'text');type(ui,form.querySelector('[aria-label="Назва матеріалу"]'),'Записка');type(ui,form.querySelector('.library-block-editor textarea'),'Таємний текст');type(ui,form.querySelector('[aria-label="Текст на обкладинці"]'),'Лист\nмістера Нотта');select(ui,form.querySelector('[aria-label="Доступ для гравців"]'),'all');submit(ui,form);await flush();
 let card=(await f.call('keeper')).cards[0];assert.ok(card.cover_thumb);assert.ok(ui.document.querySelector('.library-card img'));card=(await f.call('keeper','/cards/'+card.id)).card;assert.equal(card.cover_source,'');assert.equal(card.crop.caption,'Лист\nмістера Нотта');assert.equal(card.image,'');assert.equal(card.kind,'text');
 card=(await f.call('keeper','/cards/'+card.id,'PUT',{title:card.title,revision:card.revision,audience:'selected',targets:['alice']})).card;assert.equal(card.crop.caption,'Лист\nмістера Нотта');
 ui.document.querySelector('.library-card').click();await flush();namedButton(ui.document.querySelector('.library-detail'),'Редагувати картку').click();await flush();form=ui.document.querySelector('.library-editor[open] form');assert.equal(form.querySelector('[aria-label="Текст на обкладинці"]').value,'Лист\nмістера Нотта');type(ui,form.querySelector('[aria-label="Текст на обкладинці"]'),'');submit(ui,form);await flush();card=(await f.call('keeper','/cards/'+card.id)).card;assert.equal(card.cover_thumb,'');assert.equal(card.crop.caption,undefined);assert.equal(ui.errors.length,0);ui.library.dispose();
 assert.equal((await f.create({kind:'entry',title:'Фото і напис',cover_source:tiny,cover_thumb:tiny,crop:{zoom:1,x:.5,y:.5,caption:'Напис'}})).status,200);
 assert.equal((await f.create({kind:'entry',title:'Завеликий напис',cover_thumb:tiny,crop:{zoom:1,x:.5,y:.5,caption:'а'.repeat(241)}})).status,400);
});
