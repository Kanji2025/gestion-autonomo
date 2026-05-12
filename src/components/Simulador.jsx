// src/components/Simulador.jsx
// Calculadora rápida: dado una base imponible, ¿cuánto te queda limpio?
// REDISEÑO 2026: lavanda = va a Hacienda, amarillo = tu dinero real.

import { useState } from "react";
import {
  TrendingUp, TrendingDown, Receipt, PiggyBank, Info
} from "lucide-react";

import { B, fmt, calcIVA, calcIRPF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, PageHeader } from "./UI.jsx";

// ============================================================
// SUB-CARD para cada partida del breakdown
// ============================================================
function StatCard({ icon: Icon, label, value, accent = null, hint, emphasis = false }) {
  // accent: null (blanca) | "lavender" | "yellow"
  // emphasis: true → borde negro 1px (destaca como conclusión)
  const bg =
    accent === "lavender" ? B.lavender :
    accent === "yellow" ? B.yellow :
    "#fafafa";
  const border = emphasis ? B.ink : B.border;

  return (
    <div style={{
      background: bg,
      borderRadius: 16,
      border: `1px solid ${border}`,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={16} strokeWidth={2} color={B.ink} />
        <span style={{
          fontSize: 11,
          color: B.ink,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: B.font
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: B.ty.numL,
        fontWeight: 700,
        color: B.ink,
        fontFamily: B.font,
        letterSpacing: "-0.02em",
        marginTop: 10,
        ...B.num
      }}>
        {value}
      </div>
      {hint && (
        <div style={{
          fontSize: 11,
          color: B.ink,
          opacity: accent ? 0.65 : 0.55,
          fontFamily: B.font,
          marginTop: 4
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Simulador() {
  const { isMobile } = useResponsive();
  const [base, setBase] = useState(500);

  const iva = calcIVA(base);
  const irpf = calcIRPF(base);
  const tot = base + iva - irpf;
  const limpio = base - irpf;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Simulador."
        subtitle="Calcula qué te queda limpio antes de enviar un presupuesto."
      />

      {/* CSS personalizado del slider Kanji */}
      <style>{`
        input[type="range"].kn-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          background: ${B.border};
          border-radius: 999px;
          outline: none;
          cursor: pointer;
        }
        input[type="range"].kn-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${B.ink};
          cursor: pointer;
          border: 3px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
        input[type="range"].kn-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${B.ink};
          cursor: pointer;
          border: 3px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
      `}</style>

      <Card>
        <Lbl>Base imponible del presupuesto</Lbl>

        {/* Display grande */}
        <div style={{
          textAlign: "center",
          fontSize: B.ty.display,
          fontWeight: 700,
          margin: "14px 0 4px",
          fontFamily: B.font,
          color: B.ink,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          ...B.num
        }}>
          {fmt(base)}
        </div>

        {/* Input para valor exacto */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <input
            type="number"
            value={base}
            onChange={e => setBase(Number(e.target.value) || 0)}
            min="0"
            style={{
              ...B.inp,
              textAlign: "center",
              maxWidth: 160,
              fontFamily: B.font,
              fontWeight: 600,
              fontSize: 14,
              ...B.num
            }}
            onFocus={e => (e.target.style.borderColor = B.ink)}
            onBlur={e => (e.target.style.borderColor = B.border)}
          />
        </div>

        {/* Slider */}
        <input
          type="range"
          min="50"
          max="5000"
          step="10"
          value={base}
          onChange={e => setBase(Number(e.target.value))}
          className="kn-slider"
        />
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: B.muted,
          fontFamily: B.font,
          ...B.num
        }}>
          <span>50 €</span>
          <span>5.000 €</span>
        </div>

        {/* Breakdown 2x2 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: 12,
          marginTop: 26
        }}>
          <StatCard
            icon={TrendingUp}
            label="+ IVA 21%"
            value={fmt(iva)}
            accent="lavender"
            hint="Va a la Hucha de Hacienda"
          />
          <StatCard
            icon={TrendingDown}
            label="− IRPF 15%"
            value={fmt(irpf)}
            accent="lavender"
            hint="Lo retiene tu cliente para Hacienda"
          />
          <StatCard
            icon={Receipt}
            label="Total factura"
            value={fmt(tot)}
            accent={null}
            hint="Lo que cobras al cliente"
          />
          <StatCard
            icon={PiggyBank}
            label="Te queda limpio"
            value={fmt(limpio)}
            accent="yellow"
            emphasis
            hint="Antes de descontar gastos"
          />
        </div>

        {/* Aclaración */}
        <div style={{
          marginTop: 22,
          padding: "14px 16px",
          background: "#fafafa",
          border: `1px solid ${B.border}`,
          borderRadius: 12,
          fontSize: 12.5,
          color: B.ink,
          fontFamily: B.font,
          lineHeight: 1.55,
          display: "flex",
          gap: 10,
          alignItems: "flex-start"
        }}>
          <Info size={15} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: 2, color: B.muted }} />
          <div>
            <strong>Cómo se reparte: </strong>
            el cliente te paga <strong style={B.num}>{fmt(tot)}</strong> (base + IVA − IRPF retenido).
            El IVA (<strong style={B.num}>{fmt(iva)}</strong>) <strong>no es tuyo</strong>, va a la Hucha de Hacienda.
            Lo que realmente te queda como ingreso bruto es <strong style={B.num}>{fmt(limpio)}</strong>, antes de descontar tus gastos.
          </div>
        </div>
      </Card>
    </div>
  );
}
