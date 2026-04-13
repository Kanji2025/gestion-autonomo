import { useState } from "react";

// ============================================================
// DATOS DE EJEMPLO
// ============================================================
const MOCK_CLIENTES = [
  { id: 1, nombre: "Beatriz Ruiz Caballero", cif: "17453133C", email: "beatriz@email.com", facturas: [
    { id: "F00072026", fecha: "2026-02-02", base: 190, estado: "cobrada", fechaCobro: "2026-02-15", vencimiento: "2026-03-02" },
    { id: "F00082026", fecha: "2026-03-01", base: 190, estado: "cobrada", fechaCobro: "2026-03-20", vencimiento: "2026-03-31" },
    { id: "F00092026", fecha: "2026-04-01", base: 190, estado: "pendiente", fechaCobro: null, vencimiento: "2026-04-30" },
  ]},
  { id: 2, nombre: "Carlos López Martín", cif: "28764521B", email: "carlos@empresa.com", facturas: [
    { id: "F00102026", fecha: "2026-01-15", base: 450, estado: "cobrada", fechaCobro: "2026-02-28", vencimiento: "2026-02-15" },
    { id: "F00112026", fecha: "2026-02-15", base: 450, estado: "vencida", fechaCobro: null, vencimiento: "2026-03-15" },
    { id: "F00122026", fecha: "2026-03-15", base: 500, estado: "pendiente", fechaCobro: null, vencimiento: "2026-04-15" },
  ]},
  { id: 3, nombre: "Ana García Sánchez", cif: "45982311D", email: "ana@startup.io", facturas: [
    { id: "F00132026", fecha: "2026-01-10", base: 800, estado: "cobrada", fechaCobro: "2026-01-12", vencimiento: "2026-02-10" },
    { id: "F00142026", fecha: "2026-02-10", base: 800, estado: "cobrada", fechaCobro: "2026-02-11", vencimiento: "2026-03-10" },
    { id: "F00152026", fecha: "2026-03-10", base: 850, estado: "cobrada", fechaCobro: "2026-03-12", vencimiento: "2026-04-10" },
    { id: "F00162026", fecha: "2026-04-10", base: 850, estado: "pendiente", fechaCobro: null, vencimiento: "2026-05-10" },
  ]},
  { id: 4, nombre: "Pedro Navarro Gil", cif: "12398745F", email: "pedro@consultoria.es", facturas: [
    { id: "F00172026", fecha: "2026-02-20", base: 300, estado: "vencida", fechaCobro: null, vencimiento: "2026-03-20" },
    { id: "F00182026", fecha: "2026-03-20", base: 350, estado: "vencida", fechaCobro: null, vencimiento: "2026-04-06" },
  ]},
];

const MOCK_GASTOS = [
  { concepto: "Hosting Hostinger", base: 120, iva: 25.2, tipo: "fijo", fecha: "2026-01-15", periodicidad: "anual" },
  { concepto: "Adobe Creative Cloud", base: 36, iva: 7.56, tipo: "fijo", fecha: "2026-01-01", periodicidad: "mensual" },
  { concepto: "Dominio web", base: 15, iva: 3.15, tipo: "fijo", fecha: "2026-03-01", periodicidad: "anual" },
  { concepto: "Teléfono móvil", base: 25, iva: 5.25, tipo: "fijo", fecha: "2026-01-01", periodicidad: "mensual" },
  { concepto: "Coworking", base: 80, iva: 16.8, tipo: "fijo", fecha: "2026-01-01", periodicidad: "mensual" },
  { concepto: "Curso formación", base: 200, iva: 42, tipo: "variable", fecha: "2026-02-10", periodicidad: "puntual" },
  { concepto: "Material oficina", base: 45, iva: 9.45, tipo: "variable", fecha: "2026-03-05", periodicidad: "puntual" },
];

const TRAMOS_2026 = [
  { tramo: 1, min: 0, max: 670, cuota: 200 },{ tramo: 2, min: 670, max: 900, cuota: 230 },
  { tramo: 3, min: 900, max: 1166, cuota: 275 },{ tramo: 4, min: 1166, max: 1300, cuota: 291 },
  { tramo: 5, min: 1300, max: 1500, cuota: 294 },{ tramo: 6, min: 1500, max: 1700, cuota: 294 },
  { tramo: 7, min: 1700, max: 1850, cuota: 350 },{ tramo: 8, min: 1850, max: 2030, cuota: 370 },
  { tramo: 9, min: 2030, max: 2330, cuota: 390 },{ tramo: 10, min: 2330, max: 2760, cuota: 415 },
  { tramo: 11, min: 2760, max: 3190, cuota: 465 },{ tramo: 12, min: 3190, max: 3620, cuota: 465 },
  { tramo: 13, min: 3620, max: 4050, cuota: 530 },{ tramo: 14, min: 4050, max: 6000, cuota: 530 },
  { tramo: 15, min: 6000, max: 99999, cuota: 590 },
];

