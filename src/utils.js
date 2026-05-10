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
// PALETA DE COLORES Y ESTILOS BASE — REDISEÑO 2026
// Minimalista: blanco/negro + amarillo y lavanda como acentos.
// ============================================================
export const B = {
  // Colores base
  bg: "#fafafa",                         // fondo blanco roto (antes: gradiente pastel)
  surface: "#ffffff",                    // superficies de cards
  card: "#ffffff",                       // alias para retrocompatibilidad
  border: "#ececec",                     // bordes sutiles (antes: rgba(0,0,0,0.07))
  text: "#000000",                       // negro puro (antes: #111)
  muted: "#6b6b6b",                      // texto secundario (antes: #555)
  soft: "#a3a3a3",                       // texto terciario / footer

  // Acentos
  yellow: "#f0e991",                     // amarillo de marca
  lavender: "#b1b8f4",                   // lavanda de marca
  purple: "#6e72b8",                     // púrpura (mantener para compatibilidad)

  // Semáforo (más sobrio)
  green: "#2f7a4f",                      // verde sobrio (antes: #16a34a)
  red: "#c14545",                        // rojo sobrio (antes: #dc2626)
  amber: "#d97706",                      // ámbar (sin cambio)

  // Tipografía: SOLO Work Sans
  tS: "'Work Sans', system-ui, sans-serif",   // body y todo
  tM: "'Work Sans', system-ui, sans-serif",   // alias para retrocompatibilidad (antes era Roboto Mono)

  // Números tabulares (alineación impecable)
  num: { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' },

  // BOTONES — pills redondeados (antes: rectángulos)
  btn: {
    background: "#000000",
    color: "#ffffff",
    border: "none",
    borderRadius: 999,
    padding: "11px 20px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Work Sans', system-ui, sans-serif",
    letterSpacing: "0.01em",
    transition: "opacity 0.15s ease"
  },
  btnSm: {
    background: "#000000",
    color: "#ffffff",
    border: "none",
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Work Sans', system-ui, sans-serif",
    letterSpacing: "0.01em",
    transition: "opacity 0.15s ease"
  },
  btnDel: {
    background: "transparent",
    color: "#c14545",
    border: "1px solid #c14545",
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 600,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "'Work Sans', system-ui, sans-serif",
    letterSpacing: "0.01em"
  },
  // INPUTS — bordes finos y radio mayor
  inp: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #ececec",
    background: "#ffffff",
    color: "#000000",
    fontSize: 14,
    fontFamily: "'Work Sans', system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease"
  },

  // CARDS — blancas planas con borde sutil (antes glassmorphism)
  cardStyle: {
    background: "#ffffff",
    borderRadius: 20,
    border: "1px solid #ececec",
    padding: "clamp(20px, 3vw, 28px)"
  },

  // Escala tipográfica fluida (clamp)
  ty: {
    display: "clamp(32px, 4.5vw, 44px)",   // hero numbers
    h1: "clamp(24px, 3.5vw, 32px)",        // títulos grandes
    h1Sub: "clamp(14px, 1.5vw, 16px)",     // subtítulos
    h2: "clamp(17px, 2vw, 20px)",          // títulos sección
    numL: "clamp(22px, 2.6vw, 28px)",      // KPI
    numM: "clamp(17px, 1.9vw, 20px)",      // breakdown
    body: "15px",
    small: "14px",
    label: "12px"
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
  xxl: 2400,
  xl: 1366,
  lg: 900,
  md: 750,
  sm: 550
};
