// src/utils.js
// Helpers, constantes y estilos compartidos.

// ============================================================
// FORMATEO Y CÁLCULOS
// ============================================================
export const fmt = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

export const calcIVA = (b) => (b || 0) * 0.21;
export const calcIRPF = (b) => (b || 0) * 0.15;

export const hoy = () => new Date().toISOString().split("T")[0];

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const diasEntre = (a, b) => {
  try {
    return Math.floor((new Date(b) - new Date(a)) / 86400000);
  } catch {
    return 0;
  }
};

export function getTrimestre(f) {
  if (!f) return "";
  const m = new Date(f).getMonth();
  return m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4";
}

// Convierte fecha DD/MM/YYYY o DD-MM-YY a YYYY-MM-DD (formato ISO de Airtable)
export function convD(d) {
  if (!d) return "";
  const p = d.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!p) return d;
  let [, dy, mo, yr] = p;
  if (yr.length === 2) yr = "20" + yr;
  return `${yr}-${mo.padStart(2, "0")}-${dy.padStart(2, "0")}`;
}

// Filtrar registros por año/trimestre/mes
export function applyF(recs, filtro, df = "Fecha") {
  return recs.filter(r => {
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
// PALETA DE COLORES Y ESTILOS BASE
// ============================================================
export const B = {
  bg: "linear-gradient(160deg, #f0e991 0%, #FAFAFA 45%, #b1b8f4 100%)",
  card: "rgba(255,255,255,0.75)",
  border: "rgba(0,0,0,0.07)",
  text: "#111",
  muted: "#555",
  purple: "#6e72b8",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  yellow: "#f0e991",
  tM: "'Roboto Mono', monospace",
  tS: "'Work Sans', sans-serif",

  btn: {
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Roboto Mono', monospace",
    textTransform: "uppercase",
    letterSpacing: "0.06em"
  },
  btnSm: {
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontWeight: 700,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "'Roboto Mono', monospace",
    textTransform: "uppercase",
    letterSpacing: "0.06em"
  },
  btnDel: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    fontWeight: 700,
    fontSize: 10,
    cursor: "pointer",
    fontFamily: "'Roboto Mono', monospace",
    textTransform: "uppercase"
  },
  inp: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 6,
    border: "2px solid rgba(0,0,0,0.1)",
    background: "#fff",
    color: "#111",
    fontSize: 14,
    fontFamily: "'Work Sans', sans-serif",
    outline: "none",
    boxSizing: "border-box"
  }
};

// ============================================================
// MENÚ PRINCIPAL
// ============================================================
export const MENU = [
  { id: "dashboard", label: "DASHBOARD" },
  { id: "facturas", label: "FACTURAS" },
  { id: "clientes", label: "CLIENTES" },
  { id: "gastos", label: "GASTOS" },
  { id: "gastosfijos", label: "GASTOS FIJOS" },
  { id: "alertas", label: "ALERTAS" },
  { id: "simulador", label: "SIMULADOR" },
  { id: "autonomo", label: "CUOTA AUTÓNOMOS" }
];

// ============================================================
// BREAKPOINTS RESPONSIVE
// ============================================================
export const BREAKPOINTS = {
  xxl: 2400,  // Desktop extra-grande
  xl: 1366,   // Laptop estándar
  lg: 900,    // Tablet horizontal
  md: 750,    // Tablet vertical
  sm: 550     // Móvil
};