const MESES = ["Ene","Feb","Mar","Abr"];
const fmt = (n) => new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(n);
const calcIVA = (b) => b*0.21;
const calcIRPF = (b) => b*0.15;
const calcTotal = (b) => b+calcIVA(b)-calcIRPF(b);
const diasEntre = (a,b) => Math.floor((new Date(b)-new Date(a))/86400000);
const getTramo = (r) => TRAMOS_2026.find(t=>r>=t.min&&r<t.max)||TRAMOS_2026[14];

// BRAND TOKENS
const B = {
  bg: "linear-gradient(160deg, #f0e991 0%, #FAFAFA 45%, #b1b8f4 100%)",
  card: "rgba(255,255,255,0.75)",
  border: "rgba(0,0,0,0.07)",
  text: "#111111",
  muted: "#555555",
  purple: "#6e72b8",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  yellow: "#f0e991",
  tMono: "'Roboto Mono', monospace",
  tSans: "'Work Sans', sans-serif",
  btn: { background:"#111", color:"#fff", border:"none", borderRadius:6, padding:"12px 24px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'Roboto Mono', monospace", textTransform:"uppercase", letterSpacing:"0.06em" },
};

// COMPONENTS
function Card({children,style}) {
  return <div style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:12,padding:"22px 24px",border:`1px solid ${B.border}`,...style}}>{children}</div>;
}
function Label({children}) {
  return <span style={{fontSize:11,color:B.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:B.tMono}}>{children}</span>;
}
function BigNum({children,color}) {
  return <span style={{fontSize:30,fontWeight:700,color:color||B.text,fontFamily:B.tMono,display:"block",marginTop:4}}>{children}</span>;
}
function Sub({children}) {
  return <span style={{fontSize:12,color:B.muted,fontFamily:B.tSans}}>{children}</span>;
}
function Semaforo({estado}) {
  const m={cobrada:{c:B.green,l:"COBRADA"},pendiente:{c:B.amber,l:"PENDIENTE"},vencida:{c:B.red,l:"VENCIDA"}};
  const{c,l}=m[estado];
  return <span style={{background:c+"15",color:c,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700,fontFamily:B.tMono,letterSpacing:"0.03em"}}>{l}</span>;
}
function ProgressBar({value,max,label,color}) {
  const c=color||B.text, pct=Math.min((value/max)*100,100);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontFamily:B.tSans}}>
        <span style={{color:B.text,fontWeight:600}}>{label}</span>
        <span style={{color:B.muted}}>{fmt(value)} / {fmt(max)}</span>
      </div>
      <div style={{background:"rgba(0,0,0,0.06)",borderRadius:6,height:28,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",borderRadius:6,background:c,transition:"width 1s ease",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:10}}>
          {pct>12&&<span style={{fontSize:11,fontWeight:700,color:"#fff",fontFamily:B.tMono}}>{Math.round(pct)}%</span>}
        </div>
      </div>
    </div>
  );
}

