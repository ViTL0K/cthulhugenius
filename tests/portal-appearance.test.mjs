import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../public/portal-appearance.js',import.meta.url),'utf8');
function screen(storage){
 const {document,window}=parseHTML('<html><body><div id="modalBody"></div></body></html>');let observe;
 vm.runInNewContext(source,{document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},MutationObserver:class{constructor(fn){observe=fn;}observe(){} }});
 function form(){document.querySelector('#modalBody').innerHTML='<form id="appearanceSettings"><div id="appearancePreview"></div></form>';observe();return document.querySelector('form');}
 return {document,window,form};
}
test('custom colors persist after reload, follow the palette fields and can be reset',()=>{
 const storage=new Map(),ui=screen(storage),form=ui.form();const fields=[...form.querySelectorAll('input[type=color]')];
 fields[0].value='#faf4df';fields[1].value='#183b2d';fields[2].value='#ff7a1a';form.querySelector('input[type=checkbox]').checked=true;
 form.dispatchEvent(new ui.window.Event('submit',{cancelable:true}));
 assert.equal(ui.document.body.style.getPropertyValue('--bg'),'#faf4df');assert.equal(ui.document.body.style.getPropertyValue('--surface-dark'),'#faf4df');assert.equal(ui.document.body.style.getPropertyValue('--wash-dark'),'#faf4dfdd');assert.equal(ui.document.body.style.getPropertyValue('--gold'),'#ff7a1a');assert.equal(ui.document.body.style.getPropertyValue('--ink'),'#f4f1e7');assert.equal(ui.document.body.style.getPropertyValue('--base-ink'),'#101613');
 const next=screen(storage);assert.equal(next.document.body.style.getPropertyValue('--gold'),'#ff7a1a');
 const nextForm=next.form();nextForm.querySelector('input[type=checkbox]').checked=false;nextForm.dispatchEvent(new next.window.Event('submit'));
 assert.equal(storage.has('cth-portal-colors'),false);assert.equal(next.document.body.getAttribute('data-custom-colors'),null);assert.ok(!next.document.body.style.getPropertyValue('--gold'));
});
test('appearance drafts do not change saved colors until submitted and invalid storage is ignored',()=>{
 const storage=new Map([['cth-portal-colors','{"background":"url(evil)","surface":"#000000","accent":"#ffffff"}']]),ui=screen(storage),form=ui.form();
 assert.equal(ui.document.body.getAttribute('data-custom-colors'),null);
 [...form.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Бірюзова Безодня').click();assert.equal(form.querySelectorAll('input[type=color]')[2].value,'#36D3BD');assert.equal(ui.document.body.getAttribute('data-custom-colors'),null);
 form.querySelector('input[type=color]').value='#ffffff';form.querySelector('input[type=color]').dispatchEvent(new ui.window.Event('input'));assert.ok(form.querySelector('input[type=checkbox]').checked);
});

test('complete 60/30/10 presets fill all fields and refresh both previews',()=>{
 const ui=screen(new Map()),form=ui.form(),presets=[...form.querySelectorAll('.portal-palette-preset')];assert.equal(presets.length,6);
 presets.find(b=>b.getAttribute('aria-label')==='Опівнічний Помаранч').click();assert.deepEqual([...form.querySelectorAll('input[type=color]')].map(i=>i.value),['#141413','#233554','#FF7A1A']);assert.ok(form.querySelector('input[type=checkbox]').checked);assert.equal(form.querySelectorAll('#appearancePreview .mini-room').length,1);for(const zone of ['.mini-header','.mini-sidebar','.mini-material','.mini-tools','.mini-chat'])assert.ok(form.querySelector(zone));assert.equal(form.querySelector('.portal-color-sample').children.length,2);assert.equal(form.querySelector('[aria-pressed=true]').getAttribute('aria-label'),'Опівнічний Помаранч');
 const input=form.querySelector('input[type=color]');input.value='#ffffff';input.dispatchEvent(new ui.window.Event('input'));assert.equal(form.querySelector('[aria-pressed=true]'),null);
});

test('preview retains wallpaper and the saved motion preference survives reload',()=>{
 const storage=new Map(),ui=screen(storage),form=ui.form(),upper=form.querySelector('#appearancePreview');upper.dataset.theme='mythos-runes';form.querySelector('.portal-palette-preset').click();assert.equal(upper.dataset.theme,'mythos-runes');assert.ok(upper.querySelector('.mini-room'));const motion=form.querySelector('[aria-label="Живе переливання фону"]');motion.checked=false;form.dispatchEvent(new ui.window.Event('submit'));assert.equal(ui.document.body.dataset.liveBackground,'off');assert.equal(storage.get('cth-live-background'),'off');assert.equal(screen(storage).document.body.dataset.liveBackground,'off');
});

test('saved palette and wallpaper restore on pages without the room application',()=>{
 const ui=screen(new Map([['cth-palette','cosmic'],['cth-theme','09_walnut_table']]));assert.equal(ui.document.body.dataset.palette,'cosmic');assert.equal(ui.document.body.dataset.theme,'09_walnut_table');
});

test('localized preset labels preserve selection and draft preview in all interface languages',()=>{
 for(const lang of ['uk','ru','en']){
  const {document,window}=parseHTML(`<html lang="${lang}"><body><div id="modalBody"></div></body></html>`);let callback;
  const context={window,document,localStorage:{getItem:()=>null},MutationObserver:class{constructor(fn){callback=fn;}observe(){}}};
  vm.runInNewContext(readFileSync(new URL('../public/locale.js',import.meta.url),'utf8'),context);
  vm.runInNewContext(source,context);
  document.querySelector('#modalBody').innerHTML='<form id="appearanceSettings"><div id="appearancePreview"></div></form>';callback();
  const preset=document.querySelector('.portal-palette-preset');
  assert.equal(preset.textContent.includes(window.cthLocale.portalText('Опівнічний Помаранч',lang)),true);
  preset.click();assert.equal(preset.getAttribute('aria-pressed'),'true');
  assert.equal(document.querySelectorAll('input[type=color]')[2].value,'#FF7A1A');
  assert.equal(document.querySelector('.mini-stage b').textContent,window.cthLocale.portalText('Матеріали гри',lang));
  assert.equal(window.cthLocale.portalText('Вигляд порталу','uk'),'Вигляд порталу');
  assert.equal(window.cthLocale.portalText('Кобальтова безодня','en'),'Cobalt Abyss');
 }
});
