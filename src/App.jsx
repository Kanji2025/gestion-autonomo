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
  const r = await fetch(`${API}/${encodeURIComponent(table)}`, {
    method: "POST", headers: hdrs,
    body: JSON.stringify({ records: [{ fields }] })
  });
  return r.json();
}

async function updateRecord(table, id, fields) {
  const r = await fetch(`${API}/${encodeURIComponent(table)}`, {
    method: "PATCH", headers: hdrs,
    body: JSON.stringify({ records: [{ id, fields }] })
  });
  return r.json();
}

// ============================================================
// UTILS
// ============================================================
const fmt = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const calcIVA = (b) => (b || 0) * 0.21;
const calcIRPF = (b) => (b || 0) * 0.15;
const calcTotal = (b) => (b || 0) + calcIVA(b) - calcIRPF(b);
const diasEntre = (a, b) => { try { return Math.floor((new Date(b) - new Date(a)) / 86400000); } catch { return 0; } };
const hoy = () => new Date().toISOString().split("T")[0];
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// BRAND TOKENS
const B = {
  bg: "linear-gradient(160deg, #f0e991 0%, #FAFAFA 45%, #b1b8f4 100%)",
  card: "rgba(255,255,255,0.75)", border: "rgba(0,0,0,0.07)",
  text: "#111111", muted: "#555555", purple: "#6e72b8",
  green: "#16a34a", red: "#dc2626", amber: "#d97706", yellow: "#f0e991",
  tMono: "'Roboto Mono', monospace", tSans: "'Work Sans', sans-serif",
  btn: { background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"12px 24px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Roboto Mono', monospace",textTransform:"uppercase",letterSpacing:"0.06em" },
  btnSm: { background:"#111",color:"#fff",border:"none",borderRadius:6,padding:"8px 16px",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Roboto Mono', monospace",textTransform:"uppercase",letterSpacing:"0.06em" },
  input: { width:"100%",padding:"12px 14px",borderRadius:6,border:"2px solid rgba(0,0,0,0.1)",background:"#fff",color:"#111",fontSize:14,fontFamily:"'Work Sans', sans-serif",outline:"none",boxSizing:"border-box" },
};

// ============================================================
// LOGIN
// ============================================================
function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (user === "Maria" && pass === "Chaimyzeta17!") {
      if (remember) {
        try { window.localStorage.setItem("ga_auth", "1"); } catch {}
      }
      onLogin();
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:B.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:B.tSans }}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ background:"rgba(255,255,255,0.85)", backdropFilter:"blur(20px)", borderRadius:16, padding:"48px 40px", width:360, border:`1px solid ${B.border}` }}>
        <h1 style={{ fontSize:20, fontWeight:700, fontFamily:B.tMono, textTransform:"uppercase", textAlign:"center", margin:"0 0 8px", color:B.text }}>Gestión Autónomo</h1>
        <p style={{ textAlign:"center", color:B.muted, fontSize:13, margin:"0 0 32px" }}>Introduce tus credenciales</p>
        {error && <div style={{ background:B.red+"15", color:B.red, padding:"10px 14px", borderRadius:6, fontSize:13, fontWeight:600, marginBottom:16 }}>{error}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, fontFamily:B.tMono, textTransform:"uppercase", letterSpacing:"0.08em", color:B.muted, display:"block", marginBottom:6 }}>Usuario</label>
            <input value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={B.input} placeholder="Usuario" />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, fontFamily:B.tMono, textTransform:"uppercase", letterSpacing:"0.08em", color:B.muted, display:"block", marginBottom:6 }}>Contraseña</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={B.input} placeholder="Contraseña" />
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:B.muted, cursor:"pointer" }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor:B.text }} />
            Recordar contraseña
          </label>
          <button onClick={handleLogin} style={{ ...B.btn, width:"100%", padding:"14px 24px", marginTop:8 }}>ENTRAR</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTS
// ============================================================
function Card({ children, style }) {
  return <div style={{ background:B.card, backdropFilter:"blur(14px)", borderRadius:12, padding:"22px 24px", border:`1px solid ${B.border}`, ...style }}>{children}</div>;
}
function Label({ children }) {
  return <span style={{ fontSize:11, color:B.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:B.tMono }}>{children}</span>;
}
function BigNum({ children, color }) {
  return <span style={{ fontSize:30, fontWeight:700, color:color||B.text, fontFamily:B.tMono, display:"block", marginTop:4 }}>{children}</span>;
}
function Sub({ children }) {
  return <span style={{ fontSize:12, color:B.muted, fontFamily:B.tSans }}>{children}</span>;
}
function Semaforo({ estado }) {
  const m = { Cobrada:{c:B.green,l:"COBRADA"}, Pendiente:{c:B.amber,l:"PENDIENTE"}, Vencida:{c:B.red,l:"VENCIDA"} };
  const x = m[estado] || m.Pendiente;
  return <span style={{ background:x.c+"15", color:x.c, padding:"3px 10px", borderRadius:4, fontSize:11, fontWeight:700, fontFamily:B.tMono }}>{x.l}</span>;
}
function ProgressBar({ value, max, label, color }) {
  const c = color || B.text, pct = Math.min(((value||0) / (max||1)) * 100, 100);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontFamily:B.tSans }}>
        <span style={{ color:B.text, fontWeight:600 }}>{label}</span>
        <span style={{ color:B.muted }}>{fmt(value)} / {fmt(max)}</span>
      </div>
      <div style={{ background:"rgba(0,0,0,0.06)", borderRadius:6, height:28, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", borderRadius:6, background:c, transition:"width 1s ease", display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:10 }}>
          {pct > 12 && <span style={{ fontSize:11, fontWeight:700, color:"#fff", fontFamily:B.tMono }}>{Math.round(pct)}%</span>}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label style={{ fontSize:11, fontWeight:700, fontFamily:B.tMono, textTransform:"uppercase", letterSpacing:"0.08em", color:B.muted, display:"block", marginBottom:6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={B.input} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ fontSize:11, fontWeight:700, fontFamily:B.tMono, textTransform:"uppercase", letterSpacing:"0.08em", color:B.muted, display:"block", marginBottom:6 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...B.input, cursor:"pointer" }}>
        <option value="">Selecciona...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ============================================================
// PAGES
// ============================================================

// --- DASHBOARD ---
function Dashboard({ ingresos, gastos, resumen, tramos, salarioObj, setSalarioObj }) {
  const tFact = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tCob = ingresos.filter(r => r.fields["Estado"] === "Cobrada").reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const ivaR = ingresos.reduce((s, r) => s + (r.fields["IVA (€)"] || 0), 0);
  const ivaS = gastos.reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);
  const irpfR = ingresos.reduce((s, r) => s + (r.fields["IRPF (€)"] || 0), 0);
  const tGast = gastos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const benef = tFact - tGast;
  const hucha = ivaR - ivaS + irpfR;
  const venc = ingresos.filter(r => r.fields["Estado"] === "Vencida").length;
  const mesesT = Math.max(new Date().getMonth() + 1, 1);
  const bMes = benef / mesesT;
  const [editSal, setEditSal] = useState(false);
  const [tempSal, setTempSal] = useState(salarioObj);

  const dataMeses = MESES.slice(0, Math.min(new Date().getMonth() + 1, 12)).map((m, i) => {
    const fi = ingresos.filter(r => { const d = r.fields["Fecha"]; return d && new Date(d).getMonth() === i; });
    const gi = gastos.filter(r => { const d = r.fields["Fecha"]; return d && new Date(d).getMonth() === i; });
    return { mes: m, ing: fi.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0), gas: gi.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0) };
  });
  const mx = Math.max(...dataMeses.map(d => Math.max(d.ing, d.gas)), 1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Panel de Control</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(195px, 1fr))", gap:14 }}>
        <Card><Label>Facturado Total</Label><BigNum color={B.purple}>{fmt(tFact)}</BigNum><Sub>Base imponible acumulada</Sub></Card>
        <Card><Label>Cobrado Real</Label><BigNum color={B.green}>{fmt(tCob)}</BigNum><Sub>Dinero en tu cuenta</Sub></Card>
        <Card><Label>Beneficio Neto</Label><BigNum color={benef > 0 ? B.green : B.red}>{fmt(benef)}</BigNum><Sub>{fmt(bMes)}/mes de media</Sub></Card>
        <Card><Label>Facturas Vencidas</Label><BigNum color={B.red}>{venc}</BigNum><Sub>Pendientes de cobro</Sub></Card>
      </div>

      {/* HUCHA */}
      <div style={{ background:B.text, borderRadius:12, padding:"28px 28px 24px", color:"#fff", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-8, right:20, fontSize:72, opacity:0.06, fontFamily:B.tMono, fontWeight:700 }}>HACIENDA</div>
        <Label><span style={{ color:"rgba(255,255,255,0.6)" }}>HUCHA DE HACIENDA — DINERO INTOCABLE</span></Label>
        <div style={{ fontSize:44, fontWeight:700, marginTop:8, fontFamily:B.tMono }}>{fmt(hucha)}</div>
        <div style={{ display:"flex", gap:20, marginTop:14, fontSize:12, opacity:0.65, fontFamily:B.tSans, flexWrap:"wrap" }}>
          <span>IVA Repercutido: {fmt(ivaR)}</span>
          <span>IVA Soportado: {fmt(ivaS)}</span>
          <span>IRPF Retenido: {fmt(irpfR)}</span>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* OBJETIVO SALARIO EDITABLE */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <Label>Objetivo de Salario</Label>
            <button onClick={() => { if (editSal) { setSalarioObj(Number(tempSal)); try { window.localStorage.setItem("ga_salario", tempSal); } catch {} } setEditSal(!editSal); }}
              style={B.btnSm}>{editSal ? "GUARDAR" : "EDITAR"}</button>
          </div>
          {editSal && (
            <div style={{ marginBottom:12 }}>
              <input type="number" value={tempSal} onChange={e => setTempSal(e.target.value)}
                style={{ ...B.input, fontSize:18, fontWeight:700, fontFamily:B.tMono, textAlign:"center" }} />
            </div>
          )}
          <ProgressBar value={bMes} max={salarioObj} label="Este mes" color={bMes >= salarioObj ? B.green : B.amber} />
        </Card>
        <Card>
          <Label>IVA Trimestral</Label>
          <BigNum color={B.purple}>{fmt(ivaR - ivaS)}</BigNum>
          <Sub>A pagar en el próximo modelo 303</Sub>
        </Card>
      </div>

      {/* GRÁFICA */}
      {dataMeses.length > 0 && <Card>
        <Label>Ingresos vs Gastos</Label>
        <div style={{ display:"flex", gap:16, margin:"14px 0 8px", fontSize:12, fontFamily:B.tSans }}>
          <span><span style={{ color:B.purple }}>■</span> Ingresos</span>
          <span><span style={{ color:B.red+"88" }}>■</span> Gastos</span>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:150 }}>
          {dataMeses.map((d, i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:120, width:"100%" }}>
                <div style={{ flex:1, background:B.purple, borderRadius:"3px 3px 0 0", height:`${(d.ing/mx)*100}%`, minHeight:2, transition:"height 0.8s" }} />
                <div style={{ flex:1, background:B.red+"77", borderRadius:"3px 3px 0 0", height:`${(d.gas/mx)*100}%`, minHeight:2, transition:"height 0.8s" }} />
              </div>
              <span style={{ fontSize:11, color:B.muted, fontWeight:600, fontFamily:B.tMono }}>{d.mes}</span>
            </div>
          ))}
        </div>
      </Card>}

      {/* FLUJO CAJA */}
      <Card>
        <Label>Flujo de Caja vs Beneficio</Label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }}>
          <div style={{ textAlign:"center", padding:18, background:"rgba(0,0,0,0.03)", borderRadius:8 }}>
            <div style={{ fontSize:11, color:B.muted, fontFamily:B.tMono, textTransform:"uppercase" }}>Facturado</div>
            <div style={{ fontSize:26, fontWeight:700, color:B.purple, fontFamily:B.tMono, marginTop:4 }}>{fmt(tFact)}</div>
          </div>
          <div style={{ textAlign:"center", padding:18, background:"rgba(0,0,0,0.03)", borderRadius:8 }}>
            <div style={{ fontSize:11, color:B.muted, fontFamily:B.tMono, textTransform:"uppercase" }}>Cobrado Real</div>
            <div style={{ fontSize:26, fontWeight:700, color:B.green, fontFamily:B.tMono, marginTop:4 }}>{fmt(tCob)}</div>
          </div>
        </div>
        <div style={{ marginTop:12, textAlign:"center", fontSize:13, color:B.muted, fontFamily:B.tSans }}>
          Pendiente de cobro: <strong style={{ color:B.amber }}>{fmt(tFact - tCob)}</strong>
        </div>
      </Card>
    </div>
  );
}

