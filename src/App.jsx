import { useState, useEffect, useCallback } from "react";

// ============================================================
// AIRTABLE API
// ============================================================
const TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE;
const API = `https://api.airtable.com/v0/${BASE_ID}`;
const hdrs = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function fetchTable(table) {
  let all = [], offset = null;
  do {
    const u = `${API}/${encodeURIComponent(table)}${offset ? `?offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: hdrs });
    const d = await r.json();
    if (d.error) { console.error("Airtable error:", d.error); return all; }
    all = all.concat(d.records || []);
    offset = d.offset;
  } while (offset);
  return all;
}
async function createRecord(table, fields) {
  console.log("CREATE", table, JSON.stringify(fields));
  const r = await fetch(`${API}/${encodeURIComponent(table)}`, { method: "POST", headers: hdrs, body: JSON.stringify({ records: [{ fields }] }) });
  const d = await r.json();
  console.log("RESPONSE", JSON.stringify(d));
  if (d.error) throw new Error(d.error.message || "Error Airtable");
  return d;
}
async function deleteRecord(table, id) {
  const r = await fetch(`${API}/${encodeURIComponent(table)}?records[]=${id}`, { method: "DELETE", headers: hdrs });
  return r.json();
}
async function findOrCreateClient(nombre) {
  if (!nombre || !nombre.trim()) return null;
  const clean = nombre.trim();
  const formula = encodeURIComponent(`{Nombre}="${clean}"`);
  const r = await fetch(`${API}/${encodeURIComponent("Clientes")}?filterByFormula=${formula}`, { headers: hdrs });
  const d = await r.json();
  if (d.records && d.records.length > 0) return d.records[0].id;
  const cr = await createRecord("Clientes", { "Nombre": clean });
  if (cr.records && cr.records[0]) return cr.records[0].id;
  return null;
}

// ============================================================
// UTILS
// ============================================================
const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const calcIVA = (b) => (b || 0) * 0.21;
const calcIRPF = (b) => (b || 0) * 0.15;
const hoy = () => new Date().toISOString().split("T")[0];
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const diasEntre = (a, b) => { try { return Math.floor((new Date(b) - new Date(a)) / 86400000); } catch { return 0; } };
function getTrimestre(f) { if (!f) return ""; const m = new Date(f).getMonth(); return m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4"; }

const B = {
  bg: "linear-gradient(160deg, #f0e991 0%, #FAFAFA 45%, #b1b8f4 100%)",
  card: "rgba(255,255,255,0.75)", border: "rgba(0,0,0,0.07)",
  text: "#111", muted: "#555", purple: "#6e72b8",
  green: "#16a34a", red: "#dc2626", amber: "#d97706", yellow: "#f0e991",
  tM: "'Roboto Mono', monospace", tS: "'Work Sans', sans-serif",
  btn: { background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"12px 24px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Roboto Mono', monospace",textTransform:"uppercase",letterSpacing:"0.06em" },
  btnSm: { background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"8px 16px",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Roboto Mono', monospace",textTransform:"uppercase",letterSpacing:"0.06em" },
  btnDel: { background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"6px 12px",fontWeight:700,fontSize:10,cursor:"pointer",fontFamily:"'Roboto Mono', monospace",textTransform:"uppercase" },
  inp: { width:"100%",padding:"12px 14px",borderRadius:6,border:"2px solid rgba(0,0,0,0.1)",background:"#fff",color:"#111",fontSize:14,fontFamily:"'Work Sans', sans-serif",outline:"none",boxSizing:"border-box" },
};

// ============================================================
// LOGIN
// ============================================================
function Login({ onLogin }) {
  const [u,sU]=useState(""); const [p,sP]=useState(""); const [rem,sRem]=useState(false); const [err,sErr]=useState("");
  const go=()=>{ if(u==="Maria"&&p==="Chaimyzeta17!"){if(rem)try{localStorage.setItem("ga_auth","1")}catch{};onLogin()}else sErr("Usuario o contraseña incorrectos")};
  return (
    <div style={{ minHeight:"100vh",background:B.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.tS }}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ background:"rgba(255,255,255,0.85)",backdropFilter:"blur(20px)",borderRadius:16,padding:"48px 40px",width:360,border:`1px solid ${B.border}` }}>
        <h1 style={{ fontSize:20,fontWeight:700,fontFamily:B.tM,textTransform:"uppercase",textAlign:"center",margin:"0 0 8px" }}>Gestión Autónomo</h1>
        <p style={{ textAlign:"center",color:B.muted,fontSize:13,margin:"0 0 32px" }}>Introduce tus credenciales</p>
        {err&&<div style={{ background:B.red+"15",color:B.red,padding:"10px 14px",borderRadius:6,fontSize:13,fontWeight:600,marginBottom:16 }}>{err}</div>}
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <Inp label="USUARIO" value={u} onChange={sU} onKey={e=>e.key==="Enter"&&go()} ph="Usuario"/>
          <Inp label="CONTRASEÑA" value={p} onChange={sP} type="password" onKey={e=>e.key==="Enter"&&go()} ph="Contraseña"/>
          <label style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,color:B.muted,cursor:"pointer" }}>
            <input type="checkbox" checked={rem} onChange={e=>sRem(e.target.checked)} style={{ accentColor:B.text }}/> Recordar contraseña</label>
          <button onClick={go} style={{ ...B.btn,width:"100%",padding:"14px 24px",marginTop:8 }}>ENTRAR</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// UI
