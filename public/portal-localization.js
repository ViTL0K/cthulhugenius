/* Translate interface labels while preserving authored names, text and messages. */
(()=>{
 const locale=window.cthLocale;if(!locale?.ui)return;
 const originals=new WeakMap(),attributes=new WeakMap();
 const excluded='script,style,textarea,input,.sheet-pdf-pages,.library-prose,.library-section-heading,.library-card-title,.library-cover-text,.library-detail>h2,.library-folder-intro>h2,.library-child-row>strong,.participant-name,.roster-character,.message,.room-announcement p,.game-row strong,.library-player-picks label,#privateRecipient option,[data-prepared-assignee] option,.audio-track-row>span,.material-image-toolbar>strong,.prepared-sheet-info>span,#gameTitle,#portalUser,#identity,#account-rows strong,#account-rows small,#sheet-rows td:not(:last-child),.room-grid .card h3,#recent-rooms .card h3';
 const language=()=>document.documentElement.lang||'uk';
 function translateText(node){const parent=node.parentElement;if(!parent||parent.closest(excluded))return;const current=node.textContent,trimmed=current.trim();if(!trimmed)return;let entry=originals.get(node);if(!entry||entry.value!==current)entry={source:locale.source(trimmed),value:current};const translated=locale.ui(entry.source,language()),next=current.replace(trimmed,translated);entry.value=next;originals.set(node,entry);if(current!==next)node.textContent=next;}
 function walk(node){
  if(node.nodeType===3){translateText(node);return;}
  if(node.nodeType!==1&&node.nodeType!==9)return;
  if(node.nodeType===1){if(node.matches(excluded))return;let map=attributes.get(node);if(!map){map=new Map();attributes.set(node,map);}for(const attr of ['aria-label','title','placeholder','alt']){const value=node.getAttribute(attr);if(!value)continue;let entry=map.get(attr);if(!entry||entry.value!==value)entry={source:locale.source(value),value};const next=locale.ui(entry.source,language());entry.value=next;map.set(attr,entry);if(next!==value)node.setAttribute(attr,next);}}
  for(const child of [...node.childNodes])walk(child);
 }
 let pending=false;const roots=new Set();
 function schedule(node){roots.add(node);if(pending)return;pending=true;Promise.resolve().then(()=>{pending=false;for(const root of roots)walk(root);roots.clear();});}
 const observer=new MutationObserver(changes=>{for(const change of changes){if(change.type==='attributes'&&change.target===document.documentElement&&change.attributeName==='lang'){schedule(document.body);continue;}if(change.type==='childList')for(const child of change.addedNodes)schedule(child);else schedule(change.target);}});
 function start(){try{const saved=localStorage.getItem('cth-interface-language');if(['uk','ru','en'].includes(saved))document.documentElement.lang=saved;}catch{}walk(document.body);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['lang','aria-label','title','placeholder','alt']});}
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
