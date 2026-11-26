import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import worker from '../worker.mjs';
import {setup,game,tiny,origin} from './library-helper.mjs';
const flush=async()=>{for(let n=0;n<10;n++)await new Promise(resolve=>setTimeout(resolve,5));};
function dom(fixture,user){
 const {window,document}=parseHTML('<html><body><section id="mount"></section></body></html>');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value||this.querySelector('option')?.value||'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',Boolean(v));}});
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 const draws=[];window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},fillText(){},drawImage(...args){draws.push(args);}});window.HTMLCanvasElement.prototype.toDataURL=()=>tiny;
 class Image{constructor(){this.naturalWidth=800;this.naturalHeight=1200;}async decode(){}}
 const ticks=[],errors=[];const fakeWindow={};
 const context=vm.createContext({window:fakeWindow,document,Image,URLSearchParams,AbortSignal,console,confirm:()=>true,setInterval:fn=>{ticks.push(fn);return ticks.length;},clearInterval(){},fetch:(url,options={})=>worker.fetch(new Request(origin+url,{...options,headers:{...options.headers,Origin:origin,Cookie:'__Host-poklik-session='+fixture.tokens[user]}}),fixture.env)});
 vm.runInContext(readFileSync(new URL('../public/material-library.js',import.meta.url),'utf8'),context);
 const library=fakeWindow.createRoomMaterialLibrary({mount:document.querySelector('#mount'),onError:e=>errors.push(e)});library.activate({gameId:game,userId:user,role:user==='keeper'?'keeper':'player'});
 return {window,document,library,ticks,errors,draws};
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
 form.querySelector('input').value='Артур Вілмотт';form.querySelector('select').value='entry';form.querySelector('textarea').value='Опис персонажа';
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
