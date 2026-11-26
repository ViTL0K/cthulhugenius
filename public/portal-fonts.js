(()=>{
 const options=[['classic','Класичний'],['volja','Volja'],['irpin','Irpin Type'],['epoch','Epoch']];
 const key='cth-portal-font';let value='classic';try{const saved=localStorage.getItem(key);if(options.some(([id])=>id===saved))value=saved;}catch{}
 function apply(next){value=next;document.body.dataset.portalFont=value;try{localStorage.setItem(key,value);}catch{}for(const select of document.querySelectorAll('[data-portal-font-picker]'))select.value=value;}
 function picker(host){if(host.querySelector('[data-portal-font-picker]'))return;const label=document.createElement('label');label.className='portal-font-control';const text=document.createElement('span');text.textContent='Шрифт';const select=document.createElement('select');select.dataset.portalFontPicker='true';select.setAttribute('aria-label','Шрифт інтерфейсу');for(const [id,name]of options){const o=document.createElement('option');o.value=id;o.textContent=name;select.append(o);}select.value=value;select.addEventListener('change',()=>apply(select.value));label.append(text,select);host.append(label);}
 apply(value);const entry=document.querySelector('#joinForm .theme-select-card');if(entry)picker(entry);
 const toolbar=document.querySelector('#font-settings');if(toolbar)picker(toolbar);
 const modal=document.querySelector('#modalBody');if(modal)new MutationObserver(()=>{if((modal.querySelector('#interfaceLanguage')||modal.querySelector('#appearanceSettings'))&&!modal.querySelector('[data-portal-font-picker]'))picker(modal.querySelector('#appearanceSettings')||modal);}).observe(modal,{childList:true});
})();
