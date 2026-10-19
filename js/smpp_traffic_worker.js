/* SMPP traffic analyser - background worker: loads the file and analyses it locally.
   Messages out: {t:'p',s:stage,p:percent} progress | {t:'r',R:result} | {t:'e',m:message}
   Result R: {pdus,conns,lat,unans,orphan,orphC,pk,fmt,link,tsres}; pdus/unans/lat are sent as packed typed columns (about 40x cheaper to hand over
   to the page than ~45k small objects); the page expands them back into objects (see unpack* in smpp_traffic_analyser.js) */
const CMD={0:'generic_nack',1:'bind_receiver',2:'bind_transmitter',3:'query_sm',4:'submit_sm',5:'deliver_sm',6:'unbind',7:'replace_sm',8:'cancel_sm',9:'bind_transceiver',11:'outbind',21:'enquire_link',33:'submit_multi',258:'alert_notification',259:'data_sm'};
const R2=0x80000000;
const LTN={0:'BSD loopback',1:'Ethernet',12:'Raw IP',101:'Raw IP',113:'Linux cooked (SLL)',228:'Raw IPv4',229:'Raw IPv6',276:'Linux cooked v2 (SLL2)'};
let INFO={fmt:'',lts:[],res:1e6};   // capture facts shown by the page (container, link type, timestamp resolution)
let lastS='',lastP=-1;
function prog(s,f){const p=Math.max(0,Math.min(100,Math.round(f*100)));if(s!==lastS||p!==lastP){lastS=s;lastP=p;postMessage({t:'p',s,p})}}
/* ---- capture container: pcap + pcapng ---- */
function readCap(buf,prog){
 prog('Reading packets',0);INFO={fmt:'pcap',lts:[],res:1e6};let cnt=0;const dv=new DataView(buf),pk=[],m=dv.getUint32(0,false),n=buf.byteLength;
 if(m===0x0A0D0D0A){INFO.fmt='pcapng';let o=0,le=true;const ifs=[];
  while(o+12<=n){
   if(dv.getUint32(o,true)===0x0A0D0D0A)le=dv.getUint32(o+8,true)===0x1A2B3C4D;
   const ty=dv.getUint32(o,le),len=dv.getUint32(o+4,le);if(len<12||o+len>n)break;if(++cnt%5000===0)prog('Reading packets',o/n);
   if(ty===1){let res=1e6;for(let q=o+16;q+4<=o+len-4;){const c=dv.getUint16(q,le),l=dv.getUint16(q+2,le);if(!c)break;if(c===9){const v=dv.getUint8(q+4);res=v&128?2**(v&127):10**v}q+=4+((l+3)&~3)}if(!ifs.length)INFO.res=res;INFO.lts.push(dv.getUint16(o+8,le));ifs.push({lt:dv.getUint16(o+8,le),res})}
   else if(ty===6){const f=ifs[dv.getUint32(o+8,le)]||{lt:1,res:1e6},cl=dv.getUint32(o+20,le);
    if(o+28+cl<=n)pk.push({t:Math.round((dv.getUint32(o+12,le)*4294967296+dv.getUint32(o+16,le))/f.res*1e6)/1e3,lt:f.lt,d:new Uint8Array(buf,o+28,cl)})}
   o+=len}
 }else{let le,ns=false;
  if(m===0xA1B2C3D4)le=false;else if(m===0xD4C3B2A1)le=true;else if(m===0xA1B23C4D){le=false;ns=true}else if(m===0x4D3CB2A1){le=true;ns=true}else throw Error('Not a pcap or pcapng file');
  const lt=dv.getUint32(20,le)&0xfffffff;INFO.lts=[lt];INFO.res=ns?1e9:1e6;
  for(let o=24;o+16<=n;){const cl=dv.getUint32(o+8,le);if(o+16+cl>n)break;if(++cnt%5000===0)prog('Reading packets',o/n);
   pk.push({t:dv.getUint32(o,le)*1000+dv.getUint32(o+4,le)/(ns?1e6:1e3),lt,d:new Uint8Array(buf,o+16,cl)});o+=16+cl}}
 return pk}

