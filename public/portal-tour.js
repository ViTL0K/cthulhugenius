(()=>{
 const room=document.querySelector('#roomView');if(!room)return;
 const storageKey=scope=>'cth-tour-99:'+scope.userId+':'+scope.role;
 let scope=null,pending=null,overlay=null,step=0,previousFocus=null;
 const create=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
 const done=()=>{try{return localStorage.getItem(storageKey(scope))==='done';}catch{return false;}};
 const steps=()=>[
  ['.library-stage','Матеріали гри',scope.role==='keeper'?'Кнопка + додає вкладки й матеріали. Статус під карткою відкриває доступ гравцям; ⚙ вмикає редагування та перетягування.':'Тут розташовані матеріали, які ведучий відкрив тобі. Обирай категорію та відкривай картки.'],
  [scope.role==='keeper'?'[data-action="edit-member-sheets"]':'[data-action="sheet"]','Листи дослідників',scope.role==='keeper'?'Створюй підготовлених персонажів і призначай їх гравцям через цей розділ.':'Відкрий власний лист. Натискай характеристики та вміння, щоб зробити кидок.'],
  ['#dicePanel','Кидки кубиків',scope.role==='keeper'?'Обери кубик і видимість кидка. Приховані кидки залишаються тільки у ведучого.':'Обери кубик і зроби кидок. Результат з’явиться в чаті відповідно до обраної видимості.'],
  ['.room-chat','Спільний та особистий чат','Спілкуйся з усією кімнатою або обери одержувача для приватного повідомлення.'],
  ['.toolbox','Інструменти',scope.role==='keeper'?'Тут зібрані листи, файли, нотатки та налаштування гри. Кнопка ? повторно запускає екскурсію.':'Тут зібрані лист персонажа, матеріали й правила. Кнопка ? повторно запускає екскурсію.']
 ];
 function close(mark=false){if(mark&&scope)try{localStorage.setItem(storageKey(scope),'done');}catch{}overlay?.remove();overlay=null;document.removeEventListener('keydown',keyboard);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);if(previousFocus?.isConnected)previousFocus.focus();}
 function keyboard(e){if(e.key==='Escape'){e.preventDefault();close(true);}}
 function position(){if(!overlay)return;const target=room.querySelector(steps()[step][0])||room,rect=target.getBoundingClientRect(),spot=overlay.querySelector('.portal-tour-spot'),card=overlay.querySelector('.portal-tour-card');const visible=rect.width>0&&rect.height>0;const r=visible?rect:room.getBoundingClientRect();
  spot.style.left=Math.max(2,r.left-4)+'px';spot.style.top=Math.max(2,r.top-4)+'px';spot.style.width=Math.min(window.innerWidth-4,r.width+8)+'px';spot.style.height=Math.min(window.innerHeight-4,r.height+8)+'px';
  const width=Math.min(360,window.innerWidth-24);card.style.width=width+'px';const height=card.getBoundingClientRect().height||230;card.style.left=Math.max(12,Math.min(window.innerWidth-width-12,r.left))+'px';const below=r.bottom+12;card.style.top=(below+height<window.innerHeight?below:Math.max(12,Math.min(window.innerHeight-height-12,r.top-height-12)))+'px';
 }
 function paint(){if(!overlay)return;overlay.replaceChildren(create('div','','portal-tour-spot'));const card=create('section','','portal-tour-card');card.setAttribute('role','dialog');card.setAttribute('aria-label','Екскурсія порталом');const [selector,title,text]=steps()[step];card.append(create('small',(step+1)+' / '+steps().length),create('h3',title),create('p',text));const actions=create('div','','portal-tour-actions');const skip=create('button','Пропустити');skip.type='button';skip.onclick=()=>close(true);const next=create('button',step===steps().length-1?'Завершити':'Далі','primary');next.type='button';next.onclick=()=>{if(step===steps().length-1){close(true);return;}step++;paint();};actions.append(skip,next);card.append(actions);overlay.append(card);position();next.focus();}
 function start(){if(!scope?.userId||!room.classList.contains('active'))return;close();previousFocus=document.activeElement;overlay=create('div','','portal-tour');document.body.append(overlay);step=0;document.addEventListener('keydown',keyboard);window.addEventListener('resize',position);window.addEventListener('scroll',position,true);paint();}
 function enter(next){scope=next;if(!scope?.userId||done()||overlay)return;clearTimeout(pending);pending=setTimeout(()=>{if(!document.querySelector('dialog[open]'))start();},600);}
 window.portalTour={enter,restart:start};
 const controls=room.querySelector('.room-controls');if(controls){const replay=create('button','?','btn portal-tour-replay');replay.type='button';replay.title='Екскурсія порталом';replay.setAttribute('aria-label','Повторити екскурсію');replay.onclick=start;controls.append(replay);}
 const observer=new MutationObserver(()=>{if(!room.classList.contains('active')){if(overlay)close();return;}if(!overlay&&room.dataset.tourUser&&!document.querySelector('dialog[open]'))enter({userId:room.dataset.tourUser,role:room.dataset.tourRole||'player'});});observer.observe(room,{attributes:true,attributeFilter:['class','data-tour-user','data-tour-role']});
 document.addEventListener('close',()=>{if(scope&&!done()&&!overlay&&room.classList.contains('active'))enter(scope);},true);
 if(room.classList.contains('active')&&room.dataset.tourUser)enter({userId:room.dataset.tourUser,role:room.dataset.tourRole||'player'});
})();
