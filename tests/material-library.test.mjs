import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import {setup,game,otherGame,tiny,origin} from './library-helper.mjs';
test('nested materials enforce every ancestor on list, direct reads, and retracted access',async()=>{
 const {call,create,edit}=setup();
 let folder=(await create({title:'Персонажі',kind:'category',audience:'hidden'})).card;
 assert.ok(folder?.id);
 let child=(await create({title:'Артур',kind:'entry',parent_id:folder.id,audience:'all',body:'Таємний опис',image:tiny})).card;
 assert.equal((await call('keeper','?parent='+folder.id)).cards[0].title,'Артур');
 assert.equal((await call('alice')).cards.length,0);
 assert.equal((await call('alice','/cards/'+child.id)).status,404);
 assert.equal((await call('alice','?parent='+folder.id)).status,404);
 folder=(await edit(folder,{audience:'selected',targets:['alice']})).card;
 assert.equal((await call('alice')).cards[0].title,'Персонажі');
 assert.equal((await call('alice','/cards/'+child.id)).card.body,'Таємний опис');
 assert.equal((await call('bob','/cards/'+child.id)).status,404);
 folder=(await edit(folder,{audience:'all'})).card;
 child=(await edit(child,{audience:'selected',targets:['alice']})).card;
 assert.equal((await call('bob','?parent='+folder.id)).cards.length,0);
 assert.equal((await call('alice','/cards/'+child.id)).card.cover_source,undefined);
 const version=(await call('alice','?parent='+folder.id)).version;
 child=(await edit(child,{audience:'hidden'})).card;
 const changed=await call('alice','?parent='+folder.id+'&known='+encodeURIComponent(version));
 assert.equal(changed.cards.length,0);assert.equal((await call('alice','/cards/'+child.id)).status,404);
 assert.equal((await call('outside')).status,403);
});
test('only the keeper can create, edit, reorder or remove; stale edits are rejected',async()=>{
 const {call,create,edit,DB}=setup();
 const a=(await create({title:'Локації',audience:'all'})).card,b=(await create({title:'Персонажі',audience:'hidden'})).card;
 assert.equal((await call('alice','','POST',{title:'Підміна',audience:'all'})).status,403);
 assert.equal((await call('alice','/cards/'+a.id,'PUT',{...a,title:'Підміна'})).status,403);
 assert.equal((await call('alice','/cards/'+a.id,'DELETE',{revision:a.revision})).status,403);
 assert.equal((await call('alice','/reorder','POST',{ids:[b.id,a.id]})).status,403);
 assert.equal((await call('keeper','/reorder','POST',{id:b.id,parent_id:null,direction:-1})).status,200);
 assert.equal((await call('keeper')).cards[0].id,b.id);
 const latest=(await call('keeper','/cards/'+a.id)).card;
 const updated=await edit(latest,{title:'Нові локації'});assert.equal(updated.status,200);
 assert.equal((await edit(latest,{title:'Застарілий запис'})).status,409);
 assert.equal((await call('keeper','/cards/'+a.id,'DELETE',{revision:latest.revision})).status,409);
 const child=(await create({title:'Санаторій',kind:'entry',parent_id:a.id,audience:'all'})).card;
 const grand=(await create({title:'Підказка',parent_id:b.id,audience:'hidden'})).card;
 assert.equal((await call('keeper','/cards/'+a.id,'DELETE',{revision:updated.card.revision})).status,200);
 assert.equal((await call('keeper','/cards/'+child.id)).status,404);
 assert.equal((await call('keeper','/cards/'+grand.id)).status,200);
 assert.equal(DB.db.prepare('SELECT COUNT(*) AS n FROM site_users').get().n,4);
});
test('validation prevents cross-room parents and targets, invalid images and children under entries',async()=>{
 const {call,create}=setup();
 const elsewhere=(await create({title:'Інша кімната'},otherGame)).card;
 assert.equal((await create({title:'Чужа вкладка',parent_id:elsewhere.id})).status,404);
 assert.equal((await create({title:'Доступ',audience:'selected',targets:[]})).status,400);
 assert.equal((await create({title:'Доступ',audience:'selected',targets:['outside']})).status,400);
 assert.equal((await create({title:'Фото',image:'https://example.com/photo.png'})).status,400);
 assert.equal((await create({title:'Кадрування',crop:{zoom:0,x:4,y:0}})).status,400);
 const leaf=(await create({title:'Кінцева картка',kind:'entry'})).card;
 assert.equal((await create({title:'Дочірня',parent_id:leaf.id})).status,404);
 const card=await create({title:'Фото',kind:'entry',cover_source:tiny,cover_thumb:tiny,crop:{zoom:2,x:.2,y:.8},image:tiny,audience:'all'});
 assert.equal(card.status,200);assert.equal(card.card.crop.zoom,2);
 assert.equal((await call('alice','/cards/'+card.card.id)).card.image,tiny);
});
test('legacy import is non-destructive, idempotent, and protects its PDFs when access is revoked',async()=>{
 const {DB,call,edit,env,tokens}=setup();await call('keeper');
 const pdf='data:application/pdf;base64,'+Buffer.from('%PDF-1.4 legacy file').toString('base64');
 DB.db.prepare("INSERT INTO migration_records(table_name,record_id,game_id,data) VALUES('hidden_materials','old-pdf',?,?)").run(game,JSON.stringify({title:'Старий лист',attachment_type:'application/pdf',attachment_data:pdf,audience:'all',revealed_at:new Date().toISOString()}));
 const imported=await call('keeper','/import-legacy','POST',{});assert.equal(imported.status,200,JSON.stringify(imported));assert.equal(imported.imported,1);
 let root=(await call('keeper','/cards/'+imported.root)).card;assert.equal(root.audience,'hidden');
 const cards=await call('keeper','?parent='+root.id);const card=(await call('keeper','/cards/'+cards.cards[0].id)).card;
 assert.ok(card.file_path);assert.equal((await call('alice','/cards/'+card.id)).status,404);
 async function getFile(){return worker.fetch(new Request(origin+card.file_url,{headers:{Cookie:'__Host-poklik-session='+tokens.alice}}),env);}
 assert.equal((await getFile()).status,404);
 root=(await edit(root,{title:'Старі матеріали',audience:'all'})).card;
 const download=await getFile();assert.equal(download.status,200);assert.equal(await download.text(),'%PDF-1.4 legacy file');
 root=(await edit(root,{audience:'hidden'})).card;assert.equal((await getFile()).status,404);
 assert.equal((await call('keeper','/import-legacy','POST',{})).alreadyImported,true);
 assert.equal(DB.db.prepare("SELECT COUNT(*) AS n FROM migration_records WHERE table_name='hidden_materials'").get().n,1);
});