// PAGES
function Dashboard({clientes,gastos,salObj}) {
  const af=clientes.flatMap(c=>c.facturas);
  const tFact=af.reduce((s,f)=>s+f.base,0);
  const tCob=af.filter(f=>f.estado==="cobrada").reduce((s,f)=>s+f.base,0);
  const ivaR=af.reduce((s,f)=>s+calcIVA(f.base),0);
  const ivaS=gastos.reduce((s,g)=>s+g.iva,0);
  const irpfR=af.reduce((s,f)=>s+calcIRPF(f.base),0);
  const tGast=gastos.reduce((s,g)=>s+g.base,0);
  const benef=tFact-tGast;
  const hucha=ivaR-ivaS+irpfR;
  const venc=af.filter(f=>f.estado==="vencida").length;
  const bMes=benef/4;
  const data=MESES.map((m,i)=>{
    const fi=af.filter(f=>new Date(f.fecha).getMonth()===i);
    const gi=gastos.filter(g=>g.periodicidad==="mensual"||new Date(g.fecha).getMonth()===i);
    return{mes:m,ing:fi.reduce((s,f)=>s+f.base,0),gas:gi.reduce((s,g)=>s+g.base,0)};
  });
  const mx=Math.max(...data.map(d=>Math.max(d.ing,d.gas)))||1;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase",letterSpacing:"0.02em"}}>Panel de Control</h2>
      
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(195px, 1fr))",gap:14}}>
        <Card><Label>Facturado Total</Label><BigNum color={B.purple}>{fmt(tFact)}</BigNum><Sub>Base imponible acumulada</Sub></Card>
        <Card><Label>Cobrado Real</Label><BigNum color={B.green}>{fmt(tCob)}</BigNum><Sub>Dinero en tu cuenta</Sub></Card>
        <Card><Label>Beneficio Neto</Label><BigNum color={benef>0?B.green:B.red}>{fmt(benef)}</BigNum><Sub>{fmt(bMes)}/mes de media</Sub></Card>
        <Card><Label>Facturas Vencidas</Label><BigNum color={B.red}>{venc}</BigNum><Sub>Pendientes de cobro</Sub></Card>
      </div>

      {/* HUCHA HACIENDA */}
      <div style={{background:B.text,borderRadius:12,padding:"28px 28px 24px",color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-8,right:20,fontSize:72,opacity:0.06,fontFamily:B.tMono,fontWeight:700}}>HACIENDA</div>
        <Label><span style={{color:"rgba(255,255,255,0.6)"}}>HUCHA DE HACIENDA — DINERO INTOCABLE</span></Label>
        <div style={{fontSize:46,fontWeight:700,marginTop:8,fontFamily:B.tMono}}>{fmt(hucha)}</div>
        <div style={{display:"flex",gap:20,marginTop:14,fontSize:12,opacity:0.65,fontFamily:B.tSans,flexWrap:"wrap"}}>
          <span>IVA Repercutido: {fmt(ivaR)}</span>
          <span>IVA Soportado: {fmt(ivaS)}</span>
          <span>IRPF Retenido: {fmt(irpfR)}</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <Label>Objetivo de Salario</Label>
          <div style={{marginTop:14}}><ProgressBar value={bMes} max={salObj} label="Este mes" color={bMes>=salObj?B.green:B.amber}/></div>
        </Card>
        <Card>
          <Label>IVA Trimestral (Q1)</Label>
          <BigNum color={B.purple}>{fmt(ivaR-ivaS)}</BigNum>
          <Sub>A pagar en el próximo modelo 303</Sub>
        </Card>
      </div>

      {/* GRÁFICA */}
      <Card>
        <Label>Ingresos vs Gastos</Label>
        <div style={{display:"flex",gap:16,margin:"14px 0 8px",fontSize:12,fontFamily:B.tSans}}>
          <span><span style={{color:B.purple}}>■</span> Ingresos</span>
          <span><span style={{color:B.red+"88"}}>■</span> Gastos</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:150}}>
          {data.map((d,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{display:"flex",gap:3,alignItems:"flex-end",height:120,width:"100%"}}>
                <div style={{flex:1,background:B.purple,borderRadius:"3px 3px 0 0",height:`${(d.ing/mx)*100}%`,minHeight:2,transition:"height 0.8s"}}/>
                <div style={{flex:1,background:B.red+"77",borderRadius:"3px 3px 0 0",height:`${(d.gas/mx)*100}%`,minHeight:2,transition:"height 0.8s"}}/>
              </div>
              <span style={{fontSize:11,color:B.muted,fontWeight:600,fontFamily:B.tMono}}>{d.mes}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* FLUJO CAJA */}
      <Card>
        <Label>Flujo de Caja vs Beneficio</Label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
          <div style={{textAlign:"center",padding:18,background:"rgba(0,0,0,0.03)",borderRadius:8}}>
            <div style={{fontSize:11,color:B.muted,fontFamily:B.tMono,textTransform:"uppercase"}}>Facturado</div>
            <div style={{fontSize:26,fontWeight:700,color:B.purple,fontFamily:B.tMono,marginTop:4}}>{fmt(tFact)}</div>
          </div>
          <div style={{textAlign:"center",padding:18,background:"rgba(0,0,0,0.03)",borderRadius:8}}>
            <div style={{fontSize:11,color:B.muted,fontFamily:B.tMono,textTransform:"uppercase"}}>Cobrado Real</div>
            <div style={{fontSize:26,fontWeight:700,color:B.green,fontFamily:B.tMono,marginTop:4}}>{fmt(tCob)}</div>
          </div>
        </div>
        <div style={{marginTop:12,textAlign:"center",fontSize:13,color:B.muted,fontFamily:B.tSans}}>
          Pendiente de cobro: <strong style={{color:B.amber}}>{fmt(tFact-tCob)}</strong>
        </div>
      </Card>
    </div>
  );
}

