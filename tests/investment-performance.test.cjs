const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../investment-performance.js'),B=require('../backup.js');
const rows=[{id:'a',date:'2026-09-30',ing:100,cartera:120,patrimonio:150},{id:'b',date:'2026-10-09',ing:130,cartera:110,patrimonio:140},{id:'c',date:'2026-10-31',ing:135,cartera:115,patrimonio:145}];
test('deposit masking losses and pension contribution are deducted',()=>{const r=P.interval(rows[1],rows[0]);assert.equal(r.result,-40);assert.equal(r.netFlow,30);assert.equal(r.status,'Estimado por capital registrado');});
test('verified withdrawals, internal transfers, zero flows and stale baseline',()=>{
 let r=P.interval(rows[1],rows[0],{investmentFlow:{fromDate:rows[0].date,contributions:0,withdrawals:10}});assert.equal(r.result,0);assert.equal(r.status,'Verificado');
 r=P.interval(rows[1],rows[0],{investmentFlow:{fromDate:rows[0].date,contributions:0,withdrawals:0}});assert.equal(r.result,-10);
 r=P.interval(rows[1],rows[0],{investmentFlow:{fromDate:'2026-09-29',contributions:900,withdrawals:0}});assert.equal(r.status,'Revisar intervalo');assert.equal(r.result,-40);
});
test('monthly and annual results sum all intervals with actual boundaries',()=>{for(const mode of ['mensual','anual']){const result=P.periods(rows,[],mode);if(mode==='mensual'){assert.equal(result[0].result,-40);assert.equal(result[0].netFlow,35);assert.equal(result[0].from,'2026-09-30');assert.equal(result[0].diffCartera,-5);}else assert.equal(result[0].result,null);}});
test('missing baseline and missing flow never become zero',()=>{assert.equal(P.interval(rows[0],null).result,null);assert.equal(P.interval({...rows[1],ing:null},rows[0]).result,null);assert.equal(P.periods([rows[0],{...rows[1],ing:null}],[],'mensual')[0].result,null);});
test('flow data validate, roundtrip and leave monthly savings unchanged',()=>{
const d={incomes:[],expenses:[],funds:[],snapshots:[{id:'s',date:'2026-10-31',summaryOnly:true,table2:{cartera:115},investmentFlow:{fromDate:'2026-09-30',contributions:35,withdrawals:0}}],monthlyBalances:[]};
 B.validateDataset(d);assert.deepEqual(B.prepareRestore(JSON.stringify(d),d).data,d);
 for(const bad of [NaN,-1,0.001,'2']){const c=structuredClone(d);c.snapshots[0].investmentFlow.contributions=bad;assert.throws(()=>B.validateDataset(c));}
 const c=structuredClone(d);c.snapshots[0].investmentFlow.fromDate='2026-10-31';assert.throws(()=>B.validateDataset(c));
});

test('weekly chart excludes initial capital and has only net entries and total balance changes',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const start=html.indexOf('            const resultChartRows =');
 const end=html.indexOf('            const historyColumns',start);
 const measured=[
 {date:'2026-06-19',from:'2026-06-12',diffCartera:10,diffPatrimonio:15,netFlow:5,result:5},
 {date:'2026-06-12',from:'2026-01-01',diffCartera:1000,netFlow:900,result:100},
 {date:'2026-01-01',from:null,diffCartera:10000,netFlow:10000,result:null}];
 let actualMode;
 const chart=vm.runInNewContext('(function(){'+html.slice(start,end)+'return resultChart;})()',{
 historyRows:[],snapshots:[],FamilyPerformance:{periods:(r,s,mode)=>{actualMode=mode;return measured;}}
 });
 assert.equal(actualMode,'semanal');
 assert.deepEqual(Array.from(chart.labels),['2026-06-19']);
 assert.deepEqual(Array.from(chart.datasets,d=>Array.from(d.data)).flat(),[15,5]);
});
