/* SMPP traffic analyser - page script (UI only). The capture is parsed and analysed in js/smpp_traffic_worker.js */
const CMD={0:'generic_nack',1:'bind_receiver',2:'bind_transmitter',3:'query_sm',4:'submit_sm',5:'deliver_sm',6:'unbind',7:'replace_sm',8:'cancel_sm',9:'bind_transceiver',11:'outbind',21:'enquire_link',33:'submit_multi',258:'alert_notification',259:'data_sm'};
const ST={1:'INVMSGLEN',2:'INVCMDLEN',3:'INVCMDID',4:'INVBNDSTS',5:'ALYBND',8:'SYSERR',11:'INVDSTADR',13:'BINDFAIL',14:'INVPASWD',15:'INVSYSID',20:'MSGQFUL',69:'SUBMITFAIL',88:'THROTTLED'};
/* Channel colours: documented data-viz palette hexes, ordered for maximum separation of overlapping lines on white
   (first 4 validated all-pairs: worst colour-blind dE 13.0, normal-vision dE 19.6). Channels 5+ are also dashed, so identity is never colour alone. */
const PAL=['#2a78d6','#eda100','#e87ba4','#008300','#e34948','#1baf7a','#6250d6','#eb6834'];
const COMB='#222222',HID=new Set(),col=c=>PAL[c%PAL.length],dsh=c=>c<4?[]:c<8?[7,3]:[2,3];   // HID: hidden series (-1 = combined)
const $=s=>document.querySelector(s),R2=0x80000000;
let R,I,CTX,FI,mode=0,file,wk,rz;const SC=new Map();                  // result, index of the result, chart context, file info, view (0 = all charts), file, worker, resize timer
const tn=id=>id===R2?'generic_nack':(CMD[id&0x7fffffff]||'?')+(id>>>31?'_resp':'');
const f2=x=>isNaN(x)?'–':x.toFixed(2);   // tables and charts: always 2 decimals
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const pct=(a,p)=>a.length?a[Math.max(0,Math.ceil(p*a.length)-1)]:NaN; // nearest-rank percentile on a sorted array
function stats(ms){const a=Float64Array.from(ms).sort(),n=a.length,m=n?a.reduce((s,x)=>s+x,0)/n:NaN;   // typed-array sort is numeric and far faster than a comparator sort
 return{n,avg:m,min:a[0],p50:n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):NaN,p90:pct(a,.9),p95:pct(a,.95),p99:pct(a,.99),max:a[n-1],sd:n>1?Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(n-1)):NaN,a}}

/* ---- loading + progress (analysis runs in a Web Worker) ---- */
const STG={'Loading file':[0,10],'Reading packets':[10,25],'Decoding TCP/IP':[25,50],'Decoding SMPP PDUs':[50,90],'Matching requests/responses':[90,100]};
const STP={'Loading file':'Loading the file into memory','Reading packets':'Reading packets from the capture','Decoding TCP/IP':'Decoding Ethernet / IP / TCP headers','Decoding SMPP PDUs':'Reassembling TCP streams and decoding SMPP PDUs','Matching requests/responses':'Matching requests with responses and computing latencies'};
let STT={};                                                       // performance.now() at which each step started
function prog(s,p){const k=Object.keys(STG),i=k.indexOf(s),g=STG[s]||[0,0],t=g[0]+(g[1]-g[0])*p/100;if(!(s in STT))STT[s]=performance.now();
 $('#pgl').textContent='Step '+(i+1)+' of '+k.length+': '+STP[s]+'…';$('#pgp').textContent=Math.round(t)+'%';$('#pgf').style.width=t+'%';
 $('#pgs').innerHTML=k.map((n,x)=>(x<i?'✓ ':x===i?'▶ ':'○ ')+(x===i?'<b>'+STP[n]+'</b>':STP[n])).join('<br>')}
function stop(msg){if(wk){wk.terminate();wk=null}$('#pg').hidden=true;if(msg)$('#st').textContent=msg}
/* the analysis succeeded: keep the progress box on screen as a record - all steps ticked, with the time each took */
function finish(){if(wk){wk.terminate();wk=null}const k=Object.keys(STG),now=performance.now();
 $('#pgl').textContent='All '+k.length+' steps completed';$('#pgp').textContent='100%';$('#pgf').style.width='100%';$('#cx').hidden=true;
 $('#pgs').innerHTML=k.map((n,x)=>{const a=STT[n],b=x+1<k.length?STT[k[x+1]]:now;return '✓ '+STP[n]+(a!=null&&b!=null?' <span class="hint">('+((b-a)/1000).toFixed(2)+' s)</span>':'')}).join('<br>')}
