export function normalizeAudioCommand(input,userId,clock=Date.now()){
 if(!input||!['add','play','pause','seek','stop','remove'].includes(input.action))throw Error('Невідома команда аудіо.');
 const source=input.track;if(!source||!['video','playlist','spotify'].includes(source.kind))throw Error('Обери трек.');
 const id=String(source.id||'');let url;
 if(source.kind==='spotify'){if(!['track','playlist','album','episode'].includes(source.spotifyType)||!/^[A-Za-z0-9]{1,80}$/.test(id))throw Error('Некоректний трек Spotify.');url='https://open.spotify.com/'+source.spotifyType+'/'+id;}
 else{if(!(source.kind==='video'?/^[\w-]{11}$/:/^[\w-]{10,150}$/).test(id))throw Error('Некоректний трек YouTube.');url=source.kind==='video'?'https://www.youtube.com/watch?v='+id:'https://www.youtube.com/playlist?list='+id;}
 const position=Number(source.position??0),duration=Number(source.duration??0),playlistIndex=Number(source.playlistIndex??0);
 if(!Number.isFinite(position)||position<0||position>604800||!Number.isFinite(duration)||duration<0||duration>604800||!Number.isInteger(playlistIndex)||playlistIndex<0||playlistIndex>10000)throw Error('Некоректна позиція аудіо.');
 if(input.recipient!==undefined&&typeof input.recipient!=='string')throw Error('Некоректний одержувач.');
 const track={kind:source.kind,id,url,label:String(source.label||'Аудіо').slice(0,100),position:duration?Math.min(position,duration):position,duration,playlistIndex};if(source.kind==='spotify')track.spotifyType=source.spotifyType;
 return {action:input.action,track,user_id:userId,sent_at:clock,playing:input.action==='play'||input.action==='seek'&&input.playing===true,command_id:typeof input.command_id==='string'&&/^[\w-]{1,80}$/.test(input.command_id)?input.command_id:crypto.randomUUID(),...(input.recipient?{recipient:input.recipient}:{})};
}