function Clientes({clientes}) {
  const [sel,setSel]=useState(null);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase"}}>Clientes</h2>
      {clientes.map(c=>{
        const v=c.facturas.filter(f=>f.estado==="vencida").length;
        const p=c.facturas.filter(f=>f.estado==="pendiente").length;
        const tot=c.facturas.reduce((s,f)=>s+f.base,0);
        const dm=c.facturas.filter(f=>f.fechaCobro).map(f=>diasEntre(f.fecha,f.fechaCobro));
        const md=dm.length?Math.round(dm.reduce((a,b)=>a+b,0)/dm.length):null;
        const bc=v>0?B.red:p>0?B.amber:B.green;
        return (
          <div key={c.id} onClick={()=>setSel(sel===c.id?null:c.id)} style={{
            background:B.card,backdropFilter:"blur(14px)",borderRadius:10,padding:20,cursor:"pointer",
            border:`1px solid ${B.border}`,borderLeft:`4px solid ${bc}`
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:600,fontSize:15,color:B.text,fontFamily:B.tSans}}>{c.nombre}</div>
                <div style={{fontSize:12,color:B.muted,fontFamily:B.tSans}}>{c.cif} · {c.email}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:B.text,fontFamily:B.tMono}}>{fmt(tot)}</div>
                <div style={{fontSize:11,color:B.muted,fontFamily:B.tSans}}>{md!==null?`${md} días media cobro`:"Sin datos"}</div>
              </div>
            </div>
            {v>0&&<div style={{marginTop:10,background:B.red+"12",color:B.red,padding:"8px 14px",borderRadius:6,fontSize:13,fontWeight:600,fontFamily:B.tSans}}>⚠️ {v} factura{v>1?"s":""} vencida{v>1?"s":""}</div>}
            {sel===c.id&&(
              <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
                <Label>Facturas</Label>
                {c.facturas.map(f=>(
                  <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(0,0,0,0.03)",padding:"10px 14px",borderRadius:8,fontSize:13,fontFamily:B.tSans}}>
                    <span style={{fontWeight:700,fontFamily:B.tMono,fontSize:12}}>{f.id}</span>
                    <span style={{color:B.muted}}>{f.fecha}</span>
                    <span style={{fontWeight:600}}>{fmt(f.base)}</span>
                    <Semaforo estado={f.estado}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Simulador() {
  const [base,setBase]=useState(500);
  const iva=calcIVA(base),irpf=calcIRPF(base),tot=calcTotal(base),limpio=base-irpf;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase"}}>Simulador de Precios</h2>
      <Card>
        <Label>Base Imponible</Label>
        <input type="range" min="50" max="5000" step="10" value={base} onChange={e=>setBase(Number(e.target.value))} style={{width:"100%",accentColor:B.text,marginTop:12}}/>
        <div style={{textAlign:"center",fontSize:44,fontWeight:700,color:B.text,margin:"8px 0",fontFamily:B.tMono}}>{fmt(base)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20}}>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}>
            <div style={{fontSize:11,color:B.muted,fontFamily:B.tMono,textTransform:"uppercase"}}>+ IVA (21%)</div>
            <div style={{fontSize:22,fontWeight:700,color:B.green,fontFamily:B.tMono}}>{fmt(iva)}</div>
          </div>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}>
            <div style={{fontSize:11,color:B.muted,fontFamily:B.tMono,textTransform:"uppercase"}}>- IRPF (15%)</div>
            <div style={{fontSize:22,fontWeight:700,color:B.red,fontFamily:B.tMono}}>{fmt(irpf)}</div>
          </div>
          <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}>
            <div style={{fontSize:11,color:B.muted,fontFamily:B.tMono,textTransform:"uppercase"}}>Total Factura</div>
            <div style={{fontSize:22,fontWeight:700,color:B.purple,fontFamily:B.tMono}}>{fmt(tot)}</div>
          </div>
          <div style={{background:B.text,borderRadius:8,padding:18,textAlign:"center",color:"#fff"}}>
            <div style={{fontSize:11,opacity:0.8,fontFamily:B.tMono,textTransform:"uppercase"}}>Te queda limpio</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:B.tMono}}>{fmt(limpio)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function GastosView({gastos}) {
  const fijos=gastos.filter(g=>g.tipo==="fijo"),vars=gastos.filter(g=>g.tipo==="variable");
  const tMes=fijos.reduce((s,g)=>s+(g.periodicidad==="mensual"?g.base:g.periodicidad==="anual"?g.base/12:0),0);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase"}}>Gastos y Prorrateo</h2>
      <div style={{background:B.text,borderRadius:12,padding:24,color:"#fff"}}>
        <Label><span style={{color:"rgba(255,255,255,0.6)"}}>APARTA CADA MES PARA GASTOS FIJOS</span></Label>
        <div style={{fontSize:38,fontWeight:700,marginTop:6,fontFamily:B.tMono}}>{fmt(tMes)}</div>
      </div>
      <Card>
        <Label>Gastos Fijos</Label>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
          {fijos.map((g,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8}}>
              <div><div style={{fontWeight:600,color:B.text,fontSize:14,fontFamily:B.tSans}}>{g.concepto}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tSans}}>{g.periodicidad}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:B.text,fontFamily:B.tMono}}>{fmt(g.base)}</div><div style={{fontSize:12,color:B.amber,fontWeight:600,fontFamily:B.tSans}}>{g.periodicidad==="anual"?`${fmt(g.base/12)}/mes`:"/mes"}</div></div>
            </div>
          ))}
        </div>
      </Card>
      {vars.length>0&&<Card>
        <Label>Gastos Variables</Label>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
          {vars.map((g,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"14px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8}}>
              <div><div style={{fontWeight:600,color:B.text,fontSize:14,fontFamily:B.tSans}}>{g.concepto}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tSans}}>{g.fecha}</div></div>
              <div style={{fontWeight:700,color:B.text,fontFamily:B.tMono}}>{fmt(g.base)}</div>
            </div>
          ))}
        </div>
      </Card>}
    </div>
  );
}

