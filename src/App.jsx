import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  Calculator,
  Receipt,
  ShieldCheck,
  ScanLine,
  Menu,
  X,
  LogOut,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Target,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronRight,
  Upload,
  FileText,
  Edit3,
  Check,
  AlertCircle,
} from "lucide-react";

// ============================================================
// AIRTABLE API (preserved from original)
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
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({ records: [{ fields }] }),
  });
  const d = await r.json();
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
  const cr = await createRecord("Clientes", { Nombre: clean });
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
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const diasEntre = (a, b) => { try { return Math.floor((new Date(b) - new Date(a)) / 86400000); } catch { return 0; } };
function getTrimestre(f) {
  if (!f) return "";
  const m = new Date(f).getMonth();
  return m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4";
}
function ivaDeadline(quarter, year) {
  // Fechas oficiales de declaración trimestral del modelo 303
  const map = {
    Q1: `20 de abril ${year}`,
    Q2: `20 de julio ${year}`,
    Q3: `20 de octubre ${year}`,
    Q4: `30 de enero ${Number(year) + 1}`,
  };
  return map[quarter] || "";
}
function todayLong() {
  const d = new Date();
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const T = {
  bg: "#fafafa",
  surface: "#ffffff",
  ink: "#000000",
  inkMuted: "#6b6b6b",
  inkSoft: "#a3a3a3",
  border: "#ececec",
  yellow: "#f0e991",
  lavender: "#b1b8f4",
  success: "#2f7a4f",
  successSoft: "#e8f3ec",
  danger: "#c14545",
  dangerSoft: "#f7e8e8",
  warning: "#b87333",
  warningSoft: "#f7ede0",
  font: "'Work Sans', system-ui, sans-serif",
  num: { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' },
};

const TY = {
  display: "clamp(32px, 4.5vw, 44px)",
  h1: "clamp(24px, 3.5vw, 32px)",
  h1Sub: "clamp(14px, 1.5vw, 16px)",
  heroCardNum: "clamp(24px, 3vw, 32px)",
  h2: "clamp(17px, 2vw, 20px)",
  numL: "clamp(22px, 2.6vw, 28px)",
  numM: "clamp(17px, 1.9vw, 20px)",
  body: "15px",
  small: "14px",
  label: "12px",
};

// ============================================================
// LOGO
// ============================================================
function KanjiMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140.89 140.89" xmlns="http://www.w3.org/2000/svg" aria-label="Kanji Estudio">
      <circle cx="70.45" cy="70.45" r="69.95" fill="#000" />
      <path d="M54.9,69.72l-12.23,12.43v21.96h-8.29V35.74h8.29v35.22l34.4-35.22h10.88l-27.25,27.87,27.56,40.51h-9.95l-23.41-34.4Z" fill="#fafafa" />
      <path d="M106.5,98.42c0,4.04-2.69,6.73-6.73,6.73s-6.73-2.69-6.73-6.73,2.69-6.73,6.73-6.73,6.73,2.69,6.73,6.73Z" fill="#fafafa" />
    </svg>
  );
}

// ============================================================
// PRIMITIVES
// ============================================================
function Label({ children, color = T.inkMuted, style }) {
  return (
    <span style={{ fontSize: TY.label, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color, fontFamily: T.font, ...style }}>
      {children}
    </span>
  );
}

function Card({ children, style, dark = false, accent = null }) {
  const bg = dark ? T.ink : accent === "yellow" ? T.yellow : accent === "lavender" ? T.lavender : T.surface;
  const border = dark || accent ? "transparent" : T.border;
  return (
    <div style={{ background: bg, borderRadius: 20, border: `1px solid ${border}`, padding: "clamp(20px, 3vw, 28px)", color: dark ? "#fff" : T.ink, position: "relative", ...style }}>
      {children}
    </div>
  );
}

function IconPill({ icon: Icon, dark = false, size = 32, color = null }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 999, background: dark ? "rgba(255,255,255,0.08)" : "#f4f4f4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={size * 0.5} strokeWidth={1.75} color={color || (dark ? "#fff" : T.ink)} />
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", icon: Icon, disabled = false, style = {}, type = "button" }) {
  const sizes = {
    sm: { padding: "8px 14px", fontSize: 12 },
    md: { padding: "10px 18px", fontSize: 13 },
    lg: { padding: "13px 22px", fontSize: 14 },
  };
  const variants = {
    primary: { background: T.ink, color: "#fff", border: "1px solid transparent" },
    outline: { background: "transparent", color: T.ink, border: `1px solid ${T.border}` },
    danger: { background: T.danger, color: "#fff", border: "1px solid transparent" },
    ghost: { background: "transparent", color: T.ink, border: "1px solid transparent" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...sizes[size],
        ...variants[variant],
        borderRadius: 999,
        fontFamily: T.font,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        letterSpacing: "0.005em",
        transition: "opacity 0.15s ease",
        ...style,
      }}
    >
      {children}
      {Icon && <Icon size={size === "sm" ? 13 : 15} strokeWidth={2.25} />}
    </button>
  );
}

function Inp({ label, value, onChange, type = "text", ph = "", onKey, style = {} }) {
  return (
    <div style={style}>
      {label && <div style={{ marginBottom: 6 }}><Label>{label}</Label></div>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        onKeyDown={onKey}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: "#fff",
          color: T.ink,
          fontSize: 14,
          fontFamily: T.font,
          fontWeight: 500,
          outline: "none",
          boxSizing: "border-box",
          ...T.num,
        }}
        onFocus={(e) => (e.target.style.borderColor = T.ink)}
        onBlur={(e) => (e.target.style.borderColor = T.border)}
      />
    </div>
  );
}

function Sel({ label, value, onChange, options, style = {} }) {
  return (
    <div style={style}>
      {label && <div style={{ marginBottom: 6 }}><Label>{label}</Label></div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: "#fff",
          color: T.ink,
          fontSize: 14,
          fontFamily: T.font,
          fontWeight: 500,
          outline: "none",
          cursor: "pointer",
          boxSizing: "border-box",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
          paddingRight: 36,
        }}
      >
        <option value="">Selecciona...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StatusPill({ estado }) {
  const map = {
    Cobrada: { c: T.success, bg: T.successSoft, l: "Cobrada", icon: CheckCircle2 },
    Pendiente: { c: T.warning, bg: T.warningSoft, l: "Pendiente", icon: Clock },
    Vencida: { c: T.danger, bg: T.dangerSoft, l: "Vencida", icon: AlertCircle },
  };
  const x = map[estado] || map.Pendiente;
  const Icon = x.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: x.bg, color: x.c, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, fontFamily: T.font, whiteSpace: "nowrap" }}>
      <Icon size={11} strokeWidth={2.5} />
      {x.l}
    </span>
  );
}