// ============================================================
function Card({children,style}){return <div style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:12,padding:"22px 24px",border:`1px solid ${B.border}`,...style}}>{children}</div>}
function Lbl({children}){return <span style={{fontSize:11,color:B.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:B.tM}}>{children}</span>}
function Big({children,color}){return <span style={{fontSize:30,fontWeight:700,color:color||B.text,fontFamily:B.tM,display:"block",marginTop:4}}>{children}</span>}
function Sub({children}){return <span style={{fontSize:12,color:B.muted,fontFamily:B.tS}}>{children}</span>}
function Sem({estado}){const m={Cobrada:{c:B.green,l:"COBRADA"},Pendiente:{c:B.amber,l:"PENDIENTE"},Vencida:{c:B.red,l:"VENCIDA"}};const x=m[estado]||m.Pendiente;return <span style={{background:x.c+"15",color:x.c,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700,fontFamily:B.tM}}>{x.l}</span>}
function PBar({value,max,label,color}){const c=color||B.text,pct=Math.min(((value||0)/(max||1))*100,100);return(<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontFamily:B.tS}}><span style={{color:B.text,fontWeight:600}}>{label}</span><span style={{color:B.muted}}>{fmt(value)} / {fmt(max)}</span></div><div style={{background:"rgba(0,0,0,0.06)",borderRadius:6,height:28,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",borderRadius:6,background:c,transition:"width 1s ease",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:10}}>{pct>12&&<span style={{fontSize:11,fontWeight:700,color:"#fff",fontFamily:B.tM}}>{Math.round(pct)}%</span>}</div></div></div>)}
function Inp({label,value,onChange,type="text",ph="",onKey}){return(<div><label style={{fontSize:11,fontWeight:700,fontFamily:B.tM,textTransform:"uppercase",letterSpacing:"0.08em",color:B.muted,display:"block",marginBottom:6}}>{label}</label><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={ph} style={B.inp} onKeyDown={onKey}/></div>)}
function Sel({label,value,onChange,options}){return(<div><label style={{fontSize:11,fontWeight:700,fontFamily:B.tM,textTransform:"uppercase",letterSpacing:"0.08em",color:B.muted,display:"block",marginBottom:6}}>{label}</label><select value={value} onChange={e=>onChange(e.target.value)} style={{...B.inp,cursor:"pointer"}}><option value="">Selecciona...</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>)}

function FilterBar({filtro,setFiltro}){
  const y=new Date().getFullYear();
  return(<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
    <select value={filtro.year} onChange={e=>setFiltro({...filtro,year:e.target.value})} style={{...B.inp,width:"auto",padding:"8px 12px",fontSize:12,fontFamily:B.tM}}><option value="">Todos</option>{[y,y-1,y-2].map(v=><option key={v} value={v}>{v}</option>)}</select>
    <select value={filtro.tri} onChange={e=>setFiltro({...filtro,tri:e.target.value,mes:""})} style={{...B.inp,width:"auto",padding:"8px 12px",fontSize:12,fontFamily:B.tM}}><option value="">Trimestre</option><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option></select>
    <select value={filtro.mes} onChange={e=>setFiltro({...filtro,mes:e.target.value,tri:""})} style={{...B.inp,width:"auto",padding:"8px 12px",fontSize:12,fontFamily:B.tM}}><option value="">Mes</option>{MESES_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
    {(filtro.year||filtro.tri||filtro.mes!=="")&&<button onClick={()=>setFiltro({year:"",tri:"",mes:""})} style={{...B.btnSm,background:"transparent",color:B.muted,border:`1px solid ${B.border}`}}>LIMPIAR</button>}
  </div>);
}
function applyF(recs,filtro,df="Fecha"){return recs.filter(r=>{const f=r.fields[df];if(!f)return !filtro.year&&!filtro.tri&&filtro.mes==="";const d=new Date(f);if(filtro.year&&d.getFullYear()!==Number(filtro.year))return false;if(filtro.tri&&getTrimestre(f)!==filtro.tri)return false;if(filtro.mes!==""&&d.getMonth()!==Number(filtro.mes))return false;return true;});}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ingresos,gastos,tramos,salObj,setSalObj,filtro,setFiltro}){
  const fi=applyF(ingresos,filtro),fg=applyF(gastos,filtro);
  const tFact=fi.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const tCob=fi.filter(r=>r.fields["Estado"]==="Cobrada").reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const ivaR=fi.reduce((s,r)=>s+(r.fields["IVA (€)"]||0),0);
  const ivaS=fg.reduce((s,r)=>s+(r.fields["IVA Soportado (€)"]||0),0);
  // IRPF retenido = lo que retienes a proveedores (en gastos), NO el de tus facturas
  const irpfRet=fg.reduce((s,r)=>s+(r.fields["IRPF Retenido (€)"]||0),0);
  const tGast=fg.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  // IRPF que te retienen tus clientes (reduce tu beneficio real)
  const irpfClientes=fi.reduce((s,r)=>s+(r.fields["IRPF (€)"]||0),0);
  // Beneficio neto REAL = Facturado - IRPF retenido por clientes - Gastos
  const benef=tFact-irpfClientes-tGast;
  // HUCHA CORREGIDA: IVA Rep - IVA Sop + IRPF retenido a proveedores
  const hucha=ivaR-ivaS+irpfRet;
  const venc=fi.filter(r=>r.fields["Estado"]==="Vencida").length;
  const mT=Math.max(new Set(fi.map(r=>r.fields["Fecha"]?new Date(r.fields["Fecha"]).getMonth():-1).filter(m=>m>=0)).size,1);
  const bMes=benef/mT;
  const [editS,setEditS]=useState(false);const [tmpS,setTmpS]=useState(salObj);

  const mRange=filtro.tri?{Q1:[0,1,2],Q2:[3,4,5],Q3:[6,7,8],Q4:[9,10,11]}[filtro.tri]:filtro.mes!==""?[Number(filtro.mes)]:[0,1,2,3,4,5,6,7,8,9,10,11].filter(m=>m<=new Date().getMonth());
  const mData=mRange.map(mi=>({mes:MESES[mi],ing:fi.filter(r=>{const d=r.fields["Fecha"];return d&&new Date(d).getMonth()===mi}).reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0),gas:fg.filter(r=>{const d=r.fields["Fecha"];return d&&new Date(d).getMonth()===mi}).reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0)}));
  const mx=Math.max(...mData.map(d=>Math.max(d.ing,d.gas)),1);

  return(<div style={{display:"flex",flexDirection:"column",gap:22}}>
    <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Panel de Control</h2>
    <FilterBar filtro={filtro} setFiltro={setFiltro}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(195px, 1fr))",gap:14}}>
      <Card><Lbl>Facturado Total</Lbl><Big color={B.purple}>{fmt(tFact)}</Big><Sub>Base imponible</Sub></Card>
      <Card><Lbl>Cobrado Real</Lbl><Big color={B.green}>{fmt(tCob)}</Big><Sub>En tu cuenta</Sub></Card>
      <Card><Lbl>Beneficio Neto</Lbl><Big color={benef>0?B.green:B.red}>{fmt(benef)}</Big><Sub>{fmt(bMes)}/mes (IRPF descontado)</Sub></Card>
      <Card><Lbl>Facturas Vencidas</Lbl><Big color={B.red}>{venc}</Big><Sub>Sin cobrar</Sub></Card>
    </div>
    {/* HUCHA CORREGIDA */}
    <div style={{background:B.text,borderRadius:12,padding:"28px 28px 24px",color:"#fff",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-8,right:20,fontSize:72,opacity:0.06,fontFamily:B.tM,fontWeight:700}}>HACIENDA</div>
      <Lbl><span style={{color:"rgba(255,255,255,0.6)"}}>HUCHA DE HACIENDA — DINERO INTOCABLE</span></Lbl>
      <div style={{fontSize:44,fontWeight:700,marginTop:8,fontFamily:B.tM}}>{fmt(hucha)}</div>
      <div style={{display:"flex",gap:20,marginTop:14,fontSize:12,opacity:0.65,fontFamily:B.tS,flexWrap:"wrap"}}>
        <span>IVA Repercutido: {fmt(ivaR)}</span><span>IVA Soportado: {fmt(ivaS)}</span><span>IRPF Retenido proveedores: {fmt(irpfRet)}</span>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <Lbl>Objetivo Salario</Lbl>
          <button onClick={()=>{if(editS){setSalObj(Number(tmpS));try{localStorage.setItem("ga_salario",tmpS)}catch{}}setEditS(!editS)}} style={B.btnSm}>{editS?"GUARDAR":"EDITAR"}</button>
        </div>
        {editS&&<div style={{marginBottom:12}}><input type="number" value={tmpS} onChange={e=>setTmpS(e.target.value)} style={{...B.inp,fontSize:18,fontWeight:700,fontFamily:B.tM,textAlign:"center"}}/></div>}
        <PBar value={bMes} max={salObj} label="Media mensual" color={bMes>=salObj?B.green:B.amber}/>
      </Card>
      <Card><Lbl>IVA Trimestral</Lbl><Big color={B.purple}>{fmt(ivaR-ivaS)}</Big><Sub>Modelo 303</Sub></Card>
    </div>
    {mData.length>0&&<Card><Lbl>Ingresos vs Gastos</Lbl>
      <div style={{display:"flex",gap:16,margin:"14px 0 8px",fontSize:12,fontFamily:B.tS}}><span><span style={{color:B.purple}}>■</span> Ingresos</span><span><span style={{color:B.red+"88"}}>■</span> Gastos</span></div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:150}}>
        {mData.map((d,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{display:"flex",gap:3,alignItems:"flex-end",height:120,width:"100%"}}>
            <div style={{flex:1,background:B.purple,borderRadius:"3px 3px 0 0",height:`${(d.ing/mx)*100}%`,minHeight:2}}/>
            <div style={{flex:1,background:B.red+"77",borderRadius:"3px 3px 0 0",height:`${(d.gas/mx)*100}%`,minHeight:2}}/>
          </div><span style={{fontSize:11,color:B.muted,fontWeight:600,fontFamily:B.tM}}>{d.mes}</span>
        </div>))}
      </div>
    </Card>}
    <Card><Lbl>Flujo de Caja</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
        <div style={{textAlign:"center",padding:18,background:"rgba(0,0,0,0.03)",borderRadius:8}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Facturado</div><div style={{fontSize:26,fontWeight:700,color:B.purple,fontFamily:B.tM,marginTop:4}}>{fmt(tFact)}</div></div>
        <div style={{textAlign:"center",padding:18,background:"rgba(0,0,0,0.03)",borderRadius:8}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Cobrado</div><div style={{fontSize:26,fontWeight:700,color:B.green,fontFamily:B.tM,marginTop:4}}>{fmt(tCob)}</div></div>
      </div>
      <div style={{marginTop:12,textAlign:"center",fontSize:13,color:B.muted}}>Pendiente: <strong style={{color:B.amber}}>{fmt(tFact-tCob)}</strong></div>
    </Card>
  </div>);
}

