/* Presentation preferences and portfolio summaries. No financial records are mutated.
   Per user instruction, fixed-income and mixed funds share the fixed-income group.
   Pension plans retain the existing application's equity grouping. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyPortfolio=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    const KEY='eco_portfolio_views_v1';
    const finite=n=>typeof n==='number'&&Number.isFinite(n);
    const COLORS={ 'Renta fija':'#111111','Renta variable':'#4c1d95','Liquidez':'#9ca3af','Patrimonio Total':'#2563eb','Cartera Total':'#2563eb','Ingreso Total':'#f97316','Renta Fija':'#111111','Renta Variable':'#4c1d95' };
    function normalise(pref){
        const strings=value=>Array.isArray(value)?[...new Set(value.filter(x=>typeof x==='string'))]:[];
        return {order:strings(pref?.order),hidden:strings(pref?.hidden)};
    }
    function read(storage){try{const data=JSON.parse(storage?.getItem(KEY)||'{}');return Object.fromEntries(['photo','positions','columns'].map(k=>[k,normalise(data?.[k])]));}catch{return {};}}
    function write(storage,data){if(!storage)throw new Error('Preferencias: almacenamiento no disponible.');storage.setItem(KEY,JSON.stringify(data));}
    function arrange(items,pref={},visible=false){
        const {order,hidden}=normalise(pref),rank=new Map(order.map((id,i)=>[id,i]));
        return items.map((item,i)=>({item,i})).filter(({item})=>!visible||!hidden.includes(String(item.id)))
            .sort((a,b)=>(rank.get(String(a.item.id))??order.length+a.i)-(rank.get(String(b.item.id))??order.length+b.i)).map(x=>x.item);
    }
    function move(items,pref,id,direction){const order=arrange(items,pref).map(x=>String(x.id)),i=order.indexOf(String(id)),j=i+direction;if(i>=0&&j>=0&&j<order.length)[order[i],order[j]]=[order[j],order[i]];return {...normalise(pref),order};}
    function toggle(pref,id){const p=normalise(pref);id=String(id);return {...p,hidden:p.hidden.includes(id)?p.hidden.filter(x=>x!==id):[...p.hidden,id]};}
    function group(type){return /fija|mixta/i.test(type||'')?'Renta fija':/liquidez/i.test(type||'')?'Liquidez':'Renta variable';}
    function allocation(funds,snapshot){
        if(!snapshot)return {date:null,total:null,types:[],funds:[],managers:[],missing:[]};
        const missing=funds.filter(f=>!finite(snapshot.fundsData?.[f.id]?.value)&&!f.archived).map(f=>f.name);
        if(!finite(snapshot.liquidity))missing.push('Liquidez');
        const entries=funds.filter(f=>finite(snapshot.fundsData?.[f.id]?.value)).map(f=>({id:String(f.id),label:f.name,manager:f.gestora,type:group(f.type),value:snapshot.fundsData[f.id].value}));
        if(entries.some(e=>e.value<0)||snapshot.liquidity<0)missing.push('Importes negativos');
        if(missing.length)return {date:snapshot.date,total:null,types:[],funds:[],managers:[],missing};
        entries.push({id:'bank-cash',label:'Liquidez en bancos',manager:'Liquidez en bancos',type:'Liquidez',value:snapshot.liquidity});
        const total=entries.reduce((n,e)=>n+e.value,0);
        const summarise=field=>{
            const map=new Map();for(const e of entries){const key=e[field]||'Sin gestora';map.set(key,(map.get(key)||0)+e.value);}
            return [...map].map(([label,value])=>({label,value,percent:total>0?value/total*100:null}));
        };
        return {date:snapshot.date,total,missing:[],types:summarise('type'),managers:summarise('manager'),funds:entries.map(e=>({label:e.label,value:e.value,percent:total>0?e.value/total*100:null}))};
    }
    function segmentColor(context){const a=context?.p0?.parsed?.y,b=context?.p1?.parsed?.y;if(!finite(a)||!finite(b)||a===b)return undefined;return b>a?'#16a34a':'#dc2626';}
    return {KEY,COLORS,normalise,read,write,arrange,move,toggle,group,allocation,segmentColor};
});