// --- CLIENTES ---
function Clientes({ clientes, ingresos }) {
  const [sel, setSel] = useState(null);
  const clienteData = clientes.map(c => {
    const nombre = c.fields["Nombre"] || "Sin nombre";
    const estado = c.fields["Estado"] || "";
    const facturasIds = c.fields["Ingresos"] || [];
    const facturas = ingresos.filter(r => facturasIds.includes(r.id));
    const totalBase = facturas.reduce((s, f) => s + (f.fields["Base Imponible"] || 0), 0);
    const vencidas = facturas.filter(f => f.fields["Estado"] === "Vencida").length;
    const pendientes = facturas.filter(f => f.fields["Estado"] === "Pendiente").length;
    const cobradas = facturas.filter(f => f.fields["Estado"] === "Cobrada" && f.fields["Fecha Cobro"]);
    const diasM = cobradas.map(f => diasEntre(f.fields["Fecha"], f.fields["Fecha Cobro"]));
    const mediaD = diasM.length ? Math.round(diasM.reduce((a, b) => a + b, 0) / diasM.length) : null;
    const bc = vencidas > 0 ? B.red : pendientes > 0 ? B.amber : B.green;
    return { id: c.id, nombre, estado, facturas, totalBase, vencidas, pendientes, mediaD, bc };
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Clientes</h2>
      {clienteData.length === 0 && <Card><p style={{ color:B.muted, fontFamily:B.tSans }}>No hay clientes todavía. Se crearán al añadir facturas.</p></Card>}
      {clienteData.map(c => (
        <div key={c.id} onClick={() => setSel(sel === c.id ? null : c.id)} style={{
          background:B.card, backdropFilter:"blur(14px)", borderRadius:10, padding:20, cursor:"pointer",
          border:`1px solid ${B.border}`, borderLeft:`4px solid ${c.bc}`
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontWeight:600, fontSize:15, color:B.text, fontFamily:B.tSans }}>{c.nombre}</div>
              <div style={{ fontSize:12, color:B.muted, fontFamily:B.tSans }}>{c.estado}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight:700, color:B.text, fontFamily:B.tMono }}>{fmt(c.totalBase)}</div>
              <div style={{ fontSize:11, color:B.muted, fontFamily:B.tSans }}>{c.mediaD !== null ? `${c.mediaD} días media cobro` : "Sin datos"}</div>
            </div>
          </div>
          {c.vencidas > 0 && <div style={{ marginTop:10, background:B.red+"12", color:B.red, padding:"8px 14px", borderRadius:6, fontSize:13, fontWeight:600, fontFamily:B.tSans }}>⚠️ {c.vencidas} factura{c.vencidas > 1 ? "s" : ""} vencida{c.vencidas > 1 ? "s" : ""}</div>}
          {sel === c.id && c.facturas.length > 0 && (
            <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
              <Label>Facturas</Label>
              {c.facturas.map(f => (
                <div key={f.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,0.03)", padding:"10px 14px", borderRadius:8, fontSize:13, fontFamily:B.tSans }}>
                  <span style={{ fontWeight:700, fontFamily:B.tMono, fontSize:12 }}>{f.fields["Nº Factura"] || "-"}</span>
                  <span style={{ color:B.muted }}>{f.fields["Fecha"] || "-"}</span>
                  <span style={{ fontWeight:600 }}>{fmt(f.fields["Base Imponible"])}</span>
                  <Semaforo estado={f.fields["Estado"] || "Pendiente"} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- SIMULADOR ---
function Simulador() {
  const [base, setBase] = useState(500);
  const iva = calcIVA(base), irpf = calcIRPF(base), tot = calcTotal(base), limpio = base - irpf;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Simulador de Precios</h2>
      <Card>
        <Label>Base Imponible</Label>
        <input type="range" min="50" max="5000" step="10" value={base} onChange={e => setBase(Number(e.target.value))} style={{ width:"100%", accentColor:B.text, marginTop:12 }} />
        <div style={{ textAlign:"center", fontSize:44, fontWeight:700, color:B.text, margin:"8px 0", fontFamily:B.tMono }}>{fmt(base)}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:20 }}>
          <div style={{ background:"rgba(0,0,0,0.03)", borderRadius:8, padding:18, textAlign:"center" }}>
            <div style={{ fontSize:11, color:B.muted, fontFamily:B.tMono, textTransform:"uppercase" }}>+ IVA (21%)</div>
            <div style={{ fontSize:22, fontWeight:700, color:B.green, fontFamily:B.tMono }}>{fmt(iva)}</div>
          </div>
          <div style={{ background:"rgba(0,0,0,0.03)", borderRadius:8, padding:18, textAlign:"center" }}>
            <div style={{ fontSize:11, color:B.muted, fontFamily:B.tMono, textTransform:"uppercase" }}>- IRPF (15%)</div>
            <div style={{ fontSize:22, fontWeight:700, color:B.red, fontFamily:B.tMono }}>{fmt(irpf)}</div>
          </div>
          <div style={{ background:"rgba(0,0,0,0.03)", borderRadius:8, padding:18, textAlign:"center" }}>
            <div style={{ fontSize:11, color:B.muted, fontFamily:B.tMono, textTransform:"uppercase" }}>Total Factura</div>
            <div style={{ fontSize:22, fontWeight:700, color:B.purple, fontFamily:B.tMono }}>{fmt(tot)}</div>
          </div>
          <div style={{ background:B.text, borderRadius:8, padding:18, textAlign:"center", color:"#fff" }}>
            <div style={{ fontSize:11, opacity:0.8, fontFamily:B.tMono, textTransform:"uppercase" }}>Te queda limpio</div>
            <div style={{ fontSize:22, fontWeight:700, fontFamily:B.tMono }}>{fmt(limpio)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- GASTOS CON FORMULARIO MANUAL ---
function GastosView({ gastos, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ concepto:"", fecha:hoy(), base:"", ivaSoportado:"", tipoGasto:"", periodicidad:"" });

  const fijos = gastos.filter(r => r.fields["Periodicidad"] === "Mensual" || r.fields["Periodicidad"] === "Anual" || r.fields["Periodicidad"] === "Trimestral");
  const vars = gastos.filter(r => r.fields["Periodicidad"] === "Puntual" || !r.fields["Periodicidad"]);

  const totalMesFijo = fijos.reduce((s, r) => {
    const b = r.fields["Base Imponible"] || 0;
    const p = r.fields["Periodicidad"];
    if (p === "Mensual") return s + b;
    if (p === "Trimestral") return s + b / 3;
    if (p === "Anual") return s + b / 12;
    return s;
  }, 0);

  const handleSave = async () => {
    if (!form.concepto || !form.base) return;
    setSaving(true);
    const fields = {
      "Concepto": form.concepto,
      "Fecha": form.fecha,
      "Base Imponible": Number(form.base),
      "IVA Soportado (€)": form.ivaSoportado ? Number(form.ivaSoportado) : Number(form.base) * 0.21,
      "Tipo de Gasto": form.tipoGasto,
      "Periodicidad": form.periodicidad,
    };
    await createRecord("Gastos", fields);
    setForm({ concepto:"", fecha:hoy(), base:"", ivaSoportado:"", tipoGasto:"", periodicidad:"" });
    setShowForm(false);
    setSaving(false);
    onRefresh();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Gastos y Prorrateo</h2>
        <button onClick={() => setShowForm(!showForm)} style={B.btn}>{showForm ? "CANCELAR" : "+ NUEVO GASTO"}</button>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <Card style={{ border:`2px solid ${B.purple}` }}>
          <Label>Añadir Gasto Manual</Label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }}>
            <InputField label="Concepto" value={form.concepto} onChange={v => setForm({...form, concepto:v})} placeholder="Ej: Adobe Creative Cloud" />
            <InputField label="Fecha" value={form.fecha} onChange={v => setForm({...form, fecha:v})} type="date" />
            <InputField label="Base Imponible (€)" value={form.base} onChange={v => setForm({...form, base:v})} type="number" placeholder="0" />
            <InputField label="IVA Soportado (€)" value={form.ivaSoportado} onChange={v => setForm({...form, ivaSoportado:v})} type="number" placeholder="Auto: 21%" />
            <SelectField label="Tipo de Gasto" value={form.tipoGasto} onChange={v => setForm({...form, tipoGasto:v})} options={["Fijo","Variable","Impuesto"]} />
            <SelectField label="Periodicidad" value={form.periodicidad} onChange={v => setForm({...form, periodicidad:v})} options={["Mensual","Trimestral","Anual","Puntual"]} />
          </div>
          <button onClick={handleSave} disabled={saving} style={{ ...B.btn, width:"100%", marginTop:16, opacity:saving?0.5:1 }}>
            {saving ? "GUARDANDO..." : "GUARDAR GASTO"}
          </button>
        </Card>
      )}

      {/* PRORRATEO */}
      <div style={{ background:B.text, borderRadius:12, padding:24, color:"#fff" }}>
        <Label><span style={{ color:"rgba(255,255,255,0.6)" }}>APARTA CADA MES PARA GASTOS FIJOS</span></Label>
        <div style={{ fontSize:38, fontWeight:700, marginTop:6, fontFamily:B.tMono }}>{fmt(totalMesFijo)}</div>
      </div>

      {/* LISTA FIJOS */}
      {fijos.length > 0 && <Card>
        <Label>Gastos Fijos / Recurrentes</Label>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:14 }}>
          {fijos.map(g => {
            const b = g.fields["Base Imponible"] || 0;
            const p = g.fields["Periodicidad"] || "";
            const mensual = p === "Mensual" ? b : p === "Trimestral" ? b/3 : p === "Anual" ? b/12 : b;
            return (
              <div key={g.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", background:"rgba(0,0,0,0.03)", borderRadius:8 }}>
                <div>
                  <div style={{ fontWeight:600, color:B.text, fontSize:14, fontFamily:B.tSans }}>{g.fields["Concepto"]}</div>
                  <div style={{ fontSize:12, color:B.muted, fontFamily:B.tSans }}>{p}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, color:B.text, fontFamily:B.tMono }}>{fmt(b)}</div>
                  <div style={{ fontSize:12, color:B.amber, fontWeight:600, fontFamily:B.tSans }}>{fmt(mensual)}/mes</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>}

      {/* LISTA VARIABLES */}
      {vars.length > 0 && <Card>
        <Label>Gastos Variables / Puntuales</Label>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:14 }}>
          {vars.map(g => (
            <div key={g.id} style={{ display:"flex", justifyContent:"space-between", padding:"14px 16px", background:"rgba(0,0,0,0.03)", borderRadius:8 }}>
              <div>
                <div style={{ fontWeight:600, color:B.text, fontSize:14, fontFamily:B.tSans }}>{g.fields["Concepto"]}</div>
                <div style={{ fontSize:12, color:B.muted, fontFamily:B.tSans }}>{g.fields["Fecha"] || ""} · {g.fields["Tipo de Gasto"] || ""}</div>
              </div>
              <div style={{ fontWeight:700, color:B.text, fontFamily:B.tMono }}>{fmt(g.fields["Base Imponible"])}</div>
            </div>
          ))}
        </div>
      </Card>}
    </div>
  );
}

// --- MOROSIDAD ---
function Morosidad({ clientes, ingresos }) {
  const ranking = clientes.map(c => {
    const nombre = c.fields["Nombre"] || "Sin nombre";
    const fIds = c.fields["Ingresos"] || [];
    const facts = ingresos.filter(r => fIds.includes(r.id));
    const cobradas = facts.filter(f => f.fields["Estado"] === "Cobrada" && f.fields["Fecha Cobro"] && f.fields["Fecha Vencimiento"]);
    const dias = cobradas.map(f => diasEntre(f.fields["Fecha Vencimiento"], f.fields["Fecha Cobro"]));
    const media = dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null;
    return { id: c.id, nombre, mr: media, n: cobradas.length };
  }).filter(c => c.mr !== null).sort((a, b) => b.mr - a.mr);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Ranking de Morosidad</h2>
      {ranking.length === 0 && <Card><p style={{ color:B.muted, fontFamily:B.tSans }}>No hay datos suficientes. Necesitas facturas cobradas con fecha de vencimiento y fecha de cobro.</p></Card>}
      {ranking.map((c, i) => {
        const col = c.mr > 10 ? B.red : c.mr > 0 ? B.amber : B.green;
        return (
          <div key={c.id} style={{ background:B.card, backdropFilter:"blur(14px)", borderRadius:10, padding:20, border:`1px solid ${B.border}`, display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:8, background:col+"15", color:col, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16, fontFamily:B.tMono }}>#{i+1}</div>
            <div style={{ flex:1 }}><div style={{ fontWeight:600, color:B.text, fontFamily:B.tSans }}>{c.nombre}</div><div style={{ fontSize:12, color:B.muted, fontFamily:B.tSans }}>{c.n} facturas</div></div>
            <div style={{ textAlign:"right" }}><div style={{ fontWeight:700, fontSize:22, color:col, fontFamily:B.tMono }}>{c.mr > 0 ? `+${c.mr}` : c.mr} días</div><div style={{ fontSize:11, color:B.muted, fontFamily:B.tSans }}>{c.mr > 0 ? "retraso medio" : "paga a tiempo"}</div></div>
          </div>
        );
      })}
    </div>
  );
}

// --- CUOTA AUTÓNOMOS ---
function CuotaAutonomos({ ingresos, gastos, tramos }) {
  const [ca, setCa] = useState(() => { try { return Number(window.localStorage.getItem("ga_cuota")) || 294; } catch { return 294; } });
  const tI = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tG = gastos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const meses = Math.max(new Date().getMonth() + 1, 1);
  const rn = ((tI - tG - (ca * meses)) * 0.93) / meses;

  const tramosData = tramos.map(r => ({
    tramo: r.fields["Tramo"] || 0,
    min: r.fields["Rend. Neto Mín"] || r.fields["Rend Neto Min"] || 0,
    max: r.fields["Rend. Neto Máx"] || r.fields["Rend Neto Max"] || 0,
    cuota: r.fields["Cuota Mínima"] || r.fields["Cuota Minima"] || 0,
  })).sort((a, b) => a.tramo - b.tramo);

  const tr = tramosData.find(t => rn >= t.min && rn < t.max) || tramosData[tramosData.length - 1] || { tramo:0, min:0, max:0, cuota:0 };
  const d = tr.cuota - ca;

  const saveCuota = (v) => { setCa(v); try { window.localStorage.setItem("ga_cuota", v); } catch {} };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Cuota de Autónomos</h2>
      <Card>
        <Label>¿Cuánto pagas de cuota? (€/mes)</Label>
        <input type="number" value={ca} onChange={e => saveCuota(Number(e.target.value))}
          style={{ ...B.input, fontSize:20, fontWeight:700, fontFamily:B.tMono, marginTop:10 }} />
      </Card>
      <div style={{ background:B.text, borderRadius:12, padding:28, color:"#fff" }}>
        <Label><span style={{ color:"rgba(255,255,255,0.6)" }}>RENDIMIENTO NETO MENSUAL ESTIMADO</span></Label>
        <div style={{ fontSize:40, fontWeight:700, fontFamily:B.tMono, marginTop:6 }}>{fmt(rn)}</div>
        <div style={{ marginTop:16, display:"flex", gap:24, fontSize:13, fontFamily:B.tSans, flexWrap:"wrap" }}>
          <div><div style={{ opacity:0.55, fontSize:11, fontFamily:B.tMono, textTransform:"uppercase" }}>Tramo</div><div style={{ fontWeight:700 }}>{tr.tramo}</div></div>
          <div><div style={{ opacity:0.55, fontSize:11, fontFamily:B.tMono, textTransform:"uppercase" }}>Cuota correcta</div><div style={{ fontWeight:700 }}>{fmt(tr.cuota)}/mes</div></div>
          <div><div style={{ opacity:0.55, fontSize:11, fontFamily:B.tMono, textTransform:"uppercase" }}>Rango</div><div style={{ fontWeight:700 }}>{fmt(tr.min)} - {fmt(tr.max)}</div></div>
        </div>
      </div>
      {d !== 0 && <div style={{ background:d > 0 ? "#fef2f2" : "#f0fdf4", border:`2px solid ${d > 0 ? B.red : B.green}`, borderRadius:8, padding:20, color:d > 0 ? "#991b1b" : "#166534" }}>
        <div style={{ fontWeight:700, fontSize:15, fontFamily:B.tSans }}>{d > 0 ? "⚠️ Estás pagando de menos" : "✅ Estás pagando de más"}</div>
        <div style={{ fontSize:14, marginTop:6, fontFamily:B.tSans }}>{d > 0 ? `Deberías pagar ${fmt(tr.cuota)} pero pagas ${fmt(ca)}. Diferencia: ${fmt(d)}/mes.` : `Pagas ${fmt(ca)} pero te correspondería ${fmt(tr.cuota)}. Ahorro posible: ${fmt(Math.abs(d))}/mes.`}</div>
      </div>}
      {tramosData.length > 0 && <Card>
        <Label>Tramos 2026</Label>
        <div style={{ overflowX:"auto", marginTop:14 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:B.tSans }}>
            <thead><tr style={{ borderBottom:`2px solid ${B.border}` }}>
              <th style={{ padding:"8px 12px", textAlign:"left", color:B.muted, fontFamily:B.tMono, fontSize:11, textTransform:"uppercase" }}>Tramo</th>
              <th style={{ padding:"8px 12px", textAlign:"left", color:B.muted, fontFamily:B.tMono, fontSize:11, textTransform:"uppercase" }}>Rend. Neto</th>
              <th style={{ padding:"8px 12px", textAlign:"right", color:B.muted, fontFamily:B.tMono, fontSize:11, textTransform:"uppercase" }}>Cuota</th>
            </tr></thead>
            <tbody>{tramosData.map(t => (
              <tr key={t.tramo} style={{ background:t.tramo === tr.tramo ? B.yellow+"55" : "transparent", fontWeight:t.tramo === tr.tramo ? 700 : 400, borderBottom:`1px solid ${B.border}` }}>
                <td style={{ padding:"8px 12px", color:B.text, fontFamily:B.tMono, fontSize:13 }}>{t.tramo === tr.tramo ? "→ " : ""}{t.tramo}</td>
                <td style={{ padding:"8px 12px", color:B.text }}>{fmt(t.min)} - {t.max < 99999 ? fmt(t.max) : "+6.000€"}</td>
                <td style={{ padding:"8px 12px", textAlign:"right", color:t.tramo === tr.tramo ? B.purple : B.text, fontFamily:B.tMono }}>{fmt(t.cuota)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>}
    </div>
  );
}

// --- OCR REAL ---
const VISION_KEY = import.meta.env.VITE_GOOGLE_VISION_KEY;

async function ocrImage(base64data) {
  const body = {
    requests: [{
      image: { content: base64data },
      features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
    }]
  };
  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  const text = d.responses?.[0]?.fullTextAnnotation?.text || "";
  return text;
}

function parseFactura(text) {
  const t = text.replace(/\r/g, "");
  const num = (t.match(/(?:factura|fra|invoice|nº|n°|numero)[:\s]*([A-Z0-9\-\/]+)/i) || [])[1] || "";
  const fechaM = t.match(/(?:fecha(?:\s+de\s+factura)?)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i) || t.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
  const fecha = fechaM ? fechaM[1] : "";
  const cifM = t.match(/([A-Z]\d{7,8}[A-Z0-9]|\d{8}[A-Z])/);
  const cif = cifM ? cifM[0] : "";

  const findAmount = (patterns) => {
    for (const p of patterns) {
      const m = t.match(p);
      if (m) {
        const val = m[1].replace(/\./g, "").replace(",", ".");
        const n = parseFloat(val);
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  };

  const base = findAmount([
    /(?:subtotal|base\s*imponible|importe\s*neto)[:\s]*([0-9.,]+)\s*€?/i,
    /(?:subtotal|base)[:\s]*([0-9.,]+)/i
  ]);

  const iva = findAmount([
    /(?:iva|i\.v\.a\.?)\s*(?:\d+%)?[:\s]*([0-9.,]+)\s*€?/i,
    /(?:iva\s*\d+%?)[:\s]*([0-9.,]+)/i
  ]);

  const irpf = findAmount([
    /(?:irpf|i\.r\.p\.f\.?)\s*(?:-?\s*\d+%)?[:\s]*-?\s*([0-9.,]+)\s*€?/i,
    /(?:retenci[oó]n)[:\s]*-?\s*([0-9.,]+)/i
  ]);

  const total = findAmount([
    /(?:total(?:\s+factura)?)[:\s]*([0-9.,]+)\s*€?/i
  ]);

  // Try to find client name - look after "Para" or "Cliente" or "Bill to"
  const clienteM = t.match(/(?:para|cliente|bill\s*to|destinatario)[:\s]*\n?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/i);
  let cliente = clienteM ? clienteM[1].trim().split("\n")[0].trim() : "";
  if (cliente.length > 50) cliente = cliente.substring(0, 50);

  // Find concepto/descripcion
  const descM = t.match(/(?:descripci[oó]n|concepto|servicio)[:\s]*\n?\s*([^\n]+)/i);
  const descripcion = descM ? descM[1].trim() : "";

  return { numero: num, fecha, cliente, cif, base, iva, irpf, total, descripcion };
}

function convertDateFormat(d) {
  if (!d) return "";
  const parts = d.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!parts) return d;
  let [, day, month, year] = parts;
  if (year.length === 2) year = "20" + year;
  return `${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
}

function OCRView({ onRefresh }) {
  const [drag, setDrag] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [res, setRes] = useState(null);
  const [tipo, setTipo] = useState("ingreso");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Editable fields for ingreso
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState("");
  const [cliente, setCliente] = useState("");
  const [cif, setCif] = useState("");
  const [base, setBase] = useState("");
  const [iva, setIva] = useState("");
  const [irpf, setIrpf] = useState("");
  const [total, setTotal] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("Pendiente");
  const [fechaVenc, setFechaVenc] = useState("");

  // Editable fields for gasto
  const [concepto, setConcepto] = useState("");
  const [tipoGasto, setTipoGasto] = useState("");
  const [periodicidad, setPeriodicidad] = useState("Puntual");

  const resetFields = () => {
    setNumero(""); setFecha(""); setCliente(""); setCif(""); setBase("");
    setIva(""); setIrpf(""); setTotal(""); setDescripcion(""); setEstado("Pendiente");
    setFechaVenc(""); setConcepto(""); setTipoGasto(""); setPeriodicidad("Puntual");
    setSaved(false); setError("");
  };

  const handleFile = async (file) => {
    resetFields();
    setProcessing(true);
    setRes(null);
    setError("");
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let base64 = e.target.result.split(",")[1];
        
        // For PDFs, we need to convert first page to image
        // Google Vision can handle PDFs directly as images
        if (file.type === "application/pdf") {
          // Send PDF as-is to Vision API (it handles PDFs)
          base64 = e.target.result.split(",")[1];
        }
        
        try {
          const text = await ocrImage(base64);
          if (!text) {
            setError("No se pudo leer texto del documento. Intenta con mejor calidad.");
            setProcessing(false);
            return;
          }
          const parsed = parseFactura(text);
          setRes(parsed);
          
          // Set editable fields
          setNumero(parsed.numero);
          setFecha(convertDateFormat(parsed.fecha));
          setCliente(parsed.cliente);
          setCif(parsed.cif);
          setBase(String(parsed.base || ""));
          setIva(String(parsed.iva || ""));
          setIrpf(String(parsed.irpf || ""));
          setTotal(String(parsed.total || ""));
          setDescripcion(parsed.descripcion);
          setConcepto(parsed.descripcion);
        } catch (err) {
          setError("Error al procesar: " + err.message);
        }
        setProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error al leer archivo: " + err.message);
      setProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (tipo === "ingreso") {
        const fields = {
          "Nº Factura": numero,
          "Fecha": fecha || undefined,
          "Base Imponible": Number(base) || 0,
          "Estado": estado,
        };
        if (fechaVenc) fields["Fecha Vencimiento"] = fechaVenc;
        await createRecord("Ingresos", fields);
      } else {
        const fields = {
          "Concepto": concepto || descripcion || "Gasto sin concepto",
          "Fecha": fecha || undefined,
          "Base Imponible": Number(base) || 0,
          "IVA Soportado (€)": Number(iva) || 0,
        };
        if (tipoGasto) fields["Tipo de Gasto"] = tipoGasto;
        if (periodicidad) fields["Periodicidad"] = periodicidad;
        await createRecord("Gastos", fields);
      }
      setSaved(true);
      onRefresh();
    } catch (err) {
      setError("Error al guardar: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:B.text, margin:0, fontFamily:B.tMono, textTransform:"uppercase" }}>Lector de Facturas (OCR)</h2>

      {/* Tipo selector */}
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => { setTipo("ingreso"); resetFields(); setRes(null); }}
          style={{ ...B.btn, flex:1, background: tipo === "ingreso" ? B.text : "transparent", color: tipo === "ingreso" ? "#fff" : B.text, border:`2px solid ${B.text}` }}>
          FACTURA (INGRESO)
        </button>
        <button onClick={() => { setTipo("gasto"); resetFields(); setRes(null); }}
          style={{ ...B.btn, flex:1, background: tipo === "gasto" ? B.text : "transparent", color: tipo === "gasto" ? "#fff" : B.text, border:`2px solid ${B.text}` }}>
          TICKET / GASTO
        </button>
      </div>

      {/* Drop zone */}
      <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={handleDrop} onClick={handleClick}
        style={{
          background: drag ? B.yellow+"44" : B.card,
          border: `3px dashed ${drag ? B.text : B.border}`,
          borderRadius:12, padding: processing ? 40 : 60, textAlign:"center",
          cursor:"pointer", backdropFilter:"blur(14px)", transition:"all 0.3s"
        }}>
        {processing ? (
          <>
            <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
            <div style={{ fontSize:15, fontWeight:700, color:B.text, fontFamily:B.tSans }}>Leyendo documento...</div>
            <div style={{ fontSize:13, color:B.muted, marginTop:4, fontFamily:B.tSans }}>Extrayendo datos con OCR</div>
          </>
        ) : (
          <>
            <div style={{ fontSize:48, marginBottom:12 }}>{tipo === "ingreso" ? "📄" : "🧾"}</div>
            <div style={{ fontSize:15, fontWeight:700, color:B.text, fontFamily:B.tSans }}>
              {tipo === "ingreso" ? "Arrastra tu factura aquí" : "Arrastra tu ticket o factura de gasto"}
            </div>
            <div style={{ fontSize:13, color:B.muted, marginTop:4, fontFamily:B.tSans }}>PDF o imagen · Haz clic para seleccionar archivo</div>
          </>
        )}
      </div>

      {error && <div style={{ background:B.red+"15", color:B.red, padding:"12px 16px", borderRadius:8, fontSize:13, fontWeight:600, fontFamily:B.tSans }}>{error}</div>}

      {/* Resultados editables */}
      {res && !saved && (
        <Card style={{ border:`2px solid ${B.green}` }}>
          <Label><span style={{ color:B.green }}>DATOS EXTRAÍDOS — REVISA Y CORRIGE</span></Label>
          
          {tipo === "ingreso" ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }}>
              <InputField label="Nº Factura" value={numero} onChange={setNumero} placeholder="F00012026" />
              <InputField label="Fecha" value={fecha} onChange={setFecha} type="date" />
              <InputField label="Cliente" value={cliente} onChange={setCliente} placeholder="Nombre del cliente" />
              <InputField label="CIF/NIF" value={cif} onChange={setCif} placeholder="12345678A" />
              <InputField label="Base Imponible (€)" value={base} onChange={setBase} type="number" />
              <InputField label="IVA (€)" value={iva} onChange={setIva} type="number" />
              <InputField label="IRPF (€)" value={irpf} onChange={setIrpf} type="number" />
              <InputField label="Total (€)" value={total} onChange={setTotal} type="number" />
              <SelectField label="Estado" value={estado} onChange={setEstado} options={["Cobrada","Pendiente","Vencida"]} />
              <InputField label="Fecha Vencimiento" value={fechaVenc} onChange={setFechaVenc} type="date" />
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }}>
              <InputField label="Concepto" value={concepto} onChange={setConcepto} placeholder="Ej: Material oficina" />
              <InputField label="Fecha" value={fecha} onChange={setFecha} type="date" />
              <InputField label="Base Imponible (€)" value={base} onChange={setBase} type="number" />
              <InputField label="IVA Soportado (€)" value={iva} onChange={setIva} type="number" />
              <SelectField label="Tipo de Gasto" value={tipoGasto} onChange={setTipoGasto} options={["Fijo","Variable","Impuesto"]} />
              <SelectField label="Periodicidad" value={periodicidad} onChange={setPeriodicidad} options={["Mensual","Trimestral","Anual","Puntual"]} />
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            style={{ ...B.btn, width:"100%", marginTop:16, opacity:saving ? 0.5 : 1 }}>
            {saving ? "GUARDANDO..." : tipo === "ingreso" ? "GUARDAR INGRESO EN AIRTABLE" : "GUARDAR GASTO EN AIRTABLE"}
          </button>
        </Card>
      )}

      {/* Saved confirmation */}
      {saved && (
        <Card style={{ border:`2px solid ${B.green}` }}>
          <div style={{ textAlign:"center", padding:20 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:700, color:B.green, fontFamily:B.tSans }}>
              {tipo === "ingreso" ? "Factura guardada en Ingresos" : "Gasto guardado en Gastos"}
            </div>
            <button onClick={() => { resetFields(); setRes(null); }}
              style={{ ...B.btn, marginTop:16 }}>ESCANEAR OTRO DOCUMENTO</button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
const MENU = [
  { id:"dashboard", label:"DASHBOARD" }, { id:"clientes", label:"CLIENTES" },
  { id:"simulador", label:"SIMULADOR" }, { id:"gastos", label:"GASTOS" },
  { id:"morosidad", label:"MOROSIDAD" }, { id:"autonomo", label:"CUOTA AUTÓNOMOS" },
  { id:"ocr", label:"LECTOR FACTURAS" },
];

export default function App() {
  const [auth, setAuth] = useState(() => { try { return window.localStorage.getItem("ga_auth") === "1"; } catch { return false; } });
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ingresos, setIngresos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [tramos, setTramos] = useState([]);
  const [salarioObj, setSalarioObj] = useState(() => { try { return Number(window.localStorage.getItem("ga_salario")) || 2500; } catch { return 2500; } });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [i, g, c, r, t] = await Promise.all([
        fetchTable("Ingresos"), fetchTable("Gastos"), fetchTable("Clientes"),
        fetchTable("Resumen Trimestral"), fetchTable("Tramos de Cotización"),
      ]);
      setIngresos(i); setGastos(g); setClientes(c); setResumen(r); setTramos(t);
    } catch (e) { console.error("Error loading data:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { if (auth) loadData(); }, [auth, loadData]);

  const handleLogout = () => {
    try { window.localStorage.removeItem("ga_auth"); } catch {}
    setAuth(false);
  };

  if (!auth) return <Login onLogin={() => setAuth(true)} />;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:B.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:B.tMono }}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:16 }}>📊</div>
        <div style={{ fontSize:14, color:B.muted, textTransform:"uppercase", letterSpacing:"0.1em" }}>Cargando datos...</div>
      </div>
    </div>
  );

  const render = () => {
    switch (page) {
      case "dashboard": return <Dashboard ingresos={ingresos} gastos={gastos} resumen={resumen} tramos={tramos} salarioObj={salarioObj} setSalarioObj={setSalarioObj} />;
      case "clientes": return <Clientes clientes={clientes} ingresos={ingresos} />;
      case "simulador": return <Simulador />;
      case "gastos": return <GastosView gastos={gastos} onRefresh={loadData} />;
      case "morosidad": return <Morosidad clientes={clientes} ingresos={ingresos} />;
      case "autonomo": return <CuotaAutonomos ingresos={ingresos} gastos={gastos} tramos={tramos} />;
      case "ocr": return <OCRView onRefresh={loadData} />;
      default: return <Dashboard ingresos={ingresos} gastos={gastos} resumen={resumen} tramos={tramos} salarioObj={salarioObj} setSalarioObj={setSalarioObj} />;
    }
  };

  return (
    <div style={{ fontFamily:B.tSans, color:B.text, minHeight:"100vh", background:B.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <header style={{ background:"rgba(255,255,255,0.82)", backdropFilter:"blur(16px)", borderBottom:`1px solid ${B.border}`, padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <button onClick={() => setOpen(!open)} style={{ background:"none", border:"none", color:B.text, cursor:"pointer", padding:4, display:"flex" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:22, height:22 }}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <span style={{ fontSize:15, fontWeight:700, fontFamily:B.tMono, textTransform:"uppercase", letterSpacing:"0.03em" }}>Gestión Autónomo</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:12, color:B.muted, fontFamily:B.tSans }}>{new Date().toLocaleDateString("es-ES", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</span>
          <button onClick={handleLogout} style={{ ...B.btnSm, background:"transparent", color:B.muted, border:`1px solid ${B.border}` }}>SALIR</button>
        </div>
      </header>
      <div style={{ display:"flex" }}>
        <nav style={{ width:open ? 240 : 0, overflow:"hidden", background:"rgba(255,255,255,0.68)", backdropFilter:"blur(16px)", borderRight:`1px solid ${B.border}`, transition:"width 0.3s ease", minHeight:"calc(100vh - 56px)", flexShrink:0 }}>
          <div style={{ padding:"20px 14px", display:"flex", flexDirection:"column", gap:4 }}>
            {MENU.map(m => (
              <button key={m.id} onClick={() => { setPage(m.id); setOpen(false); }} style={{
                display:"block", padding:"12px 16px", borderRadius:6, border:"none",
                background:page === m.id ? B.text : "transparent", color:page === m.id ? "#fff" : B.text,
                fontWeight:700, fontSize:12, cursor:"pointer", width:"100%", textAlign:"left",
                fontFamily:B.tMono, letterSpacing:"0.06em", transition:"all 0.2s", whiteSpace:"nowrap"
              }}>{m.label}</button>
            ))}
          </div>
        </nav>
        <main style={{ flex:1, padding:28, maxWidth:920, margin:"0 auto" }}>{render()}</main>
      </div>
    </div>
  );
}