// ============================================================
// FILTER BAR
// ============================================================
function FilterBar({ filtro, setFiltro }) {
  const y = new Date().getFullYear();
  const pillSel = {
    padding: "8px 28px 8px 12px",
    borderRadius: 999,
    border: `1px solid ${T.border}`,
    background: "#fff",
    color: T.ink,
    fontSize: 12,
    fontFamily: T.font,
    fontWeight: 600,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={filtro.year} onChange={(e) => setFiltro({ ...filtro, year: e.target.value })} style={pillSel}>
        <option value="">Todos los años</option>
        {[y, y - 1, y - 2].map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={filtro.tri} onChange={(e) => setFiltro({ ...filtro, tri: e.target.value, mes: "" })} style={pillSel}>
        <option value="">Trimestre</option>
        <option value="Q1">Q1</option><option value="Q2">Q2</option>
        <option value="Q3">Q3</option><option value="Q4">Q4</option>
      </select>
      <select value={filtro.mes} onChange={(e) => setFiltro({ ...filtro, mes: e.target.value, tri: "" })} style={pillSel}>
        <option value="">Mes</option>
        {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      {(filtro.year || filtro.tri || filtro.mes !== "") && (
        <Btn variant="ghost" size="sm" onClick={() => setFiltro({ year: "", tri: "", mes: "" })} style={{ color: T.inkMuted }}>
          Limpiar
        </Btn>
      )}
    </div>
  );
}
function applyF(recs, filtro, df = "Fecha") {
  return recs.filter((r) => {
    const f = r.fields[df];
    if (!f) return !filtro.year && !filtro.tri && filtro.mes === "";
    const d = new Date(f);
    if (filtro.year && d.getFullYear() !== Number(filtro.year)) return false;
    if (filtro.tri && getTrimestre(f) !== filtro.tri) return false;
    if (filtro.mes !== "" && d.getMonth() !== Number(filtro.mes)) return false;
    return true;
  });
}

// ============================================================
// LOGIN
// ============================================================
function Login({ onLogin }) {
  const [u, sU] = useState("");
  const [p, sP] = useState("");
  const [rem, sRem] = useState(false);
  const [err, sErr] = useState("");
  const go = () => {
    if (u === "Maria" && p === "Chaimyzeta17!") {
      if (rem) try { localStorage.setItem("ga_auth", "1"); } catch {}
      onLogin();
    } else sErr("Usuario o contraseña incorrectos");
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <KanjiMark size={32} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Gestión Autónomo</span>
        </div>
        <h1 style={{ fontSize: TY.h1, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0, color: T.ink }}>
          Hola de nuevo.
        </h1>
        <p style={{ fontSize: TY.h1Sub, fontWeight: 400, color: T.inkMuted, margin: "8px 0 32px" }}>
          Entra para ver tu negocio.
        </p>
        {err && (
          <div style={{ background: T.dangerSoft, color: T.danger, padding: "12px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={15} strokeWidth={2.25} />{err}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Inp label="Usuario" value={u} onChange={sU} onKey={(e) => e.key === "Enter" && go()} ph="Tu usuario" />
          <Inp label="Contraseña" value={p} onChange={sP} type="password" onKey={(e) => e.key === "Enter" && go()} ph="Tu contraseña" />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.inkMuted, cursor: "pointer", marginTop: 4 }}>
            <input type="checkbox" checked={rem} onChange={(e) => sRem(e.target.checked)} style={{ accentColor: T.ink }} />
            Mantener sesión iniciada
          </label>
          <Btn onClick={go} size="lg" style={{ width: "100%", marginTop: 8 }}>Entrar</Btn>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HEADER + SIDEBAR
// ============================================================
const MENU = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "simulador", label: "Simulador", icon: Calculator },
  { id: "gastos", label: "Gastos", icon: Receipt },
  { id: "autonomo", label: "Cuota Autónomos", icon: ShieldCheck },
  { id: "ocr", label: "Añadir factura", icon: ScanLine },
];

function Header({ onMenuToggle, onLogout }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px clamp(16px, 3vw, 28px)", borderBottom: `1px solid ${T.border}`, background: T.bg, position: "sticky", top: 0, zIndex: 50, height: 56, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button aria-label="Menú" onClick={onMenuToggle} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", color: T.ink }}>
          <Menu size={20} strokeWidth={2} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <KanjiMark size={26} />
          <span style={{ fontFamily: T.font, fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>Gestión Autónomo</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="header-date" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkMuted, fontWeight: 500 }}>
          <Calendar size={13} strokeWidth={2} />
          <span style={{ textTransform: "capitalize" }}>{todayLong()}</span>
        </div>
        <Btn variant="outline" size="sm" icon={LogOut} onClick={onLogout}>Salir</Btn>
      </div>
    </header>
  );
}

function Sidebar({ open, page, setPage, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
          zIndex: 60,
        }}
      />
      {/* Sidebar */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 280,
          maxWidth: "85vw",
          height: "100vh",
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <KanjiMark size={28} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>Gestión Autónomo</span>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: T.ink, display: "flex" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MENU.map((m) => {
            const active = page === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => { setPage(m.id); onClose(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: active ? T.ink : "transparent",
                  color: active ? "#fff" : T.ink,
                  fontFamily: T.font,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f4f4f4"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={16} strokeWidth={1.75} />
                {m.label}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}

// ============================================================
// SHARED DASHBOARD COMPONENTS
// ============================================================
function PageHeader({ title, subtitle, action }) {
  return (
    <section style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: "clamp(20px, 3vw, 28px)", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontFamily: T.font, fontSize: TY.h1, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0, color: T.ink }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontFamily: T.font, fontSize: TY.h1Sub, fontWeight: 400, color: T.inkMuted, margin: "8px 0 0", letterSpacing: "-0.005em" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </section>
  );
}

function KPI({ icon, label, value, sub, delta, deltaType = "up", color = T.ink }) {
  const DeltaIcon = deltaType === "up" ? ArrowUpRight : ArrowDownRight;
  const deltaColor = deltaType === "up" ? T.success : T.danger;
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <IconPill icon={icon} />
        {delta && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: T.font, fontSize: 12, fontWeight: 600, color: deltaColor, ...T.num }}>
            <DeltaIcon size={13} strokeWidth={2.5} />{delta}
          </div>
        )}
      </div>
      <Label>{label}</Label>
      <div style={{ fontFamily: T.font, fontSize: TY.numL, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 6, color, ...T.num }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, marginTop: 4, fontWeight: 400 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ ingresos, gastos, salObj, setSalObj, filtro, setFiltro }) {
  const fi = applyF(ingresos, filtro);
  const fg = applyF(gastos, filtro);

  const facturado = fi.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const cobrado = fi.filter((r) => r.fields["Estado"] === "Cobrada").reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const pendiente = facturado - cobrado;
  const ivaR = fi.reduce((s, r) => s + (r.fields["IVA (€)"] || 0), 0);
  const ivaS = fg.reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);
  const irpfRet = fg.reduce((s, r) => s + (r.fields["IRPF Retenido (€)"] || 0), 0);
  const tGast = fg.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const irpfClientes = fi.reduce((s, r) => s + (r.fields["IRPF (€)"] || 0), 0);
  const beneficio = facturado - irpfClientes - tGast;
  const ivaAPagar = ivaR - ivaS + irpfRet;
  const vencidas = fi.filter((r) => r.fields["Estado"] === "Vencida").length;
  const monthsCount = Math.max(new Set(fi.map((r) => r.fields["Fecha"] ? new Date(r.fields["Fecha"]).getMonth() : -1).filter((m) => m >= 0)).size, 1);
  const beneficioMes = beneficio / monthsCount;

  const now = new Date();
  const monthLabel = MESES_FULL[now.getMonth()].toLowerCase();
  const currentQuarter = `${getTrimestre(now.toISOString())} ${now.getFullYear()}`;
  const ivaDue = ivaDeadline(getTrimestre(now.toISOString()), now.getFullYear());

  // Chart range
  const mRange = filtro.tri
    ? { Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11] }[filtro.tri]
    : filtro.mes !== ""
    ? [Number(filtro.mes)]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((m) => m <= now.getMonth());
  const months = mRange.map((mi) => ({
    mes: MESES[mi],
    ing: fi.filter((r) => { const d = r.fields["Fecha"]; return d && new Date(d).getMonth() === mi; }).reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0),
    gas: fg.filter((r) => { const d = r.fields["Fecha"]; return d && new Date(d).getMonth() === mi; }).reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader title={`Hola, María.`} subtitle={`Esto es tu negocio en ${monthLabel}.`} />

      <FilterBar filtro={filtro} setFiltro={setFiltro} />
      <div style={{ height: "clamp(20px, 3vw, 28px)" }} />

      {/* HERO IVA */}
      <Card dark style={{ padding: "clamp(24px, 4vw, 36px)", marginBottom: "clamp(20px, 3vw, 28px)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 10, height: 10, background: T.yellow, borderRadius: "0 20px 0 20px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: T.yellow, display: "inline-block" }} />
          <Label color="rgba(255,255,255,0.55)">IVA a pagar · {currentQuarter}</Label>
        </div>
        <div style={{ fontFamily: T.font, fontSize: TY.display, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1, color: "#fff", ...T.num }}>
          {fmt(ivaAPagar)}
        </div>
        <p style={{ fontFamily: T.font, fontSize: TY.body, fontWeight: 400, color: "rgba(255,255,255,0.7)", margin: "14px 0 24px", maxWidth: 460, lineHeight: 1.5 }}>
          {ivaAPagar > 0
            ? `Apártalo en otra cuenta antes de que llegue el ${ivaDue}. Este dinero no es tuyo.`
            : `Este trimestre tu IVA soportado supera al repercutido. No tienes que ingresar nada.`}
        </p>
        <div className="grid-iva-breakdown" style={{ paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <BreakdownItem label="Repercutido" value={ivaR} positive />
          <BreakdownItem label="Soportado" value={ivaS} negative />
          <BreakdownItem label="IRPF retenido" value={irpfRet} />
        </div>
      </Card>

      {/* KPI GRID */}
      <div className="grid-kpi" style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
        <KPI icon={Receipt} label="Facturado" value={fmt(facturado)} sub="Base imponible total" />
        <KPI icon={Wallet} label="Cobrado" value={fmt(cobrado)} sub="Lo que está en tu cuenta" />
        <KPI icon={TrendingUp} label="Beneficio neto" value={fmt(beneficio)} sub={`${fmt(beneficioMes)} de media al mes`} color={beneficio >= 0 ? T.ink : T.danger} />
        <KPI icon={AlertTriangle} label="Vencidas sin cobrar" value={vencidas} sub={vencidas > 0 ? "Reclama esta semana" : "Todo al día"} color={vencidas > 0 ? T.danger : T.ink} />
      </div>

      {/* SALARY */}
      <SalaryGoal beneficioMes={beneficioMes} salaryGoal={salObj} setSalaryGoal={setSalObj} />

      {/* FLUJO */}
      <FlujoCaja facturado={facturado} cobrado={cobrado} pendiente={pendiente} />

      {/* CHART */}
      {months.length > 0 && <ChartIngresosVsGastos months={months} />}
    </div>
  );
}

function BreakdownItem({ label, value, positive, negative }) {
  return (
    <div>
      <Label color="rgba(255,255,255,0.45)">{label}</Label>
      <div style={{ fontFamily: T.font, fontSize: TY.numM, fontWeight: 600, marginTop: 6, color: "#fff", letterSpacing: "-0.015em", ...T.num }}>
        {positive ? "+" : negative ? "−" : ""}{fmt(Math.abs(value))}
      </div>
    </div>
  );
}

function CuotaInfo({ label, value }) {
  return (
    <div>
      <Label color="rgba(255,255,255,0.45)">{label}</Label>
      <div style={{ fontFamily: T.font, fontSize: TY.numM, fontWeight: 600, marginTop: 6, color: "#fff", letterSpacing: "-0.015em", ...T.num }}>
        {value}
      </div>
    </div>
  );
}

function SalaryGoal({ beneficioMes, salaryGoal, setSalaryGoal }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(salaryGoal);
  const pct = Math.min((beneficioMes / salaryGoal) * 100, 100);
  const reached = beneficioMes >= salaryGoal;
  const remaining = salaryGoal - beneficioMes;

  const save = () => {
    const v = Number(tmp) || 0;
    setSalaryGoal(v);
    try { localStorage.setItem("ga_salario", v); } catch {}
    setEditing(false);
  };

  return (
    <Card style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
      <div className="salary-head" style={{ marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <IconPill icon={Target} size={28} />
            <Label>Tu salario este mes</Label>
          </div>
          <h2 style={{ fontFamily: T.font, fontSize: TY.h2, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 0", color: T.ink, lineHeight: 1.25 }}>
            {reached ? "Has superado tu objetivo." : `Te quedan ${fmt(Math.max(remaining, 0))}.`}
          </h2>
          <p style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, margin: "4px 0 0" }}>
            Llevas {fmt(Math.max(beneficioMes, 0))} de los {fmt(salaryGoal)} que te has marcado.
          </p>
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="number" value={tmp} onChange={(e) => setTmp(e.target.value)} style={{ width: 100, padding: "7px 10px", borderRadius: 999, border: `1px solid ${T.ink}`, fontSize: 12, fontFamily: T.font, fontWeight: 600, outline: "none", textAlign: "center", ...T.num }} />
            <Btn size="sm" icon={Check} onClick={save}>Guardar</Btn>
          </div>
        ) : (
          <Btn variant="outline" size="sm" icon={Edit3} onClick={() => { setTmp(salaryGoal); setEditing(true); }}>Editar</Btn>
        )}
      </div>

      <div style={{ height: 12, background: "#f4f4f4", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 0)}%`, height: "100%", background: reached ? T.success : T.yellow, borderRadius: 999, transition: "width 1s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: T.font, fontSize: 12, fontWeight: 500, color: T.inkMuted, ...T.num }}>
        <span>0 €</span>
        <span style={{ color: T.ink, fontWeight: 600 }}>{Math.round(Math.max(pct, 0))}%</span>
        <span>{fmt(salaryGoal)}</span>
      </div>
    </Card>
  );
}

function FlujoCaja({ facturado, cobrado, pendiente }) {
  const cobradoPct = facturado > 0 ? (cobrado / facturado) * 100 : 0;
  return (
    <div className="grid-flow" style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
      <Card accent="yellow">
        <Label>Flujo de caja real</Label>
        <h2 style={{ fontFamily: T.font, fontSize: TY.h2, fontWeight: 700, letterSpacing: "-0.02em", margin: "10px 0 22px", color: T.ink, maxWidth: 360, lineHeight: 1.25 }}>
          {pendiente > 0 ? "Has facturado mucho, pero no todo está en tu cuenta." : "Todo lo facturado está cobrado."}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FlowRow label="Facturado" value={fmt(facturado)} pct={100} />
          <FlowRow label="Cobrado" value={fmt(cobrado)} pct={cobradoPct} />
          <FlowRow label="Pendiente" value={fmt(pendiente)} pct={100 - cobradoPct} italic />
        </div>
      </Card>
      <Card>
        <Label>Te falta cobrar</Label>
        <div style={{ fontFamily: T.font, fontSize: TY.heroCardNum, fontWeight: 700, letterSpacing: "-0.025em", margin: "12px 0 8px", color: T.ink, lineHeight: 1, ...T.num }}>
          {fmt(pendiente)}
        </div>
        <div style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, lineHeight: 1.5, marginBottom: 18, maxWidth: 280 }}>
          {Math.round(100 - cobradoPct)}% de lo facturado todavía no ha entrado en tu cuenta.
        </div>
        <Btn icon={ArrowUpRight}>Ver pendientes</Btn>
      </Card>
    </div>
  );
}

function FlowRow({ label, value, pct, italic }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: T.font, fontSize: TY.small, fontWeight: 600, color: T.ink, fontStyle: italic ? "italic" : "normal" }}>{label}</span>
        <span style={{ fontFamily: T.font, fontSize: TY.numM, fontWeight: 700, color: T.ink, letterSpacing: "-0.015em", ...T.num }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 0)}%`, height: "100%", background: T.ink, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function ChartIngresosVsGastos({ months }) {
  const max = Math.max(...months.flatMap((m) => [m.ing, m.gas]), 1);
  const chartH = 180;
  const barW = 22;
  const gap = 5;
  const groupGap = 36;
  const totalW = months.length * (barW * 2 + gap + groupGap) - groupGap;
  const totalIng = months.reduce((s, m) => s + m.ing, 0);
  const totalGas = months.reduce((s, m) => s + m.gas, 0);
  return (
    <Card style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
      <div className="chart-head" style={{ marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Label>Ingresos vs gastos</Label>
          <h2 style={{ fontFamily: T.font, fontSize: TY.h2, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 0", color: T.ink, lineHeight: 1.25 }}>
            ¿Cubren tus ingresos los gastos?
          </h2>
        </div>
        <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
          <LegendDot color={T.lavender} label="Ingresos" />
          <LegendDot color={T.ink} label="Gastos" />
        </div>
      </div>
      <div style={{ overflow: "auto", marginBottom: 22 }}>
        <svg width={Math.max(totalW + 16, 320)} height={chartH + 32} style={{ display: "block", fontFamily: T.font }}>
          {months.map((m, i) => {
            const x = i * (barW * 2 + gap + groupGap);
            const ingH = (m.ing / max) * chartH;
            const gasH = (m.gas / max) * chartH;
            return (
              <g key={i}>
                <rect x={x} y={chartH - ingH} width={barW} height={ingH} fill={T.lavender} rx={3} />
                <rect x={x + barW + gap} y={chartH - gasH} width={barW} height={gasH} fill={T.ink} rx={3} />
                <text x={x + barW + gap / 2} y={chartH + 20} fontSize="12" fontWeight="500" fill={T.inkMuted} textAnchor="middle">{m.mes}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid-chart-totals" style={{ paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
        <ChartTotal label="Total ingresos" value={fmt(totalIng)} color={T.ink} />
        <ChartTotal label="Total gastos" value={fmt(totalGas)} color={T.ink} />
        <ChartTotal label="Diferencia" value={fmt(totalIng - totalGas)} color={totalIng - totalGas >= 0 ? T.success : T.danger} />
      </div>
    </Card>
  );
}
function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: T.font }}>
      <span style={{ width: 9, height: 9, background: color, borderRadius: 3, display: "inline-block" }} />
      <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 500 }}>{label}</span>
    </div>
  );
}
function ChartTotal({ label, value, color }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ fontFamily: T.font, fontSize: TY.numM, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 4, color, ...T.num }}>{value}</div>
    </div>
  );
}

// ============================================================
// CLIENTES
// ============================================================
function Clientes({ clientes, ingresos, onRefresh }) {
  const [sel, setSel] = useState(null);
  const [del, setDel] = useState(null);
  const [updId, setUpdId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const addCliente = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await createRecord("Clientes", { Nombre: newName.trim() });
    setNewName(""); setShowAdd(false); setSaving(false); onRefresh();
  };
  const delFactura = async (id) => {
    setDel(id); await deleteRecord("Ingresos", id); await onRefresh(); setDel(null);
  };
  const cambiarEstado = async (id, nuevoEstado) => {
    setUpdId(id);
    const fields = { Estado: nuevoEstado };
    if (nuevoEstado === "Cobrada") fields["Fecha Cobro"] = hoy();
    await fetch(`${API}/${encodeURIComponent("Ingresos")}`, { method: "PATCH", headers: hdrs, body: JSON.stringify({ records: [{ id, fields }] }) });
    await onRefresh(); setUpdId(null);
  };

  const cd = clientes.map((c) => {
    const n = c.fields["Nombre"] || "Sin nombre";
    const fIds = c.fields["Ingresos"] || [];
    const fs = ingresos.filter((r) => fIds.includes(r.id));
    const totBase = fs.reduce((s, f) => s + (f.fields["Base Imponible"] || 0), 0);
    const totIrpf = fs.reduce((s, f) => s + (f.fields["IRPF (€)"] || 0), 0);
    const benefNeto = totBase - totIrpf;
    const p = fs.filter((f) => f.fields["Estado"] === "Pendiente").length;
    const v = fs.filter((f) => f.fields["Estado"] === "Vencida").length;
    return { id: c.id, nombre: n, fs, totBase, totIrpf, benefNeto, p, v };
  });

  const totales = {
    activos: cd.length,
    conVencidas: cd.filter((c) => c.v > 0).length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Clientes."
        subtitle={`${totales.activos} en total${totales.conVencidas > 0 ? ` · ${totales.conVencidas} con facturas vencidas` : " · todos al día"}.`}
        action={<Btn icon={Plus} onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Cancelar" : "Nuevo cliente"}</Btn>}
      />

      {showAdd && (
        <Card style={{ marginBottom: 16, border: `1px solid ${T.ink}` }}>
          <Label>Añadir cliente</Label>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del cliente" style={{ flex: 1, minWidth: 200, padding: "11px 14px", borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, fontWeight: 500, outline: "none" }} />
            <Btn onClick={addCliente} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Btn>
          </div>
        </Card>
      )}

      {cd.length === 0 && (
        <Card><p style={{ color: T.inkMuted, fontFamily: T.font, fontSize: TY.body, margin: 0 }}>No hay clientes todavía. Añade uno o se crearán automáticamente al subir facturas.</p></Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cd.map((c) => {
          const expanded = sel === c.id;
          const accentColor = c.v > 0 ? T.danger : c.p > 0 ? T.warning : T.success;
          return (
            <div key={c.id} style={{ background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, borderLeft: `4px solid ${accentColor}`, overflow: "hidden" }}>
              <div onClick={() => setSel(expanded ? null : c.id)} style={{ padding: "clamp(18px, 2.5vw, 24px)", cursor: "pointer" }}>
                <div className="cliente-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: "-0.01em" }}>{c.nombre}</div>
                    <div style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, marginTop: 4 }}>
                      {c.fs.length} factura{c.fs.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: T.font, fontSize: TY.numM, fontWeight: 700, color: T.ink, letterSpacing: "-0.015em", ...T.num }}>{fmt(c.totBase)}</div>
                    <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted, marginTop: 2, ...T.num }}>Neto: {fmt(c.benefNeto)}</div>
                  </div>
                  <ChevronRight size={18} strokeWidth={2} style={{ color: T.inkSoft, transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                </div>
                {(c.v > 0 || c.p > 0) && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {c.v > 0 && <StatusPill estado="Vencida" />}
                    {c.p > 0 && <StatusPill estado="Pendiente" />}
                  </div>
                )}
              </div>
              {expanded && c.fs.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "clamp(16px, 2.5vw, 20px)", background: "#fbfbfb" }}>
                  <div style={{ marginBottom: 10 }}><Label>Facturas</Label></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {c.fs.map((f) => {
                      const irpfF = f.fields["IRPF (€)"] || 0;
                      return (
                        <div key={f.id} className="factura-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface, padding: "12px 14px", borderRadius: 12, border: `1px solid ${T.border}`, gap: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 100 }}>
                            <span style={{ fontFamily: T.font, fontSize: 12, fontWeight: 700, color: T.ink, letterSpacing: "-0.005em" }}>{f.fields["Nº Factura"] || "—"}</span>
                            <span style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginTop: 2 }}>{f.fields["Fecha"] || "—"}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", textAlign: "right", minWidth: 90 }}>
                            <span style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, ...T.num }}>{fmt(f.fields["Base Imponible"])}</span>
                            <span style={{ fontFamily: T.font, fontSize: 11, color: T.inkMuted, marginTop: 2, ...T.num }}>IRPF {fmt(irpfF)}</span>
                          </div>
                          <select value={f.fields["Estado"] || "Pendiente"} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); cambiarEstado(f.id, e.target.value); }}
                            disabled={updId === f.id}
                            style={{ padding: "6px 26px 6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, fontSize: 11, fontFamily: T.font, fontWeight: 600, cursor: "pointer", background: "#fff", appearance: "none", backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Cobrada">Cobrada</option>
                            <option value="Vencida">Vencida</option>
                          </select>
                          <button onClick={(e) => { e.stopPropagation(); if (confirm("¿Borrar esta factura?")) delFactura(f.id); }} disabled={del === f.id} aria-label="Borrar"
                            style={{ background: T.dangerSoft, color: T.danger, border: "none", padding: 7, borderRadius: 999, cursor: "pointer", display: "flex", opacity: del === f.id ? 0.5 : 1 }}>
                            <Trash2 size={13} strokeWidth={2.25} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SIMULADOR
// ============================================================
function Simulador() {
  const [base, setBase] = useState(500);
  const iva = calcIVA(base);
  const irpf = calcIRPF(base);
  const total = base + iva - irpf;
  const limpio = base - irpf;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader title="Simulador." subtitle="Calcula cuánto te queda limpio antes de enviar el presupuesto." />

      <Card>
        <Label>Base imponible (sin IVA)</Label>
        <div style={{ fontFamily: T.font, fontSize: TY.display, fontWeight: 700, letterSpacing: "-0.035em", textAlign: "center", margin: "16px 0", color: T.ink, lineHeight: 1, ...T.num }}>
          {fmt(base)}
        </div>
        <input type="range" min="50" max="5000" step="10" value={base} onChange={(e) => setBase(Number(e.target.value))}
          style={{ width: "100%", accentColor: T.ink, marginBottom: 8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.font, fontSize: 11, fontWeight: 500, color: T.inkMuted, ...T.num }}>
          <span>50 €</span><span>5.000 €</span>
        </div>

        <div className="grid-sim" style={{ marginTop: 28 }}>
          <SimResult label="+ IVA 21%" value={fmt(iva)} color={T.success} />
          <SimResult label="− IRPF 15%" value={fmt(irpf)} color={T.danger} />
          <SimResult label="Total factura" value={fmt(total)} color={T.ink} />
          <SimResult label="Te queda limpio" value={fmt(limpio)} color="#fff" bg={T.ink} />
        </div>

        <div style={{ marginTop: 24, padding: "16px 18px", background: T.yellow, borderRadius: 12, fontFamily: T.font, fontSize: TY.small, color: T.ink, lineHeight: 1.5 }}>
          <strong>Nota:</strong> el "total factura" es lo que tu cliente te transferirá ({fmt(total)}). De ahí, {fmt(iva)} no es tuyo (lo declararás como IVA). Lo que realmente te queda son {fmt(limpio)}.
        </div>
      </Card>
    </div>
  );
}

function SimResult({ label, value, color, bg }) {
  return (
    <div style={{ background: bg || "rgba(0,0,0,0.03)", borderRadius: 16, padding: "18px 20px", textAlign: "center" }}>
      <div style={{ fontSize: TY.label, fontWeight: 600, fontFamily: T.font, textTransform: "uppercase", letterSpacing: "0.1em", color: bg ? "rgba(255,255,255,0.7)" : T.inkMuted }}>{label}</div>
      <div style={{ fontFamily: T.font, fontSize: TY.numL, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 6, color, ...T.num }}>{value}</div>
    </div>
  );
}

// ============================================================
// GASTOS
// ============================================================
function GastosView({ gastos, onRefresh, filtro, setFiltro }) {
  const [showF, setShowF] = useState(false);
  const [sav, setSav] = useState(false);
  const [delId, setDelId] = useState(null);
  const [form, setForm] = useState({ concepto: "", fecha: hoy(), base: "", iva: "", irpf: "", tipo: "", period: "" });

  const fg = applyF(gastos, filtro);
  // Lectura defensiva del campo Periodicidad por si Airtable tiene la variante con typo
  const getPeriod = (r) => r.fields["Periodicidad"] || r.fields["Perioricidad"] || "";
  const fijos = fg.filter((r) => ["Mensual", "Anual", "Trimestral"].includes(getPeriod(r)));
  const vars_ = fg.filter((r) => !["Mensual", "Anual", "Trimestral"].includes(getPeriod(r)));
  const tMes = fijos.reduce((s, r) => {
    const b = r.fields["Base Imponible"] || 0;
    const p = getPeriod(r);
    return s + (p === "Mensual" ? b : p === "Trimestral" ? b / 3 : p === "Anual" ? b / 12 : 0);
  }, 0);

  const save = async () => {
    if (!form.concepto || !form.base) return;
    setSav(true);
    const f = {
      Concepto: form.concepto,
      Fecha: form.fecha,
      "Base Imponible": Number(form.base) || 0,
      "IVA Soportado (€)": form.iva ? Number(form.iva) : Number(form.base) * 0.21,
    };
    if (form.irpf) f["IRPF Retenido (€)"] = Number(form.irpf);
    if (form.tipo) f["Tipo de Gasto"] = form.tipo;
    if (form.period) f["Periodicidad"] = form.period;
    await createRecord("Gastos", f);
    setForm({ concepto: "", fecha: hoy(), base: "", iva: "", irpf: "", tipo: "", period: "" });
    setShowF(false); setSav(false); onRefresh();
  };
  const del = async (id) => { setDelId(id); await deleteRecord("Gastos", id); await onRefresh(); setDelId(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Gastos."
        subtitle="Lo que pagas cada mes y lo que acumulas para el resto."
        action={<Btn icon={Plus} onClick={() => setShowF(!showF)}>{showF ? "Cancelar" : "Nuevo gasto"}</Btn>}
      />

      <FilterBar filtro={filtro} setFiltro={setFiltro} />
      <div style={{ height: "clamp(20px, 3vw, 28px)" }} />

      {showF && (
        <Card style={{ marginBottom: 20, border: `1px solid ${T.ink}` }}>
          <Label>Añadir gasto</Label>
          <div className="grid-2col" style={{ marginTop: 14 }}>
            <Inp label="Concepto" value={form.concepto} onChange={(v) => setForm({ ...form, concepto: v })} ph="Ej: Adobe Creative Cloud" />
            <Inp label="Fecha" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} type="date" />
            <Inp label="Base imponible (€)" value={form.base} onChange={(v) => setForm({ ...form, base: v })} type="number" ph="0" />
            <Inp label="IVA soportado (€)" value={form.iva} onChange={(v) => setForm({ ...form, iva: v })} type="number" ph="Auto: 21%" />
            <Inp label="IRPF retenido (€)" value={form.irpf} onChange={(v) => setForm({ ...form, irpf: v })} type="number" ph="Solo si proveedor autónomo" />
            <Sel label="Tipo de gasto" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} options={["Fijo", "Variable", "Impuesto"]} />
            <Sel label="Periodicidad" value={form.period} onChange={(v) => setForm({ ...form, period: v })} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
          </div>
          <Btn onClick={save} disabled={sav} size="lg" style={{ width: "100%", marginTop: 16 }}>{sav ? "Guardando..." : "Guardar gasto"}</Btn>
        </Card>
      )}

      {/* Hero "Aparta cada mes" */}
      <Card dark style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: T.lavender, display: "inline-block" }} />
          <Label color="rgba(255,255,255,0.55)">Aparta cada mes</Label>
        </div>
        <div style={{ fontFamily: T.font, fontSize: TY.display, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1, color: "#fff", ...T.num }}>{fmt(tMes)}</div>
        <p style={{ fontFamily: T.font, fontSize: TY.body, fontWeight: 400, color: "rgba(255,255,255,0.7)", margin: "12px 0 0", maxWidth: 460, lineHeight: 1.5 }}>
          Esta es la suma prorrateada de tus gastos fijos. Si la apartas mensualmente, los recibos no son sustos.
        </p>
      </Card>

      {fijos.length > 0 && (
        <Card style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
          <Label>Gastos fijos</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {fijos.map((g) => {
              const b = g.fields["Base Imponible"] || 0;
              const p = getPeriod(g);
              const m = p === "Mensual" ? b : p === "Trimestral" ? b / 3 : p === "Anual" ? b / 12 : b;
              return (
                <div key={g.id} className="gasto-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#fbfbfb", border: `1px solid ${T.border}`, borderRadius: 12, gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: T.font, fontWeight: 600, fontSize: 14, color: T.ink }}>{g.fields["Concepto"]}</div>
                    <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted, marginTop: 2 }}>{p}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 14, ...T.num }}>{fmt(b)}</div>
                      <div style={{ fontFamily: T.font, fontSize: 12, color: T.warning, fontWeight: 600, marginTop: 2, ...T.num }}>{fmt(m)}/mes</div>
                    </div>
                    <button onClick={() => { if (confirm("¿Borrar este gasto?")) del(g.id); }} disabled={delId === g.id} aria-label="Borrar"
                      style={{ background: T.dangerSoft, color: T.danger, border: "none", padding: 8, borderRadius: 999, cursor: "pointer", display: "flex", opacity: delId === g.id ? 0.5 : 1 }}>
                      <Trash2 size={13} strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {vars_.length > 0 && (
        <Card>
          <Label>Gastos variables</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {vars_.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#fbfbfb", border: `1px solid ${T.border}`, borderRadius: 12, gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: T.font, fontWeight: 600, fontSize: 14, color: T.ink }}>{g.fields["Concepto"]}</div>
                  <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted, marginTop: 2 }}>{g.fields["Fecha"] || ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: 14, ...T.num }}>{fmt(g.fields["Base Imponible"])}</div>
                  <button onClick={() => { if (confirm("¿Borrar este gasto?")) del(g.id); }} disabled={delId === g.id} aria-label="Borrar"
                    style={{ background: T.dangerSoft, color: T.danger, border: "none", padding: 8, borderRadius: 999, cursor: "pointer", display: "flex", opacity: delId === g.id ? 0.5 : 1 }}>
                    <Trash2 size={13} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fijos.length === 0 && vars_.length === 0 && (
        <Card><p style={{ color: T.inkMuted, fontFamily: T.font, fontSize: TY.body, margin: 0 }}>No hay gastos en este filtro.</p></Card>
      )}
    </div>
  );
}