// ============================================================
// CLIENTES CON AÑADIR MANUAL Y BORRAR FACTURAS
// ============================================================
function Clientes({clientes,ingresos,onRefresh}){
  const [sel,setSel]=useState(null);const [del,setDel]=useState(null);const [updId,setUpdId]=useState(null);
  const [showAdd,setShowAdd]=useState(false);const [newName,setNewName]=useState("");const [saving,setSaving]=useState(false);

  const addCliente=async()=>{if(!newName.trim())return;setSaving(true);await createRecord("Clientes",{"Nombre":newName.trim()});setNewName("");setShowAdd(false);setSaving(false);onRefresh()};
  const delFactura=async(id)=>{setDel(id);await deleteRecord("Ingresos",id);await onRefresh();setDel(null)};
  const cambiarEstado=async(id,nuevoEstado)=>{
    setUpdId(id);
    const fields={"Estado":nuevoEstado};
    if(nuevoEstado==="Cobrada")fields["Fecha Cobro"]=hoy();
    await fetch(`${API}/${encodeURIComponent("Ingresos")}`,{method:"PATCH",headers:hdrs,body:JSON.stringify({records:[{id,fields}]})});
    await onRefresh();setUpdId(null);
  };

  const cd=clientes.map(c=>{const n=c.fields["Nombre"]||"Sin nombre";const fIds=c.fields["Ingresos"]||[];const fs=ingresos.filter(r=>fIds.includes(r.id));
    const totBase=fs.reduce((s,f)=>s+(f.fields["Base Imponible"]||0),0);
    const totIrpf=fs.reduce((s,f)=>s+(f.fields["IRPF (€)"]||0),0);
    const benefNeto=totBase-totIrpf;
    const p=fs.filter(f=>f.fields["Estado"]==="Pendiente").length;
    const v=fs.filter(f=>f.fields["Estado"]==="Vencida").length;
    return{id:c.id,nombre:n,fs,totBase,totIrpf,benefNeto,p,v,bc:v>0?B.red:p>0?B.amber:B.green};
  });

  return(<div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Clientes</h2>
      <button onClick={()=>setShowAdd(!showAdd)} style={B.btn}>{showAdd?"CANCELAR":"+ NUEVO CLIENTE"}</button>
    </div>
    {showAdd&&<Card style={{border:`2px solid ${B.purple}`}}>
      <Lbl>Añadir Cliente</Lbl>
      <div style={{display:"flex",gap:12,marginTop:14}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre del cliente" style={{...B.inp,flex:1}}/>
        <button onClick={addCliente} disabled={saving} style={{...B.btn,opacity:saving?0.5:1}}>{saving?"...":"GUARDAR"}</button>
      </div>
    </Card>}
    {cd.length===0&&<Card><p style={{color:B.muted,fontFamily:B.tS}}>No hay clientes. Añádelos manualmente o se crean al subir facturas.</p></Card>}
    {cd.map(c=>(<div key={c.id} onClick={()=>setSel(sel===c.id?null:c.id)} style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:10,padding:20,cursor:"pointer",border:`1px solid ${B.border}`,borderLeft:`4px solid ${c.bc}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:600,fontSize:15,fontFamily:B.tS}}>{c.nombre}</div>
          <div style={{fontSize:12,color:B.muted,marginTop:4}}>{c.fs.length} factura{c.fs.length!==1?"s":""}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:700,fontFamily:B.tM}}>{fmt(c.totBase)}</div>
          <div style={{fontSize:11,color:B.red,fontWeight:600}}>IRPF: {fmt(c.totIrpf)}</div>
          <div style={{fontSize:11,color:B.green,fontWeight:600}}>Neto: {fmt(c.benefNeto)}</div>
        </div>
      </div>
      {(c.v>0||c.p>0)&&<div style={{marginTop:10,display:"flex",gap:8}}>
        {c.v>0&&<span style={{background:B.red+"12",color:B.red,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600}}>{c.v} vencida{c.v>1?"s":""}</span>}
        {c.p>0&&<span style={{background:B.amber+"12",color:B.amber,padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:600}}>{c.p} pendiente{c.p>1?"s":""}</span>}
      </div>}
      {sel===c.id&&c.fs.length>0&&(<div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}><Lbl>Facturas</Lbl>
        {c.fs.map(f=>{const irpfF=f.fields["IRPF (€)"]||0;
          return(<div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(0,0,0,0.03)",padding:"12px 14px",borderRadius:8,fontSize:13,gap:6,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,fontFamily:B.tM,fontSize:12,minWidth:90}}>{f.fields["Nº Factura"]||"-"}</span>
          <span style={{color:B.muted,minWidth:80}}>{f.fields["Fecha"]||"-"}</span>
          <span style={{fontWeight:600,minWidth:70}}>{fmt(f.fields["Base Imponible"])}</span>
          <span style={{color:B.red,fontSize:11,fontWeight:600,minWidth:60}}>IRPF {fmt(irpfF)}</span>
          <Sem estado={f.fields["Estado"]||"Pendiente"}/>
          <select value={f.fields["Estado"]||"Pendiente"} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();cambiarEstado(f.id,e.target.value)}}
            disabled={updId===f.id}
            style={{padding:"4px 8px",borderRadius:4,border:`1px solid ${B.border}`,fontSize:11,fontFamily:B.tM,cursor:"pointer",background:updId===f.id?"#eee":"#fff"}}>
            <option value="Pendiente">Pendiente</option><option value="Cobrada">Cobrada</option><option value="Vencida">Vencida</option>
          </select>
          <button onClick={e=>{e.stopPropagation();if(confirm("¿Borrar esta factura?"))delFactura(f.id)}} disabled={del===f.id} style={{...B.btnDel,opacity:del===f.id?0.5:1}}>✕</button>
        </div>)})}
      </div>)}
    </div>))}
  </div>);
}

// ============================================================
// SIMULADOR
// ============================================================
function Simulador(){
  const [base,setBase]=useState(500);const iva=calcIVA(base),irpf=calcIRPF(base),tot=base+iva-irpf,limpio=base-irpf;
  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Simulador de Precios</h2>
    <Card><Lbl>Base Imponible</Lbl>
      <input type="range" min="50" max="5000" step="10" value={base} onChange={e=>setBase(Number(e.target.value))} style={{width:"100%",accentColor:B.text,marginTop:12}}/>
      <div style={{textAlign:"center",fontSize:44,fontWeight:700,margin:"8px 0",fontFamily:B.tM}}>{fmt(base)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:20}}>
        <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>+ IVA 21%</div><div style={{fontSize:22,fontWeight:700,color:B.green,fontFamily:B.tM}}>{fmt(iva)}</div></div>
        <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>- IRPF 15%</div><div style={{fontSize:22,fontWeight:700,color:B.red,fontFamily:B.tM}}>{fmt(irpf)}</div></div>
        <div style={{background:"rgba(0,0,0,0.03)",borderRadius:8,padding:18,textAlign:"center"}}><div style={{fontSize:11,color:B.muted,fontFamily:B.tM,textTransform:"uppercase"}}>Total Factura</div><div style={{fontSize:22,fontWeight:700,color:B.purple,fontFamily:B.tM}}>{fmt(tot)}</div></div>
        <div style={{background:B.text,borderRadius:8,padding:18,textAlign:"center",color:"#fff"}}><div style={{fontSize:11,opacity:0.8,fontFamily:B.tM,textTransform:"uppercase"}}>Te queda limpio</div><div style={{fontSize:22,fontWeight:700,fontFamily:B.tM}}>{fmt(limpio)}</div></div>
      </div>
    </Card>
  </div>);
}

// ============================================================
// GASTOS CON IRPF RETENIDO
// ============================================================
function GastosView({gastos,onRefresh,filtro,setFiltro}){
  const [showF,setShowF]=useState(false);const [sav,setSav]=useState(false);const [delId,setDelId]=useState(null);
  const [form,setForm]=useState({concepto:"",fecha:hoy(),base:"",iva:"",irpf:"",tipo:"",period:""});
  const fg=applyF(gastos,filtro);
  const fijos=fg.filter(r=>["Mensual","Anual","Trimestral"].includes(r.fields["Periodicidad"]));
  const vars=fg.filter(r=>!["Mensual","Anual","Trimestral"].includes(r.fields["Periodicidad"]));
  const tMes=fijos.reduce((s,r)=>{const b=r.fields["Base Imponible"]||0,p=r.fields["Periodicidad"];return s+(p==="Mensual"?b:p==="Trimestral"?b/3:p==="Anual"?b/12:0)},0);

  const save=async()=>{if(!form.concepto||!form.base)return;setSav(true);
    const f={"Concepto":form.concepto,"Fecha":form.fecha,"Base Imponible":Number(form.base)||0,"IVA Soportado (€)":form.iva?Number(form.iva):Number(form.base)*0.21};
    if(form.irpf)f["IRPF Retenido (€)"]=Number(form.irpf);
    if(form.tipo)f["Tipo de Gasto"]=form.tipo;if(form.period)f["Periodicidad"]=form.period;
    await createRecord("Gastos",f);setForm({concepto:"",fecha:hoy(),base:"",iva:"",irpf:"",tipo:"",period:""});setShowF(false);setSav(false);onRefresh()};
  const del=async(id)=>{setDelId(id);await deleteRecord("Gastos",id);await onRefresh();setDelId(null)};

  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Gastos y Prorrateo</h2>
      <button onClick={()=>setShowF(!showF)} style={B.btn}>{showF?"CANCELAR":"+ NUEVO GASTO"}</button>
    </div>
    <FilterBar filtro={filtro} setFiltro={setFiltro}/>
    {showF&&<Card style={{border:`2px solid ${B.purple}`}}><Lbl>Añadir Gasto</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
        <Inp label="Concepto" value={form.concepto} onChange={v=>setForm({...form,concepto:v})} ph="Ej: Adobe"/>
        <Inp label="Fecha" value={form.fecha} onChange={v=>setForm({...form,fecha:v})} type="date"/>
        <Inp label="Base Imponible (€)" value={form.base} onChange={v=>setForm({...form,base:v})} type="number" ph="0"/>
        <Inp label="IVA Soportado (€)" value={form.iva} onChange={v=>setForm({...form,iva:v})} type="number" ph="Auto: 21%"/>
        <Inp label="IRPF Retenido (€)" value={form.irpf} onChange={v=>setForm({...form,irpf:v})} type="number" ph="Si proveedor autónomo"/>
        <Sel label="Tipo de Gasto" value={form.tipo} onChange={v=>setForm({...form,tipo:v})} options={["Fijo","Variable","Impuesto"]}/>
        <Sel label="Periodicidad" value={form.period} onChange={v=>setForm({...form,period:v})} options={["Mensual","Trimestral","Anual","Puntual"]}/>
      </div>
      <button onClick={save} disabled={sav} style={{...B.btn,width:"100%",marginTop:16,opacity:sav?0.5:1}}>{sav?"GUARDANDO...":"GUARDAR GASTO"}</button>
    </Card>}
    <div style={{background:B.text,borderRadius:12,padding:24,color:"#fff"}}><Lbl><span style={{color:"rgba(255,255,255,0.6)"}}>APARTA CADA MES</span></Lbl><div style={{fontSize:38,fontWeight:700,marginTop:6,fontFamily:B.tM}}>{fmt(tMes)}</div></div>
    {fijos.length>0&&<Card><Lbl>Gastos Fijos</Lbl><div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
      {fijos.map(g=>{const b=g.fields["Base Imponible"]||0,p=g.fields["Periodicidad"]||"";const m=p==="Mensual"?b:p==="Trimestral"?b/3:p==="Anual"?b/12:b;
        return(<div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8}}>
          <div><div style={{fontWeight:600,fontSize:14,fontFamily:B.tS}}>{g.fields["Concepto"]}</div><div style={{fontSize:12,color:B.muted}}>{p}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{textAlign:"right"}}><div style={{fontWeight:700,fontFamily:B.tM}}>{fmt(b)}</div><div style={{fontSize:12,color:B.amber,fontWeight:600}}>{fmt(m)}/mes</div></div>
            <button onClick={()=>{if(confirm("¿Borrar?"))del(g.id)}} disabled={delId===g.id} style={B.btnDel}>BORRAR</button></div>
        </div>)})}
    </div></Card>}
    {vars.length>0&&<Card><Lbl>Gastos Variables</Lbl><div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
      {vars.map(g=>(<div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"rgba(0,0,0,0.03)",borderRadius:8}}>
        <div><div style={{fontWeight:600,fontSize:14,fontFamily:B.tS}}>{g.fields["Concepto"]}</div><div style={{fontSize:12,color:B.muted}}>{g.fields["Fecha"]||""}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{fontWeight:700,fontFamily:B.tM}}>{fmt(g.fields["Base Imponible"])}</div>
          <button onClick={()=>{if(confirm("¿Borrar?"))del(g.id)}} disabled={delId===g.id} style={B.btnDel}>BORRAR</button></div>
      </div>))}
    </div></Card>}
  </div>);
}

// ============================================================
// MOROSIDAD
// ============================================================
function Morosidad({clientes,ingresos}){
  const r=clientes.map(c=>{const n=c.fields["Nombre"]||"";const fIds=c.fields["Ingresos"]||[];const fs=ingresos.filter(r=>fIds.includes(r.id));
    const cb=fs.filter(f=>f.fields["Estado"]==="Cobrada"&&f.fields["Fecha Cobro"]&&f.fields["Fecha Vencimiento"]);
    const d=cb.map(f=>diasEntre(f.fields["Fecha Vencimiento"],f.fields["Fecha Cobro"]));
    const m=d.length?Math.round(d.reduce((a,b)=>a+b,0)/d.length):null;return{id:c.id,nombre:n,mr:m,n:cb.length};
  }).filter(c=>c.mr!==null).sort((a,b)=>b.mr-a.mr);
  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Ranking de Morosidad</h2>
    {r.length===0&&<Card><p style={{color:B.muted}}>Necesitas facturas cobradas con fecha de vencimiento y cobro.</p></Card>}
    {r.map((c,i)=>{const col=c.mr>10?B.red:c.mr>0?B.amber:B.green;
      return(<div key={c.id} style={{background:B.card,backdropFilter:"blur(14px)",borderRadius:10,padding:20,border:`1px solid ${B.border}`,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:44,height:44,borderRadius:8,background:col+"15",color:col,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,fontFamily:B.tM}}>#{i+1}</div>
        <div style={{flex:1}}><div style={{fontWeight:600,fontFamily:B.tS}}>{c.nombre}</div><div style={{fontSize:12,color:B.muted}}>{c.n} facturas</div></div>
        <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:22,color:col,fontFamily:B.tM}}>{c.mr>0?`+${c.mr}`:c.mr} días</div><div style={{fontSize:11,color:B.muted}}>{c.mr>0?"retraso":"a tiempo"}</div></div>
      </div>)})}
  </div>);
}

// ============================================================
// CUOTA AUTÓNOMOS - TRAMO CORREGIDO
// ============================================================
function CuotaAut({ingresos,gastos,tramos}){
  const [ca,setCa]=useState(()=>{try{return Number(localStorage.getItem("ga_cuota"))||294}catch{return 294}});
  const tI=ingresos.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const tG=gastos.reduce((s,r)=>s+(r.fields["Base Imponible"]||0),0);
  const ms=Math.max(new Date().getMonth()+1,1);
  const rn=((tI-tG-(ca*ms))*0.93)/ms;
  const td=tramos.map(r=>({tramo:r.fields["Tramo"]||0,min:r.fields["Rend. Neto Mín"]||r.fields["Rend Neto Min"]||0,max:r.fields["Rend. Neto Máx"]||r.fields["Rend Neto Max"]||0,cuota:r.fields["Cuota Mínima"]||r.fields["Cuota Minima"]||0})).sort((a,b)=>a.tramo-b.tramo);
  // CORREGIDO: si negativo o bajo, tramo 1
  const tr=rn<=0?(td[0]||{tramo:1,min:0,max:670,cuota:200}):(td.find(t=>rn>=t.min&&rn<t.max)||td[0]||{tramo:1,min:0,max:670,cuota:200});
  const d=tr.cuota-ca;
  const save=(v)=>{setCa(v);try{localStorage.setItem("ga_cuota",v)}catch{}};
  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>Cuota de Autónomos</h2>
    <Card><Lbl>Tu cuota actual (€/mes)</Lbl><input type="number" value={ca} onChange={e=>save(Number(e.target.value))} style={{...B.inp,fontSize:20,fontWeight:700,fontFamily:B.tM,marginTop:10}}/></Card>
    <div style={{background:B.text,borderRadius:12,padding:28,color:"#fff"}}>
      <Lbl><span style={{color:"rgba(255,255,255,0.6)"}}>RENDIMIENTO NETO MENSUAL</span></Lbl>
      <div style={{fontSize:40,fontWeight:700,fontFamily:B.tM,marginTop:6}}>{fmt(rn)}</div>
      <div style={{marginTop:16,display:"flex",gap:24,fontSize:13,fontFamily:B.tS,flexWrap:"wrap"}}>
        <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tM,textTransform:"uppercase"}}>Tramo</div><div style={{fontWeight:700}}>{tr.tramo}</div></div>
        <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tM,textTransform:"uppercase"}}>Cuota correcta</div><div style={{fontWeight:700}}>{fmt(tr.cuota)}/mes</div></div>
        <div><div style={{opacity:0.55,fontSize:11,fontFamily:B.tM,textTransform:"uppercase"}}>Rango</div><div style={{fontWeight:700}}>{fmt(tr.min)} - {fmt(tr.max)}</div></div>
      </div>
    </div>
    {d!==0&&<div style={{background:d>0?"#fef2f2":"#f0fdf4",border:`2px solid ${d>0?B.red:B.green}`,borderRadius:8,padding:20,color:d>0?"#991b1b":"#166534"}}>
      <div style={{fontWeight:700,fontSize:15,fontFamily:B.tS}}>{d>0?"⚠️ Pagando de menos":"✅ Pagando de más"}</div>
      <div style={{fontSize:14,marginTop:6}}>{d>0?`Deberías pagar ${fmt(tr.cuota)}. Diferencia: ${fmt(d)}/mes.`:`Ahorro posible: ${fmt(Math.abs(d))}/mes.`}</div>
    </div>}
    {td.length>0&&<Card><Lbl>Tramos 2026</Lbl><div style={{overflowX:"auto",marginTop:14}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:B.tS}}>
        <thead><tr style={{borderBottom:`2px solid ${B.border}`}}><th style={{padding:"8px 12px",textAlign:"left",color:B.muted,fontFamily:B.tM,fontSize:11}}>TRAMO</th><th style={{padding:"8px 12px",textAlign:"left",color:B.muted,fontFamily:B.tM,fontSize:11}}>REND. NETO</th><th style={{padding:"8px 12px",textAlign:"right",color:B.muted,fontFamily:B.tM,fontSize:11}}>CUOTA</th></tr></thead>
        <tbody>{td.map(t=>(<tr key={t.tramo} style={{background:t.tramo===tr.tramo?B.yellow+"55":"transparent",fontWeight:t.tramo===tr.tramo?700:400,borderBottom:`1px solid ${B.border}`}}>
          <td style={{padding:"8px 12px",fontFamily:B.tM}}>{t.tramo===tr.tramo?"→ ":""}{t.tramo}</td>
          <td style={{padding:"8px 12px"}}>{fmt(t.min)} - {t.max<99999?fmt(t.max):"+6.000€"}</td>
          <td style={{padding:"8px 12px",textAlign:"right",color:t.tramo===tr.tramo?B.purple:B.text,fontFamily:B.tM}}>{fmt(t.cuota)}</td>
        </tr>))}</tbody>
      </table></div></Card>}
  </div>);
}

// ============================================================
// OCR + MANUAL
// ============================================================
const VK=import.meta.env.VITE_GOOGLE_VISION_KEY;
let pdfLib=null;
async function loadPdf(){if(pdfLib)return pdfLib;const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";document.head.appendChild(s);await new Promise((r,j)=>{s.onload=r;s.onerror=j});window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";pdfLib=window.pdfjsLib;return pdfLib}
async function pdf2img(buf){const lib=await loadPdf();const pdf=await lib.getDocument({data:buf}).promise;const pg=await pdf.getPage(1);const vp=pg.getViewport({scale:2.5});const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;return c.toDataURL("image/png").split(",")[1]}
async function ocr(b64){const r=await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VK}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requests:[{image:{content:b64},features:[{type:"TEXT_DETECTION",maxResults:1}]}]})});const d=await r.json();if(d.error)throw new Error(d.error.message);return d.responses?.[0]?.fullTextAnnotation?.text||""}

function parseF(text){const t=text.replace(/\r/g,"");
  const lines=t.split("\n").map(l=>l.trim()).filter(l=>l);
  const num=(t.match(/(?:factura|fra)[:\s]*\n?\s*([A-Z0-9][\w\-\/]*\d+)/i)||t.match(/(?:nº|n°)[:\s]*\s*([A-Z0-9][\w\-\/]+)/i)||[])[1]||"";
  const fM=t.match(/(?:fecha(?:\s+de\s+factura)?)[:\s]*\n?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i)||t.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
  const fecha=fM?fM[1]:"";const cifM=t.match(/(\d{8}[A-Z])/);const cif=cifM?cifM[0]:"";

  // Parse the Subtotal/IVA/IRPF/Total block specifically
  // Format in OCR: Subtotal \n IVA 21% \n 120,00 € \n 25,20 € \n IRPF -15% \n -18,00 € \n Total \n 127,20 €
  let base=0, iva=0, irpf=0, total=0;
  
  // Find all euro amounts in order
  const amounts=[];
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^-?([0-9]+[.,]\d{2})\s*€$/);
    if(m){
      const v=m[1].replace(/\./g,"").replace(",",".");
      amounts.push({idx:i, val:parseFloat(v), line:lines[i]});
    }
  }

  // Find keyword positions
  const findLine=(kw)=>{for(let i=0;i<lines.length;i++){if(lines[i].toLowerCase().includes(kw.toLowerCase()))return i}return -1};
  const subIdx=findLine("Subtotal");
  const ivaIdx=findLine("IVA");
  const irpfIdx=findLine("IRPF");
  const totalIdx=Math.max(findLine("Total"),0);

  // Assign amounts based on position relative to keywords
  // The OCR layout is: Subtotal then IVA% then baseAmount then ivaAmount then IRPF% then irpfAmount then Total then totalAmount
  if(subIdx>=0){
    // Find the first € amount AFTER subtotal keyword
    const subAmounts=amounts.filter(a=>a.idx>subIdx);
    if(subAmounts.length>=1) base=subAmounts[0].val;
    if(subAmounts.length>=2) iva=subAmounts[1].val;
    if(subAmounts.length>=3) irpf=subAmounts[2].val;
    if(subAmounts.length>=4) total=subAmounts[3].val;
  } else {
    // Fallback: try same-line matching
    for(let i=0;i<lines.length;i++){
      const l=lines[i];
      if(/subtotal|base\s*imponible/i.test(l)){const m=l.match(/([0-9.,]+)\s*€/);if(m)base=parseFloat(m[1].replace(/\./g,"").replace(",","."))}
      if(/^iva/i.test(l)){const m=l.match(/([0-9.,]+)\s*€/);if(m)iva=parseFloat(m[1].replace(/\./g,"").replace(",","."))}
      if(/irpf/i.test(l)){const m=l.match(/([0-9.,]+)\s*€/);if(m)irpf=parseFloat(m[1].replace(/\./g,"").replace(",","."))}
      if(/^total$/i.test(l.replace(/\s/g,""))){if(i+1<lines.length){const m=lines[i+1].match(/([0-9.,]+)\s*€/);if(m)total=parseFloat(m[1].replace(/\./g,"").replace(",","."))}}
    }
  }

  const clM=t.match(/Para\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/);
  let cliente=clM?clM[1].trim().split("\n")[0].trim():"";if(cliente.length>60)cliente=cliente.substring(0,60);
  const dsM=t.match(/(?:ESTRATEGIA|CONTENIDO|Descripci[oó]n)[:\s+]*([^\n]*)/i);
  let desc=dsM?dsM[1].trim():"";
  if(!desc){const di=findLine("ESTRATEGIA");if(di>=0)desc=lines[di]}
  return{numero:num,fecha,cliente,cif,base,iva,irpf,total,desc}}

function convD(d){if(!d)return"";const p=d.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);if(!p)return d;let[,dy,mo,yr]=p;if(yr.length===2)yr="20"+yr;return`${yr}-${mo.padStart(2,"0")}-${dy.padStart(2,"0")}`}

function OCRView({onRefresh}){
  const [drag,setDrag]=useState(false);const [proc,setProc]=useState(false);const [mode,setMode]=useState("choose");
  const [res,setRes]=useState(null);const [tipo,setTipo]=useState("ingreso");
  const [sav,setSav]=useState(false);const [saved,setSaved]=useState(false);const [err,setErr]=useState("");
  const [numero,sNumero]=useState("");const [fecha,sFecha]=useState(hoy());const [cliente,sCliente]=useState("");
  const [cif,sCif]=useState("");const [base,sBase]=useState("");const [iva,sIva]=useState("");
  const [irpf,sIrpf]=useState("");const [total,sTotal]=useState("");const [desc,sDesc]=useState("");
  const [estado,sEstado]=useState("Pendiente");const [fechaV,sFechaV]=useState("");const [fechaC,sFechaC]=useState("");
  const [concepto,sConcepto]=useState("");const [tipoG,sTipoG]=useState("");const [period,sPeriod]=useState("Puntual");const [irpfG,sIrpfG]=useState("");

  const reset=()=>{sNumero("");sFecha(hoy());sCliente("");sCif("");sBase("");sIva("");sIrpf("");sTotal("");sDesc("");sEstado("Pendiente");sFechaV("");sFechaC("");sConcepto("");sTipoG("");sPeriod("Puntual");sIrpfG("");setSaved(false);setErr("");setRes(null)};

  const handleFile=async(file)=>{reset();setProc(true);setMode("ocr");try{let b64;
    if(file.type==="application/pdf"){b64=await pdf2img(await file.arrayBuffer())}
    else{const du=await new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.onerror=j;rd.readAsDataURL(file)});b64=du.split(",")[1]}
    const text=await ocr(b64);console.log("OCR text:",text);
    if(!text){setErr("No se pudo leer.");setProc(false);return}
    const p=parseF(text);setRes(p);sNumero(p.numero);sFecha(convD(p.fecha));sCliente(p.cliente);sCif(p.cif);
    sBase(String(p.base||""));sIva(String(p.iva||""));sIrpf(String(p.irpf||""));sTotal(String(p.total||""));sDesc(p.desc);sConcepto(p.desc);
  }catch(e){setErr("Error: "+e.message)}setProc(false)};

  const handleSave=async()=>{setSav(true);setErr("");try{
    if(tipo==="ingreso"){
      const f={"Nº Factura":numero||"","Base Imponible":Number(base)||0,"Estado":estado||"Pendiente"};
      if(fecha)f["Fecha"]=fecha;if(fechaV)f["Fecha Vencimiento"]=fechaV;if(fechaC)f["Fecha Cobro"]=fechaC;
      if(cliente&&cliente.trim()){const cId=await findOrCreateClient(cliente.trim());if(cId)f["Cliente"]=[cId]}
      await createRecord("Ingresos",f);
    }else{
      const f={"Concepto":concepto||desc||"Gasto","Base Imponible":Number(base)||0,"IVA Soportado (€)":Number(iva)||(Number(base)*0.21)||0};
      if(irpfG)f["IRPF Retenido (€)"]=Number(irpfG);
      if(fecha)f["Fecha"]=fecha;if(tipoG)f["Tipo de Gasto"]=tipoG;if(period)f["Periodicidad"]=period;
      await createRecord("Gastos",f);
    }setSaved(true);onRefresh();
  }catch(e){console.error(e);setErr("Error: "+e.message)}setSav(false)};

  const ready=(mode==="ocr"&&res&&!proc)||mode==="manual";

  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <h2 style={{fontSize:22,fontWeight:700,color:B.text,margin:0,fontFamily:B.tM,textTransform:"uppercase"}}>{tipo==="ingreso"?"Facturas (Ingresos)":"Tickets / Gastos"}</h2>
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>{setTipo("ingreso");reset();setMode("choose")}} style={{...B.btn,flex:1,background:tipo==="ingreso"?B.text:"transparent",color:tipo==="ingreso"?"#fff":B.text,border:`2px solid ${B.text}`}}>FACTURA (INGRESO)</button>
      <button onClick={()=>{setTipo("gasto");reset();setMode("choose")}} style={{...B.btn,flex:1,background:tipo==="gasto"?B.text:"transparent",color:tipo==="gasto"?"#fff":B.text,border:`2px solid ${B.text}`}}>TICKET / GASTO</button>
    </div>
    {!saved&&<div style={{display:"flex",gap:8}}>
      <button onClick={()=>{setMode("choose");reset()}} style={{...B.btnSm,flex:1,background:mode!=="manual"?B.purple+"18":"transparent",border:`1px solid ${mode!=="manual"?B.purple:B.border}`,color:mode!=="manual"?B.purple:B.text}}>📄 ESCANEAR OCR</button>
      <button onClick={()=>{setMode("manual");reset()}} style={{...B.btnSm,flex:1,background:mode==="manual"?B.purple+"18":"transparent",border:`1px solid ${mode==="manual"?B.purple:B.border}`,color:mode==="manual"?B.purple:B.text}}>✏️ MANUAL</button>
    </div>}
    {(mode==="choose"||mode==="ocr")&&!res&&!saved&&<div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handleFile(f)}} onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="image/*,.pdf";i.onchange=e=>{const f=e.target.files[0];if(f)handleFile(f)};i.click()}}
      style={{background:drag?B.yellow+"44":B.card,border:`3px dashed ${drag?B.text:B.border}`,borderRadius:12,padding:proc?40:60,textAlign:"center",cursor:"pointer",backdropFilter:"blur(14px)"}}>
      {proc?<><div style={{fontSize:32,marginBottom:8}}>⏳</div><div style={{fontSize:15,fontWeight:700}}>Leyendo documento...</div></>
      :<><div style={{fontSize:48,marginBottom:12}}>{tipo==="ingreso"?"📄":"🧾"}</div><div style={{fontSize:15,fontWeight:700}}>{tipo==="ingreso"?"Arrastra tu factura":"Arrastra tu ticket/gasto"}</div><div style={{fontSize:13,color:B.muted,marginTop:4}}>PDF o imagen</div></>}
    </div>}
    {err&&<div style={{background:B.red+"15",color:B.red,padding:"12px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>{err}</div>}
    {ready&&!saved&&<Card style={{border:`2px solid ${mode==="ocr"?B.green:B.purple}`}}>
      <Lbl><span style={{color:mode==="ocr"?B.green:B.purple}}>{mode==="ocr"?"REVISA Y CORRIGE":"INTRODUCIR DATOS"}</span></Lbl>
      {tipo==="ingreso"?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
        <Inp label="Nº Factura" value={numero} onChange={sNumero} ph="F00012026"/>
        <Inp label="Fecha" value={fecha} onChange={sFecha} type="date"/>
        <Inp label="Cliente" value={cliente} onChange={sCliente} ph="Nombre del cliente"/>
        <Inp label="CIF/NIF" value={cif} onChange={sCif} ph="12345678A"/>
        <Inp label="Base Imponible (€)" value={base} onChange={sBase} type="number" ph="0"/>
        <Inp label="IVA (€)" value={iva} onChange={sIva} type="number" ph="Auto"/>
        <Inp label="IRPF (€)" value={irpf} onChange={sIrpf} type="number" ph="Auto"/>
        <Inp label="Total (€)" value={total} onChange={sTotal} type="number"/>
        <Sel label="Estado" value={estado} onChange={sEstado} options={["Cobrada","Pendiente","Vencida"]}/>
        <Inp label="Fecha Vencimiento" value={fechaV} onChange={sFechaV} type="date"/>
        <Inp label="Fecha Cobro" value={fechaC} onChange={sFechaC} type="date"/>
      </div>
      :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
        <Inp label="Concepto" value={concepto} onChange={sConcepto} ph="Ej: Material oficina"/>
        <Inp label="Fecha" value={fecha} onChange={sFecha} type="date"/>
        <Inp label="Base Imponible (€)" value={base} onChange={sBase} type="number" ph="0"/>
        <Inp label="IVA Soportado (€)" value={iva} onChange={sIva} type="number" ph="Auto: 21%"/>
        <Inp label="IRPF Retenido (€)" value={irpfG} onChange={sIrpfG} type="number" ph="Si proveedor autónomo"/>
        <Sel label="Tipo de Gasto" value={tipoG} onChange={sTipoG} options={["Fijo","Variable","Impuesto"]}/>
        <Sel label="Periodicidad" value={period} onChange={sPeriod} options={["Mensual","Trimestral","Anual","Puntual"]}/>
      </div>}
      <button onClick={handleSave} disabled={sav} style={{...B.btn,width:"100%",marginTop:16,opacity:sav?0.5:1}}>{sav?"GUARDANDO...":tipo==="ingreso"?"GUARDAR INGRESO":"GUARDAR GASTO"}</button>
    </Card>}
    {saved&&<Card style={{border:`2px solid ${B.green}`}}><div style={{textAlign:"center",padding:20}}>
      <div style={{fontSize:48,marginBottom:12}}>✅</div>
      <div style={{fontSize:16,fontWeight:700,color:B.green}}>{tipo==="ingreso"?"Factura guardada":"Gasto guardado"}</div>
      <button onClick={()=>{reset();setMode("choose")}} style={{...B.btn,marginTop:16}}>AÑADIR OTRO</button>
    </div></Card>}
  </div>);
}

// ============================================================
// APP
// ============================================================
const MENU=[{id:"dashboard",label:"DASHBOARD"},{id:"clientes",label:"CLIENTES"},{id:"simulador",label:"SIMULADOR"},{id:"gastos",label:"GASTOS"},{id:"autonomo",label:"CUOTA AUTÓNOMOS"},{id:"ocr",label:"AÑADIR FACTURA"}];

export default function App(){
  const [auth,setAuth]=useState(()=>{try{return localStorage.getItem("ga_auth")==="1"}catch{return false}});
  const [page,setPage]=useState("dashboard");const [open,setOpen]=useState(false);const [loading,setLoading]=useState(true);
  const [ingresos,setI]=useState([]);const [gastos,setG]=useState([]);const [clientes,setC]=useState([]);const [resumen,setR]=useState([]);const [tramos,setT]=useState([]);
  const [salObj,setSalObj]=useState(()=>{try{return Number(localStorage.getItem("ga_salario"))||2500}catch{return 2500}});
  const [filtro,setFiltro]=useState({year:String(new Date().getFullYear()),tri:"",mes:""});

  const load=useCallback(async()=>{setLoading(true);try{const[i,g,c,r,t]=await Promise.all([fetchTable("Ingresos"),fetchTable("Gastos"),fetchTable("Clientes"),fetchTable("Resumen Trimestral"),fetchTable("Tramos de Cotización")]);setI(i);setG(g);setC(c);setR(r);setT(t)}catch(e){console.error(e)}setLoading(false)},[]);
  useEffect(()=>{if(auth)load()},[auth,load]);

  if(!auth)return <Login onLogin={()=>setAuth(true)}/>;
  if(loading)return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.tM}}>
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div style={{textAlign:"center"}}><div style={{fontSize:32,marginBottom:16}}>📊</div><div style={{fontSize:14,color:B.muted,textTransform:"uppercase"}}>Cargando...</div></div></div>);

  const P=()=>{switch(page){
    case "dashboard":return <Dashboard ingresos={ingresos} gastos={gastos} tramos={tramos} salObj={salObj} setSalObj={setSalObj} filtro={filtro} setFiltro={setFiltro}/>;
    case "clientes":return <Clientes clientes={clientes} ingresos={ingresos} onRefresh={load}/>;
    case "simulador":return <Simulador/>;
    case "gastos":return <GastosView gastos={gastos} onRefresh={load} filtro={filtro} setFiltro={setFiltro}/>;
    case "autonomo":return <CuotaAut ingresos={ingresos} gastos={gastos} tramos={tramos}/>;
    case "ocr":return <OCRView onRefresh={load}/>;
    default:return <Dashboard ingresos={ingresos} gastos={gastos} tramos={tramos} salObj={salObj} setSalObj={setSalObj} filtro={filtro} setFiltro={setFiltro}/>;
  }};

  return(<div style={{fontFamily:B.tS,color:B.text,minHeight:"100vh",background:B.bg}}>
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <header style={{background:"rgba(255,255,255,0.82)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${B.border}`,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",color:B.text,cursor:"pointer",padding:4,display:"flex"}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:22,height:22}}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <span style={{fontSize:15,fontWeight:700,fontFamily:B.tM,textTransform:"uppercase"}}>Gestión Autónomo</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <span style={{fontSize:12,color:B.muted}}>{new Date().toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</span>
        <button onClick={()=>{try{localStorage.removeItem("ga_auth")}catch{};setAuth(false)}} style={{...B.btnSm,background:"transparent",color:B.muted,border:`1px solid ${B.border}`}}>SALIR</button>
      </div>
    </header>
    <div style={{display:"flex"}}>
      <nav style={{width:open?240:0,overflow:"hidden",background:"rgba(255,255,255,0.68)",backdropFilter:"blur(16px)",borderRight:`1px solid ${B.border}`,transition:"width 0.3s ease",minHeight:"calc(100vh - 56px)",flexShrink:0}}>
        <div style={{padding:"20px 14px",display:"flex",flexDirection:"column",gap:4}}>
          {MENU.map(m=>(<button key={m.id} onClick={()=>{setPage(m.id);setOpen(false)}} style={{display:"block",padding:"12px 16px",borderRadius:6,border:"none",background:page===m.id?B.text:"transparent",color:page===m.id?"#fff":B.text,fontWeight:700,fontSize:12,cursor:"pointer",width:"100%",textAlign:"left",fontFamily:B.tM,letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{m.label}</button>))}
        </div>
      </nav>
      <main style={{flex:1,padding:28,maxWidth:920,margin:"0 auto"}}>{P()}</main>
    </div>
  </div>);
}
