import { useState, useEffect } from "react";

// ============================================================
// AIRTABLE API
// ============================================================
const TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE;
const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function fetchAll(table) {
  let all = [], offset = null;
  do {
    const u = `${API}/${encodeURIComponent(table)}${offset ? `?offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: H });
    const d = await r.json();
    if (d.error) { console.error("Airtable error:", d.error); return []; }
    all = all.concat(d.records || []);
    offset = d.offset;
  } while (offset);
  return all;
}

async function createRec(table, fields) {
  const r = await fetch(`${API}/${encodeURIComponent(table)}`, {
    method: "POST", headers: H, body: JSON.stringify({ records: [{ fields }] })
  });
  return r.json();
}

// UTILS
const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const calcIVA = (b) => (b || 0) * 0.21;
const calcIRPF = (b) => (b || 0) * 0.15;
const calcTotal = (b) => (b || 0) + calcIVA(b) - calcIRPF(b);
const diasEntre = (a, b) => { try { return Math.floor((new Date(b) - new Date(a)) / 86400000); } catch { return 0; } };
const hoy = new Date().toISOString().split("T")[0];

const TRAMOS_FB = [
  { tramo:1,min:0,max:670,cuota:200 },{ tramo:2,min:670,max:900,cuota:230 },
  { tramo:3,min:900,max:1166,cuota:275 },{ tramo:4,min:1166,max:1300,cuota:291 },
  { tramo:5,min:1300,max:1500,cuota:294 },{ tramo:6,min:1500,max:1700,cuota:294 },
  { tramo:7,min:1700,max:1850,cuota:350 },{ tramo:8,min:1850,max:2030,cuota:370 },
  { tramo:9,min:2030,max:2330,cuota:390 },{ tramo:10,min:2330,max:2760,cuota:415 },
  { tramo:11,min:2760,max:3190,cuota:465 },{ tramo:12,min:3190,max:3620,cuota:465 },
  { tramo:13,min:3620,max:4050,cuota:530 },{ tramo:14,min:4050,max:6000,cuota:530 },
  { tramo:15,min:6000,max:99999,cuota:590 },
];
function getTramo(rn, t) { const x = t.length ? t : TRAMOS_FB; return x.find(z => rn >= z.min && rn < z.max) || x[x.length-1]; }

// BRAND
const B = {
  bg:"linear-gradient(160deg, #f0e991 0%, #FAFAFA 45%, #b1b8f4 100%)",
  card:"rgba(255,255,255,0.75)",border:"rgba(0,0,0,0.07)",text:"#111",muted:"#555",
  purple:"#6e72b8",green:"#16a34a",red:"#dc2626",amber:"#d97706",yellow:"#f0e991",
  tM:"'Roboto Mono', monospace",tS:"'Work Sans', sans-serif",
  btn:{background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"12px 24px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Roboto Mono', monospace",textTransform:"uppercase",letterSpacing:"0.06em"},
};

