/* Shared room map and the keeper's persistent room portrait. */
(()=>{
 window.createRoomExtras=({state,rpc,openModal,toast,onPortrait,isActive=()=>true,translate=key=>key})=>{
  const t=key=>translate(key),make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(label,fn,cls='btn')=>{const b=make('button',t(label),cls);b.type='button';b.addEventListener('click',fn);return b;};
  const field=(label,input)=>{const e=make('label',undefined,'field');e.append(make('span',t(label)),input);return e;};
  async function imageFile(file,maxSide,maxLength){
   if(!file?.type.startsWith('image/')||file.size>25*1024*1024)throw Error(t('Обери зображення до 25 МБ.'));
   const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error(t('Не вдалося прочитати файл.')));reader.readAsDataURL(file);});
   const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');let ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight)),result;
   do{canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);result=canvas.toDataURL('image/webp',.85);ratio*=.8;}while(result.length>maxLength&&canvas.width>40);
   if(result.length>maxLength)throw Error(t('Зображення завелике. Обери менший файл.'));return result;
  }
  let profilesAt=0,profilesKey='',busy=false;
  async function refreshProfiles(force=false){
   if(!state.cloud||!state.userId||!state.gameId||!isActive()||busy)return;
   const key=state.gameId+':'+state.userId;if(key!==profilesKey){profilesKey=key;profilesAt=0;}
   if(!force&&Date.now()-profilesAt<5000)return;busy=true;profilesAt=Date.now();const game=state.gameId,user=state.userId;
   try{const rows=await rpc('get_room_profiles',{target_game:game});if(state.gameId!==game||state.userId!==user)return;for(const row of rows||[])onPortrait(row);}catch{profilesAt=0;}finally{busy=false;}
  }
  async function openMap(){
   const game=state.gameId,user=state.userId;if(!game)return;
   try{const map=await rpc('get_room_map',{target_game:game});if(state.gameId!==game||state.userId!==user||!isActive())return;if(map?.image)await window.openMaterialImage({src:map.image,title:map.title||t('Карта'),container:document.querySelector('#roomView .library-stage')});else if(state.role==='keeper')await editMap();else toast(t('Ведучий ще не додав карту.'));}catch(error){toast(error.message);}
  }
  async function editMap(){
   if(state.role!=='keeper'||!state.gameId)return;const game=state.gameId,user=state.userId;
   let previous;try{previous=await rpc('get_room_map',{target_game:game});}catch(error){toast(error.message);return;}if(state.gameId!==game||state.userId!==user)return;
   openModal(t('Карта кімнати'),'<div id="roomMapEditor" class="room-extras-editor"></div>');const host=document.querySelector('#roomMapEditor');
   const title=make('input');title.type='text';title.maxLength=100;title.value=previous?.title||t('Карта');title.setAttribute('aria-label',t('Назва карти'));
   const file=make('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';const preview=make('img',undefined,'room-extras-preview');preview.alt=t('Попередній перегляд');let source=previous?.image||'',reading=false,saving=false;if(source)preview.src=source;preview.hidden=!source;
   const message=make('p','','room-extras-status');message.setAttribute('role','status');host.append(field('Назва карти',title),field('Зображення карти',file),preview,message);
   file.addEventListener('change',async()=>{if(!file.files[0])return;reading=true;try{source=await imageFile(file.files[0],2400,900000);preview.src=source;preview.hidden=false;message.textContent='';}catch(error){message.textContent=error.message;}finally{reading=false;}});
   const actions=make('div',undefined,'room-extras-actions');
   async function save(remove=false){if(reading||saving||state.gameId!==game||state.userId!==user||state.role!=='keeper')return;if(!remove&&!source){message.textContent=t('Додай зображення до картки.');return;}saving=true;for(const b of actions.querySelectorAll('button'))b.disabled=true;
    try{await rpc('set_room_map',{target_game:game,title:title.value,image:remove?'':source});if(state.gameId===game)host.closest('dialog')?.close();}catch(error){message.textContent=error.message;}finally{saving=false;for(const b of actions.querySelectorAll('button'))b.disabled=false;}}
   actions.append(button('Зберегти',()=>save(false),'btn primary'));if(source)actions.append(button('Прибрати карту',()=>save(true)));host.append(actions);
  }
  async function editPortrait(){
   if(state.role!=='keeper'||!state.userId||!state.gameId)return;const game=state.gameId,user=state.userId;let rows;
   try{rows=await rpc('get_room_profiles',{target_game:game});}catch(error){toast(error.message);return;}if(state.gameId!==game||state.userId!==user)return;
   const profile=(rows||[]).find(row=>row.user_id===user)||{};let source=profile.portrait||'',reading=false,saving=false;
   openModal(t('Аватар ведучого'),'<div id="keeperPortraitEditor" class="room-extras-editor"></div>');const host=document.querySelector('#keeperPortraitEditor');
   const file=make('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';const frame=make('div',undefined,'room-profile-preview'),preview=make('img');preview.alt=t('Аватар ведучого');if(source)preview.src=source;preview.hidden=!source;frame.append(preview);host.append(field('Зображення профілю',file),frame);
   const controls={};for(const [key,label,min,max,value,step]of [['zoom','Масштаб',1,3,profile.zoom||1,.05],['x','Положення по горизонталі',-50,50,profile.x||0,1],['y','Положення по вертикалі',-50,50,profile.y||0,1]]){const input=make('input');Object.assign(input,{type:'range',min:String(min),max:String(max),step:String(step),value:String(value)});controls[key]=input;host.append(field(label,input));input.addEventListener('input',paint);}
   function paint(){preview.hidden=!source;if(source)preview.src=source;preview.style.transform='translate('+controls.x.value+'%,'+controls.y.value+'%) scale('+controls.zoom.value+')';}paint();
   const message=make('p','','room-extras-status');message.setAttribute('role','status');host.append(message);
   file.addEventListener('change',async()=>{if(!file.files[0])return;reading=true;try{source=await imageFile(file.files[0],480,280000);controls.zoom.value='1';controls.x.value=controls.y.value='0';paint();message.textContent='';}catch(error){message.textContent=error.message;}finally{reading=false;}});
   const actions=make('div',undefined,'room-extras-actions');actions.append(button('Прибрати зображення',()=>{source='';paint();}),button('Зберегти',async()=>{if(reading||saving||state.gameId!==game||state.userId!==user||state.role!=='keeper')return;saving=true;try{const row=await rpc('set_my_room_portrait',{target_game:game,portrait:source,zoom:Number(controls.zoom.value),x:Number(controls.x.value),y:Number(controls.y.value)});if(state.gameId!==game||state.userId!==user)return;onPortrait(row);profilesAt=0;void state.roomSub?.send({type:'broadcast',event:'participant-photo',payload:row}).catch(()=>{});host.closest('dialog')?.close();}catch(error){message.textContent=error.message;}finally{saving=false;}},'btn primary'));host.append(actions);
  }
  const timer=setInterval(()=>{void refreshProfiles();},5000);
  return {openMap,editMap,editPortrait,refreshProfiles,dispose(){clearInterval(timer);}};
 };
})();