function load(f){
 stop();file=f;R=I=CTX=null;$('#res').hidden=true;
 const txt=$('#pt').value.trim(),ports=txt?txt.split(/[\s,;]+/).filter(Boolean).map(Number):[];
 if(ports.some(n=>!Number.isInteger(n)||n<1||n>65535)){$('#st').textContent='Invalid port list "'+txt+'": use numbers 1-65535 separated by commas, or leave blank to auto-detect.';return}
 FI={name:f.name,size:f.size,mod:f.lastModified,ports,t0:performance.now()};STT={};$('#cx').hidden=false;
 $('#st').textContent=f.name+' ('+(f.size/1048576).toFixed(2)+' MB)';prog('Loading file',0);$('#pg').hidden=false;
 try{wk=new Worker('js/smpp_traffic_worker.js')}catch(e){stop('Cannot start the background worker: '+e.message);return}
 wk.onmessage=e=>{const m=e.data;if(m.t==='p')return prog(m.s,m.p);
  if(m.t==='e'){stop('Error: '+m.m);return}
  finish();setTimeout(()=>{if(file===f)done(m.R)},0)};   // leave the message handler at once; render in its own task
 wk.onerror=e=>stop('The background worker failed ('+(e.message||'open the page via http(s), not file://')+')');
 wk.postMessage({file:f,ports})}
/* the worker sends typed columns; expand them into the plain objects the rest of this script uses (arrays of objects are accepted as they are) */
function unpackPdus(k,o=new Array(k.n),a=0,b=k.n){for(let i=a;i<b;i++){const q={c:k.c[i],id:k.id[i],st:k.st[i],sq:k.sq[i],t:k.t[i]};if(k.rv[i])q.rep=k.rd[k.rv[i]-1];o[i]=q}return o}
function unpackLat(k,o=new Array(k.n),a=0,b=k.n){for(let i=a;i<b;i++)o[i]={c:k.c[i],id:k.id[i],t:k.t[i],rt:k.rt[i],ms:k.ms[i],st:k.st[i],sq:k.sq[i],mid:k.mid[i]||undefined};return o}
function done(r){R=r;I=null;SC.clear();
 const packed=!Array.isArray(R.pdus);                                // typed columns from the worker (plain object arrays are accepted as they are)
 if(!(packed?R.pdus.n:R.pdus.length)){$('#res').hidden=true;$('#st').textContent=R.pk+' packets read, but no SMPP PDUs found. Check the port; TLS-encrypted SMPP cannot be decoded.';return}
 const go=[];                                                        // every step runs in its own task, so no single task is long
 if(packed){const K=R.pdus,KL=R.lat,KU=R.unans,P=new Array(K.n),Q=new Array(KL.n),CH=6000;   // expand the typed columns in chunks of 6000 records
  for(let a=0;a<K.n;a+=CH)go.push(()=>{unpackPdus(K,P,a,Math.min(K.n,a+CH))});
  for(let a=0;a<KL.n;a+=CH)go.push(()=>{unpackLat(KL,Q,a,Math.min(KL.n,a+CH))});
  go.push(()=>{R.pdus=P;R.lat=Q;R.unans=unpackPdus(KU)})}
 go.push(()=>{I=index()},()=>{indexLat(I);FI=FI||{name:'(unknown)',size:NaN,mod:NaN,ports:[],t0:performance.now()}},
  ()=>{$('#sc').innerHTML='<option value="-1">All channels (overview + combined)</option>'+R.conns.map((c,i)=>`<option value="${i}">#${i+1} ${esc(c.label)}</option>`).join('');
  const ids=[...new Set(R.lat.map(l=>l.id))].sort((a,b)=>a-b);
  $('#ty').innerHTML='<option value="0">All types</option>'+ids.map(i=>`<option value="${i}">${tn(i)}</option>`).join('');
  $('#ty').value=ids.includes(4)?4:0;HID.clear();$('#pts').checked=R.conns.length<2},
  ()=>{FI.secs=(performance.now()-FI.t0)/1000;$('#st').textContent='✓ '+FI.name+' analysed locally in '+FI.secs.toFixed(2)+' s; nothing was uploaded.';fileInfo()},
  ()=>render(true));                                                 // render(): tables in several tasks, charts last
 let i=0;(function nx(){if(R!==r)return;go[i++]();if(i<go.length)setTimeout(nx,0)})()}

/* ---- one pass over the result: per-channel counts and lists, so render() never re-filters the full PDU list ---- */
function index(){
 const n=R.conns.length,X={cnt:[],eid:[],est:[],rep:[],req:[],lat:[],un:[],tmin:[],tmax:[],reqAll:[]},mk=()=>Array.from({length:n},()=>new Map()),ar=()=>Array.from({length:n},()=>[]);
 X.cnt=mk();X.eid=mk();X.est=mk();X.rep=mk();X.req=ar();X.lat=ar();X.un=ar();X.tmin=new Array(n).fill(Infinity);X.tmax=new Array(n).fill(-Infinity);
 const inc=(m,k)=>m.set(k,(m.get(k)||0)+1);
 for(const p of R.pdus){const c=p.c;inc(X.cnt[c],p.id);if(p.t<X.tmin[c])X.tmin[c]=p.t;if(p.t>X.tmax[c])X.tmax[c]=p.t;
  if(p.id>>>31){if(p.st){inc(X.eid[c],p.id);inc(X.est[c],p.st)}}else{X.req[c].push(p);X.reqAll.push(p)}   // R.pdus is sorted by time => the lists are too
  if(p.rep)inc(X.rep[c],p.rep)}
 X.t0=R.pdus[0].t;X.t1=R.pdus[R.pdus.length-1].t;return X}