// COMPONENTS
function Card({children,style}){return <div style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:12,padding:"22px 24px",border:`1px solid ${B.border}`,...style}}>{children}</div>;}
function Label({children}){return <span style={{fontSize:11,color:B.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:B.tM}}>{children}</span>;}
function BigNum({children,color}){return <span style={{fontSize:30,fontWeight:700,color:color||B.text,fontFamily:B.tM,display:"block",marginTop:4}}>{children}</span>;}
function Sem({estado}){const m={Cobrada:{c:B.green,l:"COBRADA"},Pendiente:{c:B.amber,l:"PENDIENTE"},Vencida:{c:B.red,l:"VENCIDA"}};const x=m[estado]||m.Pendiente;return <span style={{background:x.c+"15",color:x.c,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700,fontFamily:B.tM}}>{x.l}</span>;}
function PBar({value,max,label,color}){const c=color||B.text,pct=Math.min(((value||0)/(max||1))*100,100);return(<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontFamily:B.tS}}><span style={{color:B.text,fontWeight:600}}>{label}</span><span style={{color:B.muted}}>{fmt(value)} / {fmt(max)}</span></div><div style={{background:"rgba(0,0,0,0.06)",borderRadius:6,height:28,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",borderRadius:6,background:c,transition:"width 1s ease",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:10}}>{pct>12&&<span style={{fontSize:11,fontWeight:700,color:"#fff",fontFamily:B.tM}}>{Math.round(pct)}%</span>}</div></div></div>);}
function Loader(){return <div style={{textAlign:"center",padding:60,color:B.muted,fontFamily:B.tM,fontSize:14}}>CARGANDO DATOS...</div>;}

// ============================================================
// PAGES
// ============================================================
function Dashboard({ingresos,gastos,salObj}){
  const tF=ingresos.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const tC=ingresos.filter(r=>r.fields["Estado"]==="Cobrada").reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const iR=ingresos.reduce((s,r)=>s+(r.fields["IVA (€)"]||0),0);
  const iS=gastos.reduce((s,r)=>s+(r.fields["IVA Soportado (€)"]||0),0);
  const irR=ingresos.reduce((s,r)=>s+(r.fields["IRPF (€)"]||0),0);
  const tG=gastos.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const bn=tF-tG,hu=iR-iS+irR,vc=ingresos.filter(r=>r.fields["Estado"]==="Vencida").length;
  const ms=new Date().getMonth()+1,bm=bn/(ms||1);
  const MN=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const dt=MN.slice(0,ms).map((m,i)=>{
    const fi=ingresos.filter(r=>r.fields["Fecha"]&&new Date(r.fields["Fecha"]).getMonth()===i);
    const gi=gastos.filter(r=>{if(r.fields["Periodicidad"]==="Mensual")return true;return r.fields["Fecha"]&&new Date(r.fields["Fecha"]).getMonth()===i;});
    return{mes:m,ing:fi.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0),gas:gi.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0)};
  });
  const mx=Math.max(...dt.map(d=>Math.max(d.ing,d.gas)),1);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Panel de Control</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(195px, 1fr))",gap:14}}>
        <Card><Label>Facturado Total</Label><BigNum color={B.purple}>{fmt(tF)}</BigNum><span style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>Base imponible</span></Card>
        <Card><Label>Cobrado Real</Label><BigNum color={B.green}>{fmt(tC)}</BigNum><span style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>En tu cuenta</span></Card>
        <Card><Label>Beneficio Neto</Label><BigNum color={bn>0?B.green:B.red}>{fmt(bn)}</BigNum><span style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>{fmt(bm)}/mes</span></Card>
        <Card><Label>Facturas Vencidas</Label><BigNum color={B.red}>{vc}</BigNum><span style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>Sin cobrar</span></Card>
      </div>
      <div style={{background:B.text,borderRadius:12,padding:"28px",color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-8,right:20,fontSize:72,opacity:0.06,fontFamily:B.tM,fontWeight:700}}>HACIENDA</div>
        <Label><span style={{color:"rgba(255,255,255,0.6)"}}>HUCHA DE HACIENDA — DINERO INTOCABLE</span></Label>
        <div style={{fontSize:46,fontWeight:700,marginTop:8,fontFamily:B.tM}}>{fmt(hu)}</div>
        <div style={{display:"flex",gap:20,marginTop:14,fontSize:12,opacity:0.65,fontFamily:B.tS,flexWrap:"wrap"}}>
          <span>IVA Repercutido: {fmt(iR)}</span><span>IVA Soportado: {fmt(iS)}</span><span>IRPF Retenido: {fmt(irR)}</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card><Label>Objetivo de Salario</Label><div style={{marginTop:14}}><PBar value={bm} max={salObj} label="Este mes" color={bm>=salObj?B.green:B.amber}/></div></Card>
        <Card><Label>IVA Trimestral</Label><BigNum color={B.purple}>{fmt(iR-iS)}</BigNum><span style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>Modelo 303</span></Card>
      </div>
      <Card>
        <Label>Ingresos vs Gastos</Label>
        <div style={{display:"flex",gap:16,margin:"14px 0 8px",fontSize:12,fontFamily:B.tS}}><span><span style={{color:B.purple}}>■</span> Ingresos</span><span><span style={{color:B.red+"88"}}>■</span> Gastos</span></div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:150}}>
          {dt.map((d,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{display:"flex",gap:3,alignItems:"flex-end",height:120,width:"100%"}}><div style={{flex:1,background:B.purple,borderRadius:"3px 3px 0 0",height:`${(d.ing/mx)*100}%`,minHeight:2,transition:"height 0.8s"}}/><div style={{flex:1,background:B.red+"77",borderRadius:"3px 3px 0 0",height:`${(d.gas/mx)*100}%`,minHeight:2,transition:"height 0.8s"}}/></div><span style={{fontSize:11,color:B.muted,fontWeight:600,fontFamily:B.tM}}>{d.mes}</span></div>))}
        </div>
      </Card>
      <Card>
        <Label>Flujo de Caja vs Beneficio</Label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
          <div style={{textAlign:"center",padding:18,background:"rgba(0,0,0,0.03)",borderRadius:8}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Facturado</div><div style={{fontSize:26,fontWeight:700,color:B.purple,fontFamily:B.tM,marginTop:4}}>{fmt(tF)}</div></div>
          <div style={{textAlign:"center",padding:18,background:"rgba(0,0,0,0.03)",borderRadius:8}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Cobrado Real</div><div style={{fontSize:26,fontWeight:700,color:B.green,fontFamily:B.tM,marginTop:4}}>{fmt(tC)}</div></div>
        </div>
        <div style={{marginTop:12,textAlign:"center",fontSize:13,color:B.muted,fontFamily:B.tS}}>Pendiente: <strong style={{color:B.amber}}>{fmt(tF-tC)}</strong></div>
      </Card>
    </div>
  );
}

