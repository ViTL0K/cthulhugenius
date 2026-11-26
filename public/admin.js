const $=s=>document.querySelector(s);
const labels={overview:'Огляд порталу',rooms:'Пригоди й кімнати',sheets:'Листи персонажів',content:'Наповнення сайту',accounts:'Акаунти та ролі',requests:'Запити на права ведучого',feedback:'Повідомлення та ідеї'};
const roleNames={admin:'Адміністратор',keeper:'Ведучий',player:'Гравець'};
let state=null,editingRoom=null,section='overview';
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function button(text,action,className){const b=node('button',text,className);b.type='button';b.addEventListener('click',()=>run(b,action));return b;}
function status(text,error=false){$('#status').textContent=text;$('#status').classList.toggle('error',error);}
async function api(path,body){const r=await fetch('/api/migration/admin/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(typeof data.error==='string'?data.error:data.error?.message||'Не вдалося виконати запит.');return data;}
async function run(control,action){control.disabled=true;try{await action();}catch(e){status(e.message,true);}finally{control.disabled=false;}}
function selectSection(name){if(!labels[name])return;section=name;for(const el of document.querySelectorAll('.panel'))el.hidden=el.id!==name;for(const b of document.querySelectorAll('nav [data-section]'))b.setAttribute('aria-current',b.dataset.section===name?'page':'false');$('#page-title').textContent=labels[name];history.replaceState(null,'','#'+name);}
function empty(text){return node('div',text,'empty');}
async function workspace(game,tool='',extra={}){
  let url='/migration/?workspace=1';
  if(game)url=(await api('rooms/'+encodeURIComponent(game)+'/open',{})).url;
  const target=new URL(url,location.origin);if(tool)target.searchParams.set('tool',tool);for(const [key,value] of Object.entries(extra))if(value)target.searchParams.set(key,value);
  location.assign(target.pathname+target.search);
}
function roomCard(room){
  const card=node('article',undefined,'card');card.append(node('h3',room.title),node('p',room.description||'Пригода без опису'),node('div','Кімната: '+room.room_code,'code'),node('p',`Ведучий: ${room.keeper_name} · Учасників: ${room.member_count}\nЛистів: ${room.sheet_count} · Матеріалів: ${room.material_count} · Файлів: ${room.file_count}`));
  const actions=node('div',undefined,'room-actions');
  actions.append(button('Вести гру',()=>workspace(room.id),'primary'),button('Листи',()=>workspace(room.id,'sheets')),button('Матеріали',()=>workspace(room.id,'materials')),button('PDF і зображення',()=>workspace(room.id,'files')),button('Нотатки',()=>workspace(room.id,'notes')),button('Гравці й налаштування',()=>workspace(room.id,'settings')),button('Назва та опис',()=>editRoom(room),'quiet'));
  card.append(actions);return card;
}
function render(){
  const totalSheets=state.sheets.length,totalMaterials=state.counts.material_library_total??state.counts.hidden_materials??0;
  $('#stats').replaceChildren(...[[state.rooms.length,'Пригод на сайті'],[state.accounts.length,'Акаунтів'],[totalSheets,'Листів персонажів'],[totalMaterials,'Матеріалів пригод']].map(([value,title])=>{const card=node('div',undefined,'stat');card.append(node('b',String(value)),node('span',title));return card;}));
  $('#recent-rooms').replaceChildren(...(state.rooms.length?state.rooms.slice(0,4).map(roomCard):[empty('Створи першу пригоду в розділі «Пригоди й кімнати».')]));
  $('#all-rooms').replaceChildren(...(state.rooms.length?state.rooms.map(roomCard):[empty('Пригод поки немає.')]));
  const roomNames=new Map(state.rooms.map(r=>[r.id,r.title])),accountNames=new Map(state.accounts.map(u=>[u.id,u.display_name]));
  $('#sheet-rows').replaceChildren(...state.sheets.map(sheet=>{const tr=node('tr');for(const text of [sheet.name,roomNames.get(sheet.game_id)||'Пригода',accountNames.get(sheet.user_id)||'Не призначено',sheet.kind==='prepared'?'Підготовлений':'Особистий'])tr.append(node('td',text));const action=node('td');action.append(button('Редагувати лист',()=>workspace(sheet.game_id,'sheets',sheet.kind==='prepared'?{prepared:sheet.id}:{owner:sheet.user_id})));tr.append(action);return tr;}));
  $('#sheet-empty').hidden=Boolean(state.sheets.length);
  $('#account-rows').replaceChildren(...state.accounts.map(user=>{
    const tr=node('tr'),name=node('td');name.append(node('strong',user.display_name),node('small',user.email));tr.append(name);const role=node('td');role.append(node('span',roleNames[user.role],'badge'));tr.append(role);const control=node('td');
    if(user.role==='admin')control.textContent='Захищений акаунт власника';
    else{const select=node('select');select.setAttribute('aria-label','Роль: '+user.display_name);for(const value of ['player','keeper']){const o=node('option',roleNames[value]);o.value=value;select.append(o);}select.value=user.role;
      control.append(select,button('Зберегти',async()=>{await api('roles',{user_id:user.id,role:select.value});await refresh();status('Роль акаунта оновлено.');}));}
    tr.append(control);return tr;
  }));
  $('#request-count').textContent=state.requests.length?String(state.requests.length):'';
  $('#request-list').replaceChildren(...(state.requests.length?state.requests.map(item=>{const row=node('article');row.append(node('h3',item.display_name||accountNames.get(item.user_id)||'Користувач'),node('p',item.reason||'Без пояснення'),node('small',new Date(item.created_at).toLocaleString('uk-UA')));const actions=node('div',undefined,'room-actions');for(const [action,label] of [['approve','Призначити ведучим'],['reject','Відхилити']])actions.append(button(label,async()=>{await api('requests',{id:item.id,action});await refresh();}));row.append(actions);return row;}):[empty('Нових запитів немає.')]));
  $('#feedback-count').textContent=String(state.feedback.filter(f=>f.status==='new').length||'');
  $('#feedback-list').replaceChildren(...(state.feedback.length?[...state.feedback].reverse().map(item=>{const row=node('article');row.append(node('h3',item.kind||'Повідомлення'),node('small',(item.display_name||'Користувач')+' · '+new Date(item.created_at).toLocaleString('uk-UA')),node('p',item.text));const select=node('select');select.setAttribute('aria-label','Стан повідомлення');for(const [value,label] of [['new','Нове'],['reviewed','На розгляді'],['done','Вирішено']]){const option=node('option',label);option.value=value;select.append(option);}select.value=item.status||'new';row.append(select,button('Зберегти стан',async()=>{await api('feedback',{id:item.id,status:select.value});await refresh();}));return row;}):[empty('Повідомлень поки немає.')]));
}
async function refresh(){state=await api('overview');render();$('#identity').textContent=state.user.display_name+' · Адміністратор';$('#signout').hidden=false;$('#access').hidden=true;$('#dashboard').hidden=false;}
function editRoom(room){editingRoom=room.id;const form=$('#edit-room');form.elements.title.value=room.title;form.elements.description.value=room.description;$('#edit-status').textContent='';$('#room-editor').showModal();}
document.addEventListener('click',e=>{const target=e.target.closest('[data-section]');if(target){selectSection(target.dataset.section);return;}const tool=e.target.closest('[data-tool]');if(tool)void run(tool,()=>workspace(null,tool.dataset.tool));});
$('#refresh').addEventListener('click',()=>run($('#refresh'),async()=>{await refresh();status('Дані оновлено.');}));
$('#close-editor').addEventListener('click',()=>$('#room-editor').close());
$('#edit-room').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const submit=form.querySelector('.primary');submit.disabled=true;try{await api('rooms/'+editingRoom+'/update',Object.fromEntries(new FormData(form)));$('#room-editor').close();await refresh();status('Пригоду оновлено.');}catch(error){$('#edit-status').textContent=error.message;}finally{submit.disabled=false;}});
$('#create-room').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;await run(form.querySelector('button'),async()=>{await api('rooms',Object.fromEntries(new FormData(form)));form.reset();await refresh();status('Пригоду створено.');});});
try{
  const response=await fetch('/api/migration/auth/session',{cache:'no-store'});if(!response.ok)throw Error('Не вдалося перевірити вхід.');const session=await response.json();
  if(!session.user){$('#access-message').textContent='Увійди через Google-акаунт адміністратора.';$('#login').hidden=false;$('#identity').textContent='Вхід не виконано';}
  else if(session.role!=='admin'){$('#access-message').textContent='Ця сторінка доступна лише адміністратору. Для цього акаунта відкритий ігровий портал.';$('#identity').textContent=session.user.display_name;$('#signout').hidden=false;}
  else{await refresh();selectSection(location.hash.slice(1)||'overview');}
}catch(error){$('#access-message').textContent=error.message;$('#identity').textContent='Не вдалося завантажити кабінет';}
