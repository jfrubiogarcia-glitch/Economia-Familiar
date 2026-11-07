/* Portfolio boundary: funds and pension plans, excluding cash. Amounts in EUR.
   Result = closing value - opening value - net external flow.
   Legacy capital differences are estimates, never verified transactions. */
(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; else root.FamilyPerformance=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
    const known = n => typeof n === 'number' && Number.isFinite(n);
    const cents = n => Math.round(n*100)/100;
    function interval(current, previous, snapshot) {
        if (!previous) return { netFlow:null, result:null, status:'Sin referencia', from:null };
        const flow = snapshot?.investmentFlow;
        const verified = flow && flow.fromDate === previous.date;
        const netFlow = verified ? cents(flow.contributions-flow.withdrawals) : known(current.ing)&&known(previous.ing) ? cents(current.ing-previous.ing) : null;
        const result = known(netFlow)&&known(current.cartera)&&known(previous.cartera) ? cents(current.cartera-previous.cartera-netFlow) : null;
        return {netFlow,result,from:previous.date,status:verified?'Verificado':flow?'Revisar intervalo':known(netFlow)?'Estimado por capital registrado':'Sin flujos'};
    }
    function periods(rows,snapshots,mode) {
        const chronological=[...rows].sort((a,b)=>a.date.localeCompare(b.date));
        const measured=chronological.map((r,i)=>({...r,...interval(r,chronological[i-1],snapshots.find(s=>s.id===r.id))}));
        if(mode==='semanal')return measured.reverse();
        const groups=new Map();
        for(const r of measured){ const k=r.date.slice(0,mode==='mensual'?7:4); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(r); }
        return [...groups.values()].map(group=>{
            const last=group.at(-1), first=group[0];
            // A missing baseline or unknown interval must not silently disappear.
            const complete=group.every(r=>known(r.result));
            const flowsKnown=group.every(r=>known(r.netFlow));
            const from=first.from;
            const opening=chronological.find(r=>r.date===from);
            return {...last, from, netFlow:flowsKnown?cents(group.reduce((n,r)=>n+r.netFlow,0)):null,
                result:complete?cents(group.reduce((n,r)=>n+r.result,0)):null,
                diffCartera:opening&&known(opening.cartera)&&known(last.cartera)?cents(last.cartera-opening.cartera):null,
                pctCartera:opening&&opening.cartera>0&&known(last.cartera)?(last.cartera-opening.cartera)/opening.cartera*100:null,
                diffPatrimonio:opening&&known(opening.patrimonio)&&known(last.patrimonio)?cents(last.patrimonio-opening.patrimonio):null,
                pctPatrimonio:opening&&opening.patrimonio>0&&known(last.patrimonio)?(last.patrimonio-opening.patrimonio)/opening.patrimonio*100:null,
                status:complete?(group.every(r=>r.status==='Verificado')?'Verificado':'Estimado / revisar'):'Sin datos suficientes'};
        }).reverse();
    }
    return {interval,periods};
});
