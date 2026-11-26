import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../public/portal-appearance.js',import.meta.url),'utf8');
function screen(storage){
 const {document,window}=parseHTML('<html><body><div id="modalBody"></div></body></html>');let observe;
 vm.runInNewContext(source,{document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},MutationObserver:class{constructor(fn){observe=fn;}observe(){} }});
 function form(){document.querySelector('#modalBody').innerHTML='<form id="appearanceSettings"></form>';observe();return document.querySelector('form');}
 return {document,window,form};
}
test('custom colors persist after reload, follow the palette fields and can be reset',()=>{
 const storage=new Map(),ui=screen(storage),form=ui.form();const fields=[...form.querySelectorAll('input[type=color]')];
 fields[0].value='#faf4df';fields[1].value='#183b2d';fields[2].value='#ff7a1a';form.querySelector('input[type=checkbox]').checked=true;
 form.dispatchEvent(new ui.window.Event('submit',{cancelable:true}));
 assert.equal(ui.document.body.style.getPropertyValue('--bg'),'#faf4df');assert.equal(ui.document.body.style.getPropertyValue('--gold'),'#ff7a1a');assert.equal(ui.document.body.style.getPropertyValue('--ink'),'#f4f1e7');assert.equal(ui.document.body.style.getPropertyValue('--base-ink'),'#101613');
 const next=screen(storage);assert.equal(next.document.body.style.getPropertyValue('--gold'),'#ff7a1a');
 const nextForm=next.form();nextForm.querySelector('input[type=checkbox]').checked=false;nextForm.dispatchEvent(new next.window.Event('submit'));
 assert.equal(storage.has('cth-portal-colors'),false);assert.equal(next.document.body.getAttribute('data-custom-colors'),null);assert.ok(!next.document.body.style.getPropertyValue('--gold'));
});
test('appearance drafts do not change saved colors until submitted and invalid storage is ignored',()=>{
 const storage=new Map([['cth-portal-colors','{"background":"url(evil)","surface":"#000000","accent":"#ffffff"}']]),ui=screen(storage),form=ui.form();
 assert.equal(ui.document.body.getAttribute('data-custom-colors'),null);
 [...form.querySelectorAll('button')].find(b=>b.textContent==='Бірюза').click();assert.equal(form.querySelectorAll('input[type=color]')[2].value,'#36d3bd');assert.equal(ui.document.body.getAttribute('data-custom-colors'),null);
 form.querySelector('input[type=color]').value='#ffffff';form.querySelector('input[type=color]').dispatchEvent(new ui.window.Event('input'));assert.ok(form.querySelector('input[type=checkbox]').checked);
});
