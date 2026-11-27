/* Structured room materials. Every read and mutation is authorized by the Worker. */
(()=>{
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function button(text,fn,cls='btn'){const b=make('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
 function inline(text){const out=document.createDocumentFragment();for(const part of String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)){if(part.startsWith('**')&&part.endsWith('**'))out.append(make('strong',part.slice(2,-2)));else if(part.startsWith('*')&&part.endsWith('*'))out.append(make('em',part.slice(1,-1)));else out.append(document.createTextNode(part));}return out;}
 function markdown(text){const block=make('div',undefined,'library-prose');let ul=null;for(const line of String(text||'').split('\n')){if(!line.trim()){ul=null;continue;}if(line.startsWith('- ')){if(!ul){ul=make('ul');block.append(ul);}const li=make('li');li.append(inline(line.slice(2)));ul.append(li);continue;}ul=null;const h=/^(#{1,3})\s+(.+)$/.exec(line);const p=make(h?'h'+(Number(h[1].length)+1):'p');p.append(inline(h?h[2]:line));block.append(p);}return block;}
 async function loadImage(src){const image=new Image();image.src=src;await image.decode();return image;}
 async function resized(src,maxSide,maxLength,quality=.85){const image=await loadImage(src);let ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');let result;
  do{canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);result=canvas.toDataURL('image/webp',quality);ratio*=.8;}while(result.length>maxLength&&canvas.width>40);if(result.length>maxLength)throw Error('Зображення завелике. Обери менший файл.');return result;
 }
 async function readFile(file){if(!file?.type.startsWith('image/'))throw Error('Обери файл зображення.');if(file.size>25*1024*1024)throw Error('Обери зображення до 25 МБ.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Не вдалося прочитати файл.'));reader.readAsDataURL(file);});}
 window.createRoomMaterialLibrary=({mount,onError=()=>{},isActive=()=>true,onCount=()=>{}})=>{
  let room='',user='',role='',parent=null,page=0,version='',data=null,detail=null,managing=false,busy=false,generation=0,dialog=null,category=null,dragged=null;
  const root=make('div',undefined,'material-library');mount.append(root);
  const editors=new Set();let editorSequence=0;
  const snapshots=new Map(),cacheKey=()=>['cth-materials-104',user,room,role,parent||'root',category??'*',page].join(':');
  function remember(){if(!data)return;const snapshot={data,detail,time:Date.now()};snapshots.set(cacheKey(),snapshot);try{sessionStorage.setItem(cacheKey(),JSON.stringify(snapshot));}catch{}}
  function restore(){let snapshot=snapshots.get(cacheKey());try{snapshot??=JSON.parse(sessionStorage.getItem(cacheKey()));}catch{}if(snapshot?.data?.cards&&snapshot.data.canEdit===(role==='keeper')&&Date.now()-snapshot.time<300000){data=snapshot.data;detail=snapshot.detail||null;return true;}return false;}
  function forget(){snapshots.clear();try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k.startsWith(['cth-materials-104',user,room].join(':')))sessionStorage.removeItem(k);}}catch{}}
  function content(card){if(card.blocks?.length)return card.blocks;return [...(card.body?[{type:'text',text:card.body}]:[]),...(card.image?[{type:'image',src:card.image,size:'medium'}]:[])];}
  function renderContent(host,card){
   const photo=block=>{const img=make('img',undefined,'library-detail-image library-image-'+(block.size||'medium'));img.src=block.src;img.alt=card.title;img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Відкрити зображення на весь екран: '+card.title);img.setAttribute('aria-haspopup','dialog');img.title='Відкрити на весь екран';const open=()=>window.openMaterialImage?.({src:block.src,title:card.title});img.addEventListener('click',open);img.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();void open();}});return img;};
   if(card.kind==='image'){const img=photo({src:card.image,size:'large'});img.classList.add('library-picture');host.append(img);return;}
   const blocks=content(card);let texts=[];
   function pair(block,paragraphs){const row=make('section',undefined,'library-content-pair'),text=make('div',undefined,'library-content-text'),media=make('div',undefined,'library-content-media');row.dataset.imageSide=block.side||'right';for(const paragraph of paragraphs)text.append(markdown(paragraph.text));media.append(photo(block));row.append(text,media);host.append(row);}
   for(let i=0;i<blocks.length;i++){
    const block=blocks[i];if(block.type==='heading'){for(const paragraph of texts)host.append(markdown(paragraph.text));texts=[];host.append(make('h3',block.text,'library-section-heading'));continue;}if(block.type==='text'){texts.push(block);continue;}
    if(block.type!=='image')continue;
    if(!texts.length)while(blocks[i+1]?.type==='text')texts.push(blocks[++i]);
    if(texts.length){pair(block,texts);texts=[];}else{const img=photo(block);img.classList.add('library-image-standalone');img.dataset.imageSide=block.side||'right';host.append(img);}
   }
   for(const paragraph of texts)host.append(markdown(paragraph.text));
  }


  function legacyContent(card){
   const blocks=Array.isArray(card.blocks)?card.blocks:[];
   const text=blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n');
   return card.kind==='category'&&(blocks.some(b=>b.type==='image'||b.type==='heading')||blocks.filter(b=>b.type==='text').length>1||text&&text!==card.body||card.image||card.file_url)?content(card):[];
  }
  function renderLegacy(host,card){
   if(!legacyContent(card).length&&!card.file_url)return;
   const previous=make('details',undefined,'library-legacy-content');previous.append(make('summary','Матеріали попереднього формату'));
   renderContent(previous,card);
   if(card.file_url){const link=make('a','Відкрити прикріплений файл','btn');link.href=card.file_url;link.target='_blank';link.rel='noopener';previous.append(link);}
   host.append(previous);
  }

  async function api(tail='',options={}){const response=await fetch('/api/migration/library/'+room+tail,{...options,headers:options.body?{'Content-Type':'application/json'}:undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Object.assign(Error(typeof result.error==='string'?result.error:result.error?.message||'Не вдалося виконати запит.'),{status:response.status});return result;}
  const status=(text,error=false)=>{const p=root.querySelector('.library-status');if(p){p.textContent=text;p.classList.toggle('error',error);}};
  async function action(control,fn){control.disabled=true;try{await fn();}catch(error){onError(error.message);status(error.message,true);}finally{control.disabled=false;}}
  function cover(card){if(card.cover_thumb){const image=make('img');image.src=card.cover_thumb;image.alt='';image.loading='lazy';image.draggable=false;return image;}return make('span',card.kind==='category'?'▤':'◇','library-cover-placeholder');}
  function header(){const head=make('div',undefined,'library-toolbar'),nav=make('nav',undefined,'library-crumbs');nav.setAttribute('aria-label','Навігація матеріалів');nav.append(button('Матеріали гри',()=>go(null)));for(const crumb of data?.crumbs||[]){nav.append(make('span','/'),button(crumb.title,()=>go(crumb.id)));}
   if(detail){nav.append(make('span','/'),make('span',detail.title));}head.append(nav);if(role==='keeper'){const controls=make('div',undefined,'library-tools');const add=button('+',()=>edit(null,parent?{kind:'entry'}:{}),'icon-btn');add.title='Додати матеріал';add.setAttribute('aria-label','Додати матеріал');const settings=button('⚙',()=>{detail=null;managing=!managing;render();},'icon-btn');settings.title='Налаштування вкладок';settings.setAttribute('aria-label','Налаштування матеріалів');settings.setAttribute('aria-pressed',String(managing));controls.append(add,settings);head.append(controls);}return head;
  }
  function render(){root.replaceChildren(header());const notice=make('p','', 'library-status');notice.setAttribute('role','status');root.append(notice);const viewport=make('div',undefined,'library-scroll');root.append(viewport);
   if(!data){viewport.append(make('p','Завантажуємо матеріали…','library-empty'));return;}
   if(detail){renderDetail(viewport);return;}
   if(data.categories?.length){const filters=make('nav',undefined,'library-category-filters');filters.setAttribute('aria-label','Категорії матеріалів');for(const value of [null,...data.categories]){const b=button(value===null?'Усі':value||'Без категорії',()=>{generation++;busy=false;category=value;page=0;version='';detail=null;void refresh(true);});b.setAttribute('aria-pressed',String(category===value));filters.append(b);}root.insertBefore(filters,viewport);}
   if(parent){const back=button('Назад',()=>{const crumbs=data.crumbs||[];go(crumbs.length>1?crumbs.at(-2).id:null);});back.classList.add('library-back');viewport.append(back);if(data.parent){const intro=make('section',undefined,'library-folder-intro');intro.append(make('h2',data.parent.title),markdown(data.parent.body));viewport.append(intro);renderLegacy(viewport,data.parent);if(role==='keeper'){const tools=make('div',undefined,'library-folder-tools');tools.append(button('+ Створити дод. матеріал',()=>edit(null,{kind:'entry',category:data.parent.category||''},{forceEntry:true}),'btn primary'),button('Редагувати картку',()=>edit(data.parent.id)));viewport.append(tools);}}}

   const grid=make('div',undefined,'library-grid');viewport.append(grid);
   if(!data.cards.length){const text=role==='keeper'?'У цій картці ще немає підкарток. Створи перший матеріал.':category!==null?'У цій категорії поки немає відкритих матеріалів.':parent?'Вартовий ще не відкрив вам матеріалів у цій локації. Очікуйте на зачіпки під час розслідування.':'Вартовий ще не відкрив вам жодних матеріалів. Очікуйте на зачіпки під час розслідування';if(role!=='keeper'||parent)grid.append(make('p',text,'library-empty-player'));}
   if(role==='keeper'&&!parent&&data.legacyAvailable){const legacy=button('Перенести раніше додані матеріали',e=>action(e.currentTarget,async()=>{await api('/import-legacy',{method:'POST',body:'{}'});await refresh(true);}));legacy.className='btn library-legacy-import';viewport.append(legacy);}
   for(const card of data.cards){const article=make('article',undefined,'library-tile');const open=button('',()=>openCard(card),'library-card');open.append(cover(card),make('span',card.title,'library-card-title'));open.setAttribute('aria-label',(card.kind==='category'?'Відкрити картку з підкартками: ':'Відкрити картку: ')+card.title);article.append(open,make('span',String(page*48+data.cards.indexOf(card)+1),'library-number'));
    if(role==='keeper'){const badge=button(card.audience==='hidden'?'◉ Приховано':card.audience==='selected'?'◈ Обраним гравцям':'◎ Усім гравцям',()=>quickAccess(card), 'library-access '+card.audience);badge.setAttribute('aria-label','Доступ: '+card.title);badge.setAttribute('aria-haspopup','dialog');article.append(badge);
     if(managing){const controls=make('div',undefined,'library-tile-tools');controls.append(button('Редагувати',()=>edit(card.id)),button('Видалити',e=>action(e.currentTarget,()=>removeCard(card)),'btn danger'));article.append(controls);}}
    if(role==='keeper'&&managing){article.draggable=true;article.tabIndex=0;article.setAttribute('aria-label','Перемістити: '+card.title);article.title='Перетягни картку. Клавіатура: Alt + стрілка вліво або вправо.';
     article.addEventListener('dragstart',e=>{dragged=card;e.dataTransfer?.setData('text/plain',card.id);article.classList.add('dragging');});article.addEventListener('dragend',()=>{dragged=null;article.classList.remove('dragging');for(const tile of root.querySelectorAll('.drag-over'))tile.classList.remove('drag-over');});article.addEventListener('dragover',e=>{if(dragged&&dragged.id!==card.id){e.preventDefault();article.classList.add('drag-over');if(e.dataTransfer)e.dataTransfer.dropEffect='move';}});article.addEventListener('dragleave',()=>article.classList.remove('drag-over'));article.addEventListener('drop',e=>{e.preventDefault();article.classList.remove('drag-over');const moving=dragged;dragged=null;if(moving&&moving.id!==card.id){const rect=article.getBoundingClientRect(),after=e.clientX>rect.left+rect.width/2;void action(article,()=>moveCard(moving,after?data.cards[data.cards.indexOf(card)+1]:card));}});
     article.addEventListener('keydown',e=>{if(!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const i=data.cards.indexOf(card),anchor=e.key==='ArrowLeft'?data.cards[i-1]:data.cards[i+2];if(e.key==='ArrowLeft'&&i===0||e.key==='ArrowRight'&&i===data.cards.length-1)return;void action(article,()=>moveCard(card,anchor));});
    }grid.append(article);
   }
   if(data.page>0||data.hasMore){const controls=make('div',undefined,'library-pages');const prev=button('Попередня сторінка',()=>{generation++;busy=false;page--;version='';refresh(true);});prev.disabled=page===0;const next=button('Наступна сторінка',()=>{generation++;busy=false;page++;version='';refresh(true);});next.disabled=!data.hasMore;controls.append(prev,make('span','Сторінка '+(page+1)),next);viewport.append(controls);}
  }
  function renderDetail(viewport){const card=detail;viewport.append(button('Назад до вкладки',()=>{detail=null;render();}));const article=make('article',undefined,'library-detail');article.append(make('h2',card.title));renderContent(article,card);
   if(card.file_url){if(card.file_type==='application/pdf'){const frame=make('iframe',undefined,'library-pdf');frame.src=card.file_url;frame.title=card.title;article.append(frame);}else if(card.file_type?.startsWith('image/')){const image=make('img',undefined,'library-detail-image');image.src=card.file_url;image.alt=card.title;article.append(image);}const link=make('a','Відкрити прикріплений файл','btn');link.href=card.file_url;link.target='_blank';link.rel='noopener';article.append(link);}
   if(role==='keeper')article.append(button('Редагувати картку',()=>edit(card.id),'btn primary'));viewport.append(article);
  }
  async function refresh(force=false){if(!room||busy)return;const token=generation;busy=true;try{const query=new URLSearchParams({page:String(page)});if(parent)query.set('parent',parent);if(category!==null)query.set('category',category);if(version&&!force)query.set('known',version);const result=await api('?'+query);if(token!==generation)return;if(result.unchanged)return;if(!Array.isArray(result.cards)||!Array.isArray(result.crumbs)||typeof result.canEdit!=='boolean'||typeof result.version!=='string')throw Error('Неповна відповідь сервера. Повторюємо синхронізацію.');if(data?.version&&data.version!==result.version)forget();data=result;role=result.canEdit?'keeper':'player';version=result.version;
    if(detail){const id=detail.id;try{const updated=(await api('/cards/'+id)).card;if(token===generation&&detail?.id===id)detail=updated;}catch(error){if(error.status!==404)throw error;if(detail?.id===id){detail=null;window.closeMaterialImage?.();}}}
    if(token!==generation)return;
    remember();render();onCount(result.cards.length);
   }catch(error){if(token!==generation)return;if(error.status===404&&parent){window.closeMaterialImage?.();forget();parent=null;detail=null;category=null;page=0;version='';busy=false;return refresh(true);}if([401,403].includes(error.status)){forget();data=null;detail=null;root.replaceChildren(make('p','Кімната недоступна. Увійди знову або повернись до порталу.','library-empty'));}else{if(!data)render();status(error.message,true);}}
   finally{if(token===generation)busy=false;}
  }
  async function go(id){generation++;busy=false;remember();parent=id;detail=null;category=null;managing=false;page=0;version='';restore();await refresh(true);}
  async function openCard(card){if(card.kind==='category')return go(card.id);const token=++generation;busy=false;try{const result=await api('/cards/'+card.id);if(token!==generation)return;detail=result.card;remember();render();}catch(error){onError(error.message);await refresh(true);}}
  async function moveCard(card,anchor){if(anchor?.id===card.id)return;await api('/move',{method:'POST',body:JSON.stringify({parent_id:parent,id:card.id,revision:card.revision,before_id:anchor?.id||null,anchor_revision:anchor?.revision})});await refresh(true);}
  async function removeCard(card){if(!confirm('Видалити «'+card.title+'»'+(card.kind==='category'?' разом з усіма дочірніми вкладками й картками':'')+'?'))return;await api('/cards/'+card.id,{method:'DELETE',body:JSON.stringify({revision:card.revision})});if(detail?.id===card.id)detail=null;await refresh(true);}
  async function quickAccess(card,{afterSave,returnDialog}={}){
   if(role!=='keeper')return;
   const scope=room,token=generation;let current;
   try{current=(await api('/cards/'+card.id)).card;}catch(error){onError(error.message);return;}
   if(scope!==room||token!==generation)return;
   const popup=make('dialog',undefined,'library-access-popup'),form=make('form'),head=make('div',undefined,'library-editor-head');
   popup.setAttribute('aria-label','Доступ до матеріалу');head.append(make('h3',current.title),button('×',()=>popup.close(),'icon-btn'));form.append(head);
   const picks=make('fieldset',undefined,'library-player-picks');picks.append(make('legend','Гравці кімнати'));
   for(const player of data?.players||[]){const label=make('label'),check=make('input');check.type='checkbox';check.value=player.user_id;check.checked=current.audience==='all'||(current.targets||[]).includes(player.user_id);label.append(check,document.createTextNode(player.display_name));picks.append(label);}
   const message=make('p','','library-editor-status');message.setAttribute('role','status');
   async function save(audience,targets=[]){if(scope!==room||token!==generation){popup.close();return;}const controls=[...form.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);try{await api('/cards/'+card.id,{method:'PUT',body:JSON.stringify({title:current.title,revision:current.revision,audience,targets})});await afterSave?.();popup.close();await refresh(true);}catch(error){message.textContent=error.message;}finally{controls.forEach(b=>b.disabled=false);}}
   const actions=make('div',undefined,'library-access-actions');
   const selected=make('button','Зберегти вибір','btn');selected.type='submit';selected.disabled=!data?.players?.length;
   const modes=[];
   function mark(mode){for(const [value,b] of modes){b.setAttribute('aria-pressed',String(value===mode));b.classList.toggle('primary',value===mode);}picks.hidden=mode!=='selected';selected.hidden=mode!=='selected';}
   for(const [mode,label] of [['all','Відкрити всім'],['hidden','Приховати від усіх'],['selected','Обраним гравцям']]){const b=button(label,()=>{if(mode==='selected'){mark(mode);picks.querySelector('input')?.focus();}else void save(mode);});modes.push([mode,b]);actions.append(b);}
   mark(current.audience);

   form.append(actions,picks,message,selected);form.addEventListener('submit',e=>{e.preventDefault();const targets=[...picks.querySelectorAll('input:checked')].map(c=>c.value);void save(targets.length?'selected':'hidden',targets);});
   popup.append(form);document.body.append(popup);dialog=popup;popup.addEventListener('close',()=>{popup.remove();dialog=returnDialog?.open?returnDialog:null;});popup.showModal();
  }
  let browserDialog=null;
  function showLibrary(){
   if(browserDialog?.open){void go(null);return;}
   browserDialog=make('dialog',undefined,'library-browser');browserDialog.setAttribute('aria-label','Матеріали сесії');
   const top=make('div',undefined,'library-browser-head');top.append(make('h2','Матеріали сесії'),button('Закрити',()=>browserDialog.close()));
   browserDialog.append(top,root);document.body.append(browserDialog);browserDialog.addEventListener('close',()=>{mount.append(root);browserDialog.remove();browserDialog=null;});browserDialog.showModal();void go(null);
  }
  async function edit(id,prefill={},options={}){if(role!=='keeper')return;const startRoom=room,startGeneration=generation;let loaded;try{if(id)loaded=(await api('/cards/'+id)).card;}catch(error){onError(error.message);return;}if(startRoom!==room||startGeneration!==generation)return;let card=id?loaded:{kind:'category',parent_id:parent,title:'',body:'',audience:'hidden',targets:[],cover_source:'',cover_thumb:'',crop:{zoom:1,x:.5,y:.5},image:'',...prefill};
   const editingRoom=room,editingGeneration=generation,previousDialog=options.nested&&dialog?.open?dialog:null;if(dialog&&!options.nested){dialog.close();dialog.remove();}
   let dirty=false,editor;const closeEditor=()=>{if(!dirty||confirm('Закрити без збереження змін?'))editor.close();};
   editor=make('dialog',undefined,'library-editor');dialog=editor;editors.add(editor);const form=make('form'),top=make('div',undefined,'library-editor-head');top.append(make('h2',id?'Редагувати матеріал':'Новий матеріал'),button('×',closeEditor,'icon-btn'));form.append(top);
   const message=make('p','', 'library-editor-status');message.setAttribute('role','status');
   function field(title,control){const label=make('label');label.append(make('span',title),control);label.className='library-field';return label;}
   const kind=make('select');for(const [value,name]of [['category','Картка з підкартками'],['entry','Кінцева картка з матеріалом'],['image','Картинка з назвою']]){if(options.forceEntry&&value==='category')continue;const option=make('option',name);option.value=value;kind.append(option);}kind.value=card.kind;if(options.forceEntry)kind.value=card.kind==='image'?'image':'entry';kind.setAttribute('aria-label','Тип матеріалу');const title=make('input');title.value=card.title;title.maxLength=100;title.required=true;title.setAttribute('aria-label','Назва матеріалу');form.append(field('Тип матеріалу',kind),field('Назва',title));
   const categoryInput=make('input');categoryInput.value=card.category??category??'';categoryInput.maxLength=60;categoryInput.setAttribute('aria-label','Категорія матеріалу');const categoryListId='material-category-options-'+(++editorSequence);categoryInput.setAttribute('list',categoryListId);const categoryOptions=make('datalist');categoryOptions.id=categoryListId;for(const name of new Set(['Локації','Персонажі (NPC)','Зачіпки / Документи','Предмети',...(data?.categories||[])])){if(!name)continue;const option=make('option');option.value=name;categoryOptions.append(option);}form.append(field('Категорія',categoryInput),categoryOptions);
   let coverSource=card.cover_source||'',filePath=card.file_path||'',crop={zoom:1,x:.5,y:.5,...card.crop},image=null,reading=0,pictureSource=card.image||card.blocks?.find(b=>b.type==='image')?.src||card.cover_source||'';
   const coverFile=make('input');coverFile.type='file';coverFile.accept='image/png,image/jpeg,image/webp';const coverBox=make('section',undefined,'library-cover-editor');const coverLabel=field('Зображення обкладинки',coverFile);coverBox.append(coverLabel);
   const canvas=make('canvas');canvas.width=360;canvas.height=480;canvas.className='library-crop-canvas';canvas.setAttribute('aria-label','Кадрування обкладинки. Перетягни зображення в рамці.');coverBox.append(canvas);
   const range=(name,min,max,value,step)=>{const input=make('input');Object.assign(input,{type:'range',min:String(min),max:String(max),value:String(value),step:String(step)});coverBox.append(field(name,input));return input;};
   const zoom=range('Масштаб',1,3,crop.zoom,.01),x=range('Положення по горизонталі',0,1,crop.x,.01),y=range('Положення по вертикалі',0,1,crop.y,.01);
   function draw(){const ctx=canvas.getContext('2d');ctx.fillStyle='#132219';ctx.fillRect(0,0,360,480);if(!image){ctx.fillStyle='#c7a96b';ctx.font='26px Georgia';ctx.textAlign='center';ctx.fillText('Обкладинка',180,240);return;}const scale=Math.max(360/image.naturalWidth,480/image.naturalHeight)*crop.zoom;ctx.drawImage(image,(360-image.naturalWidth*scale)*crop.x,(480-image.naturalHeight*scale)*crop.y,image.naturalWidth*scale,image.naturalHeight*scale);}
   for(const input of [zoom,x,y])input.addEventListener('input',()=>{crop={zoom:Number(zoom.value),x:Number(x.value),y:Number(y.value)};draw();});
   let drag=null;canvas.addEventListener('pointerdown',e=>{if(!image)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,crop:{...crop}};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag||!image)return;const rect=canvas.getBoundingClientRect(),scale=Math.max(360/image.naturalWidth,480/image.naturalHeight)*crop.zoom;const excessX=image.naturalWidth*scale-360,excessY=image.naturalHeight*scale-480;crop.x=excessX>1?Math.max(0,Math.min(1,drag.crop.x-(e.clientX-drag.x)*360/rect.width/excessX)):.5;crop.y=excessY>1?Math.max(0,Math.min(1,drag.crop.y-(e.clientY-drag.y)*480/rect.height/excessY)):.5;x.value=String(crop.x);y.value=String(crop.y);draw();});for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
   const removeCover=button('Прибрати обкладинку',()=>{dirty=true;coverSource='';pictureSource='';image=null;coverFile.value='';crop={zoom:1,x:.5,y:.5};zoom.value='1';x.value=y.value='.5';draw();});coverBox.append(removeCover);form.append(coverBox);
   coverFile.addEventListener('change',async()=>{if(!coverFile.files[0])return;reading++;coverFile.disabled=true;try{const src=await readFile(coverFile.files[0]),full=await resized(src,2000,900000),cover=await resized(src,1200,280000),loaded=await loadImage(cover);pictureSource=full;coverSource=cover;image=loaded;crop={zoom:1,x:.5,y:.5};zoom.value='1';x.value=y.value='.5';draw();message.textContent='';}catch(error){message.textContent=error.message;}finally{reading=Math.max(0,reading-1);coverFile.disabled=false;}});
   let legacy=legacyContent(card);const intro=make('textarea');intro.value=card.body||'';intro.rows=4;intro.maxLength=30000;intro.setAttribute('aria-label','Вступний опис');const introField=field('Короткий вступний опис',intro);introField.classList.add('library-intro-field');form.append(introField);
   const blocks=content(card).map(b=>({...b}));if(!blocks.length)blocks.push({type:'text',text:''});const blockHost=make('section',undefined,'library-block-editor');const blockActions=make('div',undefined,'library-format');let blockReading=0;
   function paintBlocks(){blockHost.replaceChildren();for(const [i,block]of blocks.entries()){
    const box=make('section',undefined,'library-edit-block'),bar=make('div',undefined,'library-block-bar');bar.append(make('strong',(i+1)+'. '+(block.type==='text'?'Текст':block.type==='heading'?'Назва':'Фото')));
    const up=button('↑',()=>{dirty=true;[blocks[i-1],blocks[i]]=[blocks[i],blocks[i-1]];paintBlocks();});up.disabled=i===0;up.setAttribute('aria-label','Перемістити блок вище');const down=button('↓',()=>{dirty=true;[blocks[i+1],blocks[i]]=[blocks[i],blocks[i+1]];paintBlocks();});down.disabled=i===blocks.length-1;down.setAttribute('aria-label','Перемістити блок нижче');bar.append(up,down,button('Прибрати',()=>{dirty=true;blocks.splice(i,1);paintBlocks();}));box.append(bar);
    if(block.type==='heading'){const input=make('input');input.type='text';input.value=block.text;input.maxLength=200;input.setAttribute('aria-label','Назва розділу '+(i+1));input.addEventListener('input',()=>{block.text=input.value;});box.append(field('Назва розділу',input));
    }else if(block.type==='text'){const text=make('textarea');text.value=block.text;text.rows=5;text.maxLength=30000;text.setAttribute('aria-label','Текст блоку '+(i+1));text.addEventListener('input',()=>block.text=text.value);const format=make('div',undefined,'library-format');for(const [name,before,after]of [['Жирний','**','**'],['Курсив','*','*'],['Заголовок','\n## ',''],['Список','\n- ','']])format.append(button(name,()=>{dirty=true;const a=text.selectionStart,b=text.selectionEnd;text.setRangeText(before+(text.value.slice(a,b)||'текст')+after,a,b,'select');block.text=text.value;text.focus();}));box.append(field('Текст',text),format);
    }else{const upload=make('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';const preview=make('img',undefined,'library-editor-detail-image');preview.alt='Фото блоку '+(i+1);if(block.src)preview.src=block.src;const size=make('select');for(const [value,label]of [['small','Малий'],['medium','Середній'],['large','Великий']]){const o=make('option',label);o.value=value;size.append(o);}size.value=block.size||'medium';size.addEventListener('change',()=>{dirty=true;block.size=size.value;});upload.addEventListener('change',async()=>{if(!upload.files[0])return;blockReading++;upload.disabled=true;try{block.src=await resized(await readFile(upload.files[0]),1600,900000);preview.src=block.src;dirty=true;message.textContent='';}catch(error){message.textContent=error.message;}finally{blockReading--;upload.disabled=false;}});const side=make('select');side.setAttribute('aria-label','Розташування фото блоку '+(i+1));for(const [value,label]of [['right','Фото справа, текст зліва'],['left','Фото зліва, текст справа']]){const o=make('option',label);o.value=value;side.append(o);}side.value=block.side||'right';side.addEventListener('change',()=>{dirty=true;block.side=side.value;});box.append(field('Фото',upload),preview,field('Розмір фото',size),field('Розташування',side));}
    blockHost.append(box);
   }}
   blockActions.append(button('+ Додати назву',()=>{dirty=true;blocks.push({type:'heading',text:''});paintBlocks();}),button('+ Додати текст',()=>{dirty=true;blocks.push({type:'text',text:''});paintBlocks();}),button('+ Додати фото',()=>{dirty=true;blocks.push({type:'image',src:'',size:'medium'});paintBlocks();}));paintBlocks();form.append(blockHost,blockActions);
   if(filePath){const note=make('p','До картки прикріплено файл із бібліотеки пригоди.','library-help');form.append(note,button('Відкріпити файл',e=>{dirty=true;filePath='';note.remove();e.currentTarget.remove();}));}
   const audience=make('select');audience.setAttribute('aria-label','Доступ для гравців');for(const [value,text]of [['hidden','Приховано від усіх гравців'],['all','Відкрито всім гравцям'],['selected','Лише обраним гравцям']]){const option=make('option',text);option.value=value;audience.append(option);}audience.value=card.audience||'hidden';const players=make('fieldset',undefined,'library-player-picks');players.append(make('legend','Обери гравців'));for(const player of data?.players||[]){const label=make('label'),check=make('input');check.type='checkbox';check.value=player.user_id;check.checked=(card.targets||[]).includes(player.user_id);label.append(check,document.createTextNode(player.display_name));players.append(label);}if(!data?.players?.length)players.append(make('p','У кімнаті ще немає гравців.'));players.hidden=audience.value!=='selected';audience.addEventListener('change',()=>players.hidden=audience.value!=='selected');form.append(field('Доступ для гравців',audience),players);
   const children=make('section',undefined,'library-children-editor');children.setAttribute('aria-label','Підкартки');
   const addChild=button('+ Створити дод. матеріал',()=>openChild(),'btn primary');
   const childList=make('div',undefined,'library-children-list');let childrenPage=0,childrenRequest=0,childrenCount=0;
   const legacyNote=make('div',undefined,'library-legacy-editor');
   function paintLegacy(){legacyNote.replaceChildren();legacyNote.hidden=!legacy.length&&!filePath;if(legacyNote.hidden)return;
    legacyNote.append(make('p','У картці є матеріал зі старого редактора. Він збережений; його можна перенести в окрему підкартку.','library-help'),button('Перенести попередній вміст у підкартку',()=>openChild(true)));
   }
   async function loadChildren(){
    const request=++childrenRequest;if(!id){childList.replaceChildren();return;}
    try{const result=await api('?'+new URLSearchParams({parent:id,page:String(childrenPage)}));if(request!==childrenRequest||editingRoom!==room||editingGeneration!==generation)return;
     childrenCount=result.cards.length;childList.replaceChildren();
     for(const child of result.cards){const row=make('article',undefined,'library-child-row'),name=make('strong',child.title),tools=make('div',undefined,'library-child-actions');row.append(cover(child),name);
      const access=button(child.audience==='hidden'?'Приховано':child.audience==='selected'?'Обраним гравцям':'Відкрито всім',()=>quickAccess(child,{afterSave:loadChildren,returnDialog:editor}),'btn library-child-access');access.setAttribute('aria-label','Доступ: '+child.title);
      tools.append(button('Редагувати',()=>edit(child.id,{}, {nested:true,forceEntry:child.kind!=='category',onClose:loadChildren})),access,button('Видалити',e=>action(e.currentTarget,async()=>{await removeCard(child);await loadChildren();}),'btn danger'));row.append(tools);childList.append(row);
     }
     if(childrenPage>0||result.hasMore){const pagination=make('div',undefined,'library-pages'),prev=button('Попередні підкартки',()=>{childrenPage--;void loadChildren();}),next=button('Наступні підкартки',()=>{childrenPage++;void loadChildren();});prev.disabled=childrenPage===0;next.disabled=!result.hasMore;pagination.append(prev,make('span','Сторінка '+(childrenPage+1)),next);childList.append(pagination);}
    }catch(error){if(request===childrenRequest)childList.replaceChildren(make('p',error.message,'library-editor-status'));}
   }
   async function openChild(migrate=false){
    if(!await persist())return;
    const previousBlocks=legacy.map(b=>({...b})),previousFile=filePath;
    await edit(null,{kind:'entry',parent_id:id,category:categoryInput.value,...(migrate?{title:('Матеріали: '+card.title).slice(0,100),body:card.body,blocks:previousBlocks,image:card.image,file_path:previousFile,audience:card.audience,targets:card.targets}:{} )},{nested:true,forceEntry:true,onClose:loadChildren,onSaved:async()=>{
     if(!migrate)return;
     try{const moved=await api('/cards/'+id,{method:'PUT',body:JSON.stringify({title:card.title,revision:card.revision,blocks:[],image:'',file_path:''})});card=moved.card;legacy=[];filePath='';paintLegacy();}
     catch(error){message.textContent='Підкартку збережено. Попередній вміст залишено також у батьківській картці: '+error.message;}
    }});
   }
   children.append(make('h3','Підкартки'),addChild,legacyNote,childList);form.append(children);paintLegacy();
   let previousKind=kind.value;
   function paintKind(){const folder=kind.value==='category';if(kind.value!==previousKind){if(folder&&!intro.value)intro.value=blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n');if(!folder&&blocks.length===1&&blocks[0].type==='text'&&!blocks[0].text&&intro.value){blocks[0].text=intro.value;paintBlocks();}previousKind=kind.value;}introField.hidden=!folder;children.hidden=!folder;blockHost.hidden=folder;blockActions.hidden=folder;editor.dataset.kind=kind.value;blockHost.hidden=folder||kind.value==='image';blockActions.hidden=blockHost.hidden;coverLabel.querySelector('span').textContent=kind.value==='image'?'Зображення':'Зображення обкладинки';removeCover.textContent=kind.value==='image'?'Прибрати зображення':'Прибрати обкладинку';if(folder)void loadChildren();}
   kind.addEventListener('change',()=>{dirty=true;paintKind();});paintKind();
   const footer=make('div',undefined,'library-editor-footer'),save=make('button','Зберегти','btn primary');save.type='submit';footer.append(button('Скасувати',closeEditor),save);form.append(message,footer);editor.append(form);document.body.append(editor);editor.showModal();draw();if(coverSource){reading++;coverFile.disabled=true;void loadImage(coverSource).then(result=>{image=result;draw();}).catch(()=>{message.textContent='Не вдалося відкрити обкладинку.';}).finally(()=>{reading=Math.max(0,reading-1);coverFile.disabled=false;});}
   form.addEventListener('input',()=>dirty=true);form.addEventListener('change',()=>dirty=true);
   editor.addEventListener('cancel',e=>{if(dirty&&!confirm('Закрити без збереження змін?'))e.preventDefault();});
   editor.addEventListener('close',()=>{editor.remove();editors.delete(editor);dialog=previousDialog?.open?previousDialog:null;if(editingRoom===room&&editingGeneration===generation)void options.onClose?.();});
   let saving=false;
   async function persist(){
    if(saving)return false;
    if(reading||blockReading){message.textContent='Зачекай, зображення ще обробляється.';return false;}
    if(editingRoom!==room||editingGeneration!==generation){message.textContent='Кімната змінилася. Відкрий матеріал ще раз.';return false;}
    if(!title.value.trim()){message.textContent='Вкажи назву матеріалу.';title.focus();return false;}
    if(kind.value!=='category'&&childrenCount){message.textContent='Картка має підкартки. Спочатку перенеси або видали їх.';return false;}
    saving=true;save.disabled=true;addChild.disabled=true;
    try{
     const targets=[...players.querySelectorAll('input:checked')].map(c=>c.value);if(audience.value==='selected'&&!targets.length)throw Error('Обери хоча б одного гравця.');
     const folder=kind.value==='category',picture=kind.value==='image';if(picture&&(!coverSource||!pictureSource))throw Error('Додай зображення до картки.');const savedBlocks=picture?[]:folder?(card.kind==='entry'?blocks:legacy.length?(card.blocks||[]):[]):blocks.filter(b=>b.type!=='text'||b.text.trim());
     if(!folder)for(const block of savedBlocks)if(block.type==='heading'&&!block.text.trim())throw Error('Вкажи назву розділу або прибери порожній блок.');
     if(!folder)for(const block of savedBlocks)if(block.type==='image'){if(!block.src)throw Error('Додай фото до блоку або прибери порожній блок.');if(block.src.length>950000)block.src=await resized(block.src,1600,900000);}
     const payload={kind:kind.value,title:title.value,body:picture?'':folder?intro.value:savedBlocks.find(b=>b.type==='text')?.text||'',blocks:savedBlocks,category:categoryInput.value,parent_id:card.parent_id??null,audience:audience.value,targets,cover_source:coverSource,cover_thumb:coverSource?canvas.toDataURL('image/webp',.8):'',crop,image:picture?pictureSource:folder?(card.image||''):savedBlocks.find(b=>b.type==='image')?.src||'',file_path:picture?'':filePath,revision:card.revision};
     if(payload.cover_thumb.length>110000){const thumb=document.createElement('canvas');thumb.width=240;thumb.height=320;thumb.getContext('2d').drawImage(canvas,0,0,240,320);payload.cover_thumb=thumb.toDataURL('image/webp',.7);}
     const result=await api(id?'/cards/'+id:'',{method:id?'PUT':'POST',body:JSON.stringify(payload)});if(editingRoom!==room||editingGeneration!==generation)return false;id=result.card.id;card=result.card;legacy=legacyContent(card);if(detail?.id===id)detail=card;dirty=false;paintLegacy();message.textContent='';await options.onSaved?.(card);await refresh(true);return true;
    }catch(error){message.textContent=error.message;return false;}finally{saving=false;save.disabled=false;addChild.disabled=false;}
   }
   form.addEventListener('submit',async e=>{e.preventDefault();if(await persist()){editor.close();status('');}});

  }
  const timer=setInterval(()=>{if(room&&isActive()&&!document.hidden&&!dialog?.open&&!dragged)void refresh();},3500);
  const reconnect=()=>{if(room&&isActive())void refresh(true);};window.addEventListener?.('online',reconnect);
  return {
   activate(scope){if(scope.gameId===room&&scope.userId===user&&scope.role===role)return;window.closeMaterialImage?.();generation++;for(const open of editors){open.close();open.remove();}editors.clear();dialog?.close();dialog=null;room=scope.gameId;user=scope.userId;role=scope.role;parent=null;category=null;page=0;version='';data=null;detail=null;generation++;busy=false;restore();render();void refresh(true);},
   show(){showLibrary();},
   async importAsset(asset){if(role!=='keeper')return;const prefill={kind:'entry',title:asset.title||asset.name||'Матеріал',body:asset.note||'',file_path:asset.sourceFilePath||''};if(asset.type?.startsWith('image/')&&asset.url?.startsWith('data:image/')){prefill.image=await resized(asset.url,1800,900000);prefill.cover_source=await resized(asset.url,1200,280000);}await edit(null,prefill);},
   dispose(){window.closeMaterialImage?.();window.removeEventListener?.('online',reconnect);clearInterval(timer);for(const open of editors)open.remove();editors.clear();dialog?.remove();browserDialog?.remove();root.remove();}
  };
 };
})();
