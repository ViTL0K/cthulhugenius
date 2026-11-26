/* Original portal API adapted to the existing Google session and D1 Worker. */
(()=>{
  async function request(input,signal){
    try{
      const r=await fetch('/api/migration/bridge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal,cache:'no-store'});
      const result=await r.json();if(!r.ok&&!result.error)result.error={message:'Не вдалося виконати запит.'};return result;
    }catch(e){return {data:null,error:{message:e.message}};}
  }
  class Query {
    constructor(table){this.input={table,op:'select',filters:[],order:[]};}
    select(columns='*'){this.columns=columns;return this;}
    eq(k,v){this.input.filters.push(['eq',k,v]);return this;}
    neq(k,v){this.input.filters.push(['neq',k,v]);return this;}
    in(k,v){this.input.filters.push(['in',k,v]);return this;}
    gt(k,v){this.input.filters.push(['gt',k,v]);return this;}
    gte(k,v){this.input.filters.push(['gte',k,v]);return this;}
    lt(k,v){this.input.filters.push(['lt',k,v]);return this;}
    is(k,v){this.input.filters.push(['is',k,v]);return this;}
    not(k,op,v){if(op!=='is')throw Error('Непідтримуваний фільтр');this.input.filters.push(['not',k,v]);return this;}
    order(k,options={}){this.input.order.push([k,options.ascending!==false]);return this;}
    limit(n){this.input.limit=n;return this;}
    range(a,b){this.input.offset=a;this.input.limit=b-a+1;return this;}
    single(){this.one=true;return this;}
    maybeSingle(){this.one=true;return this;}
    abortSignal(signal){this.signal=signal;return this;}
    insert(values){Object.assign(this.input,{op:'insert',values});return this;}
    upsert(values){Object.assign(this.input,{op:'upsert',values});return this;}
    update(values){Object.assign(this.input,{op:'update',values});return this;}
    delete(){this.input.op='delete';return this;}
    async then(resolve,reject){
      try{const result=await request(this.input,this.signal);if(!result.error&&Array.isArray(result.data)){
        // Preserve JSON projection syntax used by portrait and sheet queries.
        if(this.columns&&this.columns!=='*')result.data=result.data.map(row=>{
          const out={};for(const entry of this.columns.split(',')){
            const [alias,path]=entry.includes(':')?entry.split(':'):[entry,entry];
            if(path.includes('->')){const [key,child]=path.split(/->>?/);out[alias]=row[key]?.[child];}else out[alias]=row[path];
          }return out;
        });
        if(this.one)result.data=result.data[0]||null;
      }return resolve(result);}catch(e){if(reject)return reject(e);throw e;}
    }
  }
  function rpc(name,args={}){const task={then:(a,b)=>request({kind:'rpc',name,args},task.signal).then(a,b),abortSignal(signal){task.signal=signal;return task;}};return task;}
  const channels=new Set();
  class Channel {
    constructor(name,options){this.name=name;this.options=options;this.handlers=[];this.snapshots=new Map();this.broadcasts=new Set();this.presence={};this.closed=false;}
    on(type,filter,callback){this.handlers.push({type,filter,callback});return this;}
    game(){return /[a-f0-9-]{36}/.exec(this.name)?.[0]||this.handlers.map(h=>/game_id=eq\.([a-f0-9-]{36})/.exec(h.filter.filter||'')?.[1]).find(Boolean);}
    async poll(){
      if(this.closed||this.busy||document.hidden||!this.game())return;this.busy=true;
      try{
        const tables=[...new Set(this.handlers.filter(h=>h.type==='postgres_changes').map(h=>h.filter.table))];
        const {data,error}=await request({kind:'realtime',game:this.game(),tables});if(error||this.closed)return;
        for(const table of tables){const list=data[table]||[];const next=new Map(list.map(r=>[r.id,JSON.stringify(r)]));const old=this.snapshots.get(table);
          if(old)for(const h of this.handlers.filter(h=>h.type==='postgres_changes'&&h.filter.table===table)){
            for(const row of list){const type=old.has(row.id)?old.get(row.id)!==next.get(row.id)?'UPDATE':null:'INSERT';if(type&&(h.filter.event==='*'||h.filter.event===type))h.callback({eventType:type,new:row,old:old.has(row.id)?JSON.parse(old.get(row.id)): {}});}
            for(const [id,value] of old)if(!next.has(id)&&(h.filter.event==='*'||h.filter.event==='DELETE'))h.callback({eventType:'DELETE',old:JSON.parse(value),new:{}});
          }this.snapshots.set(table,next);
        }
        for(const row of data.broadcasts||[]){if(this.broadcasts.has(row.id))continue;this.broadcasts.add(row.id);if(row.sender_id===this.ownUser)continue;for(const h of this.handlers)if(h.type==='broadcast'&&h.filter.event===row.event)h.callback({payload:row.payload});}
        this.presence=Object.fromEntries((data.presence||[]).map(r=>[r.payload.user_id,[r.payload]]));for(const h of this.handlers)if(h.type==='presence')h.callback();
      }finally{this.busy=false;}
    }
    subscribe(callback){channels.add(this);this.poll().then(()=>callback?.('SUBSCRIBED'));this.timer=setInterval(()=>void this.poll(),3500);return this;}
    async send(message){const {error}=await request({kind:'realtime',action:'send',game:this.game(),event:message.event,payload:message.payload});return error?'error':'ok';}
    async track(payload){this.ownUser=payload.user_id;const {error}=await request({kind:'realtime',action:'track',game:this.game(),payload});return error?'error':'ok';}
    presenceState(){return this.presence;}
    async unsubscribe(){this.closed=true;clearInterval(this.timer);channels.delete(this);return 'ok';}
  }
  async function fileRequest(path,method='GET',body){try{const r=await fetch('/api/migration/files?path='+encodeURIComponent(path),{method,body,headers:body?{'Content-Type':body.type||'application/octet-stream'}:undefined});const data=await r.json();return r.ok?data:{data:null,error:data.error};}catch(e){return {data:null,error:{message:e.message}};}}
  window.supabase={
    from:table=>new Query(table),rpc,
    auth:{
      async getSession(){try{const r=await fetch('/api/migration/auth/session',{cache:'no-store'});if(!r.ok)throw Error('Вхід тимчасово недоступний.');const {user}=await r.json();return {data:{session:user?{access_token:'google-cookie-session',user:{...user,email:'',user_metadata:{display_name:user.display_name},is_anonymous:false}}:null},error:null};}catch(e){return {data:{session:null},error:{message:e.message}};}},
      async signOut(){for(const c of channels)await c.unsubscribe();try{const r=await fetch('/api/migration/auth/logout',{method:'POST'});if(!r.ok)throw Error('Не вдалося вийти.');return {error:null};}catch(e){return {error:{message:e.message}};}},
      async signInWithPassword(){location.href='/api/migration/auth/google';return {data:{},error:null};},
      async signUp(){location.href='/api/migration/auth/google';return {data:{},error:null};},
    },
    channel:(name,options)=>new Channel(name,options),
    removeChannel:channel=>channel.unsubscribe(),
    removeAllChannels:()=>Promise.all([...channels].map(c=>c.unsubscribe())),
    storage:{from:()=>({
      async list(path,options={}){try{const r=await fetch('/api/migration/files?list=1&path='+encodeURIComponent(path));const data=await r.json();if(!r.ok)return {data:null,error:data.error};return {data:data.data.slice(options.offset||0,(options.offset||0)+(options.limit||100)),error:null};}catch(e){return {data:null,error:{message:e.message}};}},
      upload:(path,file)=>fileRequest(path,'PUT',file),
      async remove(paths){for(const path of paths){const r=await fileRequest(path,'DELETE');if(r.error)return r;}return {data:[],error:null};},
      async createSignedUrl(path){return {data:{signedUrl:'/api/migration/files?path='+encodeURIComponent(path)},error:null};},
    })},
  };
})();
