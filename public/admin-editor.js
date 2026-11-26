// Keep the existing editors and their save logic inside the administrator cabinet.
export function createAdminEditor({document,window,openRoom,onClose}){
 const dialog=document.querySelector('#admin-content-editor'),host=document.querySelector('#admin-editor-host'),title=document.querySelector('#admin-editor-title'),close=document.querySelector('#admin-editor-close');let frame=null,closing=false;
 const names={rules:'Правила гри',quotes:'Цитати порталу',appearance:'Вигляд порталу',materials:'Матеріали пригоди',sheets:'Листи персонажів',files:'PDF і зображення',notes:'Нотатки',settings:'Налаштування кімнати',report:'Повідомлення',account:'Налаштування акаунта'};
 async function open({game,tool,extra={}}){
  const url=new URL(game?await openRoom(game):'/migration/?workspace=1',window.location.origin);url.searchParams.set('embed','admin');url.searchParams.set('tool',tool);for(const [k,v]of Object.entries(extra))if(v)url.searchParams.set(k,v);
  title.textContent=names[tool]||'Редагування';host.replaceChildren();frame=document.createElement('iframe');frame.title=title.textContent;frame.src=url.pathname+url.search;host.append(frame);if(!dialog.open)dialog.showModal();
 }
 async function finish(){if(closing)return;closing=true;close.disabled=true;try{
  const allowed=await frame?.contentWindow?.adminEmbeddedEditor?.close?.();
  if(allowed===false)return;
  dialog.close();frame?.remove();frame=null;await onClose?.();
 }catch(error){window.alert('Не вдалося зберегти зміни: '+error.message);}finally{closing=false;close.disabled=false;}}
 close.addEventListener('click',()=>void finish());dialog.addEventListener('cancel',event=>{event.preventDefault();void finish();});
 return {open};
}
