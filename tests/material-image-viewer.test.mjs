import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../public/material-image-viewer.js',import.meta.url),'utf8');
function screen(fail=false){
 const {window,document}=parseHTML('<html><body></body></html>');let width=800;const events=new Map();
 const fakeWindow={addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{if(events.get(type)===fn)events.delete(type);}};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};window.HTMLElement.prototype.close=function(){if(!this.open)return;this.open=false;this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
 const create=document.createElement.bind(document);document.createElement=tag=>{const node=create(tag);if(tag==='div'){Object.defineProperty(node,'clientWidth',{get:()=>width});Object.defineProperty(node,'clientHeight',{get:()=>600});node.scrollLeft=node.scrollTop=0;node.getBoundingClientRect=()=>({left:0,top:0});}return node;};
 class Image{constructor(){this.naturalWidth=1600;this.naturalHeight=1200;}async decode(){if(fail)throw Error('bad image');}}
 vm.runInNewContext(source,{window:fakeWindow,document,Image});
 const event=(target,name,fields={})=>{const e=Object.assign(new window.Event(name,{cancelable:true}),fields);target.dispatchEvent(e);return e;};
 return {document,window:fakeWindow,events,event,resize:next=>{width=next;events.get('resize')?.();}};
}
test('image viewer supports fit, real-size zoom, wheel anchoring, panning and complete cleanup',async()=>{
 const ui=screen(),viewer=await ui.window.openMaterialImage({src:'data:image/png;base64,fixture',title:'Мапа'});assert.equal(viewer.open,true);assert.equal(viewer.getAttribute('aria-label'),'Зображення: Мапа');
 const byLabel=label=>viewer.querySelector('[aria-label="'+label+'"]'),viewport=viewer.querySelector('.material-image-viewport'),picture=viewer.querySelector('img');assert.equal(viewer.querySelector('output').textContent,'47%');assert.equal(picture.getAttribute('src'),'data:image/png;base64,fixture');
 byLabel('Масштаб 100%').click();assert.equal(viewer.querySelector('output').textContent,'100%');assert.equal(viewport.scrollLeft,400);assert.equal(viewport.scrollTop,300);
 const wheel=ui.event(viewport,'wheel',{deltaY:-100,clientX:200,clientY:150});assert.equal(wheel.defaultPrevented,true);assert.equal(viewer.querySelector('output').textContent,'122%');const left=viewport.scrollLeft,top=viewport.scrollTop;ui.event(viewport,'pointerdown',{button:0,clientX:10,clientY:20,pointerId:1});ui.event(viewport,'pointermove',{clientX:60,clientY:60});assert.equal(viewport.scrollLeft,left-50);assert.equal(viewport.scrollTop,top-40);ui.event(viewport,'pointerup');assert.equal(viewport.classList.contains('dragging'),false);
 const slider=byLabel('Масштаб зображення');slider.value='800';ui.event(slider,'input');assert.equal(byLabel('Збільшити').disabled,true);slider.value='5';ui.event(slider,'input');assert.equal(byLabel('Зменшити').disabled,true);byLabel('Вписати зображення').click();ui.resize(400);assert.equal(viewer.querySelector('output').textContent,'23%');
 ui.event(viewer,'keydown',{key:'Escape'});assert.equal(ui.document.querySelector('.material-image-viewer'),null);assert.equal(ui.events.size,0);assert.equal(picture.getAttribute('src'),'data:image/png;base64,fixture');
});
test('opening another image replaces the previous viewer and failed loads stay closable',async()=>{
 const ui=screen(),first=await ui.window.openMaterialImage({src:'first',title:'Перша'}),second=await ui.window.openMaterialImage({src:'second',title:'Друга'});assert.equal(first.open,false);assert.equal(second.open,true);assert.equal(ui.document.querySelectorAll('.material-image-viewer').length,1);ui.window.closeMaterialImage();assert.equal(ui.document.querySelector('.material-image-viewer'),null);
 const bad=screen(true),viewer=await bad.window.openMaterialImage({src:'bad',title:'Фото'});assert.match(viewer.querySelector('.material-image-status').textContent,/Не вдалося/);assert.equal(viewer.querySelector('[aria-label="Збільшити"]').disabled,true);viewer.querySelector('[aria-label="Закрити зображення"]').click();assert.equal(bad.document.querySelector('.material-image-viewer'),null);
});