test('categories only expose readable sibling materials and support custom labels',async()=>{
 const f=setup();await f.create({title:'Таємне',kind:'entry',category:'Секрети',audience:'hidden'});await f.create({title:'Лист',kind:'entry',category:'Документи',audience:'selected',targets:['alice']});await f.create({title:'Порт',category:'Локації',audience:'all'});
 const alice=await f.call('alice');assert.deepEqual(alice.categories,['Документи','Локації']);assert.deepEqual((await f.call('bob')).categories,['Локації']);
 const filtered=await f.call('alice','?category='+encodeURIComponent('Документи'));assert.deepEqual(filtered.cards.map(c=>c.title),['Лист']);assert.equal((await f.call('bob','?category='+encodeURIComponent('Секрети'))).cards.length,0);
});
test('ordered content blocks persist with photo sizes and survive access-only edits',async()=>{
 const f=setup(),blocks=[{type:'text',text:'Перший опис'},{type:'image',src:tiny,size:'small'},{type:'text',text:'Другий опис'},{type:'image',src:tiny,size:'large'}];
 let card=(await f.create({title:'Бібліотека',kind:'entry',category:'Локації',audience:'all',blocks})).card;assert.deepEqual(card.blocks,blocks);
 card=(await f.call('keeper','/cards/'+card.id,'PUT',{title:card.title,revision:card.revision,audience:'selected',targets:['alice']})).card;
 assert.deepEqual(card.blocks,blocks);assert.equal(card.category,'Локації');assert.deepEqual((await f.call('alice','/cards/'+card.id)).card.blocks,blocks);assert.equal((await f.call('bob','/cards/'+card.id)).status,404);
 assert.equal((await f.call('alice','/cards/'+card.id,'PUT',{...card,blocks:[]})).status,403);
 const stale=await f.edit({...card,revision:card.revision-1},{blocks:[]});assert.equal(stale.status,409);assert.deepEqual((await f.call('keeper','/cards/'+card.id)).card.blocks,blocks);
 assert.equal((await f.edit(card,{blocks:[{type:'image',src:'https://bad.example/image',size:'small'}]})).status,400);assert.deepEqual((await f.call('keeper','/cards/'+card.id)).card.blocks,blocks);
});
test('drag movement changes the sibling order, rejects stale edits and enforces keeper access',async()=>{
 const f=setup(),a=(await f.create({title:'A',audience:'all'})).card,b=(await f.create({title:'B',audience:'all'})).card,c=(await f.create({title:'C',audience:'all'})).card;
 const payload={parent_id:null,id:c.id,revision:c.revision,before_id:a.id,anchor_revision:a.revision};assert.equal((await f.call('alice','/move','POST',payload)).status,403);assert.equal((await f.call('keeper','/move','POST',payload)).status,200);
 assert.deepEqual((await f.call('keeper')).cards.map(c=>c.title),['C','A','B']);assert.equal((await f.call('keeper','/move','POST',payload)).status,409);
 const folder=(await f.create({title:'Вкладка'})).card,child=(await f.create({title:'Дочірня',parent_id:folder.id})).card;assert.equal((await f.call('keeper','/move','POST',{id:b.id,revision:2,before_id:child.id,anchor_revision:child.revision})).status,400);
});