function indexLat(X){R.lat.forEach(l=>X.lat[l.c].push(l));R.unans.forEach(q=>X.un[q.c].push(q))}   // second half of index(), kept apart so it can run in its own task
const sumMap=(arr,c)=>{const r=new Map();(c<0?arr:[arr[c]]).forEach(m=>m.forEach((v,k)=>r.set(k,(r.get(k)||0)+v)));return r};

/* ---- capture file box ---- */
function fileInfo(){
 const F=FI,iso=t=>new Date(t).toISOString().replace('T',' ').slice(0,23)+' UTC',kv=(l,v)=>`<td class="lb">${l}</td><td>${v}</td>`;
 const size=isNaN(F.size)?'–':(F.size/1048576).toFixed(2)+' MB ('+F.size+' bytes)',mod=isNaN(F.mod)?'–':new Date(F.mod).toLocaleString();
 $('#ft').innerHTML='<thead><tr><th>Property<th>Value<th>Property<th>Value</tr></thead><tbody>'
  +'<tr>'+kv('File name','<b>'+esc(F.name)+'</b>')+kv('Size',size)+'</tr>'
  +'<tr>'+kv('Format',esc(R.fmt||'pcap')+' · '+esc(R.link||'')+' · '+esc(R.tsres||'')+' timestamps')+kv('Last modified',mod)+'</tr>'
  +'<tr>'+kv('First / last SMPP PDU',iso(I.t0)+' → '+iso(I.t1)+' ('+f2((I.t1-I.t0)/1000)+' s)')+kv('Packets read',R.pk)+'</tr>'
  +'<tr>'+kv('SMPP port filter',F.ports.length?F.ports.join(', '):'auto-detect (all TCP flows)')+kv('Analysis',R.pdus.length+' SMPP PDUs on '+R.conns.length+' channel(s), '+f2(F.secs)+' s, processed locally')+'</tr></tbody>'}

