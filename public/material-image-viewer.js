/* Full-window image viewer; no changes to the stored material or its image. */
(()=>{
 let active=null;
 window.closeMaterialImage=()=>active?.close();
 window.openMaterialImage=async({src,title='',container=null,onEdit=null})=>{
  active?.close();
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const viewer=make(container?'section':'dialog',undefined,'material-image-viewer');active=viewer;
  const previousFocus=document.activeElement;if(container){viewer.classList.add('material-image-embedded');viewer.setAttribute('role','region');viewer.tabIndex=-1;viewer.open=true;viewer.close=()=>{if(!viewer.open)return;viewer.open=false;cleanup();};}
  viewer.setAttribute('aria-label',title?'Зображення: '+title:'Перегляд зображення');
  const toolbar=make('header',undefined,'material-image-toolbar'),name=make('strong',title),tools=make('div',undefined,'material-image-controls');
  const control=(label,action,text=label)=>{const button=make('button',text,'btn');button.type='button';button.setAttribute('aria-label',label);button.addEventListener('click',action);return button;};
  const viewport=make('div',undefined,'material-image-viewport'),surface=make('div',undefined,'material-image-surface'),picture=make('img');picture.alt=title;picture.draggable=false;
  viewport.tabIndex=0;viewport.setAttribute('aria-label','Зображення. Колесо миші змінює масштаб; перетягування переміщує зображення.');
  const message=make('p','Завантажуємо зображення…','material-image-status');message.setAttribute('role','status');
  const amount=make('output','100%'),slider=make('input');slider.type='range';slider.min='5';slider.max='800';slider.step='1';slider.value='100';slider.setAttribute('aria-label','Масштаб зображення');
  let naturalWidth=0,naturalHeight=0,scale=1,fitMode=true,drag=null;
  function zoom(next,point){
   if(!naturalWidth||!viewer.open)return;
   const bounds=viewport.getBoundingClientRect(),vw=viewport.clientWidth||1,vh=viewport.clientHeight||1;
   const x=point?point.x-bounds.left:vw/2,y=point?point.y-bounds.top:vh/2;
   const oldWidth=naturalWidth*scale,oldHeight=naturalHeight*scale;
   const imageX=(viewport.scrollLeft+x-Math.max(0,(vw-oldWidth)/2))/scale;
   const imageY=(viewport.scrollTop+y-Math.max(0,(vh-oldHeight)/2))/scale;
   scale=Math.min(8,Math.max(.05,next));fitMode=false;
   const width=naturalWidth*scale,height=naturalHeight*scale;
   surface.style.width=Math.max(vw,width)+'px';surface.style.height=Math.max(vh,height)+'px';picture.style.width=width+'px';picture.style.height=height+'px';
   viewport.scrollLeft=Math.max(0,imageX*scale+Math.max(0,(vw-width)/2)-x);
   viewport.scrollTop=Math.max(0,imageY*scale+Math.max(0,(vh-height)/2)-y);
   const percent=Math.round(scale*100);amount.textContent=percent+'%';slider.value=String(percent);slider.setAttribute('aria-valuetext',percent+'%');minus.disabled=scale<=.05;plus.disabled=scale>=8;
  }
  function fit(){if(!naturalWidth)return;zoom(Math.min(1,Math.max(1,viewport.clientWidth-32)/naturalWidth,Math.max(1,viewport.clientHeight-32)/naturalHeight));viewport.scrollLeft=viewport.scrollTop=0;fitMode=true;}
  const minus=control('Зменшити',()=>zoom(scale/1.25),'−'),plus=control('Збільшити',()=>zoom(scale*1.25),'+');
  const fitButton=control('Вписати зображення',fit,'Вписати'),original=control('Масштаб 100%',()=>zoom(1),'100%');
  const full=control('Повний екран',async()=>{try{if(document.fullscreenElement===viewer)await document.exitFullscreen?.();else await viewer.requestFullscreen?.();}catch{message.textContent='Повноекранний режим браузера недоступний.';}} ,'⛶');
  full.hidden=!!container||typeof viewer.requestFullscreen!=='function';
  const close=control('Закрити зображення',()=>viewer.close(),'×');close.classList.add('material-image-close');
  if(onEdit)tools.append(control('Редагувати карту',onEdit));tools.append(minus,amount,plus,slider,fitButton,original,full,close);toolbar.append(name,tools);surface.append(picture);viewport.append(surface);viewer.append(toolbar,viewport,message);(container||document.body).append(viewer);if(!container)viewer.showModal();viewer.focus();
  slider.addEventListener('input',()=>zoom(Number(slider.value)/100));
  viewport.addEventListener('wheel',event=>{if(!naturalWidth)return;event.preventDefault();zoom(scale*Math.exp(-Math.max(-200,Math.min(200,event.deltaY))*.002),{x:event.clientX,y:event.clientY});},{passive:false});
  viewport.addEventListener('pointerdown',event=>{if(event.button!==0||!naturalWidth)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture?.(event.pointerId);viewport.classList.add('dragging');});
  viewport.addEventListener('pointermove',event=>{if(!drag)return;viewport.scrollLeft=Math.max(0,drag.left-(event.clientX-drag.x));viewport.scrollTop=Math.max(0,drag.top-(event.clientY-drag.y));});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,()=>{drag=null;viewport.classList.remove('dragging');});
  viewer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();viewer.close();}else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(scale*1.25);}else if(event.key==='-'){event.preventDefault();zoom(scale/1.25);}else if(event.key==='0'){event.preventDefault();fit();}});
  const resize=()=>{if(fitMode)fit();else zoom(scale);};window.addEventListener?.('resize',resize);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(viewport);
  function cleanup(){window.removeEventListener?.('resize',resize);observer?.disconnect();if(document.fullscreenElement===viewer)void document.exitFullscreen?.().catch(()=>{});viewer.remove();if(active===viewer)active=null;if(previousFocus?.isConnected)previousFocus.focus();}
  viewer.addEventListener('close',cleanup);
  try{
   const source=new Image();source.src=src;await source.decode();
   if(active!==viewer||!viewer.open)return viewer;
   naturalWidth=source.naturalWidth;naturalHeight=source.naturalHeight;if(!naturalWidth||!naturalHeight)throw Error('image');picture.src=src;message.textContent='';fit();
  }catch{if(active===viewer){message.textContent='Не вдалося відкрити зображення.';minus.disabled=plus.disabled=slider.disabled=fitButton.disabled=original.disabled=true;}}
  return viewer;
 };
})();