test('named image materials persist their type, enforce access and remain leaf cards',async()=>{
 const f=setup();let folder=(await f.create({title:'Локація',audience:'all'})).card;
 const input={kind:'image',title:'Мапа будинку',parent_id:folder.id,image:tiny,cover_source:tiny,cover_thumb:tiny,body:'',blocks:[],audience:'selected',targets:['alice']};
 let result=await f.create(input);assert.equal(result.status,200,JSON.stringify(result));let card=result.card;assert.equal(card.kind,'image');assert.deepEqual(card.blocks,[]);assert.equal(card.body,'');
 assert.equal((await f.call('alice','?parent='+folder.id)).cards[0].kind,'image');assert.equal((await f.call('bob','/cards/'+card.id)).status,404);const visible=(await f.call('alice','/cards/'+card.id)).card;assert.equal(visible.image,tiny);assert.equal(visible.cover_source,undefined);assert.equal(visible.material_type,undefined);
 assert.equal((await f.create({title:'Зайва підкартка',parent_id:card.id})).status,404);
 card=(await f.call('keeper','/cards/'+card.id,'PUT',{title:'Мапа',revision:card.revision,audience:'all'})).card;assert.equal(card.kind,'image');assert.equal((await f.call('bob','/cards/'+card.id)).card.image,tiny);
 assert.equal((await f.edit({...card,revision:card.revision-1},{kind:'entry'})).status,409);assert.equal((await f.call('keeper','/cards/'+card.id)).card.kind,'image');
 assert.equal((await f.create({...input,title:'Без картинки',image:''})).status,400);assert.equal((await f.create({...input,title:'З текстом',body:'Зайвий текст'})).status,400);assert.equal((await f.create({...input,title:'З блоками',blocks:[{type:'text',text:'Прихований опис'}]})).status,400);
 folder=(await f.edit(folder,{audience:'hidden'})).card;assert.equal((await f.call('alice','/cards/'+card.id)).status,404);
 card=(await f.edit(card,{kind:'entry',body:'Тепер повний матеріал'})).card;assert.equal(card.kind,'entry');assert.equal(f.DB.db.prepare('SELECT COUNT(*) AS n FROM room_material_types').get().n,0);
 const another=(await f.create({...input,title:'Інша мапа'})).card;assert.equal(another.kind,'image');await f.call('keeper','/cards/'+folder.id,'DELETE',{revision:folder.revision});assert.equal(f.DB.db.prepare('SELECT COUNT(*) AS n FROM room_material_types').get().n,0);
});
