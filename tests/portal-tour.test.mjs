import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../public/portal-tour.js',import.meta.url),'utf8');
function tour(role,storage=new Map()){
 const {window,document}=parseHTML('<html><body><section id="roomView" class="active"><div class="room-controls"></div><div class="library-stage"></div><button data-action="sheet"></button><button data-action="edit-member-sheets"></button><div id="dicePanel"></div><div class="room-chat"></div><aside class="toolbox"></aside></section></body></html>');document.querySelector('#roomView').dataset.tourUser='user';document.querySelector('#roomView').dataset.tourRole=role;
 window.HTMLElement.prototype.getBoundingClientRect=()=>({left:20,top:20,width:200,height:120,bottom:140});const pending=[];const host={innerWidth:1024,innerHeight:768,addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(source,{window:host,document,MutationObserver:class{observe(){}},setTimeout:fn=>{pending.push(fn);return pending.length;},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
 return {document,host,pending,storage};
}
test('first tour has role-specific instructions, stores completion, and supports replay',()=>{
 const ui=tour('keeper');ui.pending.at(-1)();assert.match(ui.document.querySelector('.portal-tour-card').textContent,/Статус під карткою/);
 for(let i=0;i<5;i++)ui.document.querySelector('.portal-tour-actions .primary').click();assert.equal(ui.document.querySelector('.portal-tour'),null);assert.equal(ui.storage.get('cth-tour-99:user:keeper'),'done');
 const again=tour('keeper',ui.storage);assert.equal(again.pending.length,0);again.document.querySelector('.portal-tour-replay').click();assert.ok(again.document.querySelector('.portal-tour'));
 const player=tour('player',ui.storage);player.pending.at(-1)();assert.match(player.document.querySelector('.portal-tour-card').textContent,/ведучий відкрив тобі/);assert.doesNotMatch(player.document.querySelector('.portal-tour-card').textContent,/⚙|редагування/);player.document.querySelector('.portal-tour-actions button').click();assert.equal(ui.storage.get('cth-tour-99:user:player'),'done');
});