function Morosidad({clientes}) {
  const r=clientes.map(c=>{
    const cb=c.facturas.filter(f=>f.fechaCobro&&f.vencimiento);
    const d=cb.map(f=>diasEntre(f.vencimiento,f.fechaCobro));
    const m=d.length?Math.round(d.reduce((a,b)=>a+b,0)/d.length):null;
    return{...c,mr:m,n:cb.length};
  }).filter(c=>c.mr!==null).sort((a,b)=>b.mr-a.mr);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase"}}>Ranking de Morosidad</h2>
      {r.map((c,i)=>{
        const col=c.mr>10?B.red:c.mr>0?B.amber:B.green;
        return (
          <div key={c.id} style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:10,padding:20,border:`1px solid ${B.border}`,display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:44,height:44,borderRadius:8,background:col+"15",color:col,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,fontFamily:B.tMono}}>#{i+1}</div>
            <div style={{flex:1}}><div style={{fontWeight:600,color:B.text,fontFamily:B.tSans}}>{c.nombre}</div><div style={{fontSize:12,color:B.muted,fontFamily:B.tSans}}>{c.n} facturas</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:22,color:col,fontFamily:B.tMono}}>{c.mr>0?`+${c.mr}`:c.mr} días</div><div style={{fontSize:11,color:B.muted,fontFamily:B.tSans}}>{c.mr>0?"retraso medio":"paga a tiempo"}</div></div>
          </div>
        );
      })}
    </div>
  );
}