/* ---- tables + summary + charts, computed in several short tasks (a newer render() or redraw() cancels an older, unfinished one) ---- */
let RG=0,RD=0;                                                       // generation counters
function chain(fns,gen,cur){let i=0;const go=()=>{if(cur()!==gen)return;fns[i++]();if(i<fns.length)setTimeout(go,0)};go()}
function render(first){   // first === true: also reveals the results once the first tables are ready
 const gen=++RG,c=+$('#sc').value,ty=+$('#ty').value,T0=I.t0,lab=i=>'#'+(i+1)+' '+esc(R.conns[i].label);
 const cm=sumMap(I.cnt,c),em=sumMap(I.eid,c),sm=sumMap(I.est,c),rp=sumMap(I.rep,c),n=k=>cm.get(k)||0,sum=m=>[...m.values()].reduce((s,x)=>s+x,0);
 const LTi=i=>{const a=i<0?R.lat:I.lat[i];return ty?a.filter(l=>l.id===ty):a},LTA=R.conns.map((_,i)=>LTi(i)),LTall=LTi(-1);   // pairs of the selected PDU type
 const sc=(i,a)=>{const k=i+'|'+ty;let s=SC.get(k);if(!s)SC.set(k,s=stats(a.map(x=>x.ms)));return s};   // latency stats per channel, cached until the next file
 const L=c<0?LTall:LTA[c],latC=c<0?R.lat:I.lat[c],unC=c<0?R.unans:I.un[c];let S;
 const cls=i=>'k'+(i<0?' all':'')+(i===c?' sel':'');
 const RQi=i=>{const a=i<0?I.reqAll:I.req[i];return ty?a.filter(p=>p.id===ty):a},UNi=i=>(i<0?R.unans:I.un[i]).filter(q=>!ty||q.id===ty);
 const order=[c,...R.conns.map((_,i)=>i),-1].filter((v,i,a)=>a.indexOf(v)===i);   // selected channel first, then the others and All channels
 const steps=order.map(i=>()=>{sc(i,i<0?LTall:LTA[i])}).concat([
 () => {   // summary: 6 columns (3 x metric/value) in titled groups
  S=sc(c,L);const dur=(c<0?I.t1-I.t0:I.tmax[c]-I.tmin[c])/1000,nPdu=c<0?R.pdus.length:sum(I.cnt[c]);
  const kv=(l,v)=>`<td class="lb">${l}</td><td class="vl">${v}</td>`,E='<td class="lb"></td><td class="vl"></td>';
  const r3=(a,b,d)=>'<tr>'+kv(...a)+(b?kv(...b):E)+(d?kv(...d):E)+'</tr>',grp=t=>`<tr class="grp"><th colspan="6">${t}</th></tr>`,det=(l,v)=>`<tr class="det"><td class="lb">${l}</td><td colspan="5">${v}</td></tr>`;
  const desc=(m,f)=>m.size?[...m].sort((a,b)=>b[1]-a[1]).map(([k,v])=>f(k)+' ×'+v).join(', '):'none';
  const subErr=em.get(R2+4)||0,nRec=sum(rp);
  $('#cd').innerHTML='<thead><tr><th class="l">Metric<th class="l">Value<th class="l">Metric<th class="l">Value<th class="l">Metric<th class="l">Value</tr></thead><tbody>'
   +grp('Capture scope')+r3(['Channels',c<0?R.conns.length:1],['PDUs (all types)',nPdu],['Duration (s)',f2(dur)])
   +r3(['Unanswered requests',unC.length],['Error responses',sum(sm)],['Responses without request',(c<0?R.orphan:(R.orphC||[])[c])||0])
   +grp('MT-SMS submission (submit_sm)')+r3(['SMS submitted',n(4)],['Acked OK',n(R2+4)-subErr],['Submit errors',subErr])
   +grp('MO-SMS and delivery reports (deliver_sm)')+r3(['deliver_sm',n(5)],['deliver_sm_resp',n(R2+5)],['Delivery receipts',nRec])
   +r3(['MO-SMS (deliver_sm, not receipts)',Math.max(0,n(5)-nRec)])
   +grp('Latency of the selected PDU type (ms)')+r3(['Average',f2(S.avg)],['Median',f2(S.p50)],['p95',f2(S.p95)])+r3(['Minimum',f2(S.min)],['p99',f2(S.p99)],['Maximum',f2(S.max)])
   +grp('Breakdown')+det('Delivery receipt states',desc(rp,k=>esc(k)))+det('Error statuses',desc(sm,k=>ST[k]||'0x'+(+k).toString(16)))+'</tbody>';
  if(first===true)$('#res').hidden=false},
 () => {   // PDU types of the selected channel
  const ids=[...new Set([...cm.keys()].map(k=>k&0x7fffffff))].sort((a,b)=>a-b),byId=new Map(),unId=new Map();
  latC.forEach(l=>{let a=byId.get(l.id);if(!a)byId.set(l.id,a=[]);a.push(l.ms)});unC.forEach(q=>unId.set(q.id,(unId.get(q.id)||0)+1));
  $('#tt').innerHTML='<thead><tr><th>PDU<th>Requests<th>Responses<th>Errors<th>Unanswered<th>Avg ms<th>p95 ms</tr></thead><tbody>'+ids.map(b=>{const s=stats(byId.get(b)||[]);
   return`<tr><td>${CMD[b]||'?'}<td>${n(b)}<td>${n(b+R2)}<td>${em.get(b+R2)||0}<td>${unId.get(b)||0}<td>${f2(s.avg)}<td>${f2(s.p95)}`}).join('')+'</tbody>'},
 () => {   // latency statistics per channel + all channels
  const row=(lbl,a,i)=>{const s=sc(i,a);return`<tr class="${cls(i)}" onclick="sel(${i})"><td>${lbl}<td>${s.n}<td>${f2(s.min)}<td>${f2(s.avg)}<td>${f2(s.p50)}<td>${f2(s.sd)}<td>${f2(s.p90)}<td>${f2(s.p95)}<td>${f2(s.p99)}<td>${f2(s.max)}`};
  $('#tc').innerHTML='<thead><tr><th>Channel<th>pairs<th>min<th>average<th>median<th>std dev<th>p90<th>p95<th>p99<th>max</tr></thead><tbody>'+R.conns.map((cn,i)=>row(lab(i),LTA[i],i)).join('')+row('All channels',LTall,-1)+'</tbody>'},
 () => {   // fastest / slowest pair (ties: earliest request)
  const pick=(a,mx)=>a.reduce((m,l)=>!m||(mx?l.ms>m.ms:l.ms<m.ms)||(l.ms===m.ms&&l.t<m.t)?l:m,null);
  const cell=l=>l?`<td>${f2(l.ms)}<td class="l">${tn(l.id)} seq ${l.sq}${l.mid?' · msg-id '+esc(l.mid):''}${l.st?' · '+(ST[l.st]||'status 0x'+l.st.toString(16)):''}<td class="l">+${f2((l.t-T0)/1000)} s · ${new Date(l.t).toISOString().slice(11,23)} UTC`:'<td>–<td class="l">–<td class="l">–';
  const xrow=(lbl,a,i)=>`<tr class="${i<0?'all':''}"><td>${lbl}${cell(pick(a,0))}${cell(pick(a,1))}`;
  $('#tx').innerHTML='<thead><tr><th>Channel<th>min ms<th class="l">min: PDU<th class="l">min: request sent<th>max ms<th class="l">max: PDU<th class="l">max: request sent</tr></thead><tbody>'+R.conns.map((cn,i)=>xrow(lab(i),LTA[i],i)).join('')+xrow('All channels',LTall,-1)+'</tbody>';
  $('#xn').textContent='Request send times: offset from the first SMPP PDU, then UTC clock (first PDU at '+new Date(T0).toISOString().replace('T',' ').slice(0,23)+' UTC). In Wireshark use smpp.sequence_number == <seq>, adding && tcp.port == <client port> to pick the channel.'},
 () => {   // request rate + SMPP window (requests of the selected PDU type)
  const rate=a=>{if(!a.length)return null;const bn=new Map();a.forEach(p=>{const s=Math.floor((p.t-T0)/1000+1e-6);bn.set(s,(bn.get(s)||0)+1)});
   let pk=0,at=0;[...bn].sort((x,y)=>x[0]-y[0]).forEach(([s,k])=>{if(k>pk){pk=k;at=s}});return{n:a.length,per:Math.max(1,(a[a.length-1].t-a[0].t)/1000),pk,at}};
  const inflight=(pairs,un)=>{const s=new Float64Array(pairs.length+un.length),e=new Float64Array(pairs.length);pairs.forEach((l,i)=>{s[i]=l.t;e[i]=l.rt});un.forEach((q,i)=>{s[pairs.length+i]=q.t});s.sort();e.sort();
   let i=0,k=0,cur=0,mx=0;while(i<s.length){if(k<e.length&&e[k]<=s[i]){cur--;k++}else{cur++;i++;if(cur>mx)mx=cur}}return mx};
  const rrow=(lbl,i)=>{const s=rate(RQi(i)),w=inflight(i<0?LTall:LTA[i],UNi(i));
   return`<tr class="${cls(i)}" onclick="sel(${i})"><td>${lbl}`+(s?`<td>${s.n}<td>${f2(s.per)}<td>${f2(s.n/s.per)}<td>${s.pk}<td>+${f2(s.at)} s<td>${w}`:'<td>0<td>–<td>–<td>–<td>–<td>–')};
  $('#tr').innerHTML='<thead><tr><th>Channel<th>requests<th>send period (s)<th>average /s<th>peak /s (1 s bin)<th>peak at<th>max outstanding</tr></thead><tbody>'+R.conns.map((cn,i)=>rrow(lab(i),i)).join('')+rrow('All channels',-1)+'</tbody>';
  const tyn=$('#ty').options[$('#ty').selectedIndex];$('#rh').textContent='PDU type: '+(tyn?tyn.text:'all types')+(ty===4?' (= SMS submitted per second; a concatenated SMS counts once per part)':'');
  CTX={L,S,T0,RQ:RQi(c)}},   // the charts read CTX, so it is replaced only when the tables above are complete
 () => redraw()]);
 chain(steps,gen,()=>RG)}

