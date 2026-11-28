const roots=new WeakMap();
const json=data=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function ensureMaterialLibrary(db){
 if(!roots.has(db))roots.set(db,db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS room_material_cards(
    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES room_material_cards(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('category','entry')),title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',
    cover_source TEXT NOT NULL DEFAULT '',cover_thumb TEXT NOT NULL DEFAULT '',crop TEXT NOT NULL DEFAULT '{}',
    image TEXT NOT NULL DEFAULT '',file_path TEXT NOT NULL DEFAULT '',file_type TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL CHECK(audience IN ('hidden','all','selected')),targets TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,legacy_key TEXT,
    created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    UNIQUE(game_id,legacy_key))`),
  db.prepare('CREATE TABLE IF NOT EXISTS room_material_meta(card_id TEXT PRIMARY KEY REFERENCES room_material_cards(id) ON DELETE CASCADE,category TEXT NOT NULL DEFAULT \'\')'),
  db.prepare("CREATE TABLE IF NOT EXISTS room_material_text_cards(card_id TEXT PRIMARY KEY REFERENCES room_material_cards(id) ON DELETE CASCADE)"),
  db.prepare("CREATE TABLE IF NOT EXISTS room_material_types(card_id TEXT PRIMARY KEY REFERENCES room_material_cards(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind='image'))"),
  db.prepare('CREATE TABLE IF NOT EXISTS room_material_blocks(card_id TEXT NOT NULL REFERENCES room_material_cards(id) ON DELETE CASCADE,position INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(card_id,position))'),
  db.prepare('CREATE INDEX IF NOT EXISTS room_material_parent ON room_material_cards(game_id,parent_id,sort_order)'),
  db.prepare('CREATE INDEX IF NOT EXISTS room_material_file ON room_material_cards(game_id,file_path)'),
  db.prepare('CREATE TABLE IF NOT EXISTS room_material_versions(game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0)')
 ]).catch(e=>{roots.delete(db);throw e;}));return roots.get(db);
}
const bump=(db,game)=>db.prepare('INSERT INTO room_material_versions(game_id,revision) VALUES(?,1) ON CONFLICT(game_id) DO UPDATE SET revision=revision+1').bind(game);
async function ancestry(db,game){const {results}=await db.prepare('SELECT id,parent_id,kind,title,audience,targets FROM room_material_cards WHERE game_id=?').bind(game).all();return new Map(results.map(r=>[r.id,r]));}
export function mayReadMaterial(map,card,userId,isKeeper=false){
 if(isKeeper)return true;const seen=new Set();let current=card;
 while(current){if(seen.has(current.id)||seen.size>12)return false;seen.add(current.id);
  let targets=[];try{targets=JSON.parse(current.targets||'[]');}catch{return false;}
  if(current.audience!=='all'&&!(current.audience==='selected'&&targets.includes(userId)))return false;
  if(!current.parent_id)return true;current=map.get(current.parent_id);if(!current)return false;
 }return false;
}
function clean(row,isKeeper){if(!row)return null;const out={...row};if(out.kind==='entry'&&['image','text'].includes(out.material_type))out.kind=out.material_type;delete out.material_type;out.targets=JSON.parse(row.targets||'[]');out.crop={zoom:1,x:.5,y:.5,...JSON.parse(row.crop||'{}')};if(row.file_path)out.file_url='/api/migration/files?path='+encodeURIComponent(row.file_path);if(!isKeeper){delete out.cover_source;delete out.crop;delete out.targets;delete out.created_by;delete out.legacy_key;delete out.file_path;}return out;}
function image(value,max,label){if(value===undefined)return undefined;if(value==='')return '';if(typeof value!=='string'||value.length>max||!/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value))fail('Перевір зображення: '+label+'.');return value;}
async function validate(db,game,data,current,map){
 const title=typeof data.title==='string'?data.title.trim():'';if(!title||title.length>100)fail('Назва має містити від 1 до 100 символів.');
 const materialKind=data.kind||current?.material_type||current?.kind||'category';if(!['category','entry','image','text'].includes(materialKind))fail('Обери тип матеріалу.');const kind=['image','text'].includes(materialKind)?'entry':materialKind;
 const parent=current?.parent_id??data.parent_id??null;
 if(current&&data.parent_id!==undefined&&data.parent_id!==current.parent_id)fail('Не можна змінити батьківську вкладку цим запитом.');
 if(parent){let p=map.get(parent),depth=1;if(!p||p.kind!=='category')fail('Батьківську вкладку не знайдено.',404);while(p?.parent_id){p=map.get(p.parent_id);if(!p||++depth>=12)fail('Досягнуто максимальної вкладеності.');}}
 if(current?.kind==='category'&&kind==='entry'&&[...map.values()].some(r=>r.parent_id===current.id))fail('Вкладка з дочірніми картками має залишатися категорією.');
 const body=data.body??current?.body??'';if(typeof body!=='string'||body.length>30000)fail('Опис завеликий: максимум 30 000 символів.');
 const audience=data.audience??current?.audience??'hidden';if(!['hidden','all','selected'].includes(audience))fail('Перевір налаштування доступу.');
 const targets=Array.isArray(data.targets)?[...new Set(data.targets)]:current?JSON.parse(current.targets):[];
 if(targets.length>150||targets.some(t=>typeof t!=='string'))fail('Некоректний список гравців.');
 const members=(await db.prepare("SELECT user_id FROM game_members WHERE game_id=? AND role='player'").bind(game).all()).results;
 if(audience==='selected'&&(!targets.length||targets.some(t=>!members.some(m=>m.user_id===t))))fail('Обери хоча б одного гравця кімнати.');
 const crop=data.crop??(current?JSON.parse(current.crop):{zoom:1,x:.5,y:.5});
 if(!crop||!Number.isFinite(crop.zoom)||crop.zoom<1||crop.zoom>3||!Number.isFinite(crop.x)||crop.x<0||crop.x>1||!Number.isFinite(crop.y)||crop.y<0||crop.y>1)fail('Перевір кадрування обкладинки.');
 const caption=data.crop?.caption??(current?JSON.parse(current.crop||'{}').caption:'')??'';if(typeof caption!=='string'||caption.trim().length>240)fail('Текст на обкладинці має містити до 240 символів.');const coverCrop={...crop};delete coverCrop.caption;if(caption.trim())coverCrop.caption=caption.trim();
 const source=image(data.cover_source,300000,'обкладинка')??current?.cover_source??'';
 const thumb=image(data.cover_thumb,110000,'мініатюра')??current?.cover_thumb??'';
 if(Boolean(source)!==Boolean(thumb)&&!(caption.trim()&&!source&&thumb))fail('Підготуй обкладинку та її кадрування.');
 const detailImage=image(data.image,950000,'картинка під описом')??current?.image??'';
 if(materialKind==='image'){if(!detailImage||!source||!thumb)fail('Додай зображення до картки.');if(body.trim()||(data.blocks??current?.blocks??[]).length||(data.file_path??current?.file_path))fail('Картинка з назвою не містить текстових блоків чи вкладених файлів.');}
 if(materialKind==='text'&&(!body.trim()||source||thumb&&!caption.trim()||detailImage||(data.file_path??current?.file_path)||(data.blocks??current?.blocks??[]).some(b=>b?.type==='image')))fail('Текстова картка повинна містити текст без зображень.');
 const path=data.file_path??current?.file_path??'';let fileType='';
 if(path){if(typeof path!=='string'||!path.startsWith(game+'/'))fail('Файл іншої кімнати недоступний.',403);const file=await db.prepare("SELECT data FROM migration_records WHERE table_name='files' AND record_id=? AND game_id=?").bind(path,game).first();if(!file)fail('Файл не знайдено.',404);fileType=JSON.parse(file.data).type;}
 return {title,kind,parent_id:parent,body,cover_source:source,cover_thumb:thumb,crop:JSON.stringify(coverCrop),image:detailImage,file_path:path,file_type:fileType,audience,targets:JSON.stringify(audience==='selected'?targets:[])};
}
const fields=['kind','title','body','cover_source','cover_thumb','crop','image','file_path','file_type','audience','targets'];
async function getCard(db,game,id){const row=await db.prepare("SELECT c.*,COALESCE(m.category,'') AS category,COALESCE((SELECT kind FROM room_material_types WHERE card_id=c.id),(SELECT 'text' FROM room_material_text_cards WHERE card_id=c.id)) AS material_type FROM room_material_cards c LEFT JOIN room_material_meta m ON m.card_id=c.id WHERE c.game_id=? AND c.id=?").bind(game,id).first();if(row){const rows=(await db.prepare('SELECT data FROM room_material_blocks WHERE card_id=? ORDER BY position').bind(id).all()).results;row.blocks=rows.map(r=>JSON.parse(r.data));}return row;}
function contentChanges(db,id,revision,data){
 const statements=[],guard='EXISTS(SELECT 1 FROM room_material_cards WHERE id=? AND revision=?)';
 // Persist the image subtype without rebuilding the existing category/entry table.
 if(data.kind==='text')statements.push(db.prepare('INSERT INTO room_material_text_cards(card_id) SELECT ? WHERE '+guard+' ON CONFLICT(card_id) DO NOTHING').bind(id,id,revision));
 else if(data.kind!==undefined)statements.push(db.prepare('DELETE FROM room_material_text_cards WHERE card_id=? AND '+guard).bind(id,id,revision));
 if(data.kind==='image')statements.push(db.prepare("INSERT INTO room_material_types(card_id,kind) SELECT ?,'image' WHERE "+guard+" ON CONFLICT(card_id) DO UPDATE SET kind='image'").bind(id,id,revision));
 else if(data.kind!==undefined)statements.push(db.prepare('DELETE FROM room_material_types WHERE card_id=? AND '+guard).bind(id,id,revision));
 if(data.category!==undefined){if(typeof data.category!=='string'||data.category.trim().length>60)fail('Категорія має містити до 60 символів.');statements.push(db.prepare('INSERT INTO room_material_meta(card_id,category) SELECT ?,? WHERE '+guard+' ON CONFLICT(card_id) DO UPDATE SET category=excluded.category').bind(id,data.category.trim(),id,revision));}
 if(data.blocks!==undefined){if(!Array.isArray(data.blocks)||data.blocks.length>200||JSON.stringify(data.blocks).length>16000000)fail('Вміст завеликий. Розділи його на кілька карток.');
 const blocks=data.blocks.map(b=>{if(!b||!['text','image','heading'].includes(b.type))fail('Невідомий тип блоку.');if(b.type==='heading'){if(typeof b.text!=='string'||!b.text.trim()||b.text.trim().length>200)fail('Назва розділу має містити від 1 до 200 символів.');return {type:'heading',text:b.text.trim()};}if(b.type==='text'){if(typeof b.text!=='string'||b.text.length>30000)fail('Текст блоку завеликий.');return {type:'text',text:b.text};}if(!['small','medium','large'].includes(b.size))fail('Перевір розмір фото.');const src=image(b.src,950000,'фото блоку');if(!src)fail('Додай фото до блоку.');if(b.side!==undefined&&!['left','right'].includes(b.side))fail('Обери розташування фото: зліва або справа.');return {type:'image',src,size:b.size,...(b.side?{side:b.side}:{})};});
 statements.push(db.prepare('DELETE FROM room_material_blocks WHERE card_id=? AND '+guard).bind(id,id,revision));for(const [i,b]of blocks.entries())statements.push(db.prepare('INSERT INTO room_material_blocks(card_id,position,data) SELECT ?,?,? WHERE '+guard).bind(id,i,JSON.stringify(b),id,revision));
 }return statements;
}
export async function libraryFileAccess(db,game,path,userId){
 await ensureMaterialLibrary(db);const rows=(await db.prepare('SELECT id,parent_id,audience,targets FROM room_material_cards WHERE game_id=? AND file_path=?').bind(game,path).all()).results;
 if(!rows.length)return null;const map=await ancestry(db,game);return rows.some(r=>mayReadMaterial(map,r,userId));
}
export async function handleMaterialLibrary(request,ctx,url){
 const match=/^\/api\/migration\/library\/([a-f0-9-]{36})(?:\/(.*))?$/.exec(url.pathname);if(!match)fail('Сторінку не знайдено.',404);
 const game=match[1],tail=match[2]||'',member=ctx.members.find(m=>m.game_id===game);if(!member)fail('Кімната недоступна.',403);
 const db=ctx.db,keeper=member.role==='keeper';await ensureMaterialLibrary(db);
 if(request.method!=='GET'&&!keeper)fail('Матеріалами керує ведучий кімнати.',403);
 if(request.method==='GET'&&!tail&&url.searchParams.has('known')){
  const rev=await db.prepare('SELECT revision FROM room_material_versions WHERE game_id=?').bind(game).first();const version=(rev?.revision||0)+':'+member.role;
  if(url.searchParams.get('known')===version){
    let id=url.searchParams.get('parent'),depth=0;
    while(id){const row=await db.prepare('SELECT id,parent_id,kind,audience,targets FROM room_material_cards WHERE game_id=? AND id=?').bind(game,id).first();
      if(!row||depth===0&&row.kind!=='category'||++depth>12)fail('Вкладка недоступна.',404);
      if(!keeper&&row.audience!=='all'&&!(row.audience==='selected'&&JSON.parse(row.targets).includes(ctx.user.id)))fail('Вкладка недоступна.',404);
      id=row.parent_id;
    }
    return json({unchanged:true,version});
  }
 }
 const map=await ancestry(db,game);
 if(request.method==='GET'&&!tail){
  const parent=url.searchParams.get('parent')||null;const parentRow=parent?await getCard(db,game,parent):null;
  if(parent&&(!parentRow||parentRow.kind!=='category'||!mayReadMaterial(map,parentRow,ctx.user.id,keeper)))fail('Вкладка недоступна.',404);
  const rev=await db.prepare('SELECT revision FROM room_material_versions WHERE game_id=?').bind(game).first();const version=(rev?.revision||0)+':'+member.role;
  if(url.searchParams.get('known')===version)return json({unchanged:true,version});
  const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0));
  let clauses=keeper?'':" AND (audience='all' OR (audience='selected' AND EXISTS(SELECT 1 FROM json_each(targets) WHERE value=?)))";
  const category=url.searchParams.get('category');const categoryRows=(await db.prepare("SELECT DISTINCT COALESCE((SELECT category FROM room_material_meta WHERE card_id=room_material_cards.id),'') AS category FROM room_material_cards WHERE game_id=? AND parent_id IS ?"+clauses).bind(...(keeper?[game,parent]:[game,parent,ctx.user.id])).all()).results;
  if(category!==null)clauses+=" AND COALESCE((SELECT category FROM room_material_meta WHERE card_id=room_material_cards.id),'')=?";
  const sql="SELECT id,parent_id,kind,title,cover_thumb,audience,targets,sort_order,revision,updated_at,COALESCE((SELECT kind FROM room_material_types WHERE card_id=room_material_cards.id),(SELECT 'text' FROM room_material_text_cards WHERE card_id=room_material_cards.id)) AS material_type,CASE WHEN EXISTS(SELECT 1 FROM room_material_text_cards WHERE card_id=room_material_cards.id) THEN substr(body,1,280) ELSE '' END AS excerpt,COALESCE((SELECT category FROM room_material_meta WHERE card_id=room_material_cards.id),'') AS category FROM room_material_cards WHERE game_id=? AND parent_id IS ?"+clauses+' ORDER BY sort_order,id LIMIT 49 OFFSET ?';
  const params=[game,parent,...(keeper?[]:[ctx.user.id]),...(category===null?[]:[category]),page*48];const {results}=await db.prepare(sql).bind(...params).all();
  const crumbs=[];let p=parentRow;while(p){crumbs.unshift({id:p.id,title:p.title});p=p.parent_id?map.get(p.parent_id):null;}
  const players=keeper?(await db.prepare("SELECT user_id,display_name FROM game_members WHERE game_id=? AND role='player' ORDER BY joined_at").bind(game).all()).results:[];
  return json({version,canEdit:keeper,parent:clean(parentRow,keeper),crumbs,cards:results.slice(0,48).map(r=>clean(r,keeper)),page,hasMore:results.length>48,categories:categoryRows.map(r=>r.category).sort(),players,legacyAvailable:keeper&&map.size===0});
 }
 if(request.method==='POST'&&tail==='move'){
  const data=await request.json(),parent=data.parent_id||null;const sorted=(await db.prepare('SELECT id,revision,sort_order FROM room_material_cards WHERE game_id=? AND parent_id IS ? ORDER BY sort_order,id').bind(game,parent).all()).results;
  const moving=sorted.find(r=>r.id===data.id),anchor=data.before_id?sorted.find(r=>r.id===data.before_id):null;
  if(!moving||data.before_id&&!anchor||data.id===data.before_id)fail('Некоректне переміщення.');if(moving.revision!==data.revision||anchor&&anchor.revision!==data.anchor_revision)fail('Порядок змінився. Онови вкладку.',409);
  const reordered=sorted.filter(r=>r.id!==moving.id);reordered.splice(anchor?reordered.findIndex(r=>r.id===anchor.id):reordered.length,0,moving);
  const stamp=new Date().toISOString(),updates=[];for(const [i,row]of reordered.entries())if(row.id!==moving.id)updates.push(db.prepare('UPDATE room_material_cards SET sort_order=?,revision=revision+1,updated_at=? WHERE id=? AND game_id=? AND EXISTS(SELECT 1 FROM room_material_cards WHERE id=? AND revision=?)').bind(i*10,stamp,row.id,game,moving.id,data.revision));
  updates.push(db.prepare('UPDATE room_material_cards SET sort_order=?,revision=revision+1,updated_at=? WHERE id=? AND game_id=? AND revision=?').bind(reordered.findIndex(r=>r.id===moving.id)*10,stamp,moving.id,game,data.revision));const results=await db.batch([...updates,bump(db,game)]);if(!results[updates.length-1].meta.changes)fail('Порядок змінився. Онови вкладку.',409);return json({ok:true});
 }
 if(request.method==='POST'&&tail==='reorder'){
  const data=await request.json();const parent=data.parent_id||null;let ids=data.ids;
  if(data.id){const sorted=(await db.prepare('SELECT id,sort_order FROM room_material_cards WHERE game_id=? AND parent_id IS ? ORDER BY sort_order,id').bind(game,parent).all()).results;const index=sorted.findIndex(r=>r.id===data.id);if(index<0||![-1,1].includes(data.direction))fail('Некоректне переміщення.');const next=index+data.direction;if(next<0||next>=sorted.length)return json({ok:true});
    const a=sorted[index],b=sorted[next],stamp=new Date().toISOString();
    if(a.sort_order!==b.sort_order){await db.batch([db.prepare('UPDATE room_material_cards SET sort_order=?,revision=revision+1,updated_at=? WHERE id=? AND game_id=?').bind(b.sort_order,stamp,a.id,game),db.prepare('UPDATE room_material_cards SET sort_order=?,revision=revision+1,updated_at=? WHERE id=? AND game_id=?').bind(a.sort_order,stamp,b.id,game),bump(db,game)]);return json({ok:true});}
    [sorted[index],sorted[next]]=[sorted[next],sorted[index]];ids=sorted.map(r=>r.id);
  }
  if(!Array.isArray(ids)||ids.length>10000||new Set(ids).size!==ids.length)fail('Некоректний порядок карток.');
  const current=[...map.values()].filter(r=>r.parent_id===parent);
  if(current.length!==ids.length||ids.some(id=>!current.some(r=>r.id===id)))fail('Список змінився. Онови вкладку перед сортуванням.',409);
  const stamp=new Date().toISOString();await db.batch([...ids.map((id,i)=>db.prepare('UPDATE room_material_cards SET sort_order=?,revision=revision+1,updated_at=? WHERE id=? AND game_id=?').bind(i*10,stamp,id,game)),bump(db,game)]);return json({ok:true});
 }
 if(request.method==='POST'&&tail==='import-legacy')return importLegacy(db,game,ctx.user.id,map);
 const cardMatch=/^cards\/([a-f0-9-]{36})$/.exec(tail);
 if(request.method==='GET'&&cardMatch){const row=await getCard(db,game,cardMatch[1]);if(!row||!mayReadMaterial(map,row,ctx.user.id,keeper))fail('Картка недоступна.',404);return json({card:clean(row,keeper)});}
 if(request.method==='POST'&&!tail){
  const data=await request.json();const card=await validate(db,game,data,null,map);const id=crypto.randomUUID(),stamp=new Date().toISOString();
  const order=await db.prepare('SELECT MAX(sort_order) AS last FROM room_material_cards WHERE game_id=? AND parent_id IS ?').bind(game,card.parent_id).first();
  const cols=['id','game_id','parent_id',...fields,'sort_order','created_by','created_at','updated_at'];
  const values=[id,game,card.parent_id,...fields.map(f=>card[f]),(order?.last??-10)+10,ctx.user.id,stamp,stamp];
  await db.batch([db.prepare('INSERT INTO room_material_cards('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')').bind(...values),...contentChanges(db,id,1,data),bump(db,game)]);
  return json({card:clean(await getCard(db,game,id),true)});
 }
 if(cardMatch&&['PUT','DELETE'].includes(request.method)){
  const row=await getCard(db,game,cardMatch[1]);if(!row)fail('Картку не знайдено.',404);
  const data=await request.json();if(data.revision!==row.revision)fail('Картка вже змінена в іншому вікні. Онови її та повтори редагування.',409);
  if(request.method==='DELETE'){const result=await db.batch([db.prepare('DELETE FROM room_material_cards WHERE id=? AND game_id=? AND revision=?').bind(row.id,game,data.revision),bump(db,game)]);if(!result[0].meta.changes)fail('Картка змінилася. Онови список.',409);return json({ok:true});}
  const card=await validate(db,game,data,row,map),stamp=new Date().toISOString();
  const result=await db.batch([...contentChanges(db,row.id,data.revision,data),db.prepare('UPDATE room_material_cards SET '+fields.map(f=>f+'=?').join(',')+',revision=revision+1,updated_at=? WHERE id=? AND game_id=? AND revision=?').bind(...fields.map(f=>card[f]),stamp,row.id,game,data.revision),bump(db,game)]);
  if(!result.at(-2).meta.changes)fail('Картка змінилася. Онови її перед збереженням.',409);
  return json({card:clean(await getCard(db,game,row.id),true)});
 }
 fail('Сторінку не знайдено.',404);
}
async function importLegacy(db,game,userId,map){
 if(await db.prepare("SELECT id FROM room_material_cards WHERE game_id=? AND legacy_key='legacy-root'").bind(game).first())return json({ok:true,alreadyImported:true});
 const records=(await db.prepare("SELECT table_name,record_id,data FROM migration_records WHERE game_id=? AND table_name IN ('boards','hidden_materials') ORDER BY seq").bind(game).all()).results;
 const cards=[];const seen=new Set();
 for(const rec of records){const data=JSON.parse(rec.data);if(rec.table_name==='hidden_materials'){cards.push({key:'clue:'+rec.record_id,title:data.title||'Матеріал',body:data.note||'',image:data.attachment_type?.startsWith('image/')?data.attachment_data||'':'',file_data:data.attachment_type==='application/pdf'?data.attachment_data||'':'',audience:data.revealed_at?(data.audience==='all'?'all':'selected'):'hidden',targets:data.target_user_id?[data.target_user_id]:[]});seen.add(rec.record_id);}}
 for(const rec of records)if(rec.table_name==='boards')for(const scene of JSON.parse(rec.data).scenes||[])for(const c of scene.cards||[]){if(c.sourceClueId&&seen.has(c.sourceClueId))continue;cards.push({key:'board:'+c.id,title:c.title||'Матеріал сцени',body:c.note||'',image:c.type?.startsWith('image/')?c.url||'':'',file_path:c.sourceFilePath||'',file_type:c.type||'',audience:!c.targets||c.targets.includes('all')?'all':'selected',targets:(c.targets||[]).filter(t=>t!=='all')});}
 const oldTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_room_boards'").first();
 if(oldTable){const row=await db.prepare('SELECT map FROM migration_room_boards WHERE game_id=?').bind(game).first();if(row?.map)cards.push({key:'legacy-map',title:'Карта пригоди',body:'Карта зі старої центральної панелі.',image:'data:image/webp;base64,'+row.map,audience:'all',targets:[]});}
 if(!cards.length)return json({ok:true,imported:0});
 const root=crypto.randomUUID(),stamp=new Date().toISOString();
 const statements=[db.prepare("INSERT INTO room_material_cards(id,game_id,kind,title,audience,created_by,created_at,updated_at,legacy_key) VALUES(?,?,'category','Матеріали до оновлення','hidden',?,?,?,'legacy-root')").bind(root,game,userId,stamp,stamp)];
 const importedKeys=new Set();
 for(const [i,c] of cards.entries()){
  if(importedKeys.has(c.key))continue;importedKeys.add(c.key);
  if(/^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/.test(c.file_data||'')&&c.file_data.length<1900000){
    const raw=Uint8Array.from(atob(c.file_data.split(',')[1]),v=>v.charCodeAt(0));c.file_path=game+'/'+crypto.randomUUID()+'_legacy.pdf';c.file_type='application/pdf';
    for(let offset=0;offset<raw.length;offset+=262144)statements.push(db.prepare('INSERT INTO migration_file_chunks(path,part,bytes) VALUES(?,?,?)').bind(c.file_path,offset/262144,raw.slice(offset,offset+262144).buffer));
    const metadata={id:c.file_path,game_id:game,type:'application/pdf',size:raw.length,created_at:stamp};statements.push(db.prepare("INSERT INTO migration_records(table_name,record_id,game_id,owner_id,data) VALUES('files',?,?,?,?)").bind(c.file_path,game,userId,JSON.stringify(metadata)));
  }
  const validImage=/^data:image\/(?:webp|png|jpeg);base64,/.test(c.image||'')&&(c.image||'').length<=1800000?c.image:'';
  statements.push(db.prepare("INSERT INTO room_material_cards(id,game_id,parent_id,kind,title,body,image,file_path,file_type,audience,targets,sort_order,created_by,created_at,updated_at,legacy_key) VALUES(?,?,?,'entry',?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),game,root,String(c.title).slice(0,100),String(c.body).slice(0,30000),validImage,c.file_path||'',c.file_type||'',c.audience,JSON.stringify(c.targets),i*10,userId,stamp,stamp,c.key));
 }
 await db.batch([...statements,bump(db,game)]);return json({ok:true,imported:cards.length,root});
}