function CuotaAutonomos({clientes,gastos}) {
  const [ca,setCa]=useState(294);
  const tI=clientes.flatMap(c=>c.facturas).reduce((s,f)=>s+f.base,0);
  const tG=gastos.reduce((s,g)=>s+g.base,0);
  const rn=((tI-tG-(ca*4))*0.93)/4;
  const tr=getTramo(rn);
  const d=tr.cuota-ca;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase"}}>Cuota de Autónomos</h2>
      <Card>
        <Label>¿Cuánto pagas de cuota? (€/mes)</Label>
        <input type="number" value={ca} onChange={e=>setCa(Number(e.target.value))} style={{width:"100%",padding:"14px 16px",borderRadius:6,border:`2px solid ${B.border}`,background:"#fff",color:B.text,fontSize:20,fontWeight:700,fontFamily:B.tMono,outline:"none",boxSizing:"border-box",marginTop:10}}/>
      </Card>
      <div style={{background:B.text,borderRadius:12,padding:28,color:"#fff"}}>
        <Label><span style={{color:"rgba(255,255,255,0.6)"}}>RENDIMIENTO NETO MENSUAL ESTIMADO</span></Label>
        <div style={{fontSize:40,fontWeight:700,fontFamily:B.tMono,marginTop:6}}>{fmt(rn)}</div>
        <div style={{marginTop:16,display:"flex",gap:24,fontSize:13,fontFamily:B.tSans,flexWrap:"wrap"}}>
          <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tMono,textTransform:"uppercase"}}>Tramo</div><div style={{fontWeight:700}}>{tr.tramo}</div></div>
          <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tMono,textTransform:"uppercase"}}>Cuota correcta</div><div style={{fontWeight:700}}>{fmt(tr.cuota)}/mes</div></div>
          <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tMono,textTransform:"uppercase"}}>Rango</div><div style={{fontWeight:700}}>{fmt(tr.min)} - {fmt(tr.max)}</div></div>
        </div>
      </div>
      {d!==0&&<div style={{background:d>0?"#fef2f2":"#f0fdf4",border:`2px solid ${d>0?B.red:B.green}`,borderRadius:8,padding:20,color:d>0?"#991b1b":"#166534"}}>
        <div style={{fontWeight:700,fontSize:15,fontFamily:B.tSans}}>{d>0?"⚠️ Estás pagando de menos":"✅ Estás pagando de más"}</div>
        <div style={{fontSize:14,marginTop:6,fontFamily:B.tSans}}>{d>0?`Deberías pagar ${fmt(tr.cuota)} pero pagas ${fmt(ca)}. Diferencia: ${fmt(d)}/mes.`:`Pagas ${fmt(ca)} pero te correspondería ${fmt(tr.cuota)}. Ahorro posible: ${fmt(Math.abs(d))}/mes.`}</div>
      </div>}
      <Card>
        <Label>Tramos 2026</Label>
        <div style={{overflowX:"auto",marginTop:14}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:B.tSans}}>
            <thead><tr style={{borderBottom:`2px solid ${B.border}`}}>
              <th style={{padding:"8px 12px",textAlign:"left",color:B.muted,fontFamily:B.tMono,fontSize:11,textTransform:"uppercase"}}>Tramo</th>
              <th style={{padding:"8px 12px",textAlign:"left",color:B.muted,fontFamily:B.tMono,fontSize:11,textTransform:"uppercase"}}>Rend. Neto</th>
              <th style={{padding:"8px 12px",textAlign:"right",color:B.muted,fontFamily:B.tMono,fontSize:11,textTransform:"uppercase"}}>Cuota</th>
            </tr></thead>
            <tbody>{TRAMOS_2026.map(t=>(
              <tr key={t.tramo} style={{background:t.tramo===tr.tramo?B.yellow+"55":"transparent",fontWeight:t.tramo===tr.tramo?700:400,borderBottom:`1px solid ${B.border}`}}>
                <td style={{padding:"8px 12px",color:B.text,fontFamily:B.tMono,fontSize:13}}>{t.tramo===tr.tramo?"→ ":""}{t.tramo}</td>
                <td style={{padding:"8px 12px",color:B.text}}>{fmt(t.min)} - {t.max<99999?fmt(t.max):"+6.000€"}</td>
                <td style={{padding:"8px 12px",textAlign:"right",color:t.tramo===tr.tramo?B.purple:B.text,fontFamily:B.tMono}}>{fmt(t.cuota)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function OCRView() {
  const [drag,setDrag]=useState(false);
  const [res,setRes]=useState(null);
  const sim=()=>setRes({numero:"F00072026",fecha:"02/02/2026",cliente:"Beatriz Ruiz Caballero",cif:"17453133C",base:190,iva:39.90,irpf:28.50,total:201.40});
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tMono,textTransform:"uppercase"}}>Lector de Facturas</h2>
      <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);sim()}} onClick={sim}
        style={{background:drag?B.yellow+"44":B.card,border:`3px dashed ${drag?B.text:B.border}`,borderRadius:12,padding:60,textAlign:"center",cursor:"pointer",backdropFilter:"blur(14px)",transition:"all 0.3s"}}>
        <div style={{fontSize:48,marginBottom:12}}>📄</div>
        <div style={{fontSize:15,fontWeight:700,color:B.text,fontFamily:B.tSans}}>Arrastra tu factura aquí</div>
        <div style={{fontSize:13,color:B.muted,marginTop:4,fontFamily:B.tSans}}>PDF o imagen · Haz clic para simular</div>
      </div>
      {res&&<Card style={{border:`2px solid ${B.green}`}}>
        <Label><span style={{color:B.green}}>DATOS EXTRAÍDOS</span></Label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
          {Object.entries(res).map(([k,v])=>(
            <div key={k} style={{background:"rgba(0,0,0,0.03)",padding:"10px 14px",borderRadius:8}}>
              <div style={{fontSize:10,color:B.muted,textTransform:"uppercase",fontWeight:700,fontFamily:B.tMono,letterSpacing:"0.08em"}}>{k}</div>
              <div style={{fontSize:15,fontWeight:700,color:B.text,marginTop:2,fontFamily:B.tMono}}>{typeof v==="number"?fmt(v):v}</div>
            </div>
          ))}
        </div>
        <button style={{...B.btn,marginTop:16,width:"100%"}}>GUARDAR EN AIRTABLE</button>
      </Card>}
    </div>
  );
}

