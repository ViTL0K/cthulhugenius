import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const flush=()=>new Promise(r=>setTimeout(r,10));
test('live localization covers dynamic forms while preserving authored titles, prose and chat',async()=>{
 const {document,window}=parseHTML('<html lang="uk"><body><label id="kind">Тип матеріалу</label><span id="chat">Особистий чат</span><span id="to">Кому:</span><div class="library-card-title">Назва і текст</div><div class="library-prose">Зображення</div><div class="message">Назва</div><input id="draft" value="Текст"><button title="Зберегти">Зберегти</button><span id="number">3. Фото</span></body></html>');
 const ctx=vm.createContext({window,document,MutationObserver:window.MutationObserver});vm.runInContext(readFileSync(new URL('../public/locale.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../public/portal-localization.js',import.meta.url),'utf8'),ctx);
 document.documentElement.lang='en';await flush();assert.equal(document.querySelector('#kind').textContent,'Material type');assert.equal(document.querySelector('#chat').textContent,'Private chat');assert.equal(document.querySelector('#to').textContent,'To:');assert.equal(document.querySelector('#number').textContent,'3. Photo');assert.equal(document.querySelector('.library-card-title').textContent,'Назва і текст');assert.equal(document.querySelector('.library-prose').textContent,'Зображення');assert.equal(document.querySelector('.message').textContent,'Назва');assert.equal(document.querySelector('#draft').value,'Текст');
 const label=document.createElement('span');label.textContent='Зображення карти';document.body.append(label);await flush();assert.equal(label.textContent,'Map image');document.documentElement.lang='ru';await flush();assert.equal(label.textContent,'Изображение карты');document.documentElement.lang='uk';await flush();assert.equal(label.textContent,'Зображення карти');assert.equal(document.querySelector('#number').textContent,'3. Фото');
});
