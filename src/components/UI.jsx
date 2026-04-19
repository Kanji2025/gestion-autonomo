// src/components/UI.jsx
// Componentes reutilizables: Card, Lbl, Inp, Sel, PBar, Sem, FilterBar, Big, Sub.

import { B, fmt, MESES_FULL } from "../utils.js";

// ============================================================
// TARJETA
// ============================================================
export function Card({ children, style }) {
  return (
    <div style={{
      background: B.card,
      backdropFilter: "blur(14px)",
      borderRadius: 12,
      padding: "22px 24px",
      border: `1px solid ${B.border}`,
      ...style
    }}>
      {children}
    </div>
  );
}

// ============================================================
// TIPOGRAFÍA
// ============================================================
export function Lbl({ children }) {
  return (
    <span style={{
      fontSize: 11,
      color: B.muted,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      fontFamily: B.tM
    }}>
      {children}
    </span>
  );
}

export function Big({ children, color }) {
  return (
    <span style={{
      fontSize: 30,
      fontWeight: 700,
      color: color || B.text,
      fontFamily: B.tM,
      display: "block",
      marginTop: 4
    }}>
      {children}
    </span>
  );
}

export function Sub({ children }) {
  return (
    <span style={{
      fontSize: 12,
      color: B.muted,
      fontFamily: B.tS
    }}>
      {children}
    </span>
  );
}

// ============================================================
// SEMÁFORO DE ESTADO
// ============================================================
export function Sem({ estado }) {
  const m = {
    Cobrada: { c: B.green, l: "COBRADA" },
    Pendiente: { c: B.amber, l: "PENDIENTE" },
    Vencida: { c: B.red, l: "VENCIDA" }
  };
  const x = m[estado] || m.Pendiente;
  return (
    <span style={{
      background: x.c + "15",
      color: x.c,
      padding: "3px 10px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      fontFamily: B.tM
    }}>
      {x.l}
    </span>
  );
}

// ============================================================
// BARRA DE PROGRESO
// ============================================================
export function PBar({ value, max, label, color }) {
  const c = color || B.text;
  const pct = Math.min(((value || 0) / (max || 1)) * 100, 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: B.tS }}>
        <span style={{ color: B.text, fontWeight: 600 }}>{label}</span>
        <span style={{ color: B.muted }}>{fmt(value)} / {fmt(max)}</span>
      </div>
      <div style={{
        background: "rgba(0,0,0,0.06)",
        borderRadius: 6,
        height: 28,
        overflow: "hidden"
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 6,
          background: c,
          transition: "width 1s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 10
        }}>
          {pct > 12 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: B.tM }}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INPUT
// ============================================================
export function Inp({ label, value, onChange, type = "text", ph = "", onKey }) {
  return (
    <div>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: B.tM,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: B.muted,
        display: "block",
        marginBottom: 6
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
        style={B.inp}
        onKeyDown={onKey}
      />
    </div>
  );
}

// ============================================================
// TEXTAREA (para Notas)
// ============================================================
export function TxtArea({ label, value, onChange, ph = "", rows = 4 }) {
  return (
    <div>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: B.tM,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: B.muted,
        display: "block",
        marginBottom: 6
      }}>
        {label}
      </label>
      <textarea
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={ph}
        rows={rows}
        style={{
          ...B.inp,
          resize: "vertical",
          minHeight: 80,
          fontFamily: B.tS,
          lineHeight: 1.5
        }}
      />
    </div>
  );
}

// ============================================================
// SELECT
// ============================================================
export function Sel({ label, value, onChange, options, placeholder = "Selecciona..." }) {
  return (
    <div>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: B.tM,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: B.muted,
        display: "block",
        marginBottom: 6
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...B.inp, cursor: "pointer" }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ============================================================
// FILTRO POR FECHA (año / trimestre / mes)
// ============================================================
export function FilterBar({ filtro, setFiltro }) {
  const y = new Date().getFullYear();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={filtro.year}
        onChange={e => setFiltro({ ...filtro, year: e.target.value })}
        style={{ ...B.inp, width: "auto", padding: "8px 12px", fontSize: 12, fontFamily: B.tM }}
      >
        <option value="">Todos</option>
        {[y, y - 1, y - 2].map(v => <option key={v} value={v}>{v}</option>)}
      </select>

      <select
        value={filtro.tri}
        onChange={e => setFiltro({ ...filtro, tri: e.target.value, mes: "" })}
        style={{ ...B.inp, width: "auto", padding: "8px 12px", fontSize: 12, fontFamily: B.tM }}
      >
        <option value="">Trimestre</option>
        <option value="Q1">Q1</option>
        <option value="Q2">Q2</option>
        <option value="Q3">Q3</option>
        <option value="Q4">Q4</option>
      </select>

      <select
        value={filtro.mes}
        onChange={e => setFiltro({ ...filtro, mes: e.target.value, tri: "" })}
        style={{ ...B.inp, width: "auto", padding: "8px 12px", fontSize: 12, fontFamily: B.tM }}
      >
        <option value="">Mes</option>
        {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>

      {(filtro.year || filtro.tri || filtro.mes !== "") && (
        <button
          onClick={() => setFiltro({ year: "", tri: "", mes: "" })}
          style={{
            ...B.btnSm,
            background: "transparent",
            color: B.muted,
            border: `1px solid ${B.border}`
          }}
        >
          LIMPIAR
        </button>
      )}
    </div>
  );
}

// ============================================================
// HEADER DE SECCIÓN (h2 + acción opcional a la derecha)
// ============================================================
export function SectionHeader({ title, action }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap"
    }}>
      <h2 style={{
        fontSize: 22,
        fontWeight: 700,
        color: B.text,
        margin: 0,
        fontFamily: B.tM,
        textTransform: "uppercase"
      }}>
        {title}
      </h2>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================================
// MENSAJE DE ERROR
// ============================================================
export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: B.red + "15",
      color: B.red,
      padding: "12px 16px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600
    }}>
      {children}
    </div>
  );
}

// ============================================================
// MENSAJE DE ÉXITO
// ============================================================
export function SuccessBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: B.green + "15",
      color: B.green,
      padding: "12px 16px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600
    }}>
      {children}
    </div>
  );
}

// ============================================================
// PANTALLA DE CARGA
// ============================================================
export function LoadingScreen({ message = "Cargando..." }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: B.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: B.tM
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 14, color: B.muted, textTransform: "uppercase" }}>{message}</div>
      </div>
    </div>
  );
}
