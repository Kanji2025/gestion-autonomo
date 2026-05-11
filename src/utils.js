// src/utils.js
// Helpers, constantes y estilos compartidos.
// REDISEÑO 2026: minimalista blanco/negro + Work Sans único.

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

// Día y mes legibles (para saludos)
export function todayLong() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export function mesActualLabel() {
  return MESES_FULL[new Date().getMonth()].toLowerCase();
}

// Fechas oficiales del IVA (modelo 303)
export function ivaDeadline(quarter, year) {
  const map = {
    Q1: `20 de abril de ${year}`,
    Q2: `20 de julio de ${year}`,
    Q3: `20 de octubre de ${year}`,
    Q4: `30 de enero de ${Number(year) + 1}`,
  };
  return map[quarter] || "";
}

// ============================================================
// PALETA Y TOKENS DE DISEÑO
// Minimalista: blanco/negro + amarillo y lavanda como acentos.
// ============================================================
export const B = {
  // Colores base
  bg: "#fafafa",
  surface: "#ffffff",
  card: "#ffffff",                       // alias retrocompatibilidad
  border: "#ececec",
  text: "#000000",
  ink: "#000000",                        // alias semántico
  muted: "#6b6b6b",
  inkMuted: "#6b6b6b",                   // alias
  soft: "#a3a3a3",
  inkSoft: "#a3a3a3",                    // alias

  // Acentos de marca
  yellow: "#f0e991",
  lavender: "#b1b8f4",
  purple: "#6e72b8",                     // mantener para retrocompatibilidad

  // Semáforo (versión sobria + soft para fondos)
  green: "#2f7a4f",
  greenSoft: "#e8f3ec",
  success: "#2f7a4f",                    // alias
  successSoft: "#e8f3ec",                // alias
  red: "#c14545",
  redSoft: "#f7e8e8",
  danger: "#c14545",                     // alias
  dangerSoft: "#f7e8e8",                 // alias
  amber: "#b87333",
  amberSoft: "#f7ede0",
  warning: "#b87333",                    // alias
  warningSoft: "#f7ede0",                // alias

  // Tipografía: Work Sans único
  font: "'Work Sans', system-ui, sans-serif",
  tS: "'Work Sans', system-ui, sans-serif",   // body
  tM: "'Work Sans', system-ui, sans-serif",   // alias retrocompatibilidad

  // Números tabulares (alineación impecable)
  num: { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' },

  // Escala tipográfica fluida (clamp)
ty: {
    display: "clamp(26px, 2.8vw, 32px)",
    h1: "clamp(22px, 2.5vw, 27px)",
    h1Sub: "clamp(13px, 1.4vw, 15px)",
    heroCardNum: "clamp(20px, 2.4vw, 26px)",
    h2: "clamp(16px, 1.8vw, 19px)",
    numL: "clamp(19px, 2.1vw, 23px)",
    numM: "clamp(15px, 1.7vw, 17px)",
    body: "15px",
    small: "13px",
    label: "11px"
  },

  // BOTONES — pills redondeados
  btn: {
    background: "#000000",
    color: "#ffffff",
    border: "1px solid transparent",
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'Work Sans', system-ui, sans-serif",
    letterSpacing: "0.005em",
    transition: "opacity 0.15s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap"
  },
  btnSm: {
    background: "#000000",
    color: "#ffffff",
    border: "1px solid transparent",
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Work Sans', system-ui, sans-serif",
    letterSpacing: "0.005em",
    transition: "opacity 0.15s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap"
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
    letterSpacing: "0.005em"
  },

  // INPUTS
  inp: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid #ececec",
    background: "#ffffff",
    color: "#000000",
    fontSize: 14,
    fontFamily: "'Work Sans', system-ui, sans-serif",
    fontWeight: 500,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease"
  }
};

// ============================================================
// MENÚ PRINCIPAL — copys descriptivos en minúsculas
// ============================================================
export const MENU = [
  { id: "dashboard", label: "Resumen", iconName: "LayoutDashboard" },
  { id: "facturas", label: "Facturas", iconName: "FileText" },
  { id: "clientes", label: "Clientes", iconName: "Users" },
  { id: "gastos", label: "Gastos", iconName: "Receipt" },
  { id: "gastosfijos", label: "Gastos fijos", iconName: "Repeat" },
  { id: "alertas", label: "Alertas", iconName: "Bell" },
  { id: "simulador", label: "Simulador", iconName: "Calculator" },
  { id: "autonomo", label: "Cuota autónomos", iconName: "ShieldCheck" }
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
