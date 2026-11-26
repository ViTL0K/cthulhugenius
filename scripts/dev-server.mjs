// Isolated QA server. Never imported by the deployed Worker.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { createHash } from 'node:crypto';
import { D1 } from '../tests/d1-helper.mjs';
import worker from '../worker.mjs';
const DB=new D1();
const root=resolve('public');
const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.pdf':'application/pdf','.zip':'application/zip'};
const token='Q'.repeat(43);
DB.db.prepare('INSERT INTO site_users(id,google_subject,email,display_name) VALUES(?,?,?,?)').run('keeper','test','keeper@example.com','Віталій');
DB.db.prepare('INSERT INTO account_roles(user_id,role) VALUES(?,?)').run('keeper','admin');
DB.db.prepare('INSERT INTO site_sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('base64url'),'keeper',Math.floor(Date.now()/1000)+36000);
const game='11111111-1111-4111-a111-111111111111';
DB.db.prepare('INSERT INTO games VALUES(?,?,?,?,?,?)').run(game,'Будинок Корбіта','Перевірка перенесення оригінального інтерфейсу','0123456789ABCDEF0123','keeper',new Date().toISOString());
DB.db.prepare('INSERT INTO game_members(game_id,user_id,display_name,role) VALUES(?,?,?,?)').run(game,'keeper','Віталій','keeper');
const ASSETS={async fetch(req){const path=resolve(root,'.'+decodeURIComponent(new URL(req.url).pathname));if(!path.startsWith(root+'/'))return new Response('Not found',{status:404});try{return new Response(await readFile(new URL(req.url).pathname.endsWith('/')?path+'/index.html':path),{headers:{'Content-Type':type[extname(path)]||'application/octet-stream'}})}catch{return new Response('Not found',{status:404})}}};
createServer(async(req,res)=>{
 try{
  const host=req.headers.host;const origin='https://'+host;
  const chunks=[];for await(const c of req)chunks.push(c);
  const headers=new Headers(req.headers);if(!headers.has('cookie'))headers.set('cookie','__Host-poklik-session='+token);
  if(headers.has('origin'))headers.set('origin',origin);
  const request=new Request(origin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const response=await worker.fetch(request,{DB,ASSETS,ADMIN_GOOGLE_EMAIL_SHA256:createHash('sha256').update('keeper@example.com').digest('hex'),GOOGLE_CLIENT_ID:'local',GOOGLE_CLIENT_SECRET:'local',GOOGLE_REDIRECT_URI:origin+'/api/migration/auth/google/callback'});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Local QA server error')}
}).listen(Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1])||3000,'0.0.0.0');
