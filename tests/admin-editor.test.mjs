import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createAdminEditor} from '../public/admin-editor.js';
test('cabinet opens existing editors inline and waits for sheet saving before closing',async()=>{
 const {document,window:dom}=parseHTML('<html><body><dialog id="admin-content-editor"><h2 id="admin-editor-title"></h2><button id="admin-editor-close"></button><div id="admin-editor-host"></div></dialog></body></html>');
 const dialog=document.querySelector('dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;let refreshes=0,saves=0,allow=false;
 const window={location:{origin:'https://portal.test'},alert:()=>{throw Error('Unexpected alert');}};
 const editor=createAdminEditor({document,window,openRoom:async game=>'/migration/?workspace=1&room='+game,onClose:()=>refreshes++});
 await editor.open({game:'room-id',tool:'sheets',extra:{prepared:'sheet-id'}});assert.equal(dialog.open,true);
 const frame=document.querySelector('iframe'),url=new URL(frame.src,window.location.origin);assert.equal(url.searchParams.get('room'),'room-id');assert.equal(url.searchParams.get('embed'),'admin');assert.equal(url.searchParams.get('prepared'),'sheet-id');assert.equal(url.searchParams.get('tool'),'sheets');
 frame.contentWindow={adminEmbeddedEditor:{close:async()=>{saves++;return allow;}}};const button=document.querySelector('button');button.click();await new Promise(r=>setTimeout(r,0));assert.equal(saves,1);assert.equal(dialog.open,true);assert.equal(refreshes,0);
 allow=true;dialog.dispatchEvent(new dom.Event('cancel',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(dialog.open,false);assert.equal(refreshes,1);assert.equal(document.querySelector('iframe'),null);
 await editor.open({tool:'appearance'});assert.equal(new URL(document.querySelector('iframe').src,window.location.origin).searchParams.get('room'),null);assert.equal(dialog.open,true);
});
