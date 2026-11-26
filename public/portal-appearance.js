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
 apply(saved);
 function mount(form){if(form.querySelector('[data-color-settings]'))return;
  const fieldset=document.createElement('fieldset');fieldset.dataset.colorSettings='true';fieldset.className='portal-color-settings';const legend=document.createElement('legend');legend.textContent='Власні кольори';fieldset.append(legend);
  const enabledLabel=document.createElement('label'),enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!saved;enabledLabel.append(enabled,document.createTextNode(' Використовувати власну палітру'));fieldset.append(enabledLabel);
  const inputs={};for(const [name,label]of [['background','Основний фон · 60%'],['surface','Панелі та картки · 30%'],['accent','Акцент · 10%']]){const row=document.createElement('label');row.className='portal-color-row';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='color';input.value=(saved||defaults)[name];input.setAttribute('aria-label',label);inputs[name]=input;row.append(text,input);fieldset.append(row);input.addEventListener('input',()=>{enabled.checked=true;preview();});}
  const presets=document.createElement('div');presets.className='portal-accent-presets';for(const [label,color]of [['Золото','#d9b566'],['Бірюза','#36d3bd'],['Помаранчевий','#ff7a1a'],['Синій','#6ca9ff']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.setProperty('--swatch',color);b.addEventListener('click',()=>{inputs.accent.value=color;enabled.checked=true;preview();});presets.append(b);}fieldset.append(presets);
  const sample=document.createElement('div');sample.className='portal-color-sample';const sampleText=document.createElement('span');sampleText.textContent='Матеріали гри';const sampleButton=document.createElement('span');sampleButton.textContent='Відкрити';sample.append(sampleText,sampleButton);fieldset.append(sample);
  function preview(){sample.style.background=inputs.background.value;sampleText.style.background=inputs.surface.value;sampleText.style.color=ink(inputs.surface.value);sampleButton.style.background=inputs.accent.value;sampleButton.style.color=ink(inputs.accent.value);}
  preview();form.append(fieldset);form.addEventListener('submit',()=>{saved=enabled.checked?Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value])):null;try{if(saved)localStorage.setItem(key,JSON.stringify(saved));else localStorage.removeItem(key);}catch{}apply(saved);},true);
 }
 const modal=document.querySelector('#modalBody');if(modal)new MutationObserver(()=>{const form=modal.querySelector('#appearanceSettings');if(form)mount(form);}).observe(modal,{childList:true,subtree:true});
})();
