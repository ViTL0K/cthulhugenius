(()=>{
 const key='cth-portal-colors',valid=v=>/^#[0-9a-f]{6}$/i.test(v||'');
 const defaults={background:'#101914',surface:'#26362b',accent:'#d9b566'};
 let saved=null;try{const item=JSON.parse(localStorage.getItem(key));if(item&&['background','surface','accent'].every(k=>valid(item[k])))saved=item;}catch{}
 const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
 const luminance=hex=>rgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const ink=hex=>luminance(hex)>.179?'#101613':'#f4f1e7';
 const mix=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(v*(1-t)+rgb(b)[i]*t).toString(16).padStart(2,'0')).join('');
 function apply(colors){const body=document.body;const vars=['--bg','--panel','--panel2','--line','--ink','--muted','--gold','--gold2','--accent-ink','--base-ink'];if(!colors){delete body.dataset.customColors;vars.forEach(k=>body.style.removeProperty(k));return;}
  body.dataset.customColors='true';const values={'--bg':colors.background,'--panel':colors.surface,'--panel2':mix(colors.surface,ink(colors.surface),.055),'--line':mix(colors.surface,colors.accent,.42),'--ink':ink(colors.surface),'--muted':mix(colors.surface,ink(colors.surface),.72),'--gold':colors.accent,'--gold2':colors.accent,'--accent-ink':ink(colors.accent),'--base-ink':ink(colors.background)};
  for(const [name,value]of Object.entries(values))body.style.setProperty(name,value);
 }
 apply(saved);try{document.body.dataset.liveBackground=localStorage.getItem('cth-live-background')==='off'?'off':'on';}catch{document.body.dataset.liveBackground='on';}
 function mount(form){if(form.querySelector('[data-color-settings]'))return;
  const fieldset=document.createElement('fieldset');fieldset.dataset.colorSettings='true';fieldset.className='portal-color-settings';const legend=document.createElement('legend');legend.textContent='Власні кольори';fieldset.append(legend);
  const enabledLabel=document.createElement('label'),enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!saved;enabledLabel.append(enabled,document.createTextNode(' Використовувати власну палітру'));fieldset.append(enabledLabel);
  const inputs={};for(const [name,label]of [['background','Основний фон · 60%'],['surface','Панелі та картки · 30%'],['accent','Акцент · 10%']]){const row=document.createElement('label');row.className='portal-color-row';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='color';input.value=(saved||defaults)[name];input.setAttribute('aria-label',label);inputs[name]=input;row.append(text,input);fieldset.append(row);input.addEventListener('input',()=>{enabled.checked=true;preview();});}
  const schemes=[
   ['Опівнічний Помаранч','#141413','#233554','#FF7A1A'],
   ['Неоновий Кобальт','#182238','#293757','#D6FF3D'],
   ['Оксамитовий Неон','#1A211E','#2C3531','#FF3EA5'],
   ['Аркхемське Золото','#121714','#1E2822','#E5B85C'],
   ['Кривавий Ритуал','#161214','#282024','#E63946'],
   ['Бірюзова Безодня','#101C21','#20383E','#36D3BD']
  ];
  const presets=document.createElement('div');presets.className='portal-palette-presets';for(const [label,background,surface,accent]of schemes){const b=document.createElement('button');b.type='button';b.className='portal-palette-preset';b.setAttribute('aria-label',label);const colors={background,surface,accent};const strips=document.createElement('span');strips.className='palette-strips';for(const [i,color]of [background,surface,accent].entries()){const strip=document.createElement('span');strip.textContent=['60%','30%','10%'][i];strip.style.background=color;strip.style.color=ink(color);strips.append(strip);}const title=document.createElement('span');title.className='palette-preset-name';title.textContent=label;b.append(strips,title);b.addEventListener('click',()=>{for(const [k,v]of Object.entries(colors))inputs[k].value=v;enabled.checked=true;preview();});presets.append(b);}fieldset.append(presets);
  const sample=document.createElement('div');sample.className='portal-color-sample';const sampleText=document.createElement('span');sampleText.textContent='Матеріали гри';const sampleButton=document.createElement('span');sampleButton.textContent='Відкрити';sample.append(sampleText,sampleButton);fieldset.append(sample);
  const motionKey='cth-live-background';let moving=true;try{moving=localStorage.getItem(motionKey)!=='off';}catch{}
  const motionLabel=document.createElement('label'),motion=document.createElement('input');motionLabel.className='portal-motion-control';motion.type='checkbox';motion.checked=moving;motion.setAttribute('aria-label','Живе переливання фону');motionLabel.append(motion,document.createTextNode('Живе переливання фону'));fieldset.append(motionLabel);
  function miniature(host){if(host.querySelector('.mini-room'))return;host.replaceChildren();
   const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
   const room=el('div','','mini-room'),header=el('div','','mini-header');header.append(el('b','☼ Поклик Ктулху'),el('span','CTH-1926'));
   const side=el('aside','','mini-sidebar');side.append(el('b','Учасники'),el('span','● Ведучий'),el('span','● Дослідник'),el('span','● Дослідниця'));
   const stage=el('section','','mini-stage');stage.append(el('b','Матеріали гри'));const card=el('div','','mini-material');card.append(el('div','⌂','mini-cover'),el('span','Центральна бібліотека'));stage.append(card);
   const tools=el('aside','','mini-tools');tools.append(el('b','Інструменти'),el('span','Лист персонажа'),el('span','Матеріали'),el('span','Кинути','mini-primary'));
   const chat=el('section','','mini-chat');chat.append(el('b','Спільний чат'),el('span','Слух: 24 — Успіх','mini-message'),el('span','Написати повідомлення…','mini-input'));room.append(header,side,stage,tools,chat);host.append(room);
  }
  function preview(){const upper=form.querySelector('#appearancePreview');if(upper){miniature(upper);upper.dataset.liveBackground=motion.checked?'on':'off';
    for(const key of ['background-image','background-color','--panel','--panel2','--gold','--gold2','--bg','--ink','--line','color','--surface-dark','--surface-light','--wash-light','--wash-dark','--accent-ink'])upper.style.removeProperty(key);
    if(enabled.checked){const bg=inputs.background.value,surface=inputs.surface.value,accent=inputs.accent.value;for(const [key,value]of Object.entries({'--bg':bg,'--surface-dark':bg,'--surface-light':mix(bg,surface,.6),'--wash-light':mix(bg,surface,.6)+'bb','--wash-dark':bg+'dd','--panel':surface,'--panel2':mix(surface,ink(surface),.05),'--gold':accent,'--gold2':accent,'--ink':ink(surface),'--line':mix(surface,accent,.4),'--accent-ink':ink(accent)}))upper.style.setProperty(key,value);}}
   for(const b of presets.querySelectorAll('button')){const scheme=schemes.find(s=>s[0]===b.getAttribute('aria-label'));b.setAttribute('aria-pressed',String(enabled.checked&&['background','surface','accent'].every((k,i)=>inputs[k].value.toLowerCase()===scheme[i+1].toLowerCase())));}
   sample.style.background=inputs.background.value;sampleText.style.background=inputs.surface.value;sampleText.style.color=ink(inputs.surface.value);sampleButton.style.background=inputs.accent.value;sampleButton.style.color=ink(inputs.accent.value);
  }
  form.addEventListener('input',preview);form.addEventListener('submit',()=>{document.body.dataset.liveBackground=motion.checked?'on':'off';try{localStorage.setItem(motionKey,motion.checked?'on':'off');}catch{}},true);
  form.addEventListener('change',preview);preview();form.append(fieldset);form.addEventListener('submit',()=>{saved=enabled.checked?Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value])):null;try{if(saved)localStorage.setItem(key,JSON.stringify(saved));else localStorage.removeItem(key);}catch{}apply(saved);},true);
 }
 const modal=document.querySelector('#modalBody');if(modal)new MutationObserver(()=>{const form=modal.querySelector('#appearanceSettings');if(form)mount(form);}).observe(modal,{childList:true,subtree:true});
})();