// APP
const MENU=[
  {id:"dashboard",label:"DASHBOARD"},{id:"clientes",label:"CLIENTES"},{id:"simulador",label:"SIMULADOR"},
  {id:"gastos",label:"GASTOS"},{id:"morosidad",label:"MOROSIDAD"},{id:"autonomo",label:"CUOTA AUTÓNOMOS"},{id:"ocr",label:"LECTOR FACTURAS"},
];

export default function App() {
  const [page,setPage]=useState("dashboard");
  const [open,setOpen]=useState(false);

  const render=()=>{
    switch(page){
      case "dashboard":return <Dashboard clientes={MOCK_CLIENTES} gastos={MOCK_GASTOS} salObj={2500}/>;
      case "clientes":return <Clientes clientes={MOCK_CLIENTES}/>;
      case "simulador":return <Simulador/>;
      case "gastos":return <GastosView gastos={MOCK_GASTOS}/>;
      case "morosidad":return <Morosidad clientes={MOCK_CLIENTES}/>;
      case "autonomo":return <CuotaAutonomos clientes={MOCK_CLIENTES} gastos={MOCK_GASTOS}/>;
      case "ocr":return <OCRView/>;
      default:return <Dashboard clientes={MOCK_CLIENTES} gastos={MOCK_GASTOS} salObj={2500}/>;
    }
  };

  return (
    <div style={{fontFamily:B.tSans,color:B.text,minHeight:"100vh",background:B.bg}}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <header style={{background:"rgba(255,255,255,0.82)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${B.border}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",color:B.text,cursor:"pointer",padding:4,display:"flex"}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:22,height:22}}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{fontSize:15,fontWeight:700,fontFamily:B.tMono,textTransform:"uppercase",letterSpacing:"0.03em"}}>Gestión Autónomo</span>
        </div>
        <div style={{fontSize:12,color:B.muted,fontFamily:B.tSans}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
      </header>
      <div style={{display:"flex"}}>
        <nav style={{width:open?240:0,overflow:"hidden",background:"rgba(255,255,255,0.68)",backdropFilter:"blur(16px)",borderRight:`1px solid ${B.border}`,transition:"width 0.3s ease",minHeight:"calc(100vh - 56px)",flexShrink:0}}>
          <div style={{padding:"20px 14px",display:"flex",flexDirection:"column",gap:4}}>
            {MENU.map(m=>(
              <button key={m.id} onClick={()=>{setPage(m.id);setOpen(false)}} style={{
                display:"block",padding:"12px 16px",borderRadius:6,border:"none",
                background:page===m.id?B.text:"transparent",color:page===m.id?"#fff":B.text,
                fontWeight:700,fontSize:12,cursor:"pointer",width:"100%",textAlign:"left",
                fontFamily:B.tMono,letterSpacing:"0.06em",transition:"all 0.2s",whiteSpace:"nowrap"
              }}>{m.label}</button>
            ))}
          </div>
        </nav>
        <main style={{flex:1,padding:28,maxWidth:920,margin:"0 auto"}}>{render()}</main>
      </div>
    </div>
  );
}