function Clientes({clientes,ingresos}){
  const [sel,setSel]=useState(null);
  const cd=clientes.map(c=>{const n=c.fields["Nombre"]||"Sin nombre";const fs=ingresos.filter(r=>r.fields["Cliente"]&&r.fields["Cliente"].includes(c.id));const v=fs.filter(f=>f.fields["Estado"]==="Vencida").length;const p=fs.filter(f=>f.fields["Estado"]==="Pendiente").length;const t=fs.reduce((s,f)=>s+(f.fields["Base Imponible"]||0),0);const cb=fs.filter(f=>f.fields["Fecha Cobro"]&&f.fields["Fecha"]);const dm=cb.map(f=>diasEntre(f.fields["Fecha"],f.fields["Fecha Cobro"]));const md=dm.length?Math.round(dm.reduce((a,b)=>a+b,0)/dm.length):null;return{...c,n,fs,v,p,t,md};});
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Clientes</h2>
      {cd.map(c=>{const bc=c.v>0?B.red:c.p>0?B.amber:B.green;return(
        <div key={c.id} onClick={()=>setSel(sel===c.id?null:c.id)} style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:10,padding:20,cursor:"pointer",border:`1px solid ${B.border}`,borderLeft:`4px solid ${bc}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:15,color:B.text,fontFamily:B.tS}}>{c.n}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>{c.fields["Estado"]||""}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:B.text,fontFamily:B.tM}}>{fmt(c.t)}</div><div style={{fontSize:11,color:B.muted,fontFamily:B.tS}}>{c.md!==null?`${c.md} días media`:"Sin datos"}</div></div>
          </div>
          {c.v>0&&<div style={{marginTop:10,background:B.red+"12",color:B.red,padding:"8px 14px",borderRadius:6,fontSize:13,fontWeight:600,fontFamily:B.tS}}>⚠️ {c.v} factura{c.v>1?"s":""} vencida{c.v>1?"s":""}</div>}
          {sel===c.id&&c.fs.length>0&&(<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}><Label>Facturas</Label>{c.fs.map(f=>(<div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(0,0,0,0.03)",padding:"10px 14px",borderRadius:8,fontSize:13,fontFamily:B.tS}}><span style={{fontWeight:700,fontFamily:B.tM,fontSize:12}}>{f.fields["Nº Factura"]||"-"}</span><span style={{color:B.muted}}>{f.fields["Fecha"]||"-"}</span><span style={{fontWeight:600}}>{fmt(f.fields["Base Imponible"])}</span><Sem estado={f.fields["Estado"]||"Pendiente"}/></div>))}</div>)}
        </div>);})}
      {cd.length===0&&<Card><span style={{color:B.muted,fontFamily:B.tS}}>No hay clientes.</span></Card>}
    </div>
  );
}

function Simulador(){
  const[b,setB]=useState(500);const iv=calcIVA(b),ir=calcIRPF(b),tot=calcTotal(b),lm=b-ir;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Simulador de Precios</h2>
      <Card>
        <Label>Base Imponible</Label>
        <input type="range" min="50" max="5000" step="10" value={b} onChange={e=>setB(Number(e.target.value))} style={{width:"100%",accentColor:B.text,marginTop:12}}/>
        <div style={{textAlign:"center",fontSize:44,fontWeight:700,color:B.text,margin:"8px 0",fontFamily:B.tM}}>{fmt(b)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20}}>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>+ IVA (21%)</div><div style={{fontSize:22,fontWeight:700,color:B.green,fontFamily:B.tM}}>{fmt(iv)}</div></div>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>- IRPF (15%)</div><div style={{fontSize:22,fontWeight:700,color:B.red,fontFamily:B.tM}}>{fmt(ir)}</div></div>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Total Factura</div><div style={{fontSize:22,fontWeight:700,color:B.purple,fontFamily:B.tM}}>{fmt(tot)}</div></div>
          <div style={{background:B.text,borderRadius:8,padding:18,textAlign:"center",color:"#fff"}}><div style={{fontSize:11,opacity:0.8,fontFamily:B.tM,textTransform:"uppercase"}}>Te queda limpio</div><div style={{fontSize:22,fontWeight:700,fontFamily:B.tM}}>{fmt(lm)}</div></div>
        </div>
      </Card>
    </div>
  );
}

function GastosView({gastos}){
  const fj=gastos.filter(r=>["Mensual","Anual","Trimestral"].includes(r.fields["Periodicidad"]));
  const vr=gastos.filter(r=>r.fields["Periodicidad"]==="Puntual"||!r.fields["Periodicidad"]);
  const tM=fj.reduce((s,g)=>{const p=g.fields["Periodicidad"],b=g.fields["Base Imponible"]||0;if(p==="Mensual")return s+b;if(p==="Trimestral")return s+b/3;if(p==="Anual")return s+b/12;return s;},0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Gastos y Prorrateo</h2>
      <div style={{background:B.text,borderRadius:12,padding:24,color:"#fff"}}><Label><span style={{color:"rgba(255,255,255,0.6)"}}>APARTA CADA MES</span></Label><div style={{fontSize:38,fontWeight:700,marginTop:6,fontFamily:B.tM}}>{fmt(tM)}</div></div>
      {fj.length>0&&<Card><Label>Gastos Fijos</Label><div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>{fj.map(g=>{const b=g.fields["Base Imponible"]||0,p=g.fields["Periodicidad"];const ms=p==="Anual"?b/12:p==="Trimestral"?b/3:b;return(<div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8}}><div><div style={{fontWeight:600,color:B.text,fontSize:14,fontFamily:B.tS}}>{g.fields["Concepto"]||"-"}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>{p}</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:700,color:B.text,fontFamily:B.tM}}>{fmt(b)}</div><div style={{fontSize:12,color:B.amber,fontWeight:600,fontFamily:B.tS}}>{fmt(ms)}/mes</div></div></div>);})}</div></Card>}
      {vr.length>0&&<Card><Label>Gastos Variables</Label><div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>{vr.map(g=>(<div key={g.id} style={{display:"flex",justifyContent:"space-between",padding:"14px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8}}><div><div style={{fontWeight:600,color:B.text,fontSize:14,fontFamily:B.tS}}>{g.fields["Concepto"]||"-"}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>{g.fields["Fecha"]||"-"}</div></div><div style={{fontWeight:700,color:B.text,fontFamily:B.tM}}>{fmt(g.fields["Base Imponible"])}</div></div>))}</div></Card>}
      {gastos.length===0&&<Card><span style={{color:B.muted,fontFamily:B.tS}}>No hay gastos.</span></Card>}
    </div>
  );
}

function Morosidad({clientes,ingresos}){
  const rk=clientes.map(c=>{const fs=ingresos.filter(r=>r.fields["Cliente"]&&r.fields["Cliente"].includes(c.id));const cb=fs.filter(f=>f.fields["Fecha Cobro"]&&f.fields["Fecha Vencimiento"]);const d=cb.map(f=>diasEntre(f.fields["Fecha Vencimiento"],f.fields["Fecha Cobro"]));const m=d.length?Math.round(d.reduce((a,b)=>a+b,0)/d.length):null;return{id:c.id,n:c.fields["Nombre"]||"?",mr:m,ct:cb.length};}).filter(c=>c.mr!==null).sort((a,b)=>b.mr-a.mr);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Ranking de Morosidad</h2>
      {rk.map((c,i)=>{const cl=c.mr>10?B.red:c.mr>0?B.amber:B.green;return(
        <div key={c.id} style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:10,padding:20,border:`1px solid ${B.border}`,display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:44,height:44,borderRadius:8,background:cl+"15",color:cl,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,fontFamily:B.tM}}>#{i+1}</div>
          <div style={{flex:1}}><div style={{fontWeight:600,color:B.text,fontFamily:B.tS}}>{c.n}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>{c.ct} facturas</div></div>
          <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:22,color:cl,fontFamily:B.tM}}>{c.mr>0?`+${c.mr}`:c.mr} días</div><div style={{fontSize:11,color:B.muted,fontFamily:B.tS}}>{c.mr>0?"retraso":"a tiempo"}</div></div>
        </div>);})}
      {rk.length===0&&<Card><span style={{color:B.muted,fontFamily:B.tS}}>Necesitas facturas con fecha de vencimiento y cobro.</span></Card>}
    </div>
  );
}

function CuotaAut({ingresos,gastos,tramos,resumen}){
  const ci=resumen.length?resumen[0].fields["Cuota Actual Autonomo"]||294:294;
  const[ca,setCa]=useState(ci);
  const tI=ingresos.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const tG=gastos.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const m=new Date().getMonth()+1;
  const rn=((tI-tG-(ca*m))*0.93)/(m||1);
  const tr=getTramo(rn,tramos);const d=tr.cuota-ca;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Cuota de Autónomos</h2>
      <Card><Label>¿Cuánto pagas? (€/mes)</Label><input type="number" value={ca} onChange={e=>setCa(Number(e.target.value))} style={{width:"100%",padding:"14px 16px",borderRadius:6,border:`2px solid ${B.border}`,background:"#fff",color:B.text,fontSize:20,fontWeight:700,fontFamily:B.tM,outline:"none",boxSizing:"border-box",marginTop:10}}/></Card>
      <div style={{background:B.text,borderRadius:12,padding:28,color:"#fff"}}>
        <Label><span style={{color:"rgba(255,255,255,0.6)"}}>RENDIMIENTO NETO MENSUAL</span></Label>
        <div style={{fontSize:40,fontWeight:700,fontFamily:B.tM,marginTop:6}}>{fmt(rn)}</div>
        <div style={{marginTop:16,display:"flex",gap:24,fontSize:13,fontFamily:B.tS,flexWrap:"wrap"}}>
          <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tM,textTransform:"uppercase"}}>Tramo</div><div style={{fontWeight:700}}>{tr.tramo}</div></div>
          <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tM,textTransform:"uppercase"}}>Cuota correcta</div><div style={{fontWeight:700}}>{fmt(tr.cuota)}/mes</div></div>
          <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tM,textTransform:"uppercase"}}>Rango</div><div style={{fontWeight:700}}>{fmt(tr.min)} - {fmt(tr.max)}</div></div>
        </div>
      </div>
      {d!==0&&<div style={{background:d>0?"#fef2f2":"#f0fdf4",border:`2px solid ${d>0?B.red:B.green}`,borderRadius:8,padding:20,color:d>0?"#991b1b":"#166534"}}><div style={{fontWeight:700,fontSize:15,fontFamily:B.tS}}>{d>0?"⚠️ Pagando de menos":"✅ Pagando de más"}</div><div style={{fontSize:14,marginTop:6,fontFamily:B.tS}}>{d>0?`Deberías: ${fmt(tr.cuota)}. Pagas: ${fmt(ca)}. Dif: ${fmt(d)}/mes`:`Pagas: ${fmt(ca)}. Correcto: ${fmt(tr.cuota)}. Ahorro: ${fmt(Math.abs(d))}/mes`}</div></div>}
      <Card><Label>Tramos 2026</Label><div style={{overflowX:"auto",marginTop:14}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:B.tS}}><thead><tr style={{borderBottom:`2px solid ${B.border}`}}><th style={{padding:"8px 12px",textAlign:"left",color:B.muted,fontFamily:B.tM,fontSize:11,textTransform:"uppercase"}}>Tramo</th><th style={{padding:"8px 12px",textAlign:"left",color:B.muted,fontFamily:B.tM,fontSize:11,textTransform:"uppercase"}}>Rend. Neto</th><th style={{padding:"8px 12px",textAlign:"right",color:B.muted,fontFamily:B.tM,fontSize:11,textTransform:"uppercase"}}>Cuota</th></tr></thead><tbody>{(tramos.length?tramos:TRAMOS_FB).map(t=>(<tr key={t.tramo} style={{background:t.tramo===tr.tramo?B.yellow+"55":"transparent",fontWeight:t.tramo===tr.tramo?700:400,borderBottom:`1px solid ${B.border}`}}><td style={{padding:"8px 12px",color:B.text,fontFamily:B.tM,fontSize:13}}>{t.tramo===tr.tramo?"→ ":""}{t.tramo}</td><td style={{padding:"8px 12px",color:B.text}}>{fmt(t.min)} - {t.max<99999?fmt(t.max):"+6.000€"}</td><td style={{padding:"8px 12px",textAlign:"right",color:t.tramo===tr.tramo?B.purple:B.text,fontFamily:B.tM}}>{fmt(t.cuota)}</td></tr>))}</tbody></table></div></Card>
    </div>
  );
}

function NuevaFactura({onSaved}){
  const[f,sF]=useState({num:"",fecha:hoy,base:"",estado:"Pendiente",venc:"",cobro:""});
  const[saving,setSaving]=useState(false);const[ok,setOk]=useState(false);
  const save=async()=>{
    if(!f.num||!f.base)return alert("Rellena Nº Factura y Base Imponible");
    setSaving(true);
    try{
      const fields={"Nº Factura":f.num,"Base Imponible":parseFloat(f.base)||0,"Estado":f.estado};
      if(f.fecha)fields["Fecha"]=f.fecha;
      if(f.venc)fields["Fecha Vencimiento"]=f.venc;
      if(f.cobro)fields["Fecha Cobro"]=f.cobro;
      await createRec("Ingresos",fields);
      setOk(true);sF({num:"",fecha:hoy,base:"",estado:"Pendiente",venc:"",cobro:""});
      if(onSaved)onSaved();setTimeout(()=>setOk(false),3000);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const iS={width:"100%",padding:"12px 14px",borderRadius:6,border:`2px solid ${B.border}`,background:"#fff",color:B.text,fontSize:14,fontFamily:B.tS,outline:"none",boxSizing:"border-box"};
  const lS={fontSize:11,fontWeight:700,color:B.text,fontFamily:B.tM,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6,marginTop:14};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Nueva Factura</h2>
      {ok&&<div style={{background:"#f0fdf4",border:`2px solid ${B.green}`,borderRadius:8,padding:16,color:"#166534",fontWeight:600,fontFamily:B.tS}}>✅ Guardada en Airtable</div>}
      <Card>
        <Label>Datos de la factura</Label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div><label style={lS}>Nº Factura *</label><input style={iS} value={f.num} onChange={e=>sF({...f,num:e.target.value})} placeholder="F00072026"/></div>
          <div><label style={lS}>Fecha</label><input style={iS} type="date" value={f.fecha} onChange={e=>sF({...f,fecha:e.target.value})}/></div>
          <div><label style={lS}>Base Imponible (€) *</label><input style={iS} type="number" value={f.base} onChange={e=>sF({...f,base:e.target.value})} placeholder="190"/></div>
          <div><label style={lS}>Estado</label><select style={iS} value={f.estado} onChange={e=>sF({...f,estado:e.target.value})}><option value="Pendiente">Pendiente</option><option value="Cobrada">Cobrada</option><option value="Vencida">Vencida</option></select></div>
          <div><label style={lS}>Fecha Vencimiento</label><input style={iS} type="date" value={f.venc} onChange={e=>sF({...f,venc:e.target.value})}/></div>
          <div><label style={lS}>Fecha Cobro</label><input style={iS} type="date" value={f.cobro} onChange={e=>sF({...f,cobro:e.target.value})}/></div>
        </div>
        {f.base&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:20}}>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:14,textAlign:"center"}}><div style={{fontSize:10,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>IVA 21%</div><div style={{fontSize:18,fontWeight:700,color:B.green,fontFamily:B.tM}}>{fmt(calcIVA(parseFloat(f.base)))}</div></div>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:14,textAlign:"center"}}><div style={{fontSize:10,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>IRPF 15%</div><div style={{fontSize:18,fontWeight:700,color:B.red,fontFamily:B.tM}}>{fmt(calcIRPF(parseFloat(f.base)))}</div></div>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:14,textAlign:"center"}}><div style={{fontSize:10,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Total</div><div style={{fontSize:18,fontWeight:700,color:B.purple,fontFamily:B.tM}}>{fmt(calcTotal(parseFloat(f.base)))}</div></div>
        </div>}
        <button onClick={save} disabled={saving} style={{...B.btn,marginTop:20,width:"100%",opacity:saving?0.6:1}}>{saving?"GUARDANDO...":"GUARDAR EN AIRTABLE"}</button>
      </Card>
    </div>
  );
}

// ============================================================
// APP
// ============================================================
const MENU=[{id:"dashboard",label:"DASHBOARD"},{id:"clientes",label:"CLIENTES"},{id:"simulador",label:"SIMULADOR"},{id:"gastos",label:"GASTOS"},{id:"morosidad",label:"MOROSIDAD"},{id:"autonomo",label:"CUOTA AUTÓNOMOS"},{id:"ocr",label:"NUEVA FACTURA"}];

export default function App(){
  const[page,setPage]=useState("dashboard");
  const[open,setOpen]=useState(false);
  const[loading,setLoading]=useState(true);
  const[data,setData]=useState({clientes:[],ingresos:[],gastos:[],resumen:[],tramos:[]});

  const load=async()=>{
    setLoading(true);
    try{
      const[cl,ing,gas,res,trR]=await Promise.all([fetchAll("Clientes"),fetchAll("Ingresos"),fetchAll("Gastos"),fetchAll("Resumen Trimestral"),fetchAll("Tramos de Cotización")]);
      const tr=trR.map(r=>({tramo:r.fields["Tramo"]||0,min:r.fields["Rend. Neto Mín"]||r.fields["Rend Neto Min"]||0,max:r.fields["Rend. Neto Máx"]||r.fields["Rend Neto Max"]||0,cuota:r.fields["Cuota Mínima"]||r.fields["Cuota Minima"]||0})).sort((a,b)=>a.tramo-b.tramo);
      setData({clientes:cl,ingresos:ing,gastos:gas,resumen:res,tramos:tr});
    }catch(e){console.error(e);}
    setLoading(false);
  };

  useEffect(()=>{load();},[]);

  const render=()=>{
    if(loading)return <Loader/>;
    switch(page){
      case "dashboard":return <Dashboard ingresos={data.ingresos} gastos={data.gastos} salObj={2500}/>;
      case "clientes":return <Clientes clientes={data.clientes} ingresos={data.ingresos}/>;
      case "simulador":return <Simulador/>;
      case "gastos":return <GastosView gastos={data.gastos}/>;
      case "morosidad":return <Morosidad clientes={data.clientes} ingresos={data.ingresos}/>;
      case "autonomo":return <CuotaAut ingresos={data.ingresos} gastos={data.gastos} tramos={data.tramos} resumen={data.resumen}/>;
      case "ocr":return <NuevaFactura onSaved={load}/>;
      default:return <Dashboard ingresos={data.ingresos} gastos={data.gastos} salObj={2500}/>;
    }
  };

  return(
    <div style={{fontFamily:B.tS,color:B.text,minHeight:"100vh",background:B.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <header style={{background:"rgba(255,255,255,0.82)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${B.border}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",color:B.text,cursor:"pointer",padding:4,display:"flex"}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:22,height:22}}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <span style={{fontSize:15,fontWeight:700,fontFamily:B.tM,textTransform:"uppercase",letterSpacing:"0.03em"}}>Gestión Autónomo</span>
        </div>
        <button onClick={load} style={{background:"none",border:`1px solid ${B.border}`,borderRadius:6,padding:"6px 14px",fontSize:11,fontFamily:B.tM,cursor:"pointer",color:B.muted,textTransform:"uppercase"}}>↻ ACTUALIZAR</button>
      </header>
      <div style={{display:"flex"}}>
        <nav style={{width:open?240:0,overflow:"hidden",background:"rgba(255,255,255,0.68)",backdropFilter:"blur(16px)",borderRight:`1px solid ${B.border}`,transition:"width 0.3s ease",minHeight:"calc(100vh - 56px)",flexShrink:0}}>
          <div style={{padding:"20px 14px",display:"flex",flexDirection:"column",gap:4}}>
            {MENU.map(m=>(<button key={m.id} onClick={()=>{setPage(m.id);setOpen(false);}} style={{display:"block",padding:"12px 16px",borderRadius:6,border:"none",background:page===m.id?B.text:"transparent",color:page===m.id?"#fff":B.text,fontWeight:700,fontSize:12,cursor:"pointer",width:"100%",textAlign:"left",fontFamily:B.tM,letterSpacing:"0.06em",transition:"all 0.2s",whiteSpace:"nowrap"}}>{m.label}</button>))}
          </div>
        </nav>
        <main style={{flex:1,padding:28,maxWidth:920,margin:"0 auto"}}>{render()}</main>
      </div>
    </div>
  );
}