// ============================================================
// CUOTA AUTÓNOMOS
// ============================================================
function CuotaAut({ ingresos, gastos, tramos }) {
  const [ca, setCa] = useState(() => { try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; } });
  const [editing, setEditing] = useState(false);
  const [tmpCa, setTmpCa] = useState(ca);

  const tI = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tG = gastos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const ms = Math.max(new Date().getMonth() + 1, 1);
  const rn = ((tI - tG - ca * ms) * 0.93) / ms;

  const td = tramos.map((r) => ({
    tramo: r.fields["Tramo"] || 0,
    min: r.fields["Rend. Neto Mín"] || r.fields["Rend Neto Min"] || 0,
    max: r.fields["Rend. Neto Máx"] || r.fields["Rend Neto Max"] || 0,
    cuota: r.fields["Cuota Mínima"] || r.fields["Cuota Minima"] || 0,
  })).sort((a, b) => a.tramo - b.tramo);

  const tr = rn <= 0
    ? td[0] || { tramo: 1, min: 0, max: 670, cuota: 200 }
    : td.find((t) => rn >= t.min && rn < t.max) || td[0] || { tramo: 1, min: 0, max: 670, cuota: 200 };
  const dif = tr.cuota - ca;

  const saveCuota = () => {
    const v = Number(tmpCa) || 0;
    setCa(v);
    try { localStorage.setItem("ga_cuota", v); } catch {}
    setEditing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader title="Cuota de autónomos." subtitle="Tu tramo según el rendimiento neto del ejercicio." />

      <Card style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
        <div className="cuota-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <Label>Tu cuota actual</Label>
            <p style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, margin: "6px 0 0" }}>Lo que pagas cada mes a la Seguridad Social.</p>
          </div>
          {editing ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" value={tmpCa} onChange={(e) => setTmpCa(e.target.value)} style={{ width: 110, padding: "9px 12px", borderRadius: 999, border: `1px solid ${T.ink}`, fontSize: 14, fontFamily: T.font, fontWeight: 700, outline: "none", textAlign: "center", ...T.num }} />
              <Btn size="sm" icon={Check} onClick={saveCuota}>Guardar</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontFamily: T.font, fontSize: TY.numL, fontWeight: 700, color: T.ink, letterSpacing: "-0.02em", ...T.num }}>{fmt(ca)}/mes</div>
              <Btn variant="outline" size="sm" icon={Edit3} onClick={() => { setTmpCa(ca); setEditing(true); }}>Editar</Btn>
            </div>
          )}
        </div>
      </Card>

      <Card dark style={{ marginBottom: "clamp(20px, 3vw, 28px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: T.yellow, display: "inline-block" }} />
          <Label color="rgba(255,255,255,0.55)">Rendimiento neto mensual estimado</Label>
        </div>
        <div style={{ fontFamily: T.font, fontSize: TY.display, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1, color: "#fff", ...T.num }}>{fmt(rn)}</div>
        <div className="grid-cuota-info" style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <CuotaInfo label="Tramo" value={tr.tramo} />
          <CuotaInfo label="Cuota correcta" value={fmt(tr.cuota)} />
          <CuotaInfo label="Rango neto" value={`${fmt(tr.min)} – ${tr.max < 99999 ? fmt(tr.max) : "+6.000 €"}`} />
        </div>
      </Card>

      {dif !== 0 && Math.abs(dif) >= 1 && (
        <div style={{ background: dif > 0 ? T.dangerSoft : T.successSoft, border: `1px solid ${dif > 0 ? T.danger : T.success}33`, borderRadius: 16, padding: "18px 22px", color: dif > 0 ? T.danger : T.success, marginBottom: "clamp(20px, 3vw, 28px)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ marginTop: 1 }}>{dif > 0 ? <AlertTriangle size={20} strokeWidth={2} /> : <CheckCircle2 size={20} strokeWidth={2} />}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font, fontWeight: 700, fontSize: TY.body }}>
                {dif > 0 ? "Estás pagando de menos." : "Estás pagando de más."}
              </div>
              <div style={{ fontFamily: T.font, fontSize: TY.small, marginTop: 4, fontWeight: 500 }}>
                {dif > 0
                  ? `Según tu rendimiento, tu tramo te marca ${fmt(tr.cuota)}/mes. Diferencia: ${fmt(dif)}/mes.`
                  : `Podrías ahorrar ${fmt(Math.abs(dif))}/mes ajustando tu base de cotización.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {td.length > 0 && (
        <Card>
          <Label>Tramos 2026</Label>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.font, fontSize: TY.small, minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: T.font, fontSize: TY.label, fontWeight: 600, color: T.inkMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Tramo</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontFamily: T.font, fontSize: TY.label, fontWeight: 600, color: T.inkMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Rend. neto</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontFamily: T.font, fontSize: TY.label, fontWeight: 600, color: T.inkMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cuota</th>
                </tr>
              </thead>
              <tbody>
                {td.map((t) => {
                  const active = t.tramo === tr.tramo;
                  return (
                    <tr key={t.tramo} style={{ background: active ? T.yellow + "44" : "transparent", fontWeight: active ? 700 : 500, borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 12px", color: T.ink, ...T.num }}>{active ? "→ " : ""}{t.tramo}</td>
                      <td style={{ padding: "10px 12px", color: T.ink, ...T.num }}>{fmt(t.min)} – {t.max < 99999 ? fmt(t.max) : "+6.000 €"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: active ? T.ink : T.inkMuted, ...T.num }}>{fmt(t.cuota)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// OCR (logic preserved, visual redesigned)
// ============================================================
const VK = import.meta.env.VITE_GOOGLE_VISION_KEY;
let pdfLib = null;
async function loadPdf() {
  if (pdfLib) return pdfLib;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  document.head.appendChild(s);
  await new Promise((r, j) => { s.onload = r; s.onerror = j; });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfLib = window.pdfjsLib;
  return pdfLib;
}
async function pdf2img(buf) {
  const lib = await loadPdf();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const pg = await pdf.getPage(1);
  const vp = pg.getViewport({ scale: 2.5 });
  const c = document.createElement("canvas");
  c.width = vp.width; c.height = vp.height;
  await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return c.toDataURL("image/png").split(",")[1];
}
async function ocr(b64) {
  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VK}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: "TEXT_DETECTION", maxResults: 1 }] }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.responses?.[0]?.fullTextAnnotation?.text || "";
}
function parseF(text) {
  const t = text.replace(/\r/g, "");
  const lines = t.split("\n").map((l) => l.trim()).filter((l) => l);
  const num = (t.match(/(?:factura|fra)[:\s]*\n?\s*([A-Z0-9][\w\-\/]*\d+)/i) || t.match(/(?:nº|n°)[:\s]*\s*([A-Z0-9][\w\-\/]+)/i) || [])[1] || "";
  const fM = t.match(/(?:fecha(?:\s+de\s+factura)?)[:\s]*\n?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i) || t.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
  const fecha = fM ? fM[1] : "";
  const cifM = t.match(/(\d{8}[A-Z])/);
  const cif = cifM ? cifM[0] : "";
  let base = 0, iva = 0, irpf = 0, total = 0;
  const amounts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^-?([0-9]+[.,]\d{2})\s*€$/);
    if (m) {
      const v = m[1].replace(/\./g, "").replace(",", ".");
      amounts.push({ idx: i, val: parseFloat(v), line: lines[i] });
    }
  }
  const findLine = (kw) => { for (let i = 0; i < lines.length; i++) { if (lines[i].toLowerCase().includes(kw.toLowerCase())) return i; } return -1; };
  const subIdx = findLine("Subtotal");
  if (subIdx >= 0) {
    const subAmounts = amounts.filter((a) => a.idx > subIdx);
    if (subAmounts.length >= 1) base = subAmounts[0].val;
    if (subAmounts.length >= 2) iva = subAmounts[1].val;
    if (subAmounts.length >= 3) irpf = subAmounts[2].val;
    if (subAmounts.length >= 4) total = subAmounts[3].val;
  } else {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/subtotal|base\s*imponible/i.test(l)) { const m = l.match(/([0-9.,]+)\s*€/); if (m) base = parseFloat(m[1].replace(/\./g, "").replace(",", ".")); }
      if (/^iva/i.test(l)) { const m = l.match(/([0-9.,]+)\s*€/); if (m) iva = parseFloat(m[1].replace(/\./g, "").replace(",", ".")); }
      if (/irpf/i.test(l)) { const m = l.match(/([0-9.,]+)\s*€/); if (m) irpf = parseFloat(m[1].replace(/\./g, "").replace(",", ".")); }
      if (/^total$/i.test(l.replace(/\s/g, ""))) { if (i + 1 < lines.length) { const m = lines[i + 1].match(/([0-9.,]+)\s*€/); if (m) total = parseFloat(m[1].replace(/\./g, "").replace(",", ".")); } }
    }
  }
  const clM = t.match(/Para\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/);
  let cliente = clM ? clM[1].trim().split("\n")[0].trim() : "";
  if (cliente.length > 60) cliente = cliente.substring(0, 60);
  const dsM = t.match(/(?:ESTRATEGIA|CONTENIDO|Descripci[oó]n)[:\s+]*([^\n]*)/i);
  let desc = dsM ? dsM[1].trim() : "";
  if (!desc) { const di = findLine("ESTRATEGIA"); if (di >= 0) desc = lines[di]; }
  return { numero: num, fecha, cliente, cif, base, iva, irpf, total, desc };
}
function convD(d) {
  if (!d) return "";
  const p = d.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!p) return d;
  let [, dy, mo, yr] = p;
  if (yr.length === 2) yr = "20" + yr;
  return `${yr}-${mo.padStart(2, "0")}-${dy.padStart(2, "0")}`;
}

function OCRView({ onRefresh }) {
  const [drag, setDrag] = useState(false);
  const [proc, setProc] = useState(false);
  const [mode, setMode] = useState("choose");
  const [res, setRes] = useState(null);
  const [tipo, setTipo] = useState("ingreso");
  const [sav, setSav] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const [numero, sNumero] = useState("");
  const [fecha, sFecha] = useState(hoy());
  const [cliente, sCliente] = useState("");
  const [cif, sCif] = useState("");
  const [base, sBase] = useState("");
  const [iva, sIva] = useState("");
  const [irpf, sIrpf] = useState("");
  const [total, sTotal] = useState("");
  const [desc, sDesc] = useState("");
  const [estado, sEstado] = useState("Pendiente");
  const [fechaV, sFechaV] = useState("");
  const [fechaC, sFechaC] = useState("");
  const [concepto, sConcepto] = useState("");
  const [tipoG, sTipoG] = useState("");
  const [period, sPeriod] = useState("Puntual");
  const [irpfG, sIrpfG] = useState("");

  const reset = () => {
    sNumero(""); sFecha(hoy()); sCliente(""); sCif(""); sBase(""); sIva(""); sIrpf(""); sTotal("");
    sDesc(""); sEstado("Pendiente"); sFechaV(""); sFechaC(""); sConcepto(""); sTipoG("");
    sPeriod("Puntual"); sIrpfG(""); setSaved(false); setErr(""); setRes(null);
  };

  const handleFile = async (file) => {
    reset(); setProc(true); setMode("ocr");
    try {
      let b64;
      if (file.type === "application/pdf") {
        b64 = await pdf2img(await file.arrayBuffer());
      } else {
        const du = await new Promise((r, j) => {
          const rd = new FileReader();
          rd.onload = () => r(rd.result);
          rd.onerror = j;
          rd.readAsDataURL(file);
        });
        b64 = du.split(",")[1];
      }
      const text = await ocr(b64);
      if (!text) { setErr("No se pudo leer el documento."); setProc(false); return; }
      const p = parseF(text);
      setRes(p);
      sNumero(p.numero); sFecha(convD(p.fecha)); sCliente(p.cliente); sCif(p.cif);
      sBase(String(p.base || "")); sIva(String(p.iva || "")); sIrpf(String(p.irpf || ""));
      sTotal(String(p.total || "")); sDesc(p.desc); sConcepto(p.desc);
    } catch (e) {
      setErr("Error: " + e.message);
    }
    setProc(false);
  };

  const handleSave = async () => {
    setSav(true); setErr("");
    try {
      if (tipo === "ingreso") {
        const f = { "Nº Factura": numero || "", "Base Imponible": Number(base) || 0, Estado: estado || "Pendiente" };
        if (fecha) f["Fecha"] = fecha;
        if (fechaV) f["Fecha Vencimiento"] = fechaV;
        if (fechaC) f["Fecha Cobro"] = fechaC;
        if (cliente && cliente.trim()) {
          const cId = await findOrCreateClient(cliente.trim());
          if (cId) f["Cliente"] = [cId];
        }
        await createRecord("Ingresos", f);
      } else {
        const f = { Concepto: concepto || desc || "Gasto", "Base Imponible": Number(base) || 0, "IVA Soportado (€)": Number(iva) || (Number(base) * 0.21) || 0 };
        if (irpfG) f["IRPF Retenido (€)"] = Number(irpfG);
        if (fecha) f["Fecha"] = fecha;
        if (tipoG) f["Tipo de Gasto"] = tipoG;
        if (period) f["Periodicidad"] = period;
        await createRecord("Gastos", f);
      }
      setSaved(true);
      onRefresh();
    } catch (e) {
      setErr("Error: " + e.message);
    }
    setSav(false);
  };

  const ready = (mode === "ocr" && res && !proc) || mode === "manual";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Nueva factura."
        subtitle={tipo === "ingreso" ? "Sube tu factura emitida y se rellenará sola." : "Sube un ticket o gasto y se rellenará solo."}
      />

      {/* Toggle tipo */}
      <div style={{ display: "flex", gap: 6, padding: 4, background: "#f4f4f4", borderRadius: 999, marginBottom: 16, width: "fit-content" }}>
        <ToggleBtn active={tipo === "ingreso"} onClick={() => { setTipo("ingreso"); reset(); setMode("choose"); }}>Factura emitida</ToggleBtn>
        <ToggleBtn active={tipo === "gasto"} onClick={() => { setTipo("gasto"); reset(); setMode("choose"); }}>Ticket / gasto</ToggleBtn>
      </div>

      {/* Toggle modo */}
      {!saved && (
        <div style={{ display: "flex", gap: 6, padding: 4, background: "#f4f4f4", borderRadius: 999, marginBottom: 20, width: "fit-content" }}>
          <ToggleBtn active={mode !== "manual"} onClick={() => { setMode("choose"); reset(); }} icon={ScanLine}>Escanear</ToggleBtn>
          <ToggleBtn active={mode === "manual"} onClick={() => { setMode("manual"); reset(); }} icon={FileText}>Manual</ToggleBtn>
        </div>
      )}

      {/* Dropzone */}
      {(mode === "choose" || mode === "ocr") && !res && !saved && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,.pdf"; i.onchange = (e) => { const f = e.target.files[0]; if (f) handleFile(f); }; i.click(); }}
          style={{
            background: drag ? T.yellow + "33" : T.surface,
            border: `2px dashed ${drag ? T.ink : T.border}`,
            borderRadius: 20,
            padding: proc ? 40 : 56,
            textAlign: "center",
            cursor: proc ? "default" : "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {proc ? (
            <>
              <div style={{ width: 32, height: 32, border: `3px solid ${T.border}`, borderTopColor: T.ink, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontFamily: T.font, fontSize: TY.body, fontWeight: 600, color: T.ink }}>Leyendo documento…</div>
            </>
          ) : (
            <>
              <div style={{ display: "inline-flex", padding: 14, background: "#f4f4f4", borderRadius: 999, marginBottom: 16 }}>
                <Upload size={22} strokeWidth={1.75} color={T.ink} />
              </div>
              <div style={{ fontFamily: T.font, fontSize: TY.body, fontWeight: 600, color: T.ink }}>
                Arrastra {tipo === "ingreso" ? "tu factura" : "tu ticket"} aquí
              </div>
              <div style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, marginTop: 4 }}>
                O haz clic para seleccionar. Acepta PDF e imagen.
              </div>
            </>
          )}
        </div>
      )}

      {err && (
        <div style={{ background: T.dangerSoft, color: T.danger, padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} strokeWidth={2.25} />{err}
        </div>
      )}

      {ready && !saved && (
        <Card style={{ marginTop: 16, border: `1px solid ${mode === "ocr" ? T.success : T.ink}` }}>
          <Label color={mode === "ocr" ? T.success : T.ink}>
            {mode === "ocr" ? "Revisa y corrige" : "Introducir datos"}
          </Label>
          {tipo === "ingreso" ? (
            <div className="grid-2col" style={{ marginTop: 14 }}>
              <Inp label="Nº factura" value={numero} onChange={sNumero} ph="F00012026" />
              <Inp label="Fecha" value={fecha} onChange={sFecha} type="date" />
              <Inp label="Cliente" value={cliente} onChange={sCliente} ph="Nombre del cliente" />
              <Inp label="CIF / NIF" value={cif} onChange={sCif} ph="12345678A" />
              <Inp label="Base imponible (€)" value={base} onChange={sBase} type="number" ph="0" />
              <Inp label="IVA (€)" value={iva} onChange={sIva} type="number" ph="Auto: 21%" />
              <Inp label="IRPF (€)" value={irpf} onChange={sIrpf} type="number" ph="Auto: 15%" />
              <Inp label="Total (€)" value={total} onChange={sTotal} type="number" />
              <Sel label="Estado" value={estado} onChange={sEstado} options={["Cobrada", "Pendiente", "Vencida"]} />
              <Inp label="Fecha vencimiento" value={fechaV} onChange={sFechaV} type="date" />
              <Inp label="Fecha cobro" value={fechaC} onChange={sFechaC} type="date" />
            </div>
          ) : (
            <div className="grid-2col" style={{ marginTop: 14 }}>
              <Inp label="Concepto" value={concepto} onChange={sConcepto} ph="Ej: Material oficina" />
              <Inp label="Fecha" value={fecha} onChange={sFecha} type="date" />
              <Inp label="Base imponible (€)" value={base} onChange={sBase} type="number" ph="0" />
              <Inp label="IVA soportado (€)" value={iva} onChange={sIva} type="number" ph="Auto: 21%" />
              <Inp label="IRPF retenido (€)" value={irpfG} onChange={sIrpfG} type="number" ph="Si proveedor autónomo" />
              <Sel label="Tipo de gasto" value={tipoG} onChange={sTipoG} options={["Fijo", "Variable", "Impuesto"]} />
              <Sel label="Periodicidad" value={period} onChange={sPeriod} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
            </div>
          )}
          <Btn onClick={handleSave} disabled={sav} size="lg" style={{ width: "100%", marginTop: 16 }}>
            {sav ? "Guardando…" : tipo === "ingreso" ? "Guardar factura" : "Guardar gasto"}
          </Btn>
        </Card>
      )}

      {saved && (
        <Card style={{ marginTop: 16, border: `1px solid ${T.success}`, textAlign: "center" }}>
          <div style={{ display: "inline-flex", padding: 14, background: T.successSoft, borderRadius: 999, marginBottom: 14 }}>
            <Check size={26} strokeWidth={2.5} color={T.success} />
          </div>
          <div style={{ fontFamily: T.font, fontSize: TY.h2, fontWeight: 700, color: T.ink, letterSpacing: "-0.02em" }}>
            {tipo === "ingreso" ? "Factura guardada." : "Gasto guardado."}
          </div>
          <p style={{ fontFamily: T.font, fontSize: TY.small, color: T.inkMuted, margin: "6px 0 18px" }}>
            Ya está reflejado en tu Airtable.
          </p>
          <Btn onClick={() => { reset(); setMode("choose"); }}>Añadir otro</Btn>
        </Card>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, children, icon: Icon }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px",
      borderRadius: 999,
      border: "none",
      background: active ? T.surface : "transparent",
      color: T.ink,
      fontFamily: T.font,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      transition: "all 0.15s ease",
    }}>
      {Icon && <Icon size={13} strokeWidth={2} />}
      {children}
    </button>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [auth, setAuth] = useState(() => { try { return localStorage.getItem("ga_auth") === "1"; } catch { return false; } });
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ingresos, setI] = useState([]);
  const [gastos, setG] = useState([]);
  const [clientes, setC] = useState([]);
  const [tramos, setT] = useState([]);
  const [salObj, setSalObj] = useState(() => { try { return Number(localStorage.getItem("ga_salario")) || 2500; } catch { return 2500; } });
  const [filtro, setFiltro] = useState({ year: String(new Date().getFullYear()), tri: "", mes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, g, c, , t] = await Promise.all([
        fetchTable("Ingresos"),
        fetchTable("Gastos"),
        fetchTable("Clientes"),
        fetchTable("Resumen Trimestral"),
        fetchTable("Tramos de Cotización"),
      ]);
      setI(i); setG(g); setC(c); setT(t);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { if (auth) load(); }, [auth, load]);

  const onLogout = () => { try { localStorage.removeItem("ga_auth"); } catch {} ; setAuth(false); };

  if (!auth) return <Login onLogin={() => setAuth(true)} />;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
      <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${T.border}`, borderTopColor: T.ink, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: T.inkMuted, fontWeight: 500 }}>Cargando tu negocio…</div>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard ingresos={ingresos} gastos={gastos} salObj={salObj} setSalObj={setSalObj} filtro={filtro} setFiltro={setFiltro} />;
      case "clientes": return <Clientes clientes={clientes} ingresos={ingresos} onRefresh={load} />;
      case "simulador": return <Simulador />;
      case "gastos": return <GastosView gastos={gastos} onRefresh={load} filtro={filtro} setFiltro={setFiltro} />;
      case "autonomo": return <CuotaAut ingresos={ingresos} gastos={gastos} tramos={tramos} />;
      case "ocr": return <OCRView onRefresh={load} />;
      default: return <Dashboard ingresos={ingresos} gastos={gastos} salObj={salObj} setSalObj={setSalObj} filtro={filtro} setFiltro={setFiltro} />;
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: T.font, color: T.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:hover { opacity: 0.85; transition: opacity 0.15s ease; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .grid-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 960px) { .grid-kpi { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .grid-kpi { grid-template-columns: 1fr; gap: 10px; } }

        .grid-flow { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; }
        @media (max-width: 760px) { .grid-flow { grid-template-columns: 1fr; } }

        .grid-iva-breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        @media (max-width: 540px) { .grid-iva-breakdown { grid-template-columns: 1fr; gap: 14px; } }

        .grid-cuota-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        @media (max-width: 540px) { .grid-cuota-info { grid-template-columns: 1fr; gap: 14px; } }

        .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 540px) { .grid-2col { grid-template-columns: 1fr; } }

        .grid-sim { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 540px) { .grid-sim { grid-template-columns: 1fr; } }

        .salary-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        @media (max-width: 540px) { .salary-head { flex-direction: column; } }

        .chart-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        @media (max-width: 540px) { .chart-head { flex-direction: column; gap: 12px; } }

        .grid-chart-totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 540px) { .grid-chart-totals { grid-template-columns: 1fr; gap: 14px; } }

        .cliente-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        @media (max-width: 480px) { .cliente-head { flex-wrap: wrap; } }

        .cuota-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
        @media (max-width: 540px) { .cuota-row { flex-direction: column; align-items: flex-start; } }

        @media (max-width: 720px) { .header-date { display: none !important; } }
      `}</style>

      <Header onMenuToggle={() => setOpen(!open)} onLogout={onLogout} />
      <Sidebar open={open} page={page} setPage={setPage} onClose={() => setOpen(false)} />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 3vw, 32px) 48px" }}>
        {renderPage()}
      </main>
    </div>
  );
}