/* ---- link / IP / TCP ---- */
const ad=(d,o,n)=>Array.from(d.subarray(o,o+n)).join(n===4?'.':':');
function tcp(p){
 const d=p.d;if(d.length<20)return;const dv=new DataView(d.buffer,d.byteOffset,d.length);let o=0,et;
 switch(p.lt){
  case 1:et=dv.getUint16(12);o=14;while((et===0x8100||et===0x88a8)&&o+4<d.length){et=dv.getUint16(o+2);o+=4}break;
  case 113:et=dv.getUint16(14);o=16;break;case 276:et=dv.getUint16(0);o=20;break;
  case 0:o=4;et=(d[0]===2||d[3]===2)?0x800:0x86dd;break;
  case 101:case 12:case 228:case 229:et=d[0]>>4===4?0x800:0x86dd;break;default:return}
 let pr,end,s,t;
 if(et===0x800){if(dv.getUint16(o+6)&0x1fff)return;const ihl=(d[o]&15)*4;pr=d[o+9];end=Math.min(o+dv.getUint16(o+2),d.length);s=ad(d,o+12,4);t=ad(d,o+16,4);o+=ihl}
 else if(et===0x86dd){pr=d[o+6];end=Math.min(o+40+dv.getUint16(o+4),d.length);s=ad(d,o+8,16);t=ad(d,o+24,16);o+=40;while(pr===0||pr===43||pr===60){pr=d[o];o+=8+d[o+1]*8}}
 else return;
 if(pr!==6||o+20>d.length)return;
 return{s,t,sp:dv.getUint16(o),dp:dv.getUint16(o+2),seq:dv.getUint32(o+4),pl:d.subarray(o+(d[o+12]>>4)*4,end),ts:p.t}}

/* ---- SMPP framing + decode ---- */
function dec(b,o,end){let p=o;const cs=()=>{while(p<end&&b[p])p++;p++};
 cs();p+=2;cs();p+=2;cs();const esm=b[p++];p+=2;cs();cs();const rd=b[p++];p+=2;const dc=b[p++];p++;const sl=b[p++];
 return{esm,rd,dc,sm:b.subarray(p,Math.min(p+sl,end))}}
function frame(b,pc,d,out,cb){const dv=new DataView(b.buffer);let p=0,i=0,k=0;
 while(p+16<=b.length){if(cb&&!(++k&8191))cb(p);
  const len=dv.getUint32(p),id=dv.getUint32(p+4),st=dv.getUint32(p+8),sq=dv.getUint32(p+12),base=id&0x7fffffff;
  if(len<16||len>65536||!(id===R2||(base&&CMD[base]))||sq>>>31||st>0x500){p++;continue}
  if(p+len>b.length)break;
  while(i+1<pc.length&&pc[i+1].o<=p)i++;
  const q={d,t:pc[i].t,id,st,sq,len};
  if(id===0x80000004&&!st&&len>16){let e=p+16;while(e<p+len&&b[e]&&e<p+81)e++;q.mid=String.fromCharCode(...b.subarray(p+16,e))} // SMSC message_id
  if(!(id>>>31)&&(base===4||base===5)){try{const r=dec(b,p+16,p+len);q.esm=r.esm;
   if(base===5&&(r.esm&0x3c)===4)q.rep=((String.fromCharCode(...r.sm).match(/stat:(\w+)/i)||[,'?'])[1]).toUpperCase()}catch{}}
  out.push(q);p+=len}}

/* ---- packing of the result into typed columns ---- */
function packPdus(a){const n=a.length,k={n,c:new Int32Array(n),id:new Uint32Array(n),st:new Uint32Array(n),sq:new Uint32Array(n),t:new Float64Array(n),rv:new Uint16Array(n),rd:[]},ri=new Map();
 a.forEach((q,i)=>{k.c[i]=q.c;k.id[i]=q.id;k.st[i]=q.st;k.sq[i]=q.sq;k.t[i]=q.t;if(q.rep){let v=ri.get(q.rep);if(!v){k.rd.push(q.rep);ri.set(q.rep,v=k.rd.length)}k.rv[i]=v}});return k}   // rv: 0 = no delivery receipt, else 1-based index into rd
function packLat(a){const n=a.length,k={n,c:new Int32Array(n),id:new Uint32Array(n),st:new Uint32Array(n),sq:new Uint32Array(n),t:new Float64Array(n),rt:new Float64Array(n),ms:new Float64Array(n),mid:new Array(n)};
 a.forEach((l,i)=>{k.c[i]=l.c;k.id[i]=l.id;k.st[i]=l.st;k.sq[i]=l.sq;k.t[i]=l.t;k.rt[i]=l.rt;k.ms[i]=l.ms;k.mid[i]=l.mid||''});return k}

