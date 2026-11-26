import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('presence is renewed while remaining in the same room and is retried after a network failure',async()=>{
  const source=readFileSync(new URL('../public/migration/index.html',import.meta.url),'utf8');
  const start=source.indexOf('  let lastPresenceActive=');
  const end=source.indexOf('  setInterval(()=>updatePresence()',start);
  let time=100000,active=true,fail=false,calls=[];
  const channel={track:async payload=>{calls.push(payload);return fail?'error':'ok';}};
  const state={roomSub:channel,userId:'investigator',role:'keeper'};
  class TestDate extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
  const context=vm.createContext({state,Date:TestDate,$:()=>({classList:{contains:()=>active}})});
  vm.runInContext(source.slice(start,end),context);
  const update=()=>vm.runInContext('updatePresence()',context);
  await update();assert.equal(calls.length,1);assert.equal(calls[0].active,true);
  time+=1000;await update();assert.equal(calls.length,1);
  time+=30000;await update();assert.equal(calls.length,2);
  time+=30000;await update();assert.equal(calls.length,3);
  active=false;await update();assert.equal(calls.at(-1).active,false);
  fail=true;time+=30000;await update();const failed=calls.length;
  fail=false;await update();assert.equal(calls.length,failed+1);
  state.roomSub={track:async payload=>{calls.push(payload);return 'ok';}};
  await update();assert.equal(calls.at(-1).active,false);assert.equal(calls.length,failed+2);
});