/* ---- charts: three stacked canvases sharing one legend; "All channels" overlays every channel + the combined series ---- */
const sw=(cl,d,lw)=>`<svg width="24" height="10" style="vertical-align:middle;margin-right:5px" aria-hidden="true"><line x1="0" y1="5" x2="24" y2="5" stroke="${cl}" stroke-width="${lw}"${d.length?` stroke-dasharray="${d.join(' ')}"`:''}/></svg>`;   // line sample: legend + tooltips
const HV={};                                                       // hover hit-tests, one per chart, set by chart()
function redraw(){$('#tip').hidden=true;if(R&&CTX&&I)draw(CTX.L,CTX.S,CTX.T0,CTX.RQ)}
function tg(c){HID.has(c)?HID.delete(c):HID.add(c);redraw()}
function sel(c){$('#sc').value=c;HID.clear();$('#pts').checked=c>=0||R.conns.length<2;render()}
function draw(L,S,t0,RQ){
 const ids=[...new Set(L.map(l=>l.c).concat(RQ.map(p=>p.c)))].sort((x,y)=>x-y),multi=ids.length>1;
 $('#lg').innerHTML=multi?[[-1,COMB,[],4,'All channels combined']].concat(ids.map(c=>[c,col(c),dsh(c),3,'#'+(c+1)+' '+esc(R.conns[c].label)])).map(([c,cl,d,lw,n])=>
  `<span onclick="tg(${c})" style="cursor:pointer;display:inline-block;margin-right:1.5em;${HID.has(c)?'opacity:.4;text-decoration:line-through':''}">${sw(cl,d,lw)}${n}</span>`).join('')+' <span class="hint">(click to show / hide; applies to all charts)</span>':'';
 const xt=Math.max(1,(I.t1-t0)/1000);   // both time charts span the whole capture (first to last SMPP PDU), so they line up and match the Duration
 [1,2,3].forEach(m=>{$('#c'+m).hidden=!(mode===0||mode===m)});$('#ch').className=mode?'one':'';
 chain([1,2,3].filter(m=>mode===0||mode===m).map(m=>()=>chart(m,L,S,t0,RQ,multi,xt)),++RD,()=>RD)}   // one chart per task