function analyze(buf,ports,prog){
 const pk=readCap(buf,prog),fl=new Map();let tot=0,done=0,ti=0;
 prog('Decoding TCP/IP',0);
 for(const p of pk){if(++ti%20000===0)prog('Decoding TCP/IP',ti/pk.length);const x=tcp(p);if(!x||!x.pl.length)continue;
  if(ports.size&&!ports.has(x.sp)&&!ports.has(x.dp))continue;
  tot+=x.pl.length;const a=x.s+':'+x.sp,b=x.t+':'+x.dp,k=a<b?a+' ⇄ '+b:b+' ⇄ '+a,dr=a<b?0:1;
  let f=fl.get(k);if(!f)fl.set(k,f={k,D:[{g:[]},{g:[]}]});
  const D=f.D[dr];if(D.base===undefined){D.base=x.seq;D.src=a}
  D.g.push({r:(x.seq-D.base)|0,d:x.pl,t:x.ts})}
 const pdus=[],conns=[];prog('Decoding SMPP PDUs',0);
 for(const f of fl.values()){const out=[];
  f.D.forEach((D,dr)=>{if(!D.g.length)return;D.g.sort((u,v)=>u.r-v.r||u.t-v.t);
   let ch=[],pc=[],n=0,nx=null;
   const flush=()=>{if(n){const b=new Uint8Array(n);let o=0;for(const c of ch){b.set(c,o);o+=c.length}frame(b,pc,dr,out,p=>prog('Decoding SMPP PDUs',Math.min(1,(done+p)/(tot||1))));done+=n}ch=[];pc=[];n=0};
   for(const g of D.g){const e=g.r+g.d.length;let d=g.d;
    if(nx!==null&&e<=nx)continue;               // retransmission
    if(nx!==null&&g.r>nx)flush();               // gap: restart framing
    else if(nx!==null&&g.r<nx)d=d.subarray(nx-g.r); // partial overlap
    pc.push({o:n,t:g.t});ch.push(d);n+=d.length;nx=e}
   flush()});
  if(out.length<(ports.size?1:2))continue;
  const bd=out.find(q=>!(q.id>>>31)&&[1,2,9].includes(q.id));
  const label=bd?f.D[bd.d].src+' → '+f.D[1-bd.d].src:f.k,ci=conns.length;
  conns.push({label});out.forEach(q=>{q.c=ci;pdus.push(q)})}
 prog('Matching requests/responses',0);pdus.sort((u,v)=>u.t-v.t);
 const mp=new Map(),lat=[];let orphan=0;const orphC=new Array(conns.length).fill(0);
 for(const q of pdus){const base=q.id&0x7fffffff;
  if(q.id>>>31){const k=q.c+':'+(1-q.d)+':'+q.sq,r=mp.get(k);
   if(r&&(q.id===R2||r.id===base)){lat.push({c:q.c,id:r.id,t:r.t,rt:q.t,ms:q.t-r.t,st:q.st,sq:r.sq,mid:q.mid});mp.delete(k)}else{orphan++;orphC[q.c]++}}
  else if(base!==11&&base!==258)mp.set(q.c+':'+q.d+':'+q.sq,q)}
 const link=[...new Set(INFO.lts)].map(x=>LTN[x]||('link type '+x)).join(', ')||'unknown';
 return{pdus:packPdus(pdus),conns,lat:packLat(lat),unans:packPdus([...mp.values()]),orphan,orphC,pk:pk.length,fmt:INFO.fmt,link,tsres:INFO.res>=1e9?'nanosecond':INFO.res>=1e6?'microsecond':'1/'+INFO.res+' s'}}


/* message in: {file, ports[]}; out: {t:'p',s,p} progress | {t:'r',R} result | {t:'e',m} error */
onmessage=async e=>{
 const{file,ports}=e.data;
 try{
  if(file.size<24)throw Error('File is too small to be a pcap/pcapng capture');
  let buf;
  if(file.stream){ // chunked read => real loading progress
   buf=new Uint8Array(file.size);const rd=file.stream().getReader();let o=0;
   for(;;){const r=await rd.read();if(r.done)break;buf.set(r.value,o);o+=r.value.length;prog('Loading file',o/file.size)}
  }else buf=new Uint8Array(await file.arrayBuffer());
  prog('Loading file',1);
  postMessage({t:'r',R:analyze(buf.buffer,new Set(ports),prog)});
 }catch(err){postMessage({t:'e',m:err.message})}
};
