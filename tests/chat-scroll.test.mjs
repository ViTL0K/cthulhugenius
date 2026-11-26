import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/migration/index.html',import.meta.url),'utf8');
test('opening a room scrolls both chats to latest after visibility and fonts settle',async()=>{
 const text=source.slice(source.indexOf('  function scrollChats(){'),source.indexOf('  function renderPrivateThread(){'));let fontReady;const ready=new Promise(resolve=>fontReady=resolve);const frames=[],publicLog={scrollHeight:900,scrollTop:0},privateLog={scrollHeight:700,scrollTop:0};
 const ctx=vm.createContext({requestAnimationFrame:fn=>frames.push(fn),document:{fonts:{ready}},$:id=>id==='#publicLog'?publicLog:id==='#privateLog'?privateLog:{classList:{contains:()=>true}}});vm.runInContext(text+';scrollChats();',ctx);frames.shift()();assert.equal(publicLog.scrollTop,900);assert.equal(privateLog.scrollTop,700);
 publicLog.scrollHeight=1100;frames.shift()();assert.equal(publicLog.scrollTop,1100);privateLog.scrollHeight=850;fontReady();await ready;await Promise.resolve();assert.equal(privateLog.scrollTop,850);
});