/* request-rate bins over a span of xb seconds: bin width grows to keep <= 300 points; the last, incomplete bin is divided by its real width, or dropped if < half a bin */
function rateBins(xb){const BW=Math.max(1,Math.ceil(xb/300));let nb=Math.max(1,Math.ceil(xb/BW-1e-9));const wd=i=>Math.min(BW,xb-i*BW);let dropped=false;
 if(nb>1&&wd(nb-1)<BW*.5){nb--;dropped=true}
 return{BW,nb,wd,dropped,bin:(a,t0)=>{const b=new Array(nb).fill(0);a.forEach(p=>{let i=Math.floor((p.t-t0)/1000/BW+1e-6);if(i>=nb){if(dropped)return;i=nb-1}b[i]++});return b.map((v,i)=>v/wd(i))}}}
function chart(m,L,S,t0,RQ,multi,xt){   // m: 1 = latency distribution, 2 = latency over time, 3 = request rate over time
 const k=$('#cv'+m),cap=$('#cap'+m),r=devicePixelRatio||1,w=k.clientWidth,h=k.clientHeight;k.width=w*r;k.height=h*r;
 const g=k.getContext('2d'),mu='#555555',A=m===3?RQ:L;g.scale(r,r);
 g.font='11px "Lucida Grande", Verdana, sans-serif';g.textAlign='center';g.fillStyle=mu;
 HV[m]=null;const note=t=>{cap.textContent=t;k.setAttribute('role','img');k.setAttribute('aria-label',t)};
 if(!A.length){g.fillText(m===3?'No requests of this type in this selection':'No matched request/response pairs for this selection',w/2,h/2);note('');return}
 const by=new Map();A.forEach(l=>{if(!by.has(l.c))by.set(l.c,[]);by.get(l.c).push(l)});
 const ids=[...by.keys()].sort((x,y)=>x-y),vis=ids.filter(c=>!HID.has(c)),showC=!multi||!HID.has(-1);
 const ch=c=>'#'+(c+1)+' '+esc(R.conns[c].label),nmo=c=>c<0?(multi?'All channels combined':ch(ids[0])):ch(c),clr=c=>c<0?COMB:col(c);   // tooltip names / colours
 const hi=(S.p99||S.max)||1,NB=50,pts=$('#pts').checked,tyo=$('#ty').options[$('#ty').selectedIndex],tyn=tyo?tyo.text:'all types';
 const hist=a=>{const b=new Array(NB).fill(0);a.forEach(l=>b[Math.min(NB-1,Math.floor(l.ms/hi*NB))]++);return b.map(v=>v/a.length*100)};
 let xb,yb,bins=[],chs=[],BW=1,series=[],dropped=false;
 if(m===1){bins=showC?hist(L):[];chs=multi?vis.map(c=>[c,hist(by.get(c))]):[];yb=Math.max(1,...bins,...chs.flatMap(x=>x[1]))*1.05;xb=hi}
 else{xb=xt;
  if(m===2)yb=hi*1.1;
  else{   // rate: bins start at t0; the incomplete last bin is scaled by its real width, or not drawn when it is less than half a bin
   const rbn=rateBins(xb);BW=rbn.BW;dropped=rbn.dropped;const rb=a=>rbn.bin(a,t0);
   series=multi?(showC?[[-1,rb(A)]]:[]).concat(vis.map(c=>[c,rb(by.get(c))])):[[-1,rb(A)]];yb=Math.max(1,...series.flatMap(s=>s[1]))*1.1;
   series.wd=rbn.wd}}
 // margins from the real label widths, so the last x label and the y labels are never clipped
 const yl=[0,1,2,3,4,5].map(i=>f2(yb*i/5));
 const ML=Math.ceil(Math.max(...yl.map(s=>g.measureText(s).width)))+24,MB=32,MT=10,MR=Math.max(12,Math.ceil(g.measureText(f2(xb)).width/2)+4);
 let NX=5;const xlw=n=>Math.max(...Array.from({length:n+1},(_,i)=>g.measureText(f2(xb*i/n)).width));
 while(NX>2&&(w-ML-MR)/NX<xlw(NX)+14)NX--;               // narrow chart: fewer x ticks, never fewer decimals
 const xl=Array.from({length:NX+1},(_,i)=>f2(xb*i/NX));
 const X=v=>ML+v/xb*(w-ML-MR),Y=v=>h-MB-v/yb*(h-MB-MT);
 g.strokeStyle=mu+'44';g.lineWidth=1;g.setLineDash([]);
 for(let i=0;i<=5;i++){const yv=yb*i/5;g.beginPath();g.moveTo(ML,Y(yv));g.lineTo(w-MR,Y(yv));g.stroke();
  g.textAlign='right';g.fillText(yl[i],ML-5,Y(yv)+4)}
 g.textAlign='center';xl.forEach((t,i)=>g.fillText(t,X(xb*i/NX),h-MB+15));
 g.fillText(m===1?'latency (ms)':'time since first SMPP PDU (s)',(w+ML)/2,h-3);
 g.save();g.translate(12,h/2);g.rotate(-Math.PI/2);g.fillText(m===1?'% of responses':m===2?'latency (ms)':'requests / s',0,0);g.restore();
 if(m===1){
  g.fillStyle=multi?'#cfcfcf':col(ids[0]);bins.forEach((v,i)=>{const x0=X(i*hi/NB),x1=X((i+1)*hi/NB);g.fillRect(x0+1,Y(v),x1-x0-1,Y(0)-Y(v))});
  g.lineWidth=2;chs.forEach(([c,b])=>{g.strokeStyle=col(c);g.setLineDash(dsh(c));g.beginPath();b.forEach((v,i)=>{const x=X((i+.5)*hi/NB),y=Y(v);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()});
  g.setLineDash([5,4]);g.lineWidth=1.3;g.textAlign='left';g.strokeStyle=g.fillStyle=COMB;
  if(showC)[[S.p50,'median'],[S.p95,'p95']].forEach(([v,n],j)=>{if(v>hi)return;g.beginPath();g.moveTo(X(v),MT);g.lineTo(X(v),Y(0));g.stroke();const tx=n+' '+f2(v),x=X(v)+4,right=x+g.measureText(tx).width>w-2;g.textAlign=right?'right':'left';g.fillText(tx,right?X(v)-4:x,MT+12+j*14)});   // flipped to the left of the line when it would run off the right edge
  g.setLineDash([]);
  HV[1]=(px,py)=>{if(px<ML||px>w-MR||py<MT||py>h-MB)return null;const i=Math.min(NB-1,Math.floor((px-ML)/(w-ML-MR)*NB)),row=(c,v,n)=>sw(c<0?(multi?'#999999':col(ids[0])):col(c),c<0?[]:dsh(c),3)+nmo(c)+': <b>'+f2(v)+' %</b> ('+Math.round(v*n/100)+' of '+n+')',rows=[];
   if(showC)rows.push(row(-1,bins[i],L.length));chs.forEach(([c,b])=>rows.push(row(c,b[i],by.get(c).length)));
   return '<b>'+f2(i*hi/NB)+' – '+f2((i+1)*hi/NB)+' ms</b>'+(i===NB-1?' and slower':'')+'<br>'+rows.join('<br>')};
  note(S.n+' pairs, PDU type: '+tyn+'. Range clipped at p99 ('+f2(hi)+' ms); slower responses are counted in the last bin'+(S.max>hi?' (true maximum '+f2(S.max)+' ms).':'.')+(multi?' Grey bars = all channels combined; coloured lines = individual channels (each as % of its own responses).':''))}
 else if(m===2){
  if(pts)L.forEach(l=>{if(HID.has(l.c))return;g.fillStyle=col(l.c)+'aa';g.beginPath();g.arc(X((l.t-t0)/1000),Y(Math.min(l.ms,yb)),2.5,0,7);g.fill()});
  const B=50,SL=new Map();                                          // B equal time slices; SL keeps each series' per-slice sums for the tooltip
  const meanLine=(key,a,c,lw,d)=>{const sum=new Array(B).fill(0),nn=new Array(B).fill(0);SL.set(key,{sum,nn});a.forEach(l=>{const i=Math.min(B-1,Math.floor((l.t-t0)/1000/xb*B));sum[i]+=l.ms;nn[i]++});
   g.strokeStyle=c;g.lineWidth=lw;g.setLineDash(d);g.beginPath();let st=0;sum.forEach((s,i)=>{if(!nn[i])return;const x=X((i+.5)*xb/B),y=Y(Math.min(s/nn[i],yb));st?g.lineTo(x,y):g.moveTo(x,y);st=1});g.stroke();g.setLineDash([])};
  if(multi)vis.forEach(c=>meanLine(c,by.get(c),col(c),2,dsh(c)));
  if(showC)meanLine(-1,L,COMB,3,[]);
  HV[2]=(px,py)=>{if(px<ML-2||px>w-MR+2||py<MT||py>h-MB)return null;
   if(pts){let b=null,bd=64;L.forEach(l=>{if(HID.has(l.c))return;const dx=X((l.t-t0)/1000)-px,dy=Y(Math.min(l.ms,yb))-py,d=dx*dx+dy*dy;if(d<bd){bd=d;b=l}});
    if(b)return sw(col(b.c),dsh(b.c),3)+'<b>'+ch(b.c)+'</b><br>'+tn(b.id)+' seq '+b.sq+(b.mid?' · msg-id '+esc(b.mid):'')+(b.st?' · '+(ST[b.st]||'status 0x'+b.st.toString(16)):'')+'<br>request sent +'+f2((b.t-t0)/1000)+' s<br>latency <b>'+f2(b.ms)+' ms</b>'+(b.ms>yb?' (drawn clamped at the top)':'')}
   const i=Math.max(0,Math.min(B-1,Math.floor((px-ML)/(w-ML-MR)*B))),rows=[];
   [-1,...vis].forEach(c=>{const q=SL.get(c);if(q)rows.push(sw(clr(c),c<0?[]:dsh(c),3)+nmo(c)+': '+(q.nn[i]?'<b>'+f2(q.sum[i]/q.nn[i])+' ms</b> ('+q.nn[i]+' responses)':'no responses'))});
   return '<b>time slice '+f2(i*xb/B)+' – '+f2((i+1)*xb/B)+' s</b> (mean latency)<br>'+rows.join('<br>')};
  note('Lines = mean latency per time slice (the capture is cut into '+B+' equal slices of '+f2(xb/B)+' s), PDU type: '+tyn+(multi?' (coloured = per channel, dark = all channels combined)':'')+(pts?'; dots = individual responses (actual values), plotted at request time':'; tick "individual points" to see the actual responses')+'. Values above p99 are clamped to the top. Time axis: whole capture, '+f2(xt)+' s.')}
 else{
  series.forEach(([c,b])=>{g.strokeStyle=c<0?COMB:col(c);g.lineWidth=c<0?3:2;g.setLineDash(c<0?[]:dsh(c));g.beginPath();b.forEach((v,i)=>{const x=X(i*BW+series.wd(i)/2),y=Y(v);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()});g.setLineDash([]);
  HV[3]=(px,py)=>{if(!series.length||px<ML||px>w-MR||py<MT||py>h-MB)return null;const i=Math.floor((px-ML)/(w-ML-MR)*xb/BW);if(i>=series[0][1].length)return null;
   return '<b>time '+f2(i*BW)+' – '+f2(i*BW+series.wd(i))+' s</b>'+(BW>1?' (mean over the bin)':'')+'<br>'+series.map(([c,b])=>sw(clr(c),c<0?[]:dsh(c),3)+nmo(c)+': <b>'+f2(b[i])+' requests/s</b> ('+Math.round(b[i]*series.wd(i))+' requests)').join('<br>')};
  note('Requests per second, PDU type: '+tyn+(multi?' (coloured = per channel, dark = all channels combined)':'')+'; '+(BW>1?'mean over '+BW+' s bins':'1 s bins')+(dropped?'; the incomplete final interval is not drawn':'')+'. Time axis: whole capture, '+f2(xt)+' s; a PDU type that stops earlier shows no requests afterwards.')}}

/* ---- wiring ---- */
const dz=$('#drop');dz.onclick=()=>$('#fi').click();dz.onkeydown=e=>e.key==='Enter'&&$('#fi').click();
addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('o')});     // whole page is a drop target, so a miss never navigates to the file
addEventListener('dragleave',e=>{if(!e.relatedTarget)dz.classList.remove('o')});
addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('o');e.dataTransfer.files[0]&&load(e.dataTransfer.files[0])});
$('#cx').onclick=()=>stop('Cancelled.');
$('#fi').onchange=e=>{const f=e.target.files[0];e.target.value='';f&&load(f)};   // reset so the same file can be chosen again
$('#pt').onchange=()=>file&&load(file);$('#sc').onchange=()=>sel(+$('#sc').value);$('#ty').onchange=()=>render();$('#pts').onchange=redraw;
[0,1,2,3].forEach(m=>$('#m'+m).onclick=()=>{mode=m;[0,1,2,3].forEach(x=>$('#m'+x).classList.toggle('on',m===x));redraw()});
/* hover tooltips: the nearest dot / the time slice / the bin under the mouse (hit-tests are built by chart()) */
const tip=$('#tip');
[1,2,3].forEach(m=>{const k=$('#cv'+m);
 k.onmousemove=e=>{const hv=HV[m],r=k.getBoundingClientRect(),html=hv&&hv(e.clientX-r.left-k.clientLeft,e.clientY-r.top-k.clientTop);if(!html){tip.hidden=true;return}
  tip.innerHTML=html;tip.hidden=false;const tw=tip.offsetWidth,th=tip.offsetHeight;let x=e.clientX+14,y=e.clientY+14;
  if(x+tw>innerWidth-4)x=Math.max(4,e.clientX-tw-14);if(y+th>innerHeight-4)y=Math.max(4,e.clientY-th-14);tip.style.left=x+'px';tip.style.top=y+'px'};
 k.onmouseleave=()=>{tip.hidden=true}});
addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(redraw,120)});
