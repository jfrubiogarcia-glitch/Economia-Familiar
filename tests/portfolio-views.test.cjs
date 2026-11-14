const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../portfolio-views.js');
const funds=[{id:'rf',name:'Bonos ficticios',type:'Renta Fija Mixta',gestora:'Gestora A'},{id:'rv',name:'Bolsa ficticia',type:'Renta Variable',gestora:'Gestora A'},{id:'pp',name:'Plan ficticio',type:'Plan de Pensiones',gestora:'Gestora B'}];
const snap={date:'2026-11-13',liquidity:200,fundsData:{rf:{ingreso:90,value:100},rv:{ingreso:180,value:200},pp:{ingreso:250,value:500}}};
test('all allocation views have same denominator, include cash exactly once and group mixed as fixed',()=>{
 const before=JSON.stringify(snap),a=V.allocation(funds,snap);assert.equal(a.total,1000);assert.equal(a.types.find(r=>r.label==='Renta fija').value,100);assert.equal(a.types.find(r=>r.label==='Renta variable').value,700);
 for(const rows of [a.types,a.funds,a.managers]){assert.equal(rows.reduce((n,r)=>n+r.value,0),1000);assert.equal(rows.reduce((n,r)=>n+r.percent,0),100);}
 assert.equal(a.managers.find(r=>r.label==='Gestora A').value,300);assert.equal(JSON.stringify(snap),before);
});
test('hidden funds never affect allocations or saved snapshot values; order is view-specific',()=>{
 const before=JSON.stringify(snap),p=V.toggle({},'rf');assert.deepEqual(V.arrange(funds,p,true).map(f=>f.id),['rv','pp']);
 assert.equal(V.allocation(funds,snap).total,1000);assert.equal(JSON.stringify(snap),before);
 const moved=V.move(funds,p,'pp',-1);assert.deepEqual(V.arrange(funds,moved).map(f=>f.id),['rf','pp','rv']);assert.deepEqual(V.arrange(funds,{}).map(f=>f.id),['rf','rv','pp']);
 assert.deepEqual(V.arrange(funds,{order:['pp','pp','removed']}).map(f=>f.id),['pp','rf','rv']);
});
test('unknown, negative and zero are distinct; missing active values block misleading percentages',()=>{
 const missing=structuredClone(snap);delete missing.fundsData.rv;assert.equal(V.allocation(funds,missing).total,null);
 missing.fundsData.rv={value:0};assert.equal(V.allocation(funds,missing).total,800);
 missing.liquidity=null;assert.equal(V.allocation(funds,missing).total,null);
 missing.liquidity=-1;assert.equal(V.allocation(funds,missing).total,null);
});
test('preferences survive reload, tolerate malformed storage and propagate write failures',()=>{
 let saved;const storage={getItem:()=>saved,setItem:(k,v)=>{saved=v;}};
 const pref={photo:V.toggle({},'rf'),positions:V.move(funds,{},'pp',-1),columns:{order:['rf','date'],hidden:['ing']}};
 V.write(storage,pref);assert.deepEqual(V.read(storage),{...pref,fundChart:{order:[],hidden:[]},managerChart:{order:[],hidden:[]}});assert.deepEqual(V.read({getItem:()=>'{'}),{});assert.throws(()=>V.write({setItem(){throw Error('full');}},pref));
});
test('segment colours use actual movement, preserve flat segments and gaps',()=>{
 const ctx=(a,b)=>({p0:{parsed:{y:a}},p1:{parsed:{y:b}}});assert.equal(V.segmentColor(ctx(1,2)),'#16a34a');assert.equal(V.segmentColor(ctx(2,1)),'#dc2626');assert.equal(V.segmentColor(ctx(2,2)),undefined);assert.equal(V.segmentColor(ctx(null,2)),undefined);
 assert.equal(V.COLORS['Renta Fija'],'#111111');assert.equal(V.COLORS['Liquidez'],'#9ca3af');assert.equal(V.COLORS['Patrimonio Total'],V.COLORS['Cartera Total']);
});


test('chart visibility survives reload independently and preserves portfolio weights',()=>{
 const a=V.allocation(funds,snap);let raw;const store={getItem:()=>raw,setItem:(k,v)=>{raw=v;}};
 V.write(store,{photo:V.toggle({},'rf'),positions:V.toggle({},'rv'),fundChart:V.toggle({},'rf'),managerChart:V.toggle({},'manager:Gestora A')});
 const p=V.read(store);assert.deepEqual(p.photo.hidden,['rf']);assert.deepEqual(p.positions.hidden,['rv']);
 const f=V.pieView(a.funds,p.fundChart,a.total);assert.equal(f.visible.some(r=>r.id==='rf'),false);assert.equal(f.visible.find(r=>r.id==='rv').percent,20);assert.equal(f.slices.reduce((n,r)=>n+r.value,0),a.total);
 const m=V.pieView(a.managers,p.managerChart,a.total);assert.equal(m.visible.some(r=>r.label==='Gestora A'),false);assert.equal(m.slices.reduce((n,r)=>n+r.percent,0),100);
 assert.equal(V.pieView(a.funds,V.toggle(p.fundChart,'rf'),a.total).visible.length,a.funds.length);
});
test('balance bars are green for gains, red for losses and neutral for zero or missing',()=>{
 assert.equal(V.balanceBarColor(1),'#16a34a');assert.equal(V.balanceBarColor(-1),'#dc2626');assert.equal(V.balanceBarColor(0),'#9ca3af');assert.equal(V.balanceBarColor(null),'#9ca3af');
});


test('Abaco and Abaco Capital share one manager without changing source data',()=>{
 const f=structuredClone(funds);f[0].gestora='Ábaco';f[1].gestora=' ABACO  CAPITAL ';const original=JSON.stringify(f);
 const a=V.allocation(f,snap);assert.equal(a.managers.filter(r=>r.label==='Ábaco').length,1);assert.equal(a.managers.find(r=>r.label==='Ábaco').value,300);assert.equal(a.managers.find(r=>r.label==='Ábaco').percent,30);assert.equal(JSON.stringify(f),original);
 assert.equal(V.canonicalManager('Abaco Capital'),'Ábaco');assert.equal(V.canonicalManager('Otra gestora'),'Otra gestora');
 const p=V.read({getItem:()=>JSON.stringify({managerChart:{order:['manager:Ábaco Capital','manager:Ábaco'],hidden:['manager:Abaco Capital']}})});
 assert.deepEqual(p.managerChart,{order:['manager:Ábaco'],hidden:['manager:Ábaco']});
});
test('duplicate movement-sums graph is removed and main period selector remains',()=>{
 const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');assert.equal(html.includes('movementSumsChart'),false);assert.equal(html.includes('Suma de subidas y bajadas del saldo total'),false);assert.equal(html.includes('Periodo de entradas y cambios de saldo'),true);
});
